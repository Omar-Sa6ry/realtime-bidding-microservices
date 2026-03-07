// Enums & Roles
export enum Role {
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
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
  VIEW_INSTRUCTOR = 'view_instructor',
  COUNT_USER_DETAILS = 'count_user_details',

  // Auth
  RESET_PASSWORD = 'RESET_PASSWORD',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  LOGOUT = 'LOGOUT',

  // Category
  CREATE_CATEGORY = 'create_category',
  UPDATE_CATEGORY = 'update_category',
  DELETE_CATEGORY = 'delete_category',

  // Course
  CREATE_COURSE = 'create_course',
  UPDATE_COURSE = 'update_course',
  VIEW_REQUEST_FOR_USER = 'view_request_for_user',
  DELETE_COURSE = 'delete_course',

  // Startup
  CREATE_STARTUP = 'create_startup',
  UPDATE_STARTUP = 'update_startup',
  DELETE_STARTUP = 'delete_startup',

  // Requests
  CREATE_REQUEST = 'create_request',
  UPDATE_REQUEST = 'update_request',
  DELETE_REQUEST = 'delete_request',
  VIEW_REQUEST = 'view_request',
  UPDATE_REQUESTFORUSER = 'update_requestforuser',

  // Certificate
  CREATE_CERTIFICATE = 'create_certificate',
  VIEW_CERTIFICATE = 'view_certificate',
  VIEW_CERTIFICATE_FOR_USER = 'view_certificate_for_user',
  DELETE_CERTIFICATE = 'delete_certificate',

  // Cart
  CREATE_CART = 'create_cart',
  UPDATE_CART = 'update_cart',
  DELETE_CART = 'delete_cart',
  VIEW_CART = 'view_cart',

  // Wishlist
  CREATE_WISHLIST = 'create_wishlist',
  DELETE_WISHLIST = 'delete_wishlist',
  VIEW_WISHLIST = 'view_wishlist',

  // Reviews
  CREATE_REVIEW = 'create_review',
  UPDATE_REVIEW = 'update_review',
  DELETE_REVIEW = 'delete_review',
  READ_REVIEW_FOR_USER = 'read_review_for_user',
  DELETE_REVIEW_AS_ADMIN = 'delete_review_as_admin',
  DISAPPROVE_REVIEW = 'disapprove_review',

  // Student Projects
  CREATE_STUDENT_PROJECT = 'create_student_project',
  UPDATE_STUDENT_PROJECT = 'update_student_project',
  DELETE_STUDENT_PROJECT = 'delete_student_project',
  APPROVE_STUDENT_PROJECT = 'approve_student_project',
  VIEW_STUDENT_PROJECT = 'view_student_project',
}

export enum CourseLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  ALL = 'all',
}

export enum RequestStatus {
  APPROVED = 'approved',
  PENDING = 'pending',
  REJECTED = 'rejected',
  CANCELED = 'canceled',
  COMPLETED = 'completed',
}
