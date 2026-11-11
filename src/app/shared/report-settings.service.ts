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
    const setting = (name: string, fallback: string) => this.api.getSetting(name) || fallback;
    const hours = await this.fetchWorkingHours();

    const settings: ReportSettings = {
      lowBelow: Number(setting('CBAND_1_VALUE', '50')),
      highFrom: Number(setting('CBAND_2_VALUE', '80')),
      bandColors: {
        low: setting('CBAND_1_COLOR', BAND_COLORS.low),
        medium: setting('CBAND_2_COLOR', BAND_COLORS.medium),
        high: setting('CBAND_3_COLOR', BAND_COLORS.high),
      },
      workingHoursPerDay: workingHours(hours.start, hours.end),
      defaultRange: setting('DASHBOARD_SELECT_OPTION_DEFAULT', '30'),
      defaultOption: setting('DASHBOARD_OPTION_V3', 'DP'),
      defaultFeatureGroup: setting('MY_FEATURE', 'All Feature'),
      divisionLabel: setting('LBL_DIVN', 'Divn'),
      departmentLabel: setting('LBL_DEPT', 'Dept'),
    };

    this.remember(settings, hours);
    return settings;
  }

  /**
   * Keeps a copy of the settings in the browser, and starts the report parameters (license hours
   * per day, long duration, percentile) at their defaults for this session, as the company app does.
   */
  private remember(settings: ReportSettings, hours: WorkingHourTimes): void {
    const store = (key: StorageKey, value: string | number) => this.storage.set(key, value);

    store(StorageKey.bandLowBelow, settings.lowBelow);
    store(StorageKey.bandHighFrom, settings.highFrom);
    store(StorageKey.bandLowColor, settings.bandColors.low);
    store(StorageKey.bandMediumColor, settings.bandColors.medium);
    store(StorageKey.bandHighColor, settings.bandColors.high);
    store(StorageKey.workingHoursPerDay, settings.workingHoursPerDay);
    store(StorageKey.workingHourStart, hours.start);
    store(StorageKey.workingHourEnd, hours.end);

    store(StorageKey.licenseHoursPerDay, settings.workingHoursPerDay);
    store(StorageKey.longDuration, settings.workingHoursPerDay);
    store(StorageKey.percentile, DEFAULT_PERCENTILE);
    store(StorageKey.defaultPercentile, DEFAULT_PERCENTILE);
  }

  private async fetchWorkingHours(): Promise<WorkingHourTimes> {
    const result = await firstValueFrom(this.api.query<Setting[]>(WORKING_HOURS_SQL));
    if (result?.status !== 'PASS' || !Array.isArray(result.message)) {
      throw new Error('Unable to load the working hours setting.');
    }

    const timeOf = (name: string) => result.message.find((row) => row._DESC === name)?._VALUE ?? '';
    return { start: timeOf('HOUR_START_USAGE'), end: timeOf('HOUR_END_USAGE') };
  }
}

/** Hours between two "HH:MM[:SS]" times, to 2 decimals. Falls back to a full day when either is missing. */
export function workingHours(start: string, end: string): number {
  if (!start || !end) {
    return 24;
  }

  const toHours = (time: string) => {
    const [h, m = 0, s = 0] = time.split(':').map(Number);
    return h + m / 60 + s / 3600;
  };

  const hours = toHours(end) - toHours(start);
  return Number.isFinite(hours) && hours > 0 ? Number(hours.toFixed(2)) : 24;
}
