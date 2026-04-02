import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    return { 
      req: ctx.req || ctx.request, 
      res: ctx.res || ctx.response 
    };
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown-ip';
  }
}
