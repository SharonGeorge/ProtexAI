import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Region } from '../../common/enums/region.enum';
import { Moderator } from './moderator.entity';

@Injectable()
export class ModeratorsService {
  constructor(
    @InjectRepository(Moderator)
    private readonly moderatorRepository: Repository<Moderator>,
  ) {}

  async findOrCreateByUserIdAndRegion(userId: string, region: Region): Promise<Moderator> {
    const existing = await this.moderatorRepository.findOne({ where: { userId } });
    if (existing) {
      if (existing.region !== region) {
        existing.region = region;
        return this.moderatorRepository.save(existing);
      }
      return existing;
    }

    const moderator = this.moderatorRepository.create({ userId, region });
    return this.moderatorRepository.save(moderator);
  }
}
