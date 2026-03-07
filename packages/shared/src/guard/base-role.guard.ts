import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Permission, Role } from '../constant/enum.constant';
import { PERMISSIONS_KEY } from '../decorator/auth.decorator';

/**
 * Base RoleGuard – extend this in each service and provide the User repo.
 *
 * class RoleGuard extends BaseRoleGuard {
 *   protected async findUser(id: string) {
 *     return this.userRepo.findOneOrFail({ where: { id } });
 *   }
 * }
 */
@Injectable()
export abstract class BaseRoleGuard implements CanActivate {
  constructor(
    protected readonly jwtService: JwtService,
    protected readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { request } = GqlExecutionContext.create(context).getContext();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? [];

    const payload = await this.verifyToken(token);
    const user = await this.findUser(payload.id);

    const rolePermissions = this.getRolePermissions(user.role);
    const hasPermissions =
      requiredPermissions.length === 0 ||
      requiredPermissions.every((p) => rolePermissions.includes(p));

    if (!hasPermissions) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    request['user'] = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: rolePermissions,
    };

    return true;
  }

  protected abstract findUser(id: string): Promise<{ id: string; email: string; role: Role }>;
  protected abstract getRolePermissions(role: Role): Permission[];

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }

  private async verifyToken(token: string) {
    try {
      return await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
