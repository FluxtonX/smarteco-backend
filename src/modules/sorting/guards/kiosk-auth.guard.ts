import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class KioskAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Invalid Authorization header format. Use "Bearer <token>"',
      );
    }

    const kiosk = await this.prisma.kiosk.findUnique({
      where: { apiKey: token },
    });

    if (!kiosk || kiosk.status === 'INACTIVE') {
      throw new UnauthorizedException('Invalid or inactive Kiosk API key');
    }

    // Attach kiosk information to the request for controller access
    request.kiosk = kiosk;

    // Keep lastSeenAt updated asynchronously
    this.prisma.kiosk
      .update({
        where: { id: kiosk.id },
        data: { lastSeenAt: new Date() },
      })
      .catch((err) => {
        // Log error but do not fail the request
        console.error(`Failed to update kiosk lastSeenAt: ${err.message}`);
      });

    return true;
  }
}
