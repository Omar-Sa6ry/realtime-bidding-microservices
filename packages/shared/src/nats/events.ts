export enum UserEvents {
  GET_USER_BY_ID = 'user.get.by.id',
  GET_USER_BY_EMAIL = 'user.get.by.email',
  USER_EXISTS = 'user.exists',
  USER_UPDATED = 'user.updated',
  USER_DATA_EXISTED = 'user.dataExists',
  CREATE_USER_DATA = 'user.createData',
  USER_ROLE_UPDATED = 'user.role.updated',
  FIND_USERS_WITH_IDS = 'user.findUsersWithIds',
  CHECK_IF_INSTRUCTOR = 'user.checkIfInstructor',
}

export enum AuctionEvents {
  CREATE_AUCTION = 'auction.create',
  GET_AUCTION_BY_ID = 'auction.get.by.id',
  AUCTION_ENDED = 'auction.ended',
  AUCTION_STATUS_UPDATED = 'auction.status.updated',
}

export enum BidEvents {
  PLACE_BID = 'bid.place',
  BID_CREATED = 'bid.created',
  BID_OUTBID = 'bid.outbid',
  BID_WON = 'bid.won',
  BID_ACCEPTED = 'bid.accepted',
  BID_REJECTED = 'bid.rejected',
  GET_BIDS_FOR_AUCTION = 'bid.get.for.auction',
}

export enum NotificationEvents {
  SEND_NOTIFICATION = 'notification.send',
  NOTIFY_BID_UPDATE = 'notification.bid.update',
  NOTIFY_AUCTION_END = 'notification.auction.end',
}
