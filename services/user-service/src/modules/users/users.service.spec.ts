import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { Transaction } from './entity/transaction.entity';
import { RedisService } from '@bts-soft/core';
import { I18nService } from 'nestjs-i18n';
import { NotFoundException } from '@nestjs/common';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

describe('UserService', () => {
  let service: UserService;

  const mockUserRepository = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockTransactionRepository = {
    save: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockI18nService = {
    t: jest.fn((key: string) => `translated: ${key}`),
  };

  beforeEach(async () => {
    // Clear mocks to prevent state leakage between tests
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return user from redis cache if available', async () => {
      const cachedUser = { id: 'user-1', email: 'omar@test.com' };
      mockRedisService.get.mockResolvedValueOnce({ data: cachedUser });

      const result = await service.findById('user-1');
      expect(result.data).toEqual(cachedUser);
      expect(mockRedisService.get).toHaveBeenCalledWith('user:user-1');
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from DB if not in cache, then update cache', async () => {
      const dbUser = { id: 'user-2', email: 'db@db.com' };
      mockRedisService.get.mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValueOnce(dbUser);

      const result = await service.findById('user-2');

      expect(result.data).toEqual(dbUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-2' },
      });
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found in Cache or DB', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('invalid-id')).rejects.toThrow(
        'translated: user.NOT_FOUND',
      );
    });
  });
});
