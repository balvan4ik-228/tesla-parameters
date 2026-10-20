import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

const hbs = require('hbs');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Статика: style.css отдаётся по адресу /style.css
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Шаблоны Handlebars
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  hbs.registerPartials(join(__dirname, '..', 'views', 'partials'));

  // Валидация включена только на контроллерах веб-сервиса (/api).
  // Глобально её ставить нельзя: страницы лабораторных 1 и 2 шлют формы,
  // и строгий режим вырезал бы из них все поля.

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
