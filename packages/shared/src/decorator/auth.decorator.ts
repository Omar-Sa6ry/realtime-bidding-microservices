import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Permission } from '../constant/enum.constant';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Shorthand decorator that sets required permissions and applies RoleGuard.
 * Usage: @Auth([Permission.DELETE_USER])
 *
 * NOTE: Import RoleGuard from your service's own common/guard folder,
 *       as it needs access to the service's User entity and DB.
 */
export function Auth(permissions: Permission[] = []) {
  return applyDecorators(SetMetadata(PERMISSIONS_KEY, permissions));
}
