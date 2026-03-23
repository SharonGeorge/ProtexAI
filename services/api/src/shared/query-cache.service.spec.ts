import { QueryCacheService } from './query-cache.service';

describe('QueryCacheService', () => {
  let service: QueryCacheService;

  beforeEach(() => {
    service = new QueryCacheService();
  });

  it('returns cached values within the ttl window', async () => {
    const loader = jest.fn().mockResolvedValue({ ok: true });

    const first = await service.getOrSet('events:ASIA', loader, 1_000);
    const second = await service.getOrSet('events:ASIA', loader, 1_000);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invalidates all keys by prefix', async () => {
    const asiaLoader = jest.fn().mockResolvedValue(['asia']);
    const europeLoader = jest.fn().mockResolvedValue(['europe']);

    await service.getOrSet('events:available:ASIA', asiaLoader, 10_000);
    await service.getOrSet('events:available:EUROPE', europeLoader, 10_000);

    service.invalidateByPrefix('events:available:ASIA');

    await service.getOrSet('events:available:ASIA', asiaLoader, 10_000);
    await service.getOrSet('events:available:EUROPE', europeLoader, 10_000);

    expect(asiaLoader).toHaveBeenCalledTimes(2);
    expect(europeLoader).toHaveBeenCalledTimes(1);
  });
});