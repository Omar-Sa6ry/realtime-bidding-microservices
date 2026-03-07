import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRoleGuard, Permission, Role, rolePermissionsMap } from '@bidding-micro/shared';
import { User } from '../../users/entity/user.entity';

@Injectable()
export class RoleGuard extends BaseRoleGuard {
  constructor(
    protected readonly jwtService: JwtService,
    protected readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super(jwtService, reflector);
  }

  protected async findUser(id: string) {
    return await this.userRepo.findOneOrFail({ where: { id } });
  }

  protected getRolePermissions(role: Role): Permission[] {
    return rolePermissionsMap[role] ?? [];
  }
}
