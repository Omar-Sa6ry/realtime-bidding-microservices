import { Injectable } from '@nestjs/common';
import { ChannelType, NotificationService } from '@bts-soft/notifications';

export interface IEmailProvider {
  sendEmail(email: string, title: string, body: string): void;
}

@Injectable()
export class EmailAdapter implements IEmailProvider {
  constructor(private readonly notificationService: NotificationService) {}

  sendEmail(email: string, title: string, body: string): void {
    this.notificationService.send(ChannelType.EMAIL, {
      recipientId: email,
      title: title,
      body: body,
    });
  }
}
