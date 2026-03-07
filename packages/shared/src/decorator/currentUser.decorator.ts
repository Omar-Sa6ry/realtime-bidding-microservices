import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CurrentUserMsg } from '../constant/messages.constant';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context).getContext();
    const user = ctx.req?.user;
    if (!user) {
      throw new BadRequestException(CurrentUserMsg);
    }
    return user;
  },
);
