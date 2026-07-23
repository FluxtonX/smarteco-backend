import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }

    if (user.role !== 'ADMIN' || user.subRole !== 'Super Admin') {
      throw new ForbiddenException(
        'Access denied. Only Super Admin can access the simulation environment.',
      );
    }

    return true;
  }
}
