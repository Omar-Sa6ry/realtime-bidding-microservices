import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';
import { PaymentMethod } from '@bidding-micro/shared';
import { BadRequestException } from '@nestjs/common';

const mockStripeService = {
  createSession: jest.fn(),
  verifyWebhook: jest.fn(),
};

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should call StripeService.createSession when method is STRIPE', async () => {
      const userId = 'user-1';
      const amount = 100;
      const items = [{ name: 'Test Item', price: 100, quantity: 1 }];
      const sessionUrl = 'http://stripe.com/session';

      mockStripeService.createSession.mockResolvedValueOnce(sessionUrl);

      const result = await service.createSession(
        PaymentMethod.STRIPE,
        userId,
        amount,
        items,
      );

      expect(result).toBe(sessionUrl);
      expect(mockStripeService.createSession).toHaveBeenCalledWith(
        userId,
        amount,
        items,
      );
    });

    it('should throw BadRequestException for unsupported payment method', async () => {
      const unsupportedMethod = 'UNSUPPORTED' as any;

      await expect(
        service.createSession(unsupportedMethod, 'user-1', 100, []),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createSession(unsupportedMethod, 'user-1', 100, []),
      ).rejects.toThrow(`Payment method ${unsupportedMethod} is not supported`);
    });
  });

  describe('getStrategy', () => {
    it('should return StripeService when method is STRIPE', () => {
      const strategy = service.getStrategy(PaymentMethod.STRIPE);
      expect(strategy).toBe(mockStripeService);
    });

    it('should throw BadRequestException when method is not supported', () => {
      const unsupportedMethod = 'UNSUPPORTED' as any;
      expect(() => service.getStrategy(unsupportedMethod)).toThrow(
        BadRequestException,
      );
      expect(() => service.getStrategy(unsupportedMethod)).toThrow(
        `Payment method ${unsupportedMethod} is not supported`,
      );
    });
  });
});
