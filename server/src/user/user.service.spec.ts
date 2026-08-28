import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './schemas/user.schema';

function createMockUser(overrides: any = {}) {
  const defaults = {
    openId: 'abc',
    catCoins: 0,
    highScore: 0,
    currentRound: 1,
    stars: new Map<string, number>(),
    roundScores: new Map<string, number>(),
    rewardClaimIds: [],
    adRewardDailyCounts: new Map<string, number>(),
    adRewardLastClaimAt: new Map<string, number>(),
    doubledRounds: [],
    dailyGiftDate: '',
    save: jest.fn(),
  };
  const user = { ...defaults, ...overrides };
  user.save.mockResolvedValue(user);
  return user;
}

describe('UserService', () => {
  let service: UserService;
  const mockUserModel = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const user = { openId: 'abc', catCoins: 5 };
      mockUserModel.findOne.mockResolvedValue(user);
      const result = await service.getProfile('abc');
      expect(result).toEqual(user);
    });

    it('should return null for non-existent user', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      const result = await service.getProfile('unknown');
      expect(result).toBeNull();
    });
  });

  describe('updateInfo', () => {
    it('should write nickname and avatar', async () => {
      const mockUser = createMockUser({ nickname: '', avatar: '' });
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.updateInfo('abc', {
        nickname: '  喵喵  ',
        avatar: 'https://p3.douyinpic.com/a.jpg',
      });

      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual({
        openId: 'abc',
        nickname: '喵喵',
        avatar: 'https://p3.douyinpic.com/a.jpg',
      });
    });

    it('should not overwrite existing values with empty/whitespace input', async () => {
      const mockUser = createMockUser({ nickname: '旧名', avatar: 'old.jpg' });
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.updateInfo('abc', { nickname: '   ', avatar: '' });

      expect(result.nickname).toBe('旧名');
      expect(result.avatar).toBe('old.jpg');
    });

    it('should throw NotFoundException for unknown user', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      await expect(service.updateInfo('nope', { nickname: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProgress', () => {
    it('should update progress and award cat coins for new stars', async () => {
      const mockUser = createMockUser();
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.updateProgress('abc', { round: 1, score: 1000, stars: 3 });

      expect(mockUser.stars.get('1')).toBe(3);
      expect(mockUser.roundScores.get('1')).toBe(1000);
      expect(mockUser.highScore).toBe(1000);
      expect(mockUser.currentRound).toBe(2);
      expect(mockUser.catCoins).toBe(20);
      expect(result.isNewBest).toBe(true);
    });

    it('should not downgrade stars', async () => {
      const mockUser = createMockUser({
        stars: new Map([['1', 3]]),
        roundScores: new Map([['1', 200]]),
        highScore: 200,
        currentRound: 2,
      });
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await service.updateProgress('abc', { round: 1, score: 50, stars: 1 });

      expect(mockUser.stars.get('1')).toBe(3);
      expect(mockUser.roundScores.get('1')).toBe(200);
      expect(mockUser.highScore).toBe(200);
    });

    it('should not downgrade roundScores', async () => {
      const mockUser = createMockUser({
        roundScores: new Map([['1', 300]]),
        highScore: 300,
      });
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.updateProgress('abc', { round: 1, score: 100, stars: 1 });

      expect(mockUser.roundScores.get('1')).toBe(300);
      expect(result.isNewBest).toBe(false);
    });

    it('should be idempotent: repeated submission with same stars does not award extra coins', async () => {
      const mockUser = createMockUser({
        stars: new Map([['1', 2]]),
        roundScores: new Map([['1', 600]]),
        catCoins: 10,
        highScore: 500,
        currentRound: 2,
      });
      mockUserModel.findOne.mockResolvedValue(mockUser);

      // Submit same stars=2 again
      await service.updateProgress('abc', { round: 1, score: 600, stars: 2 });

      expect(mockUser.catCoins).toBe(10); // no change
    });

    it('should award incremental coins when stars improve', async () => {
      const mockUser = createMockUser({
        stars: new Map([['1', 1]]),
        catCoins: 5, // already got 5 for 1 star
      });
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await service.updateProgress('abc', { round: 1, score: 600, stars: 2 });

      // 2 stars = 10, minus old 1 star = 5, so +5
      expect(mockUser.catCoins).toBe(10);
    });

    it('should reject progress for a locked round', async () => {
      const mockUser = createMockUser({ currentRound: 1 });
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await expect(
        service.updateProgress('abc', { round: 2, score: 50, stars: 1 }),
      ).rejects.toThrow('Round is not unlocked');
    });

    it('should reject stars that do not match the score thresholds', async () => {
      const mockUser = createMockUser();
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await expect(
        service.updateProgress('abc', { round: 1, score: 100, stars: 3 }),
      ).rejects.toThrow('Stars do not match');
    });

    it('should only advance currentRound, never go backwards', async () => {
      const mockUser = createMockUser({ currentRound: 5 });
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await service.updateProgress('abc', { round: 2, score: 50, stars: 1 });

      expect(mockUser.currentRound).toBe(5); // unchanged
    });

    it('should throw NotFoundException for missing user', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      await expect(
        service.updateProgress('unknown', { round: 1, score: 10, stars: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('claimReward', () => {
    it('returns an idempotent result for an existing claimId', async () => {
      const user = createMockUser({ rewardClaimIds: ['home_123456789012'] });
      mockUserModel.findOne.mockResolvedValue(user);

      const result = await service.claimReward('abc', {
        kind: 'home_ad' as any,
        claimId: 'home_123456789012',
      });

      expect(result.alreadyClaimed).toBe(true);
      expect(result.awarded).toBe(0);
      expect(mockUserModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('awards a fixed home-ad amount through an atomic update', async () => {
      const user = createMockUser();
      const updated = createMockUser({ catCoins: 10, rewardClaimIds: ['home_123456789012'] });
      mockUserModel.findOne.mockResolvedValue(user);
      mockUserModel.findOneAndUpdate.mockResolvedValue(updated);

      const result = await service.claimReward('abc', {
        kind: 'home_ad' as any,
        claimId: 'home_123456789012',
      });

      expect(result.awarded).toBe(10);
      expect(result.catCoins).toBe(10);
      expect(mockUserModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('derives win-double reward from server-side stored stars', async () => {
      const user = createMockUser({
        stars: new Map([['1', 3]]),
        currentRound: 2,
      });
      const updated = createMockUser({
        stars: new Map([['1', 3]]),
        currentRound: 2,
        catCoins: 40,
        doubledRounds: [1],
      });
      mockUserModel.findOne.mockResolvedValue(user);
      mockUserModel.findOneAndUpdate.mockResolvedValue(updated);

      const result = await service.claimReward('abc', {
        kind: 'win_double' as any,
        claimId: 'win_1234567890123',
        round: 1,
      });

      expect(result.awarded).toBe(20);
      expect(mockUserModel.findOneAndUpdate.mock.calls[0][1].$inc.catCoins).toBe(20);
    });
  });
});
