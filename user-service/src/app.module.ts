import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/users/users.module';
import { DatabaseModule } from './common/database/database';
import { TranslationModule } from './common/translation/translation.module';

@Module({
  imports: [DatabaseModule, TranslationModule, UserModule, AuthModule],
  providers: [AppService, AppResolver],
})
export class AppModule {}
