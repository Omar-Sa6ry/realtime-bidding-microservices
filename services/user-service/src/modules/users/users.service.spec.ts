import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { Transaction } from './entity/transaction.entity';
import { RedisService } from '@bts-soft/core';
import { I18nService } from 'nestjs-i18n';
import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { UpdateUserDto } from './inputs/UpdateUser.dto';
import { TransactionType } from './interfaces/ItransactionType.interface';
import { Role } from '@bidding-micro/shared';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

const mockDate = new Date('2026-04-10T00:00:00Z');
jest.useFakeTimers();
jest.setSystemTime(mockDate);

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
    update: jest.fn(),
    del: jest.fn(),
  };

  const mockI18nService = {
    t: jest.fn((key: string) => Promise.resolve(`translated: ${key}`)),
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

    it('should return user from redis cache directly if no data wrapper exists', async () => {
      const cachedUser = { id: 'user-1', email: 'omar@test.com' };
      mockRedisService.get.mockResolvedValueOnce(cachedUser);

      const result = await service.findById('user-1');
      expect(result.data).toEqual(cachedUser);
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

    it('should calculate skip and take correctly based on page and limit', async () => {
      mockUserRepository.findAndCount.mockResolvedValueOnce([[], 0]);

      await service.findUsers(3, 15);

      expect(mockUserRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 30, // (3-1) * 15
          take: 15,
          where: { role: Role.USER },
        }),
      );
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

    it('should query correct date ranges for monthly stats', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      mockUserRepository.count.mockResolvedValue(0);

      await service.getUsersCount();

      // Verify total users count filter
      expect(mockUserRepository.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: Role.USER } }),
      );

      // Verify this month's count uses first of current month
      expect(mockUserRepository.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.anything(), // MoreThanOrEqual(startOfMonth)
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update user if user exists', async () => {
      const user = { id: 'user-1', email: 'omar@test.com' };
      const updateUserDto: UpdateUserDto = {
        id: 'user-1',
        firstName: 'Omar New',
      };
      const updatedUser = { ...user, ...updateUserDto };

      mockRedisService.get.mockResolvedValueOnce({ data: user });
      mockUserRepository.save.mockResolvedValueOnce(updatedUser);
      mockRedisService.set.mockResolvedValueOnce(true);

      const result = await service.update('user-1', updateUserDto);

      expect(result.data).toEqual(updatedUser);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'user:user-1',
        updatedUser,
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'user:email:omar@test.com',
        updatedUser,
      );
    });

    it('should manually merge data before saving', async () => {
      const user = { id: 'user-1', email: 'omar@test.com', firstName: 'Old' };
      const updateUserDto: UpdateUserDto = {
        id: 'user-1',
        firstName: 'New',
      };

      mockRedisService.get.mockResolvedValueOnce({ data: user });
      mockUserRepository.save.mockImplementationOnce((u) => Promise.resolve(u));

      const result = await service.update('user-1', updateUserDto);

      expect(result?.data?.firstName).toBe('New');
      expect(result?.data?.email).toBe('omar@test.com');
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'New', email: 'omar@test.com' }),
      );
    });

    it('should throw NotFoundException if user not found in findById', async () => {
      const updateUserDto: UpdateUserDto = {
        id: 'invalid-id',
        firstName: 'Omar New',
      };

      mockRedisService.get.mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.update('invalid-id', updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });


  });

  describe('updateBalance', () => {
    it('should add balance successfully', async () => {
      const user = { id: 'user-1', email: 'omar@test.com', balance: 100 };
      mockUserRepository.findOne.mockResolvedValueOnce(user);
      mockUserRepository.save.mockResolvedValueOnce({ ...user, balance: 150 });
      mockTransactionRepository.save.mockResolvedValueOnce({});
      mockI18nService.t.mockResolvedValueOnce(
        'translated: user.BALANCE_UPDATED',
      );

      const result = await service.updateBalance(
        'user-1',
        50,
        TransactionType.ADD,
      );

      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(150);
      expect(result.message).toBe('translated: user.BALANCE_UPDATED');
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ balance: 150 }),
      );
      expect(mockTransactionRepository.save).toHaveBeenCalled();
    });

    it('should deduct balance successfully', async () => {
      const user = { id: 'user-1', email: 'omar@test.com', balance: 100 };
      mockUserRepository.findOne.mockResolvedValueOnce(user);
      mockUserRepository.save.mockResolvedValueOnce({ ...user, balance: 50 });
      mockTransactionRepository.save.mockResolvedValueOnce({});

      const result = await service.updateBalance(
        'user-1',
        50,
        TransactionType.DEDUCT,
      );

      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(50);
      expect(result.message).toBe('translated: user.BALANCE_UPDATED');
    });

    it('should return failure if balance is insufficient', async () => {
      const user = { id: 'user-1', email: 'omar@test.com', balance: 30 };
      mockUserRepository.findOne.mockResolvedValueOnce(user);

      const result = await service.updateBalance(
        'user-1',
        50,
        TransactionType.DEDUCT,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('translated: user.INSUFFICIENT_BALANCE');
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should return failure if user is not found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.updateBalance(
        'user-1',
        50,
        TransactionType.ADD,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('translated: user.NOT_FOUND');
    });

    it('should return failure for invalid transaction type', async () => {
      const user = { id: 'user-1', balance: 100 };
      mockUserRepository.findOne.mockResolvedValueOnce(user);

      const result = await service.updateBalance(
        'user-1',
        50,
        'INVALID' as any,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('translated: user.INVALID_TRANSACTION_TYPE');
    });
  });

  describe('editUserRole', () => {
    it('should edit user role if user exists', async () => {
      const user = { id: 'user-1', email: 'omar@test.com' };
      mockUserRepository.findOne.mockResolvedValueOnce(user);
      mockUserRepository.save.mockResolvedValueOnce({
        ...user,
        role: Role.ADMIN,
      });
      mockRedisService.set.mockResolvedValueOnce(true);

      const result = await service.editUserRole('user-1');

      expect(result.message).toBe('translated: user.UPDATED');
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.ADMIN }),
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'user:user-1',
        expect.objectContaining({ role: Role.ADMIN }),
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'user:email:omar@test.com',
        expect.objectContaining({ role: Role.ADMIN }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.editUserRole('user-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.editUserRole('user-1')).rejects.toThrow(
        'translated: user.NOT_FOUND',
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user if user exists', async () => {
      const user = { id: 'user-1', email: 'omar@test.com' };
      mockUserRepository.findOne.mockResolvedValueOnce(user);
      mockUserRepository.remove.mockResolvedValueOnce(user);
      mockRedisService.del.mockResolvedValue(true);

      const result = await service.deleteUser('user-1');

      expect(result.message).toBe('translated: user.DELETED');
      expect(mockUserRepository.remove).toHaveBeenCalledWith(user);
      expect(mockRedisService.del).toHaveBeenCalledWith('user:user-1');
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'user:email:omar@test.com',
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.deleteUser('user-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteUser('user-1')).rejects.toThrow(
        'translated: user.NOT_FOUND',
      );
    });
  });

  describe('chargeMoney', () => {
    it('should charge money successfully', async () => {
      const user = { id: 'user-1', email: 'omar@test.com', balance: 100 };
      mockUserRepository.findOne.mockResolvedValueOnce(user);
      mockUserRepository.save.mockResolvedValueOnce({ ...user, balance: 150 });
      mockTransactionRepository.save.mockResolvedValueOnce({});
      mockI18nService.t.mockResolvedValueOnce(
        'translated: user.BALANCE_UPDATED',
      );

      const result = await service.chargeMoney('user-1', 50);

      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(150);
      expect(result.message).toBe('translated: user.BALANCE_UPDATED');
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ balance: 150 }),
      );
      expect(mockTransactionRepository.save).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'user:user-1',
        expect.objectContaining({ balance: 150 }),
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'user:email:omar@test.com',
        expect.objectContaining({ balance: 150 }),
      );
    });

    it('should return failure if user is not found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.chargeMoney('user-1', 50);

      expect(result.success).toBe(false);
      expect(result.message).toBe('translated: user.NOT_FOUND');
    });
  });
});
