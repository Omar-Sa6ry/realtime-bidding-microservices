import { Injectable } from '@nestjs/common';
import { NotificationType } from 'src/common/constant/enum.constant';
import { I18nService } from 'nestjs-i18n';
import { BidEventPayload } from './interface/notification-events.interface';
import { BaseNotificationStrategy } from './base.strategy';

@Injectable()
export class BidWonStrategy extends BaseNotificationStrategy<BidEventPayload> {
  getType(): NotificationType {
    return NotificationType.AUCTION_WON;
  }

  async getContent(
    data: BidEventPayload,
    i18n: I18nService,
  ): Promise<{ title: string; message: string }> {
    const auctionId = data.auction_id;
    const amount = data.amount;
    const title = await i18n.t('notification.BID_WON_TITLE');
    const message = await i18n.t('notification.BID_WON_MESSAGE', {
      args: { amount, auctionId },
    });
    return { title, message };
  }

  getUserId(data: BidEventPayload): string {
    return data.user_id;
  }

  getActionId(data: BidEventPayload): string {
    return data.auction_id;
  }
}
