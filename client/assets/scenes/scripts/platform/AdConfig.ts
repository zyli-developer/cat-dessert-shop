/**
 * 激励视频广告位 ID 配置（全项目唯一来源，调用点不要再写字面量）。
 *
 * ⚠ 当前值全部是开发占位符，真机上 createRewardedVideoAd 会失败（onError 后返回 false）。
 * 上线前需替换为抖音开放平台「流量主 → 广告位管理」创建的真实激励视频广告位 ID。
 * 开发环境（非抖音运行时）不创建真实广告、直接模拟看完，不受此配置影响。
 */
/**
 * 真机模拟激励视频开关：true 时不创建真实广告，弹「模拟广告」对话框代替
 * （确定=看完发奖，取消=中途关闭不发奖），用于在拿到真实广告位 ID 前测试发奖链路。
 *
 * ⚠⚠ 上线/提审前必须改回 false，否则用户看不到广告但能白拿奖励。
 */
export const MOCK_REWARDED_ADS = true;

export const AD_UNIT_IDS = {
    /** Game 场景道具栏：看广告 +10 金币 */
    gameGold: 'game_ad_gold',
    /** 胜利结算弹窗：奖励翻倍 */
    winDouble: 'win_double',
    /** 失败结算弹窗：看广告复活 */
    failRevive: 'fail_revive',
    /** Home 场景：看广告领猫币 */
    homeCatCoin: 'home_catcoin',
    /** 每日礼包弹窗：看广告翻倍领取 */
    dailyGift: 'home_daily_gift',
} as const;
