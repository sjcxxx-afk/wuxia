/**
 * 闲置提醒设置 —— 用户可配置闲置天数阈值。
 */

const SETTINGS_KEY = "warehouse_reminder_settings";

export type ReminderSettings = {
  /** 超过此天数未更新的闲置物品触发提醒，默认 30 */
  idleReminderDays: number;
};

const DEFAULT: ReminderSettings = {
  idleReminderDays: 30,
};

let cache: ReminderSettings | null = null;

export function getReminderSettings(): ReminderSettings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
      cache = { ...DEFAULT, ...parsed };
      return cache;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT };
}

export function saveReminderSettings(s: ReminderSettings): void {
  cache = { ...s };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}
