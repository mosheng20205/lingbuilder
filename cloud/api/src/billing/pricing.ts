export interface PeakWindow { startHour: number; endHour: number }
export interface ModelPricingInput {
  inputPointsPerMillion: bigint;
  cachedInputPointsPerMillion: bigint;
  outputPointsPerMillion: bigint;
  peakInputPointsPerMillion: bigint | null;
  peakCachedInputPointsPerMillion: bigint | null;
  peakOutputPointsPerMillion: bigint | null;
  peakWindowsJson: unknown;
}
export interface PricingRates { input: bigint; cached: bigint; output: bigint; peak: boolean }

/** 未单独配置高峰时段时使用的默认窗口：北京时间 9:00-12:00、14:00-18:00（对齐 DeepSeek 官方高峰定义）。 */
export const DEFAULT_PEAK_WINDOWS: PeakWindow[] = [{ startHour: 9, endHour: 12 }, { startHour: 14, endHour: 18 }];
export const PRICING_TIMEZONE = 'Asia/Shanghai';

/** 解析高峰时段配置；无效或缺失时返回默认窗口。 */
export function parsePeakWindows(value: unknown): PeakWindow[] {
  if (!value) return DEFAULT_PEAK_WINDOWS;
  try {
    const parsed = JSON.parse(String(value));
    const source = Array.isArray(parsed) ? parsed : parsed?.windows;
    if (!Array.isArray(source) || !source.length) return DEFAULT_PEAK_WINDOWS;
    const windows: PeakWindow[] = [];
    for (const item of source) {
      const startHour = Number((item as Record<string, unknown>)?.startHour);
      const endHour = Number((item as Record<string, unknown>)?.endHour);
      if (Number.isInteger(startHour) && Number.isInteger(endHour) && startHour >= 0 && startHour <= 23 && endHour >= 1 && endHour <= 24 && startHour < endHour) {
        windows.push({ startHour, endHour });
      }
    }
    return windows.length ? windows : DEFAULT_PEAK_WINDOWS;
  } catch {
    return DEFAULT_PEAK_WINDOWS;
  }
}

/** 判断指定时刻（按北京时间取小时）是否落在高峰时段。 */
export function isPeakTime(at: Date, windows: PeakWindow[]): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: PRICING_TIMEZONE, hour: 'numeric', hourCycle: 'h23' }).format(at));
  return windows.some(window => hour >= window.startHour && hour < window.endHour);
}

/** 根据请求发生时刻解析应计费档：配置了高峰费率且处于高峰时段时使用高峰价，否则使用基础价（空闲价）。 */
export function resolveRates(model: ModelPricingInput, at: Date): PricingRates {
  const peakConfigured = model.peakInputPointsPerMillion !== null && model.peakCachedInputPointsPerMillion !== null && model.peakOutputPointsPerMillion !== null;
  if (peakConfigured && isPeakTime(at, parsePeakWindows(model.peakWindowsJson))) {
    return { input: model.peakInputPointsPerMillion!, cached: model.peakCachedInputPointsPerMillion!, output: model.peakOutputPointsPerMillion!, peak: true };
  }
  return { input: model.inputPointsPerMillion, cached: model.cachedInputPointsPerMillion, output: model.outputPointsPerMillion, peak: false };
}
