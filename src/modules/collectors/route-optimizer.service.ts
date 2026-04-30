import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface RoutePoint {
  id: string;
  latitude: number;
  longitude: number;
}

@Injectable()
export class RouteOptimizerService {
  private readonly logger = new Logger(RouteOptimizerService.name);

  constructor(private readonly configService: ConfigService) {}

  async optimize(
    start: { latitude: number; longitude: number } | null,
    points: RoutePoint[],
  ): Promise<RoutePoint[]> {
    if (!start || points.length <= 1) return points;

    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY') || '';
    if (!apiKey) {
      return this.greedyOptimize(start, points);
    }

    try {
      // Lightweight matrix request (fallback to greedy if any error)
      const origin = `${start.latitude},${start.longitude}`;
      const destinations = points
        .map((p) => `${p.latitude},${p.longitude}`)
        .join('|');
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
        origin,
      )}&destinations=${encodeURIComponent(destinations)}&key=${apiKey}`;
      const response = await axios.get<{
        rows?: Array<{ elements?: Array<{ distance?: { value?: number } }> }>;
        status?: string;
      }>(url, { timeout: 5000 });
      if (
        response.data.status === 'OK' &&
        response.data.rows?.[0]?.elements?.length === points.length
      ) {
        const pairs = points.map((p, idx) => ({
          p,
          d:
            response.data.rows?.[0]?.elements?.[idx]?.distance?.value ??
            Number.MAX_SAFE_INTEGER,
        }));
        pairs.sort((a, b) => a.d - b.d);
        return pairs.map((x) => x.p);
      }
    } catch (e) {
      this.logger.warn(
        `Distance matrix failed, using greedy fallback: ${(e as Error).message}`,
      );
    }

    return this.greedyOptimize(start, points);
  }

  private greedyOptimize(
    start: { latitude: number; longitude: number },
    points: RoutePoint[],
  ) {
    const remaining = [...points];
    const route: RoutePoint[] = [];
    let curLat = start.latitude;
    let curLon = start.longitude;

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const d = this.haversineDistance(
          curLat,
          curLon,
          remaining[i].latitude,
          remaining[i].longitude,
        );
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      route.push(next);
      curLat = next.latitude;
      curLon = next.longitude;
    }

    return route;
  }

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

