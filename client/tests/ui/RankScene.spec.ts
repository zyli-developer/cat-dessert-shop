import { Node } from 'cc';
import { RankScene } from '../../assets/scenes/scripts/ui/RankScene';
import { ApiClient } from '../../assets/scenes/scripts/net/ApiClient';

describe('rank response lifecycle', () => {
  afterEach(() => jest.restoreAllMocks());
  function scene() {
    const s = new RankScene() as any;
    s.node = new Node('Rank');
    jest.spyOn(s, 'render').mockImplementation(() => undefined);
    return s;
  }
  it('ignores a slower previous board response', async () => {
    const s = scene();
    let finish!: (value: any) => void;
    jest.spyOn(ApiClient, 'getFriendsRank').mockImplementation(() => new Promise(r => { finish = r; }));
    jest.spyOn(ApiClient, 'getGlobalRank').mockResolvedValue([{ nickname: 'global', highScore: 20 } as any]);
    const old = s.loadBoard();
    s.board = 'global';
    await s.loadBoard();
    finish({ list: [{ nickname: 'old', currentRound: 4 }], myRank: 1 });
    await old;
    expect(s.render).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'global', score: 20, me: false })]);
  });
  it('uses rank identity rather than identical anonymous names', async () => {
    const s = scene();
    jest.spyOn(ApiClient, 'getFriendsRank').mockResolvedValue({ list: [
      { nickname: '猫店玩家', currentRound: 5, isMe: false },
      { nickname: '猫店玩家', currentRound: 3, isMe: true },
    ], myRank: 2 });
    await s.loadBoard();
    expect(s.allRows.map((r: any) => [r.me, r.score])).toEqual([[false, 4], [true, 2]]);
  });
  it('distinguishes a failed request from an empty successful board', async () => {
    const s = scene();
    jest.spyOn(ApiClient, 'getFriendsRank').mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ list: [], myRank: 0 });
    await s.loadBoard();
    expect(s.loadFailed).toBe(true);
    await s.loadBoard();
    expect(s.loadFailed).toBe(false);
  });
  it('does not render a response after leaving the scene', async () => {
    const s = scene();
    let finish!: (value: any) => void;
    jest.spyOn(ApiClient, 'getFriendsRank').mockImplementation(() => new Promise(r => { finish = r; }));
    const pending = s.loadBoard();
    s.onDestroy();
    s.node.destroy();
    finish({ list: [], myRank: 0 });
    await pending;
    expect(s.render).toHaveBeenCalledTimes(1);
  });
  it('pages through entries while keeping the current player pinned', () => {
    const s = new RankScene() as any;
    s.node = new Node('Rank');
    const draw = jest.spyOn(s, 'buildListRow').mockImplementation(() => undefined);
    jest.spyOn(s, 'buildPodiumColumn').mockImplementation(() => undefined);
    const rows = Array.from({ length: 14 }, (_, i) => ({ no: i + 1, name: '玩家', score: 20 - i, me: i === 9 }));
    s.allRows = rows;
    const seen = new Set<number>();
    for (let page = 0; page < 3; page++) {
      draw.mockClear();
      s.page = page;
      s.render(rows);
      expect(draw.mock.calls[0][0]).toEqual(rows[9]);
      for (const [row] of draw.mock.calls) seen.add((row as any).no);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([4,5,6,7,8,9,10,11,12,13,14]);
  });

});
