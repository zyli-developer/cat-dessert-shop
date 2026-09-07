/**
 * 激励视频广告位 ID 配置（全项目唯一来源，调用点不要再写字面量）。
 *
 * 此值由根目录 .env 的 REWARDED_AD_UNIT_ID 生成，请勿直接修改本文件。
 * 上线前需在 .env 填写抖音开放平台「流量主 → 广告位管理」创建的真实激励视频广告位 ID，
 * 然后执行 npm run config:sync。
 * 开发环境（非抖音运行时）不创建真实广告、直接模拟看完，不受此配置影响。
 */
/**
 * 真机模拟激励视频开关：true 时不创建真实广告，弹「模拟广告」对话框代替
 * （确定=看完发奖，取消=中途关闭不发奖），用于在拿到真实广告位 ID 前测试发奖链路。
 *
 * ⚠⚠ 上线/提审前必须改回 false，否则用户看不到广告但能白拿奖励。
 */
export const MOCK_REWARDED_ADS = false;

/** 抖音激励视频是全局单例，所有奖励入口共用同一个正式广告位。 */
export const REWARDED_AD_UNIT_ID = "1ih701gf868ig5c9ba";

export const AD_UNIT_IDS = {
    /** Game 场景道具栏：看广告 +10 金币 */
    gameGold: REWARDED_AD_UNIT_ID,
    /** 胜利结算弹窗：奖励翻倍 */
    winDouble: REWARDED_AD_UNIT_ID,
    /** 失败结算弹窗：看广告复活 */
    failRevive: REWARDED_AD_UNIT_ID,
    /** Home 场景：看广告领猫币 */
    homeCatCoin: REWARDED_AD_UNIT_ID,
    /** 每日礼包弹窗：看广告翻倍领取 */
    dailyGift: REWARDED_AD_UNIT_ID,
} as const;

const DEVELOPMENT_AD_UNIT_IDS = new Set<string>([
    'game_ad_gold',
    'win_double',
    'fail_revive',
    'home_catcoin',
    'home_daily_gift',
    'rewarded_video_ad',
]);

/** 真机调用广告 SDK 前的最后一道保护；非正式 ID 不会传给 tt。 */
export function isConfiguredAdUnitId(adUnitId: string): boolean {
    const normalized = adUnitId.trim().toLowerCase();
    return !!normalized &&
        !DEVELOPMENT_AD_UNIT_IDS.has(normalized) &&
        !/(?:placeholder|test[-_]?ad|your[-_]?ad|demo|xxx)/.test(normalized);
}
