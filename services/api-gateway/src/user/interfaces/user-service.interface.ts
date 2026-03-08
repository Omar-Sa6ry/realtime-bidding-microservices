import { Observable } from 'rxjs';

export interface User {
  id: string;
  username: string;
  email: string;
  balance: number;
}

export interface RegisterResponse {
  user: User;
  token: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface UserServiceClient {
  register(data: any): Observable<RegisterResponse>;
  login(data: any): Observable<LoginResponse>;
  getUser(data: { id: string }): Observable<{ user: User }>;
}
