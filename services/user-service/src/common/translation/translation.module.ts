import * as path from 'path';
import { Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
} from 'nestjs-i18n';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'ar',
      loaderOptions: {
        path: path.join(
          process.cwd(),
          'src/common/translation/locales/',
        ),
        watch: true,
      },
      resolvers: [new HeaderResolver(['x-lang']), new AcceptLanguageResolver()],
    }),
  ],
  exports: [I18nModule],
})
export class TranslationModule {}
