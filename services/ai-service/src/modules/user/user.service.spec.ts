import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { of, throwError } from 'rxjs';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let mockI18n: { t: jest.Mock };
  let mockClient: { getService: jest.Mock };
  let mockUserGrpcService: { getUser: jest.Mock };

  beforeEach(async () => {
    mockI18n = {
      t: jest.fn().mockReturnValue('User not found'),
    };
    mockUserGrpcService = {
      getUser: jest.fn(),
    };
    mockClient = {
      getService: jest.fn().mockReturnValue(mockUserGrpcService),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: I18nService, useValue: mockI18n },
        { provide: 'GRPC_USER_SERVICE', useValue: mockClient },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    // Manually trigger init to set userGrpcService
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize userGrpcService', () => {
      service.onModuleInit();
      expect(mockClient.getService).toHaveBeenCalledWith('UserService');
    });
  });

  describe('findById', () => {
    const userId = 'user-1';
    const mockUserResponse = { user: { id: userId, email: 'test@test.com' } };

    it('should return user data on success', async () => {
      mockUserGrpcService.getUser.mockReturnValue(of(mockUserResponse));

      const result = await service.findById(userId);

      expect(mockUserGrpcService.getUser).toHaveBeenCalledWith({ id: userId });
      expect(result).toEqual(mockUserResponse.user);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockUserGrpcService.getUser.mockReturnValue(of({ user: null }));

      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
      expect(mockI18n.t).toHaveBeenCalledWith('notification.USER_NOT_FOUND');
    });

    it('should throw NotFoundException if response is null', async () => {
      mockUserGrpcService.getUser.mockReturnValue(of(null));

      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if gRPC call fails', async () => {
      mockUserGrpcService.getUser.mockReturnValue(throwError(() => new Error('gRPC connection error')));

      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
    });
  });
});
