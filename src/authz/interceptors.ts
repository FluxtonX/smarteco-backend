/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FieldMaskInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<any>();
    const maskedFields: string[] = req.policy?.maskedFields || [];

    if (!maskedFields.length) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (!data) return data;
        return this.maskObject(data, maskedFields);
      }),
    );
  }

  private maskObject(obj: any, maskedFields: string[]): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskObject(item, maskedFields));
    }
    if (obj && typeof obj === 'object') {
      if (
        (obj as any).data &&
        (Array.isArray((obj as any).data) || typeof (obj as any).data === 'object')
      ) {
        return {
          ...obj,
          data: this.maskObject((obj as any).data, maskedFields),
        };
      }
      const newObj = { ...obj };
      for (const field of maskedFields) {
        if (field in newObj && (newObj as Record<string, unknown>)[field] != null) {
          (newObj as Record<string, unknown>)[field] = '[REDACTED]';
        }
      }
      return newObj;
    }
    return obj;
  }
}

@Injectable()
export class AuthzAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<any>();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.logAudit(req, 'ALLOW', null);
        },
        error: (err: any) => {
          void this.logAudit(req, 'DENY', err?.message || 'Access Denied');
        },
      }),
    );
  }

  private async logAudit(req: any, outcome: string, reason: string | null) {
    try {
      const user = req.user;
      if (!user) return;

      const actorId = (user.userId || user.id || 'anonymous') as string;
      const orgId = (user.orgId || 'org-kigali-01') as string;
      const path = (req.route?.path || req.url || '') as string;

      let domain = 'operations';
      if (
        path.includes('finance') ||
        path.includes('payment') ||
        path.includes('refund')
      ) {
        domain = 'finance';
      } else if (
        path.includes('iot') ||
        path.includes('device') ||
        path.includes('sensor')
      ) {
        domain = 'device';
      } else if (path.includes('support') || path.includes('ticket')) {
        domain = 'support';
      }

      const subject = req.policy?.ability
        ? 'AuthorizedResource'
        : 'ApiEndpoint';
      const action = req.method ? (req.method as string).toLowerCase() : 'request';

      await this.prisma.authzAuditLog.create({
        data: {
          actorId,
          orgId,
          domain,
          subject,
          action,
          targetId: (req.params?.id as string) || null,
          outcome,
          reason: reason || (req.policy?.requirements?.join(',') as string) || null,
          ip: (req.ip || req.connection?.remoteAddress || null) as string,
          userAgent: (req.headers ? req.headers['user-agent'] || null : null) as string,
        },
      });
    } catch {
      // Non-blocking audit log catch
    }
  }
}
