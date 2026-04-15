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
        process.env.NODE_ENV === 'test'
          ? new StubCodeExchanger({
              'test-code-1': 'openid-1',
              'test-code-2': 'openid-2',
              'test-code-3': 'openid-3',
            })
          : new DouyinCodeExchanger(),
    },
  ],
})
export class AuthModule {}
