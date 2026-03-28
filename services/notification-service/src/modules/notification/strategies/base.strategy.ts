import { I18nService } from 'nestjs-i18n';
import { NotificationType } from 'src/common/constant/enum.constant';
import { NotificationStrategy } from './interface/notification.strategy';
import { NotificationEventData } from './interface/notification-events.interface';

export abstract class BaseNotificationStrategy<
  T extends NotificationEventData,
> implements NotificationStrategy {
  abstract getType(data: T): NotificationType;

  abstract getContent(
    data: T,
    i18n: I18nService,
  ): Promise<{ title: string; message: string }>;

  abstract getUserId(data: T): string;

  abstract getActionId?(data: T): string;
}
