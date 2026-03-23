import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { IPaymentStrategy, PaymentItem } from './interfaces/payment-strategy.interface';

@Injectable()
export class StripeService implements IPaymentStrategy {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY is not defined in environment variables');
    }
    this.stripe = new Stripe(secretKey || 'dummy_key', {
      typescript: true,
    });
  }

  async createSession(userId: string, amount: number, items: PaymentItem[]): Promise<string> {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      client_reference_id: userId,
      metadata: {
        userId: userId,
        transactionType: 'recharge',
      },
      line_items: items.map(item => ({
        price_data: {
          currency: 'egp',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      success_url: process.env.STRIPE_WEBHOOK_SECRETSUCCESSURL,
      cancel_url: process.env.STRIPE_WEBHOOK_SECRETFAILURL,
    });

    if (!session.url) {
      throw new Error('Failed to create Stripe session');
    }

    return session.url;
  }

  verifyWebhook(signature: string, payload: Buffer): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');

    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
