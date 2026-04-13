import { BaseNotificationStrategy } from './base.strategy';
import { Injectable } from '@nestjs/common';
import { NotificationType } from 'src/common/constant/enum.constant';
import { I18nService } from 'nestjs-i18n';
import { BidEventPayload } from './interface/notification-events.interface';

@Injectable()
export class BidCreatedStrategy extends BaseNotificationStrategy<BidEventPayload> {
  getType(): NotificationType {
    return NotificationType.BID_PLACED;
  }

  async getContent(
    data: BidEventPayload,
    i18n: I18nService,
  ): Promise<{ title: string; message: string }> {
    const auctionId = data.auction_id;
    const amount = data.amount;
    const title = i18n.t('notification.BID_PLACED_TITLE');
    const message = i18n.t('notification.BID_PLACED_MESSAGE', {
      args: { amount, auctionId },
    });
    return { title, message };
  }

  getUserId(data: any): string {
    return data.user_id || data.userId;
  }

  getActionId(data: any): string {
    return data.auction_id || data.actionId || data.id || data._id;
  }
}
