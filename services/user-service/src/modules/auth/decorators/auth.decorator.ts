import { applyDecorators, UseGuards } from '@nestjs/common';
import { Auth as SharedAuth, Permission } from '@bidding-micro/shared';
import { RoleGuard } from '../guards/role.guard';

export function Auth(permissions: Permission[] = []) {
  return applyDecorators(
    SharedAuth(permissions),
    UseGuards(RoleGuard),
  );
}
