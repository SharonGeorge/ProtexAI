import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthResponse } from './models/auth-response.model';
import { Region } from '../../common/enums/region.enum';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthResponse)
  login(
    @Args('userId', { type: () => String }) userId: string,
    @Args('region', { type: () => Region }) region: Region,
  ) {
    return this.authService.login({ userId, region });
  }
}
