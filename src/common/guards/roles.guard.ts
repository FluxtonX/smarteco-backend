import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    private readonly logger = new Logger(RolesGuard.name);

    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // If no roles are specified, allow access
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            this.logger.warn('RolesGuard: No user found in request');
            return false;
        }

        const hasRole = requiredRoles.some((role) => user.role === role);

        if (!hasRole) {
            this.logger.warn(
                `RolesGuard: User ${user.id} with role ${user.role} denied access. Required: ${requiredRoles.join(', ')}`,
            );
        }

        return hasRole;
    }
}
