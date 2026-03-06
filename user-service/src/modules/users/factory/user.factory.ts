import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from '../inputs/UpdateUser.dto';
import { User } from '../entity/user.entity';

@Injectable()
export class UserFactory {
  static update(
    user: User,
    updateUserDto: UpdateUserDto,
    newAvatarPath?: string,
  ): User {
    const { avatar, ...otherData } = updateUserDto;
    Object.assign(user, otherData);
    if (newAvatarPath) {
      user.avatar = newAvatarPath;
    }
    return user;
  }
}
