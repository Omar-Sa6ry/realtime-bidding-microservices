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
}

export enum PaymentMethod {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  PAYMOB = 'PAYMOB',
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
