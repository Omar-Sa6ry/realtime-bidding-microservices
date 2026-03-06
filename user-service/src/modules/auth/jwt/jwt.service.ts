import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class GenerateTokenFactory {
  constructor(private readonly jwtService: JwtService) {}

  createTokenGenerator(): TokenGenerator {
    return new TokenGenerator(this.jwtService, process.env.JWT_SECRET);
  }
}

export class TokenGenerator {
  constructor(
    private readonly jwtService: JwtService,
    private readonly secret: string,
  ) {}

  async generate(
    email: string,
    id: string,
    expiresIn?: string,
  ): Promise<string> {
    const options: any = { secret: this.secret };
    if (expiresIn) {
      options.expiresIn = expiresIn;
    }
    return this.jwtService.signAsync({ email, id }, options);
  }
}
