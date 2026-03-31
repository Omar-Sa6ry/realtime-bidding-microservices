import { Observable } from 'rxjs';

export interface User {
  id: string;
  email: string;
  balance: number;
  firstname: string;
  lastname: string;
  role: string;
  country: string;
}

export interface GetUserResponse {
  user: User;
}

export interface UserService {
  getUser(data: { id: string }): Observable<GetUserResponse>;
}

export interface AuctionResponse {
  exists: boolean;
  title: string;
  description: string;
  current_price: number;
  end_time: string;
  seller_id: string;
  status: string;
}

export interface AuctionService {
  getAuction(data: { auction_id: string }): Observable<AuctionResponse>;
}

export interface Bid {
  id: string;
  amount: number;
  created_at: string;
}

export interface GetUserBidsResponse {
  bids: Bid[];
}

export interface BiddingService {
  getUserBids(data: { auction_id: string; user_id: string }): Observable<GetUserBidsResponse>;
}
