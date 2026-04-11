import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NotificationSubService } from './notification.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationStrategyFactory } from './strategies/notification-strategy.factory';
import { EmailAdapter } from './adapters/email.adapter';
import { UserClientAdapter } from './adapters/user-client.adapter';
import { AuctionClientAdapter } from './adapters/auction-client.adapter';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { NotificationStrategy } from './strategies/interface/notification.strategy';
import { NotificationType } from '../../common/constant/enum.constant';
import { Notification } from './entity/notification.entity';
import { NotificationEventData } from './strategies/interface/notification-events.interface';

describe('NotificationSubService', () => {
  let service: NotificationSubService;
  let mockI18n: { t: jest.Mock };
  let mockRepository: Record<string, jest.Mock>;
  let mockStrategyFactory: { getStrategy: jest.Mock };
  let mockEmailAdapter: { sendEmail: jest.Mock };
  let mockUserClient: { getUserByUserId: jest.Mock };
  let mockAuctionClient: { validateAuction: jest.Mock };
  let mockPubSub: { publish: jest.Mock };

  beforeEach(async () => {
    mockI18n = {
      t: jest.fn().mockReturnValue('translated text'),
    };
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    };
    mockStrategyFactory = {
      getStrategy: jest.fn(),
    };
    mockEmailAdapter = {
      sendEmail: jest.fn(),
    };
    mockUserClient = {
      getUserByUserId: jest.fn(),
    };
    mockAuctionClient = {
      validateAuction: jest.fn(),
    };
    mockPubSub = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSubService,
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationRepository, useValue: mockRepository },
        { provide: NotificationStrategyFactory, useValue: mockStrategyFactory },
        { provide: EmailAdapter, useValue: mockEmailAdapter },
        { provide: UserClientAdapter, useValue: mockUserClient },
        { provide: AuctionClientAdapter, useValue: mockAuctionClient },
        { provide: PUB_SUB, useValue: mockPubSub },
      ],
    }).compile();

    service = module.get<NotificationSubService>(NotificationSubService);
  });

  describe('process', () => {
    it('should process notification correctly', async () => {
      const mockStrategy: Partial<NotificationStrategy> = {
        getContent: jest.fn().mockResolvedValue({ title: 'Title', message: 'Msg' }),
        getUserId: jest.fn().mockReturnValue('user-1'),
        getType: jest.fn().mockReturnValue(NotificationType.BID_PLACED),
        getActionId: jest.fn().mockReturnValue('action-1'),
      };
      const mockData = { some: 'data' };
      const mockNotification = { id: 'notif-1', title: 'Title' };

      mockRepository.create.mockResolvedValue(mockNotification);
      mockUserClient.getUserByUserId.mockResolvedValue({ email: 'test@test.com' });

      const result = await service.process(mockStrategy as NotificationStrategy, mockData);

      expect(mockStrategy.getContent).toHaveBeenCalledWith(mockData, mockI18n);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockPubSub.publish).toHaveBeenCalledWith('NOTIFICATION_CREATED', {
        notificationCreated: mockNotification,
      });
      expect(mockUserClient.getUserByUserId).toHaveBeenCalledWith('user-1');
      expect(mockEmailAdapter.sendEmail).toHaveBeenCalledWith('test@test.com', 'Title', 'Msg');
      expect(result).toEqual(mockNotification);
    });
  });

  describe('getById', () => {
    it('should return notification if found', async () => {
      const mockNotif = { id: '1', title: 'Test' };
      mockRepository.findById.mockResolvedValue(mockNotif);

      const result = await service.getById('1', 'user-1');

      expect(result.data).toEqual(mockNotif);
      expect(mockI18n.t).toHaveBeenCalledWith('notification.RETRIEVED');
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getById('1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserNotifications', () => {
    it('should fetch user notifications with filters', async () => {
      const mockNotifs = [{ id: '1' }, { id: '2' }];
      mockRepository.find.mockResolvedValue(mockNotifs);

      const result = await service.getUserNotifications('user-1', { type: NotificationType.BID_PLACED });

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: NotificationType.BID_PLACED }),
        undefined,
      );
      expect(result.items).toEqual(mockNotifs);
    });

    it('should validate auction if actionId is provided', async () => {
      await service.getUserNotifications('user-1', { actionId: 'auc-1' });
      expect(mockAuctionClient.validateAuction).toHaveBeenCalledWith('auc-1');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(mockRepository.count).toHaveBeenCalledWith({ userId: 'user-1', isRead: false });
      expect(result.data).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should update notification isRead to true', async () => {
      const mockNotif = { id: '1', isRead: true };
      mockRepository.update.mockResolvedValue(mockNotif);

      const result = await service.markAsRead('1', 'user-1');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { _id: '1', userId: 'user-1' },
        { isRead: true },
      );
      expect(result.data).toEqual(mockNotif);
    });

    it('should throw NotFoundException if update returns null', async () => {
      mockRepository.update.mockResolvedValue(null);

      await expect(service.markAsRead('1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications to read', async () => {
      const mockNotifs = [{ id: '1', isRead: true }];
      mockRepository.find.mockResolvedValue(mockNotifs);

      const result = await service.markAllAsRead('user-1');

      expect(mockRepository.updateMany).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        { isRead: true },
      );
      expect(result.items).toEqual(mockNotifs);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      mockRepository.delete.mockResolvedValue({ id: '1' });

      const result = await service.deleteNotification('1', 'user-1');

      expect(mockRepository.delete).toHaveBeenCalledWith({ _id: '1', userId: 'user-1' });
      expect(result.data).toBeNull();
    });

    it('should throw NotFoundException if delete returns null', async () => {
      mockRepository.delete.mockResolvedValue(null);

      await expect(service.deleteNotification('1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Strategy Helpers', () => {
    const mockData = { type: 'test' };
    const mockStrategy = { process: jest.fn() };

    beforeEach(() => {
      mockStrategyFactory.getStrategy.mockReturnValue(mockStrategy);
      jest.spyOn(service, 'process').mockResolvedValue('processed' as unknown as Notification);
    });

    it('should call process with bid.created strategy', async () => {
      await service.createBidNotification(mockData as NotificationEventData);
      expect(mockStrategyFactory.getStrategy).toHaveBeenCalledWith('bid.created');
      expect(service.process).toHaveBeenCalled();
    });

    it('should call process with bid.outbid strategy', async () => {
      await service.createOutbidNotification(mockData as NotificationEventData);
      expect(mockStrategyFactory.getStrategy).toHaveBeenCalledWith('bid.outbid');
      expect(service.process).toHaveBeenCalled();
    });

    it('should call process with auction.ended strategy', async () => {
      await service.createAuctionEndedNotification(mockData as NotificationEventData);
      expect(mockStrategyFactory.getStrategy).toHaveBeenCalledWith('auction.ended');
      expect(service.process).toHaveBeenCalled();
    });

    it('should call process with bid.won strategy', async () => {
      await service.createBidWonNotification(mockData as NotificationEventData);
      expect(mockStrategyFactory.getStrategy).toHaveBeenCalledWith('bid.won');
      expect(service.process).toHaveBeenCalled();
    });
  });
});
