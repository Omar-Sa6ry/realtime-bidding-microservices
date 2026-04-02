import { registerEnumType } from '@nestjs/graphql';

export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}
export const AllRoles: Role[] = Object.values(Role);

export enum Permission {
  // User
  UPDATE_USER = 'update_user',
  DELETE_USER = 'delete_user',
  EDIT_USER_ROLE = 'edit_user_role',
  VIEW_USER = 'view_user',
  CREATE_INSTRUCTOR = 'create_instructor',

  // Auth
  RESET_PASSWORD = 'RESET_PASSWORD',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  RECHARGE_WALLET = 'RECHARGE_WALLET',
  LOGOUT = 'LOGOUT',

  // Notification
  CREATE_NOTIFICATION = 'create_notification',
  READ_NOTIFICATION = 'read_notification',
  UPDATE_NOTIFICATION = 'update_notification',
  DELETE_NOTIFICATION = 'delete_notification',

  // Ai
  SEND_MESSAGE = 'send_message',
  VIEW_CHAT_THREADS = 'view_chat_threads',
  VIEW_CHAT_HISTORY = 'view_chat_history',

  // Auction
  CREATE_AUCTION = 'CREATE_AUCTION',
  UPDATE_AUCTION = 'UPDATE_AUCTION',
  DELETE_AUCTION = 'DELETE_AUCTION',

  // Bidding
  CREATE_BID = 'CREATE_BID',
}

export enum PaymentMethod {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  PAYMOB = 'PAYMOB',
}

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  REFUND = 'REFUND',
  SETTLEMENT = 'SETTLEMENT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

registerEnumType(PaymentMethod, {
  name: 'PaymentMethod',
  description: 'Available payment methods in the system',
});

registerEnumType(Permission, {
  name: 'Permission',
  description: 'Detailed permissions in the system',
});

registerEnumType(Role, {
  name: 'Role',
  description: 'User roles in the system',
});

registerEnumType(TransactionType, {
  name: 'TransactionType',
});

registerEnumType(TransactionStatus, {
  name: 'TransactionStatus',
});
