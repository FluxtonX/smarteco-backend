import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom parameter decorator to extract the current authenticated user
 * from the request object.
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 *
 * @Get('profile')
 * getUserId(@CurrentUser('id') userId: string) {
 *   return userId;
 * }
 */

export interface AuthenticatedUser {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  userType: string;
  role: string;
  referralCode: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  [key: string]: unknown;
}

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user: AuthenticatedUser | undefined = request.user;

    return data ? user?.[data] : user;
  },
);
