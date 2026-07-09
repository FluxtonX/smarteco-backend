import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Custom decorator to set required roles for a route handler.
 *
 * @example
 * @Roles(UserRole.ADMIN)
 * @Get('admin/users')
 * getUsers() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
