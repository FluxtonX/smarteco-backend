import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';

interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  type: 'access' | 'refresh';
}

interface LocationUpdate {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  pickupId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/tracking',
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  // Map socketId → userId
  private connectedUsers = new Map<string, string>();
  // Map userId → socketId
  private userSockets = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── CONNECTION HANDLING ────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace(
          'Bearer ',
          '',
        );

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        throw new Error('JWT_SECRET not configured');
      }

      const payload = jwt.verify(token, secret) as JwtPayload;
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify user exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Store connection mapping
      this.connectedUsers.set(client.id, user.id);
      this.userSockets.set(user.id, client.id);

      // Attach user info to socket data
      client.data.userId = user.id;
      client.data.role = user.role;

      this.logger.log(
        `Client connected: ${client.id} (user: ${user.id}, role: ${user.role})`,
      );
    } catch (error) {
      this.logger.warn(
        `Connection rejected: ${client.id} - ${(error as Error).message}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    if (userId) {
      this.connectedUsers.delete(client.id);
      this.userSockets.delete(userId);
      this.logger.log(`Client disconnected: ${client.id} (user: ${userId})`);
    }
  }

  // ─── ROOM MANAGEMENT ────────────────────────────

  @SubscribeMessage('join:pickup')
  async handleJoinPickup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pickupId: string },
  ) {
    if (!data?.pickupId) return;

    const userId = client.data.userId as string | undefined;
    const role = client.data.role as string | undefined;
    if (!userId || !role) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    // Authorization: only pickup owner, assigned collector, or admin can join.
    const pickup = await this.prisma.pickup.findUnique({
      where: { id: data.pickupId },
      select: {
        id: true,
        userId: true,
        collectorId: true,
        collector: {
          select: {
            id: true,
            userId: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!pickup) {
      client.emit('error', { message: 'Pickup not found' });
      return;
    }

    const isOwner = pickup.userId === userId;
    const isAssignedCollector = pickup.collector?.userId === userId;
    const isAdmin = role === 'ADMIN';

    if (!isAdmin && !isOwner && !isAssignedCollector) {
      client.emit('error', { message: 'Not allowed to track this pickup' });
      return;
    }

    const roomName = `pickup:${data.pickupId}`;
    await client.join(roomName);

    this.logger.log(
      `User ${client.data.userId} joined room ${roomName}`,
    );

    client.emit('joined:pickup', {
      pickupId: data.pickupId,
      message: 'Successfully joined pickup tracking room',
    });

    // Send last known collector location immediately (if available)
    if (pickup.collector?.latitude != null && pickup.collector?.longitude != null) {
      client.emit('collector:location:broadcast', {
        collectorId: pickup.collector.id,
        latitude: pickup.collector.latitude,
        longitude: pickup.collector.longitude,
        heading: 0,
        speed: 0,
        eta: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('leave:pickup')
  async handleLeavePickup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pickupId: string },
  ) {
    if (!data?.pickupId) return;

    const roomName = `pickup:${data.pickupId}`;
    await client.leave(roomName);

    this.logger.log(
      `User ${client.data.userId} left room ${roomName}`,
    );
  }

  // ─── COLLECTOR LOCATION UPDATES ──────────────────

  @SubscribeMessage('collector:location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdate,
  ) {
    // Only collectors can broadcast location
    if (client.data.role !== 'COLLECTOR') {
      client.emit('error', { message: 'Only collectors can update location' });
      return;
    }

    const userId = client.data.userId;
    if (!userId || !data?.latitude || !data?.longitude) return;

    try {
      // Update collector location in DB
      await this.prisma.collectorProfile.updateMany({
        where: { userId },
        data: {
          latitude: data.latitude,
          longitude: data.longitude,
        },
      });

      // If a specific pickup is referenced, broadcast to that pickup room
      if (data.pickupId) {
        const pickup = await this.prisma.pickup.findUnique({
          where: { id: data.pickupId },
          select: {
            id: true,
            latitude: true,
            longitude: true,
            status: true,
            collectorId: true,
          },
        });

        if (pickup) {
          // Calculate ETA
          const distanceKm = this.haversineDistance(
            data.latitude,
            data.longitude,
            pickup.latitude,
            pickup.longitude,
          );
          const avgSpeedKmh = data.speed && data.speed > 5 ? data.speed * 3.6 : 30;
          const minutes = Math.max(
            1,
            Math.round((distanceKm / avgSpeedKmh) * 60),
          );

          const roomName = `pickup:${data.pickupId}`;
          this.server.to(roomName).emit('collector:location:broadcast', {
            collectorId: pickup.collectorId,
            latitude: data.latitude,
            longitude: data.longitude,
            heading: data.heading || 0,
            speed: data.speed || 0,
            eta: {
              minutes,
              distanceKm: Math.round(distanceKm * 10) / 10,
            },
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // Broadcast to all pickups assigned to this collector that are active
        const collectorProfile =
          await this.prisma.collectorProfile.findUnique({
            where: { userId },
            select: { id: true },
          });

        if (collectorProfile) {
          const activePickups = await this.prisma.pickup.findMany({
            where: {
              collectorId: collectorProfile.id,
              status: {
                in: ['COLLECTOR_ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'],
              },
            },
            select: {
              id: true,
              latitude: true,
              longitude: true,
            },
          });

          for (const pickup of activePickups) {
            const distanceKm = this.haversineDistance(
              data.latitude,
              data.longitude,
              pickup.latitude,
              pickup.longitude,
            );
            const avgSpeedKmh = 30;
            const minutes = Math.max(
              1,
              Math.round((distanceKm / avgSpeedKmh) * 60),
            );

            const roomName = `pickup:${pickup.id}`;
            this.server.to(roomName).emit('collector:location:broadcast', {
              collectorId: collectorProfile.id,
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading || 0,
              speed: data.speed || 0,
              eta: {
                minutes,
                distanceKm: Math.round(distanceKm * 10) / 10,
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to update collector location: ${(error as Error).message}`,
      );
    }
  }

  // ─── PICKUP STATUS BROADCAST (called from service) ──

  /**
   * Called programmatically from CollectorsService when a pickup status changes.
   * Broadcasts the status change to all clients in the pickup room.
   */
  broadcastStatusChange(
    pickupId: string,
    status: string,
    metadata?: Record<string, unknown>,
  ) {
    const roomName = `pickup:${pickupId}`;
    this.server.to(roomName).emit('pickup:status:changed', {
      pickupId,
      status,
      timestamp: new Date().toISOString(),
      ...metadata,
    });

    this.logger.log(`Broadcast status change: ${pickupId} → ${status}`);
  }

  // ─── HELPERS ─────────────────────────────────────

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
