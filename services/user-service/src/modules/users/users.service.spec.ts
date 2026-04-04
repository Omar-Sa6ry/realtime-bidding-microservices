import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { Transaction } from './entity/transaction.entity';
import { RedisService } from '@bts-soft/core';
import { I18nService } from 'nestjs-i18n';
import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';

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

  describe('findByIds', () => {
    it('should return empty array if no ids are provided', async () => {
      const result = await service.findByIds([]);
      expect(result).toEqual([]);
      expect(mockUserRepository.find).not.toHaveBeenCalled();
    });

    it('should return users if ids are provided', async () => {
      const users = [{ id: 'user-1', email: 'omar@test.com' }];
      mockUserRepository.find.mockResolvedValueOnce(users);

      const result = await service.findByIds(['user-1']);
      expect(result).toEqual(users);
      expect(mockUserRepository.find).toHaveBeenCalledWith({
        where: { id: In(['user-1']) },
      });
    });
  });

  describe('findByEmail', () => {
    it('should return user from redis cache if available', async () => {
      const cachedUser = { id: 'user-1', email: 'omar@test.com' };
      mockRedisService.get.mockResolvedValueOnce({ data: cachedUser });

      const result = await service.findByEmail('omar@test.com');
      expect(result.data).toEqual(cachedUser);
      expect(mockRedisService.get).toHaveBeenCalledWith(
        'user:email:omar@test.com',
      );
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from DB if not in cache, then update cache', async () => {
      const dbUser = { id: 'user-2', email: 'db@db.com' };
      mockRedisService.get.mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValueOnce(dbUser);

      const result = await service.findByEmail('db@db.com');
      expect(result.data).toEqual(dbUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'db@db.com' },
      });
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found in Cache or DB', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findByEmail('invalid@email.com')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByEmail('invalid@email.com')).rejects.toThrow(
        'translated: user.NOT_FOUND',
      );
    });
  });

  describe('findUsers', () => {
    it('should return users with pagination', async () => {
      const users = [{ id: 'user-1', email: 'omar@test.com' }];
      mockUserRepository.findAndCount.mockResolvedValueOnce([users, 1]);

      const result = await service.findUsers();
      expect(result.items).toEqual(users);
      expect(result.pagination).toEqual({
        totalItems: 1,
        currentPage: 1,
        totalPages: 1,
      });
    });

    it('should return users with pagination and filters', async () => {
      const users = [{ id: 'user-1', email: 'omar@test.com' }];
      mockUserRepository.findAndCount.mockResolvedValueOnce([users, 1]);

      const result = await service.findUsers(1, 10);
      expect(result.items).toEqual(users);
      expect(result.pagination).toEqual({
        totalItems: 1,
        currentPage: 1,
        totalPages: 1,
      });
    });
  });

  describe('getUsersCount', () => {
    it('should return users count from redis cache if available', async () => {
      const cachedCount = {
        totalUsers: 10,
        usersThisMonth: 5,
        percentageIncrease: 10,
      };
      mockRedisService.get.mockResolvedValueOnce(cachedCount);

      const result = await service.getUsersCount();
      expect(result.data).toEqual(cachedCount);
      expect(mockRedisService.get).toHaveBeenCalledWith('user-count');
      expect(mockUserRepository.count).not.toHaveBeenCalled();
    });

    it('should fetch from DB if not in cache, then update cache', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      mockUserRepository.count.mockResolvedValueOnce(10);
      mockUserRepository.count.mockResolvedValueOnce(5);
      mockUserRepository.count.mockResolvedValueOnce(0);

      const result = await service.getUsersCount();

      expect(result.data).toEqual({
        totalUsers: 10,
        usersThisMonth: 5,
        percentageIncrease: 100,
      });
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should calculate percentage increase correctly when last month has users', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      mockUserRepository.count.mockResolvedValueOnce(10);
      mockUserRepository.count.mockResolvedValueOnce(2);
      mockUserRepository.count.mockResolvedValueOnce(1);
      const result = await service.getUsersCount();

      expect(result.data).toEqual({
        totalUsers: 10,
        usersThisMonth: 2,
        percentageIncrease: 100,
      });
    });
  });
});
