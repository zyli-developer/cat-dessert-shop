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

export interface TestSession {
  user: { openId: string };
  accessToken: string;
}

export async function login(app: INestApplication, code: string): Promise<TestSession> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ code });
  if (res.status >= 400) {
    throw new Error(`login failed for ${code}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data as TestSession;
}

export function authed(req: supertest.Test, session: TestSession): supertest.Test {
  return req.set('Authorization', `Bearer ${session.accessToken}`);
}
