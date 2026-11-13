import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api/api.service';
import { Setting } from '../core/models';
import { BrowserStorage, StorageKey } from '../core/storage/browser-storage.service';
import { BAND_COLORS, UsageBand } from './filters/usage-band-filter';

export interface ReportSettings {
  lowBelow: number;
  highFrom: number;
  bandColors: Readonly<Record<UsageBand, string>>;
  workingHoursPerDay: number;
  defaultRange: string;
  defaultOption: string;
  defaultFeatureGroup: string;
  divisionLabel: string;
  departmentLabel: string;
}

interface WorkingHourTimes {
  start: string;
  end: string;
}

const DEFAULT_PERCENTILE = 95;

const WORKING_HOURS_SQL =
  "SELECT ESEC_DESC AS _DESC, ESEC_VALUE AS _VALUE FROM esms.cltx_esec WHERE ESEC_DESC IN ('HOUR_START_USAGE', 'HOUR_END_USAGE')";

@Injectable({ providedIn: 'root' })
export class ReportSettingsService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(BrowserStorage);
  private loading: Promise<ReportSettings> | null = null;

  load(): Promise<ReportSettings> {
    this.loading ??= this.fetch().catch((error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
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

    saveSetting(StorageKey.licenseHoursPerDay, reportSettings.workingHoursPerDay);
    saveSetting(StorageKey.longDuration, reportSettings.workingHoursPerDay);
    saveSetting(StorageKey.percentile, DEFAULT_PERCENTILE);
    saveSetting(StorageKey.defaultPercentile, DEFAULT_PERCENTILE);
  }

  private async fetchWorkingHours(): Promise<WorkingHourTimes> {
    const settingsResponse = await firstValueFrom(this.api.query<Setting[]>(WORKING_HOURS_SQL));
    if (settingsResponse?.status !== 'PASS' || !Array.isArray(settingsResponse.message)) {
      throw new Error('Unable to load the working hours setting.');
    }

    const valueFor = (settingName: string) =>
      settingsResponse.message.find((setting) => setting._DESC === settingName)?._VALUE ?? '';
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
