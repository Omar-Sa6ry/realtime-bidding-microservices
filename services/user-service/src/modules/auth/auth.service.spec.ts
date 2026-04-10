import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { I18nService } from 'nestjs-i18n';
import { UserService } from '../users/users.service';
import { RedisService, NotificationService } from '@bts-soft/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entity/user.entity';
import { BadRequestException } from '@nestjs/common';
import { MoreThan } from 'typeorm';

// Mock PasswordServiceAdapter
const mockPasswordStrategy = {
  hash: jest.fn(),
  compare: jest.fn(),
};

jest.mock('./adapter/password.adapter', () => ({
  PasswordServiceAdapter: jest.fn().mockImplementation(() => mockPasswordStrategy),
}));

// Mock Transactional decorator
jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockI18n = {
    t: jest.fn((key: string) => Promise.resolve(`translated: ${key}`)),
  };

  const mockUserService = {
    findByEmail: jest.fn(),
  };

  const mockRedisService = {
    set: jest.fn(),
  };

  const mockNotificationService = {};

  const mockUserRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: I18nService, useValue: mockI18n },
        { provide: UserService, useValue: mockUserService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: NotificationService, useValue: mockNotificationService },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('should generate otp and save user if found', async () => {
      const user = { id: 'user-1', email: 'test@test.com' } as User;
      mockUserService.findByEmail.mockResolvedValueOnce({ data: user });
      mockUserRepository.save.mockResolvedValueOnce(user);

      const result = await service.forgotPassword('test@test.com');

      expect(result.message).toBe('translated: user.SEND_MSG');
      expect(user.resetToken).toBeDefined();
      expect(user.resetToken?.length).toBe(6);
      expect(user.resetTokenExpiry).toBeDefined();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUserService.findByEmail.mockResolvedValueOnce({ data: null });

      await expect(service.forgotPassword('invalid@test.com')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password if token is valid', async () => {
      const user = { id: 'user-1', email: 'test@test.com' } as User;
      mockUserRepository.findOne.mockResolvedValueOnce(user);
      mockPasswordStrategy.hash.mockResolvedValueOnce('hashed_pass');
      mockUserRepository.save.mockResolvedValueOnce(user);

      const result = await service.resetPassword({
        token: 'valid_token',
        password: 'new_password',
      });

      expect(result.message).toBe('translated: user.UPDATE_PASSWORD');
      expect(user.password).toBe('hashed_pass');
      expect(user.resetToken).toBeUndefined();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should throw BadRequestException if token is invalid or expired', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.resetPassword({ token: 'invalid', password: 'pass' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should change password if current password is correct', async () => {
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        password: 'old_hashed',
      } as User;
      mockUserRepository.findOne.mockResolvedValueOnce(user);
      mockPasswordStrategy.compare.mockResolvedValueOnce(true);
      mockPasswordStrategy.hash.mockResolvedValueOnce('new_hashed');
      mockUserRepository.save.mockResolvedValueOnce(user);

      const result = await service.changePassword('user-1', {
        password: 'current_password',
        newPassword: 'new_password',
      });

      expect(result.message).toBe('translated: user.UPDATE_PASSWORD');
      expect(user.password).toBe('new_hashed');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if old and new password are same', async () => {
      await expect(
        service.changePassword('user-1', {
          password: 'same',
          newPassword: 'same',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockI18n.t).toHaveBeenCalledWith('user.OLD_IS_EQUAL_NEW');
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.changePassword('invalid', {
          password: 'old',
          newPassword: 'new',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if current password is wrong', async () => {
      const user = { id: 'user-1', password: 'old_hashed' } as User;
      mockUserRepository.findOne.mockResolvedValueOnce(user);
      mockPasswordStrategy.compare.mockResolvedValueOnce(false);

      await expect(
        service.changePassword('user-1', {
          password: 'wrong',
          newPassword: 'new',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
