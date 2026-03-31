import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class AppResolver {
  @Query(() => String)
  aiHello(): string {
    return 'Hello, in AI Service!';
  }
}
