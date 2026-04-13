import { Injectable } from '@nestjs/common';
import { NotificationType } from 'src/common/constant/enum.constant';
import { I18nService } from 'nestjs-i18n';
import { NotificationStrategy } from './interface/notification.strategy';
import { OutbidEventPayload } from './interface/notification-events.interface';

@Injectable()
export class OutbidStrategy implements NotificationStrategy {
  getType(): NotificationType {
    return NotificationType.OUTBID;
  }

  async getContent(
    data: OutbidEventPayload,
    i18n: I18nService,
  ): Promise<{ title: string; message: string }> {
    const amount = data.amount;
    const title = await i18n.t('notification.OUTBID_TITLE');
    const message = await i18n.t('notification.OUTBID_MESSAGE', {
      args: { amount },
    });
    return { title, message };
  }

  getUserId(data: any): string {
    return data.userId || data.user_id;
  }
}
