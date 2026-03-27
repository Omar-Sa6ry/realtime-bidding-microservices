import { NotificationType } from 'src/common/constant/enum.constant';
import { I18nService } from 'nestjs-i18n';
import { NotificationEventData } from './notification-events.interface';

export interface NotificationStrategy {
  getType(data?: NotificationEventData): NotificationType;
  getContent(
    data: NotificationEventData,
    i18n: I18nService,
  ): Promise<{ title: string; message: string }>;
  getUserId(data: NotificationEventData): string;
  getActionId?(data: NotificationEventData): string;
}
