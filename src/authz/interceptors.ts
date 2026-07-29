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
    const req = context.switchToHttp().getRequest();
    const maskedFields: string[] = req.policy?.maskedFields || [];

    if (!maskedFields.length) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
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
      if (obj.data && (Array.isArray(obj.data) || typeof obj.data === 'object')) {
        return {
          ...obj,
          data: this.maskObject(obj.data, maskedFields),
        };
      }
      const newObj = { ...obj };
      for (const field of maskedFields) {
        if (field in newObj && newObj[field] != null) {
          newObj[field] = '[REDACTED]';
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
    const req = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logAudit(req, 'ALLOW', null),
        error: (err) => this.logAudit(req, 'DENY', err.message),
      }),
    );
  }

  private async logAudit(req: any, outcome: string, reason: string | null) {
    try {
      const user = req.user;
      if (!user) return;

      const actorId = user.userId || user.id || 'anonymous';
      const orgId = user.orgId || 'org-kigali-01';
      const path = req.route?.path || req.url || '';
      
      let domain = 'operations';
      if (path.includes('finance') || path.includes('payment') || path.includes('refund')) {
        domain = 'finance';
      } else if (path.includes('iot') || path.includes('device') || path.includes('sensor')) {
        domain = 'device';
      } else if (path.includes('support') || path.includes('ticket')) {
        domain = 'support';
      }

      const subject = req.policy?.ability ? 'AuthorizedResource' : 'ApiEndpoint';
      const action = req.method ? req.method.toLowerCase() : 'request';

      await this.prisma.authzAuditLog.create({
        data: {
          actorId,
          orgId,
          domain,
          subject,
          action,
          targetId: req.params?.id || null,
          outcome,
          reason: reason || req.policy?.requirements?.join(',') || null,
          ip: req.ip || req.connection?.remoteAddress || null,
          userAgent: req.headers ? req.headers['user-agent'] || null : null,
        },
      });
    } catch (e) {
      // Non-blocking audit log catch
    }
  }
}
