import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	getRequest(context: ExecutionContext) {
		if (context.getType<'graphql' | 'http'>() === 'graphql') {
			const gqlContext = GqlExecutionContext.create(context);
			return gqlContext.getContext().req;
		}
		return context.switchToHttp().getRequest();
	}
}
