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
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Role, Permission } from '../constant/enum.constant';
import { rolePermissionsMap } from '../constant/rolePermissionsMap.constant';
import { User } from 'src/modules/users/entity/user.entity';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly i18n: I18nService,
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { request } = GqlExecutionContext.create(context).getContext();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(await this.i18n.t('user.NO_TOKEN'));
    }

    const requiredRoles = this.getRequiredRoles(context);
    const requiredPermissions = this.getRequiredPermissions(context);

    const payload = await this.verifyToken(token);
    const user = await this.findUser(payload.id);

    const hasRole = this.validateRole(user.role, requiredRoles);
    const userPermissions = rolePermissionsMap[user.role] ?? [];
    const hasPermissions = this.validatePermissions(
      userPermissions,
      requiredPermissions,
    );

    if (!hasRole || !hasPermissions) {
      throw new UnauthorizedException(
        await this.i18n.t('user.INSUFFICIENT_PERMISSIONS'),
      );
    }

    request['user'] = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: userPermissions,
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const [type, token] = request.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }

  private async verifyToken(token: string) {
    try {
      return await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException(await this.i18n.t('user.INVALID_TOKEN'));
    }
  }

  private async findUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  private getRequiredRoles(context: ExecutionContext): Role[] {
    return (
      this.reflector.getAllAndOverride<Role[]>('roles', [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    );
  }

  private getRequiredPermissions(context: ExecutionContext): Permission[] {
    return (
      this.reflector.getAllAndOverride<Permission[]>('permissions', [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    );
  }

  private validateRole(userRole: Role, requiredRoles: Role[]): boolean {
    return requiredRoles.length === 0 || requiredRoles.includes(userRole);
  }

  private validatePermissions(
    userPermissions: Permission[],
    required: Permission[],
  ): boolean {
    return (
      required.length === 0 ||
      required.every((p) => userPermissions.includes(p))
    );
  }
}
