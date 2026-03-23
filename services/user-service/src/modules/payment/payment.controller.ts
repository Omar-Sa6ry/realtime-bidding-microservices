import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { UserService } from '../users/users.service';
import type { Response } from 'express';
import { PaymentMethod } from '@bidding-micro/shared';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
  ) {}

  @Post('webhook/:method')
  async handleWebhook(
    @Param('method') method: PaymentMethod,
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    let event;

    try {
      const strategy = this.paymentService.getStrategy(method);
      const payload = req.rawBody || req.body;
      event = strategy.verifyWebhook(signature, payload);
    } catch (err) {
      this.logger.error(
        `Webhook signature verification failed for ${method}.`,
        err.message,
      );
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send(`Webhook Error: ${err.message}`);
    }

    if (
      method === PaymentMethod.STRIPE &&
      event.type === 'checkout.session.completed'
    ) {
      const session = event.data.object as any;
      if (session.metadata && session.metadata.transactionType === 'recharge') {
        const userId = session.metadata.userId;
        const amount = session.amount_total / 100;

        try {
          await this.userService.chargeMoney(userId, amount);
          this.logger.log(
            `Successfully recharged wallet via Stripe for user: ${userId}`,
          );
        } catch (error) {
          this.logger.error(`Failed to charge user wallet: ${error.message}`);
        }
      }
    }

    res.status(HttpStatus.OK).json({ received: true });
  }
}
