import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class AppResolver {
  @Query(() => String)
  notificationHello(): string {
    return 'Hello, in Notification Service!';
  }
}
