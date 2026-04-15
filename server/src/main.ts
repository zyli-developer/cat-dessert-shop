import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  const port = Number(process.env.PORT ?? 3333);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`[Server] Listening on http://${host}:${port} (真机请用本机局域网 IP + 该端口访问)`);
}
bootstrap();
