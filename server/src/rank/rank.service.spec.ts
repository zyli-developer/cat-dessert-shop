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

      expect(result).toEqual(rankData);
      expect(mockQuery.sort).toHaveBeenCalledWith({ highScore: -1 });
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should default to limit 100', async () => {
      mockQuery.lean.mockResolvedValue([]);
      await service.getGlobalRank();
      expect(mockQuery.limit).toHaveBeenCalledWith(100);
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

      expect(result.list[0].nickname).toBe('B');
      expect(result.list[0].score).toBe(800);
      expect(result.list[1].nickname).toBe('A');
      expect(result.list[2].nickname).toBe('C');
      expect(result.myRank).toBe(1);
    });

    it('should rank by currentRound when no round param', async () => {
      const users = [
        { nickname: 'A', avatar: '', openId: 'a', currentRound: 5, highScore: 200 },
        { nickname: 'B', avatar: '', openId: 'b', currentRound: 8, highScore: 500 },
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
