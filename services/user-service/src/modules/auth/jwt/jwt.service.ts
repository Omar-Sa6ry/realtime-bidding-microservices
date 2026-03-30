import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  async generate(
    email: string,
    id: string,
    role: string,
    permissions: string[],
    expiresIn?: string,
  ): Promise<string> {
    const secret = process.env.JWT_SECRET as string;
    const options: any = { secret };
    if (expiresIn) {
      options.expiresIn = expiresIn;
    }
    return this.jwtService.signAsync({ email, id, role, permissions }, options);
  }
}
