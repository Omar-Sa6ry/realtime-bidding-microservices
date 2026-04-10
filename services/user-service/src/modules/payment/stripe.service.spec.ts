import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';

const mockCreate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => {
    return {
      checkout: {
        sessions: {
          create: mockCreate,
        },
      },
      webhooks: {
        constructEvent: mockConstructEvent,
      },
    };
  });
});

describe('StripeService', () => {
  let service: StripeService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    beforeEach(() => {
      process.env.STRIPE_WEBHOOK_SECRETSUCCESSURL = 'http://success.com';
      process.env.STRIPE_WEBHOOK_SECRETFAILURL = 'http://fail.com';
    });

    it('should create a session and return the url', async () => {
      const userId = 'user-1';
      const amount = 1000;
      const items = [{ name: 'Test Product', price: 10, quantity: 2 }];
      const mockSession = { url: 'http://stripe.com/checkout' };

      mockCreate.mockResolvedValueOnce(mockSession);

      const result = await service.createSession(userId, amount, items);

      expect(result).toBe(mockSession.url);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          client_reference_id: userId,
          metadata: {
            userId: userId,
            transactionType: 'recharge',
          },
          line_items: [
            {
              price_data: {
                currency: 'egp',
                product_data: { name: 'Test Product' },
                unit_amount: 1000, // 10 * 100
              },
              quantity: 2,
            },
          ],
        }),
      );
    });

    it('should throw error if session.url is missing', async () => {
      mockCreate.mockResolvedValueOnce({ url: null });

      await expect(service.createSession('user-1', 100, [])).rejects.toThrow(
        'Failed to create Stripe session',
      );
    });
  });

  describe('verifyWebhook', () => {
    it('should verify webhook and return event', () => {
      const signature = 'sig_123';
      const payload = Buffer.from('payload');
      const mockEvent = { id: 'evt_123', type: 'payment_intent.succeeded' };
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';

      mockConstructEvent.mockReturnValueOnce(mockEvent);

      const result = service.verifyWebhook(signature, payload);

      expect(result).toBe(mockEvent);
      expect(mockConstructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_123',
      );
    });

    it('should throw error if STRIPE_WEBHOOK_SECRET is missing', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      expect(() =>
        service.verifyWebhook('sig', Buffer.from('')),
      ).toThrow('STRIPE_WEBHOOK_SECRET is not configured');
    });
  });
});
