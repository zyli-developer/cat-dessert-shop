import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { User } from '../user/schemas/user.schema';
import { CODE_EXCHANGER, StubCodeExchanger } from './code-exchanger';

describe('AuthService', () => {
  let service: AuthService;
  const mockUserModel = {
    findOne: jest.fn(),
    create: jest.fn(),
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
    mockUserModel.findOne.mockResolvedValue(existingUser);

    const result = await service.login('test-code');
    expect(result).toEqual(existingUser);
    expect(mockUserModel.findOne).toHaveBeenCalledWith({ openId: 'test-code' });
    expect(mockUserModel.create).not.toHaveBeenCalled();
  });

  it('should create new user if not found', async () => {
    const newUser = { openId: 'new-code', catCoins: 0 };
    mockUserModel.findOne.mockResolvedValue(null);
    mockUserModel.create.mockResolvedValue(newUser);

    const result = await service.login('new-code');
    expect(result).toEqual(newUser);
    expect(mockUserModel.create).toHaveBeenCalledWith({ openId: 'new-code' });
  });
});
