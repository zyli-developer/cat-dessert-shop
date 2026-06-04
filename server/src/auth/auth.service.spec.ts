import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { User } from '../user/schemas/user.schema';
import { CODE_EXCHANGER, StubCodeExchanger } from './code-exchanger';

describe('AuthService', () => {
  let service: AuthService;
  const mockUserModel = {
    findOneAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        {
          provide: CODE_EXCHANGER,
          useValue: new StubCodeExchanger({
            'test-code': 'test-code',
            'new-code': 'new-code',
          }),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should return existing user on login', async () => {
    const existingUser = { openId: 'test-code', catCoins: 10 };
    mockUserModel.findOneAndUpdate.mockResolvedValue(existingUser);

    const result = await service.login({ code: 'test-code' });
    expect(result).toEqual(existingUser);
    expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
      { openId: 'test-code' },
      {
        $setOnInsert: {
          openId: 'test-code',
          catCoins: 0,
          currentRound: 1,
          highScore: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  });

  it('should create new user if not found', async () => {
    const newUser = { openId: 'new-code', catCoins: 0 };
    mockUserModel.findOneAndUpdate.mockResolvedValue(newUser);

    const result = await service.login({ code: 'new-code' });
    expect(result).toEqual(newUser);
    expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
      { openId: 'new-code' },
      {
        $setOnInsert: {
          openId: 'new-code',
          catCoins: 0,
          currentRound: 1,
          highScore: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  });
});
