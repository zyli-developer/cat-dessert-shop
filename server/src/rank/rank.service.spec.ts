import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RankService } from './rank.service';
import { User } from '../user/schemas/user.schema';

describe('RankService', () => {
  let service: RankService;

  const mockQuery = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn(),
  };

  const mockUserModel = {
    find: jest.fn().mockReturnValue(mockQuery),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<RankService>(RankService);
    jest.clearAllMocks();
    mockUserModel.find.mockReturnValue(mockQuery);
  });

  describe('getGlobalRank', () => {
    it('should return global rank sorted by highScore', async () => {
      const rankData = [
        { nickname: 'Cat1', highScore: 300 },
        { nickname: 'Cat2', highScore: 200 },
      ];
      mockQuery.lean.mockResolvedValue(rankData);

      const result = await service.getGlobalRank(10);

      expect(result).toEqual([
        { nickname: '猫店玩家', avatar: '', highScore: 300, currentRound: 1 },
        { nickname: '猫店玩家', avatar: '', highScore: 200, currentRound: 1 },
      ]);
      expect(mockQuery.sort).toHaveBeenCalledWith({ highScore: -1 });
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.select).toHaveBeenCalledWith('-_id highScore currentRound');
    });

    it('should default to limit 100', async () => {
      mockQuery.lean.mockResolvedValue([]);
      await service.getGlobalRank();
      expect(mockQuery.limit).toHaveBeenCalledWith(100);
    });

    it('never exposes legacy nickname, avatar, openId or Mongo _id', async () => {
      mockQuery.lean.mockResolvedValue([
        {
          nickname: '加微信abc',
          avatar: 'https://evil.example/a.jpg',
          openId: 'private-open-id',
          _id: 'private-mongo-id',
          highScore: 10,
        },
      ]);

      const [result] = await service.getGlobalRank();

      expect(result.nickname).toBe('猫店玩家');
      expect(result.avatar).toBe('');
      expect(result).not.toHaveProperty('openId');
      expect(result).not.toHaveProperty('_id');
    });
  });

  describe('getFriendsRank', () => {
    it('should rank by round score when round is provided', async () => {
      const users = [
        { nickname: 'A', avatar: '', openId: 'a', roundScores: { '3': 500 } },
        { nickname: 'B', avatar: '', openId: 'b', roundScores: { '3': 800 } },
        { nickname: 'C', avatar: '', openId: 'c', roundScores: { '3': 300 } },
      ];
      mockQuery.lean.mockResolvedValue(users);

      const result = await service.getFriendsRank('b', 3);

      expect(result.list[0].score).toBe(800);
      expect(result.list.every((item) => item.nickname === '猫店玩家')).toBe(true);
      expect(result.list.every((item) => item.avatar === '')).toBe(true);
      expect(result.myRank).toBe(1);
      expect(result.list.map(item => item.isMe)).toEqual([true, false, false]);
      expect(result.list[0]).not.toHaveProperty('openId');
    });

    it('should rank by currentRound when no round param', async () => {
      const users = [
        {
          nickname: 'A',
          avatar: '',
          openId: 'a',
          currentRound: 5,
          highScore: 200,
        },
        {
          nickname: 'B',
          avatar: '',
          openId: 'b',
          currentRound: 8,
          highScore: 500,
        },
      ];
      mockQuery.lean.mockResolvedValue(users);

      const result = await service.getFriendsRank('a');

      expect(result.list.length).toBe(2);
      expect(result.myRank).toBe(1); // 'a' is first in the sorted list
    });

    it('should return myRank = list.length + 1 when user has no score for that round', async () => {
      const users = [
        { nickname: 'A', avatar: '', openId: 'a', roundScores: { '1': 100 } },
      ];
      mockQuery.lean.mockResolvedValue(users);

      const result = await service.getFriendsRank('nonexistent', 1);

      expect(result.myRank).toBe(2);
    });
  });
});
