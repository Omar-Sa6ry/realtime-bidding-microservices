import { Test, TestingModule } from '@nestjs/testing';
import { RoleGuard } from './role.guard';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { I18nService } from 'nestjs-i18n';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Role, Permission } from '../constants/enum.constant';
import { GqlExecutionContext } from '@nestjs/graphql';

jest.mock('@nestjs/graphql', () => {
  const original = jest.requireActual('@nestjs/graphql');
  return {
    ...original,
    GqlExecutionContext: {
      create: jest.fn(),
    },
  };
});

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let jwtService: JwtService;
  let reflector: Reflector;
  let i18nService: I18nService;
  let userService: any;

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockI18nService = {
    t: jest.fn((key: string) => Promise.resolve(`translated: ${key}`)),
  };

  const mockUserService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleGuard,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
        {
          provide: 'USER_SERVICE',
          useValue: mockUserService,
        },
      ],
    }).compile();

    guard = module.get<RoleGuard>(RoleGuard);
    jwtService = module.get<JwtService>(JwtService);
    reflector = module.get<Reflector>(Reflector);
    i18nService = module.get<I18nService>(I18nService);
    userService = module.get('USER_SERVICE');
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: any;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        headers: {},
      };
      mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnThis(),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      };

      (GqlExecutionContext.create as jest.Mock).mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      });
    });

    it('should throw Error if USER_SERVICE is not provided', async () => {
      const guardWithoutUserService = new RoleGuard(
        i18nService,
        jwtService,
        reflector,
        undefined,
      );

      await expect(guardWithoutUserService.canActivate(mockContext)).rejects.toThrow(
        'USER_SERVICE not provided in AuthCommonModule context',
      );
    });

    it('should throw UnauthorizedException if token is missing', async () => {
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockI18nService.t).toHaveBeenCalledWith('user.NO_TOKEN');
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';
      mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('Invalid token'));

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockI18nService.t).toHaveBeenCalledWith('user.INVALID_TOKEN');
    });

    it('should throw UnauthorizedException if userId is missing in payload', async () => {
      mockRequest.headers.authorization = 'Bearer valid-token';
      mockJwtService.verifyAsync.mockResolvedValueOnce({});

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockI18nService.t).toHaveBeenCalledWith('user.INVALID_TOKEN');
    });

    it('should throw UnauthorizedException if user has insufficient roles', async () => {
      mockRequest.headers.authorization = 'Bearer valid-token';
      mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
      mockUserService.findById.mockResolvedValueOnce({ data: { id: 'user-1', role: Role.USER } });
      
      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === 'roles') return [Role.ADMIN];
        return [];
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockI18nService.t).toHaveBeenCalledWith('user.INSUFFICIENT_PERMISSIONS');
    });

    it('should throw UnauthorizedException if user has insufficient permissions', async () => {
      mockRequest.headers.authorization = 'Bearer valid-token';
      mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
      mockUserService.findById.mockResolvedValueOnce({ data: { id: 'user-1', role: Role.USER } });
      
      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === 'permissions') return [Permission.EDIT_USER_ROLE];
        return [];
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockI18nService.t).toHaveBeenCalledWith('user.INSUFFICIENT_PERMISSIONS');
    });

    it('should allow access and attach user to request if all conditions are met', async () => {
      const userData = { id: 'user-1', email: 'test@test.com', role: Role.USER };
      mockRequest.headers.authorization = 'Bearer valid-token';
      mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });
      mockUserService.findById.mockResolvedValueOnce({ data: userData });
      
      mockReflector.getAllAndOverride.mockReturnValue([]); 

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest['user']).toBeDefined();
      expect(mockRequest['user'].id).toBe(userData.id);
      expect(mockRequest['user'].role).toBe(userData.role);
    });
  });
});
