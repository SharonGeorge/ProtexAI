import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { ModeratorsService } from '../moderators/moderators.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly moderatorsService: ModeratorsService,
    private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginDto) {
    const moderator = await this.moderatorsService.findOrCreateByUserIdAndRegion(
      input.userId,
      input.region,
    );

    const accessToken = await this.jwtService.signAsync({
      moderatorId: moderator.id,
      userId: moderator.userId,
      region: moderator.region,
    });

    return { accessToken, moderator };
  }
}
