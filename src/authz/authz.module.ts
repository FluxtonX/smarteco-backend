import { Module, Global } from '@nestjs/common';
import { AbilityFactory, PolicyGuard } from './policy';
import { FieldMaskInterceptor, AuthzAuditInterceptor } from './interceptors';

@Global()
@Module({
  providers: [
    AbilityFactory,
    PolicyGuard,
    FieldMaskInterceptor,
    AuthzAuditInterceptor,
  ],
  exports: [
    AbilityFactory,
    PolicyGuard,
    FieldMaskInterceptor,
    AuthzAuditInterceptor,
  ],
})
export class AuthzModule {}
