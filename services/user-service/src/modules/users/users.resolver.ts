import { UserService } from 'src/modules/users/users.service';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UpdateUserDto } from './inputs/UpdateUser.dto';
import { Permission } from 'src/common/constant/enum.constant';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { Auth } from 'src/common/decorator/auth.decorator';
import { EmailInput, UserIdInput } from './inputs/user.input';
import { User } from './entity/user.entity';
import { CurrentUserDto } from '@bts-soft/core';
import {
  UsersResponse,
  UserCountPercentageResponse,
  UserResponse,
} from './dto/UserResponse.dto';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query((returns) => UserResponse)
  async getUserById(@Args('id') id: UserIdInput): Promise<UserResponse> {
    return this.userService.findById(id.UserId);
  }

  @Query((returns) => UserResponse)
  @Auth([])
  async getUserByOfMe(
    @CurrentUser() user: CurrentUserDto,
  ): Promise<UserResponse> {
    return this.userService.findById(user.id);
  }

  @Query((returns) => UserResponse)
  @Auth([Permission.VIEW_USER])
  async getUserByEmail(
    @Args('email') email: EmailInput,
  ): Promise<UserResponse> {
    return this.userService.findByEmail(email.email);
  }

  @Query((returns) => UsersResponse)
  @Auth([Permission.VIEW_USER])
  async getUsers(
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<UsersResponse> {
    return await this.userService.findUsers(page, limit);
  }

  @Query((returns) => UserCountPercentageResponse)
  async getUsersCount(): Promise<UserCountPercentageResponse> {
    return await this.userService.getUsersCount();
  }

  @Query((returns) => UserResponse)
  @Auth([])
  async getMyProfile(
    @CurrentUser() user: CurrentUserDto,
  ): Promise<UserResponse> {
    return await this.userService.findById(user.id);
  }

  @Mutation((returns) => UserResponse)
  @Auth([])
  async updateProfile(
    @CurrentUser() user: CurrentUserDto,
    @Args('updateUserDto') updateUserDto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.userService.update(updateUserDto, user.id);
  }

  @Mutation((returns) => UserResponse)
  @Auth([Permission.UPDATE_USER])
  async updateUser(
    @CurrentUser() user: CurrentUserDto,
    @Args('updateUserDto') updateUserDto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.userService.update(updateUserDto, user.id);
  }

  @Query((returns) => UserResponse)
  @Auth([Permission.DELETE_USER])
  async deleteUser(@Args('id') id: UserIdInput): Promise<UserResponse> {
    return await this.userService.deleteUser(id.UserId);
  }

  @Mutation((returns) => UserResponse)
  @Auth([Permission.EDIT_USER_ROLE])
  async UpdateUserRoleToAdmin(
    @Args('id') id: UserIdInput,
  ): Promise<UserResponse> {
    return await this.userService.editUserRole(id.UserId);
  }

  @Mutation((returns) => UserResponse)
  @Auth([Permission.UPDATE_USER])
  async updateInstructor(
    @Args('id') id: UserIdInput,
    @Args('updateUserDto') updateUserDto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.userService.update(updateUserDto, id.UserId);
  }
}
