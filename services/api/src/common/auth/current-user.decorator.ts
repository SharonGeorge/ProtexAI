import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './jwt.strategy';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const gqlContext = GqlExecutionContext.create(ctx);
    const request = gqlContext.getContext()?.req ?? ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
