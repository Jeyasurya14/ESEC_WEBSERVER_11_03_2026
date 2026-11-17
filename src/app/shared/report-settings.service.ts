import { namedValues } from '../core/utils/data';
import { apiRequest } from '../core/api/api-request';
import { Injectable, inject, DestroyRef } from '@angular/core';

import { ApiService } from '../core/api/api.service';
import { LoginService } from '../core/auth/login.service';
import { Setting } from '../core/models';
import { BrowserStorage, StorageKey } from '../core/storage/browser-storage.service';
import { BAND_COLORS, UsageBand } from './filters/usage-band-filter';

export interface ReportSettings {
  lowBelow: number;
  highFrom: number;
  bandColors: Readonly<Record<UsageBand, string>>;
  heatmapColors: HeatmapColorScale;
  workingHoursPerDay: number;
  defaultRange: string;
  defaultOption: string;
  defaultFeatureGroup: string;
  divisionLabel: string;
  departmentLabel: string;
}

/** The hourly-usage heatmap's colour for each percentage band, lowest first. */
export interface HeatmapColorScale {
  from0To50: string;
  from50To60: string;
  from60To70: string;
  from70To80: string;
  from80To90: string;
  from90To99: string;
  at100: string;
}

export const DEFAULT_HEATMAP_COLORS: HeatmapColorScale = {
  from0To50: '#C7E9FF',
  from50To60: '#00BFFF',
  from60To70: '#77DD77',
  from70To80: '#FEF070',
  from80To90: '#FF8508',
  from90To99: '#FF6961',
  at100: '#FF0000',
};

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  lowBelow: 60,
  highFrom: 80,
  workingHoursPerDay: 24,
  heatmapColors: DEFAULT_HEATMAP_COLORS,
  bandColors: { low: '#10b981', medium: '#f59e0b', high: '#ef4444' },
  defaultRange: '30',
  defaultOption: 'DP',
  defaultFeatureGroup: 'All Feature',
  divisionLabel: 'Division',
  departmentLabel: 'Department',
};
interface WorkingHourTimes {
  start: string;
  end: string;
}

const DEFAULT_PERCENTILE = 95;

const WORKING_HOURS_SQL =
  "SELECT ESEC_DESC AS _DESC, ESEC_VALUE AS _VALUE FROM esms.cltx_esec WHERE ESEC_DESC IN ('HOUR_START_USAGE', 'HOUR_END_USAGE')";

@Injectable({ providedIn: 'root' })
export class ReportSettingsService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly api = inject(ApiService);
  private readonly storage = inject(BrowserStorage);
  private readonly loginService = inject(LoginService);
  private settingsPromise: Promise<ReportSettings> | null = null;
  private settingsSession: unknown = null;

  load(): Promise<ReportSettings> {
    // Sign-out clears the browser copies `remember` writes, so each sign-in loads again.
    const session = this.loginService.user();
    if (session !== this.settingsSession) {
      this.settingsSession = session;
      this.settingsPromise = null;
    }
    this.settingsPromise ??= this.fetch().catch((error: unknown) => {
      this.settingsPromise = null;
      throw error;
    });
    return this.settingsPromise;
  }

  private async fetch(): Promise<ReportSettings> {
    const getSettingOrDefault = (settingName: string, fallbackValue: string) =>
      this.api.getSetting(settingName) || fallbackValue;
    const workingHourTimes = await this.fetchWorkingHours();

    const reportSettings: ReportSettings = {
      lowBelow: Number(getSettingOrDefault('CBAND_1_VALUE', '60')),
      highFrom: Number(getSettingOrDefault('CBAND_2_VALUE', '80')),
      bandColors: {
        low: getSettingOrDefault('CBAND_1_COLOR', BAND_COLORS.low),
        medium: getSettingOrDefault('CBAND_2_COLOR', BAND_COLORS.medium),
        high: getSettingOrDefault('CBAND_3_COLOR', BAND_COLORS.high),
      },
      heatmapColors: {
        from0To50: getSettingOrDefault('HEATMAP_0_50', DEFAULT_HEATMAP_COLORS.from0To50),
        from50To60: getSettingOrDefault('HEATMAP_50_60', DEFAULT_HEATMAP_COLORS.from50To60),
        from60To70: getSettingOrDefault('HEATMAP_60_70', DEFAULT_HEATMAP_COLORS.from60To70),
        from70To80: getSettingOrDefault('HEATMAP_70_80', DEFAULT_HEATMAP_COLORS.from70To80),
        from80To90: getSettingOrDefault('HEATMAP_80_90', DEFAULT_HEATMAP_COLORS.from80To90),
        from90To99: getSettingOrDefault('HEATMAP_90_99', DEFAULT_HEATMAP_COLORS.from90To99),
        at100: getSettingOrDefault('HEATMAP_100', DEFAULT_HEATMAP_COLORS.at100),
      },
      workingHoursPerDay: workingHours(workingHourTimes.start, workingHourTimes.end),
      defaultRange: getSettingOrDefault('DASHBOARD_SELECT_OPTION_DEFAULT', '30'),
      defaultOption: getSettingOrDefault('DASHBOARD_OPTION_V3', 'DP'),
      defaultFeatureGroup: getSettingOrDefault('MY_FEATURE', 'All Feature'),
      divisionLabel: getSettingOrDefault('LBL_DIVN', 'Divn'),
      departmentLabel: getSettingOrDefault('LBL_DEPT', 'Dept'),
    };

    this.remember(reportSettings, workingHourTimes);
    return reportSettings;
  }

  private remember(reportSettings: ReportSettings, workingHourTimes: WorkingHourTimes): void {
    const saveSetting = (storageKey: StorageKey, storageValue: string | number) =>
      this.storage.set(storageKey, storageValue);

    saveSetting(StorageKey.bandLowBelow, reportSettings.lowBelow);
    saveSetting(StorageKey.bandHighFrom, reportSettings.highFrom);
    saveSetting(StorageKey.bandLowColor, reportSettings.bandColors.low);
    saveSetting(StorageKey.bandMediumColor, reportSettings.bandColors.medium);
    saveSetting(StorageKey.bandHighColor, reportSettings.bandColors.high);
    saveSetting(StorageKey.workingHoursPerDay, reportSettings.workingHoursPerDay);
    saveSetting(StorageKey.workingHourStart, workingHourTimes.start);
    saveSetting(StorageKey.workingHourEnd, workingHourTimes.end);
    saveSetting(
      StorageKey.reportStartTime,
      this.api.getSetting('HOUR_START_UTILIZATION').slice(0, 5) ||
        workingHourTimes.start.slice(0, 5) ||
        '00:00',
    );
    saveSetting(
      StorageKey.reportEndTime,
      this.api.getSetting('HOUR_END_UTILIZATION').slice(0, 5) ||
        workingHourTimes.end.slice(0, 5) ||
        '23:59',
    );

    saveSetting(StorageKey.licenseHoursPerDay, reportSettings.workingHoursPerDay);
    saveSetting(StorageKey.longDuration, reportSettings.workingHoursPerDay);
    saveSetting(StorageKey.percentile, DEFAULT_PERCENTILE);
    saveSetting(StorageKey.defaultPercentile, DEFAULT_PERCENTILE);
  }

  private async fetchWorkingHours(): Promise<WorkingHourTimes> {
    const settingsResponse = await apiRequest(
      this.api.query<Setting[]>(WORKING_HOURS_SQL),
      this.destroyRef,
    );
    if (settingsResponse?.status !== 'PASS' || !Array.isArray(settingsResponse.message)) {
      throw new Error('Unable to load the working hours setting.');
    }

    const values = namedValues(settingsResponse.message);
    const valueFor = (settingName: string) => values.get(settingName) ?? '';
    return { start: valueFor('HOUR_START_USAGE'), end: valueFor('HOUR_END_USAGE') };
  }
}

export function workingHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) {
    return 24;
  }

  const timeToHours = (timeText: string) => {
    const [hour, minute = 0, second = 0] = timeText.split(':').map(Number);
    return hour + minute / 60 + second / 3600;
  };

  const totalHours = timeToHours(endTime) - timeToHours(startTime);
  return Number.isFinite(totalHours) && totalHours > 0 ? Number(totalHours.toFixed(2)) : 24;
}
