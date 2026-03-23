import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  moderatorId: string;
  userId: string;
  region: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: { query?: Record<string, string | string[] | undefined> }) => {
          const accessToken = request?.query?.access_token;
          if (typeof accessToken === 'string' && accessToken.length > 0) {
            return accessToken;
          }

          const token = request?.query?.token;
          return typeof token === 'string' && token.length > 0 ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'super-secret-change-me'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
