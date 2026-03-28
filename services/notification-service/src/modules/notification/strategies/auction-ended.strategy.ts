import { Injectable } from '@nestjs/common';
import { NotificationType } from 'src/common/constant/enum.constant';
import { I18nService } from 'nestjs-i18n';
import { AuctionEventPayload } from './interface/notification-events.interface';
import { BaseNotificationStrategy } from './base.strategy';

@Injectable()
export class AuctionEndedStrategy extends BaseNotificationStrategy<AuctionEventPayload> {
  getType(): NotificationType {
    return NotificationType.AUCTION_WON;
  }

  async getContent(
    data: AuctionEventPayload,
    i18n: I18nService,
  ): Promise<{ title: string; message: string }> {
    const auctionTitle = data.title;
    const title = await i18n.t('notification.AUCTION_ENDED_TITLE');
    const message = await i18n.t('notification.AUCTION_ENDED_MESSAGE', {
      args: { title: auctionTitle },
    });
    return { title, message };
  }

  getUserId(data: AuctionEventPayload): string {
    return data.sellerId;
  }

  getActionId(data: AuctionEventPayload): string {
    return data.id;
  }
}
