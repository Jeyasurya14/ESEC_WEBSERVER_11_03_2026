import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import {
  StoredPreferences,
  UserPreferencesService,
} from '../../core/preferences/user-preferences.service';
import { readColumnVisibility } from '../grid/column-visibility';
import { ReportSettings, ReportSettingsService } from '../report-settings.service';
import { UsageOption, toUsageOption } from './option-filter';
import { ReportRange, formatRange, parseRange } from './range-filter';
import { ServerStatus } from './server-status-filter';
import { ALL_BANDS, UsageBand } from './usage-band-filter';
import { isRecord } from '../../core/utils/data';
import { BrowserStorage } from '../../core/storage/browser-storage.service';
import { reportParameter, restoreReportDefaults } from '../status-bar/report-controls';

const DEFAULT_SERVER_STATUS: Readonly<ServerStatus> = { active: true, inactive: false };

@Injectable()
export class ReportFilters {
  private readonly settingsService = inject(ReportSettingsService);
  private readonly preferenceService = inject(UserPreferencesService);
  private readonly storage = inject(BrowserStorage);

  readonly settings = signal<ReportSettings | null>(null);
  readonly error = signal('');

  readonly range = signal<ReportRange>({ kind: 'days', days: '30' });
  readonly featureGroup = signal('All Feature');
  readonly option = signal<UsageOption>('WP');
  readonly bands = signal<UsageBand[]>([...ALL_BANDS]);
  readonly serverStatus = signal<ServerStatus>({ ...DEFAULT_SERVER_STATUS });
  readonly notExpired = signal(true);

  readonly search = signal('');
  readonly hiddenColumns = signal<Record<string, boolean>>(readColumnVisibility(undefined));

  private lastSavedSnapshot = '';

  constructor() {
    effect(() => {
      if (!this.settings()) {
        return;
      }
      const savedChoices = this.toSavedPreferences();
      const snapshot = JSON.stringify(savedChoices);
      if (snapshot !== this.lastSavedSnapshot) {
        this.lastSavedSnapshot = snapshot;
        untracked(() => void this.preferenceService.save(savedChoices));
      }
    });
  }

  async start(initialRange?: ReportRange): Promise<boolean> {
    this.error.set('');
    try {
      const [settings, savedPreferences] = await Promise.all([
        this.settingsService.load(),
        this.preferenceService.load(),
      ]);
      this.restore(savedPreferences, settings);
      restoreReportDefaults(this.storage, savedPreferences);
      if (initialRange) this.range.set(initialRange);
      this.lastSavedSnapshot = JSON.stringify(this.toSavedPreferences());
      this.settings.set({
        ...settings,
        workingHoursPerDay: reportParameter(
          this.storage,
          'usageHours',
          settings.workingHoursPerDay,
        ),
      });
      return true;
    } catch {
      this.error.set('Unable to load the report settings. Please refresh to try again.');
      return false;
    }
  }

  private restore(savedPreferences: StoredPreferences, settings: ReportSettings): void {
    this.range.set(
      parseRange(preferenceText(savedPreferences['range_main']) || settings.defaultRange),
    );
    this.option.set(
      toUsageOption(preferenceText(savedPreferences['option']) || settings.defaultOption),
    );
    this.featureGroup.set(
      preferenceText(savedPreferences['my_feature']) || settings.defaultFeatureGroup,
    );
    this.bands.set(bandsFrom(savedPreferences['lmh_check']));
    this.serverStatus.set(serverStatusFrom(savedPreferences['act_inact']));
    this.notExpired.set(savedPreferences['not_expired'] !== 'N');
    this.hiddenColumns.set(readColumnVisibility(savedPreferences['my_columns']));
  }

  private toSavedPreferences(): StoredPreferences {
    return {
      range_main: formatRange(this.range()),
      option: this.option(),
      my_feature: this.featureGroup(),
      lmh_check: bandsToStored(this.bands()),
      act_inact: { ...this.serverStatus() },
      not_expired: this.notExpired() ? 'Y' : 'N',
    };
  }
}

function preferenceText(preferenceValue: unknown): string {
  return typeof preferenceValue === 'string' || typeof preferenceValue === 'number'
    ? String(preferenceValue)
    : '';
}

interface StoredBands {
  bandstate: number;
  boolgreen: boolean;
  boolyellow: boolean;
  boolred: boolean;
}

const BAND_PREFERENCE_KEYS: Record<UsageBand, 'boolgreen' | 'boolyellow' | 'boolred'> = {
  low: 'boolgreen',
  medium: 'boolyellow',
  high: 'boolred',
};

export function bandsFrom(savedBands: unknown): UsageBand[] {
  if (!isRecord(savedBands)) {
    return [...ALL_BANDS];
  }
  return ALL_BANDS.filter((band) => savedBands[BAND_PREFERENCE_KEYS[band]] !== false);
}

export function bandsToStored(bands: UsageBand[]): StoredBands {
  const includesBand = (band: UsageBand) => bands.includes(band);
  return {
    bandstate:
      (includesBand('low') ? 4 : 0) |
      (includesBand('medium') ? 2 : 0) |
      (includesBand('high') ? 1 : 0),
    boolgreen: includesBand('low'),
    boolyellow: includesBand('medium'),
    boolred: includesBand('high'),
  };
}

export function serverStatusFrom(savedValue: unknown): ServerStatus {
  if (!isRecord(savedValue)) {
    return { ...DEFAULT_SERVER_STATUS };
  }
  return { active: savedValue['active'] !== false, inactive: savedValue['inactive'] === true };
}
