import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from '../user/schemas/user.schema';
import { CODE_EXCHANGER, StubCodeExchanger, DouyinCodeExchanger } from './code-exchanger';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: CODE_EXCHANGER,
      useFactory: () =>
        process.env.AUTH_CODE_EXCHANGER === 'stub'
          ? new StubCodeExchanger({
              'test-code-1': 'openid-1',
              'test-code-2': 'openid-2',
              'test-code-3': 'openid-3',
              'test-code-4': 'openid-4',
              'test-code-5': 'openid-5',
              'test-code-6': 'openid-6',
              'test-code': 'test-code',
              'new-code': 'new-code',
            })
          : new DouyinCodeExchanger(),
    },
  ],
})
export class AuthModule {}
