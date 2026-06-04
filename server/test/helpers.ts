import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
import request from 'supertest';
import { AppModule } from '../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}

export async function login(app: INestApplication, code: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ code });
  if (res.status >= 400) {
    throw new Error(`login failed for ${code}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.openId;
}

export function authed(req: supertest.Test, openId: string): supertest.Test {
  return req.set('X-Open-Id', openId);
}
