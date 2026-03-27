import { NotificationType } from 'src/common/constant/enum.constant';

export interface BidEventPayload {
  id: string;
  auction_id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OutbidEventPayload {
  userId: string;
  amount: number;
}

export interface AuctionEventPayload {
  id: string;
  title: string;
  description: string;
  startingPrice: number;
  currentPrice: number;
  currency: string;
  status: string;
  sellerId: string;
  startTime: string;
  endTime: string;
}

export interface ManualNotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  userId: string;
  actionId?: string;
}

export type NotificationEventData =
  | BidEventPayload
  | OutbidEventPayload
  | AuctionEventPayload
  | ManualNotificationPayload
  | Record<string, unknown>;
