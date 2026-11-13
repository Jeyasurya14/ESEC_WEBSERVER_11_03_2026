import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import {
  StoredPreferences,
  UserPreferencesService,
} from '../../core/preferences/user-preferences.service';
import { myColumnsFrom } from '../grid/my-columns';
import { ReportSettings, ReportSettingsService } from '../report-settings.service';
import { UsageOption, toUsageOption } from './option-filter';
import { ReportRange, formatRange, parseRange } from './range-filter';
import { ServerStatus } from './server-status-filter';
import { ALL_BANDS, UsageBand } from './usage-band-filter';

const DEFAULT_SERVER_STATUS: Readonly<ServerStatus> = { active: true, inactive: false };

@Injectable()
export class ReportFilters {
  private readonly settingsService = inject(ReportSettingsService);
  private readonly preferences = inject(UserPreferencesService);

  readonly settings = signal<ReportSettings | null>(null);
  readonly error = signal('');

  readonly range = signal<ReportRange>({ kind: 'days', days: '30' });
  readonly featureGroup = signal('All Feature');
  readonly option = signal<UsageOption>('WP');
  readonly bands = signal<UsageBand[]>([...ALL_BANDS]);
  readonly serverStatus = signal<ServerStatus>({ ...DEFAULT_SERVER_STATUS });
  readonly notExpired = signal(true);

  readonly search = signal('');
  readonly myColumns = signal<Record<string, boolean>>(myColumnsFrom(undefined));

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
        untracked(() => void this.preferences.save(savedChoices));
      }
    });
  }

  async start(): Promise<boolean> {
    this.error.set('');
    try {
      const [settings, saved] = await Promise.all([
        this.settingsService.load(),
        this.preferences.load(),
      ]);
      this.restore(saved, settings);
      this.lastSavedSnapshot = JSON.stringify(this.toSavedPreferences());
      this.settings.set(settings);
      return true;
    } catch {
      this.error.set('Unable to load the report settings. Please refresh to try again.');
      return false;
    }
  }

  private restore(saved: StoredPreferences, settings: ReportSettings): void {
    this.range.set(parseRange(preferenceText(saved['range_main']) || settings.defaultRange));
    this.option.set(toUsageOption(preferenceText(saved['option']) || settings.defaultOption));
    this.featureGroup.set(preferenceText(saved['my_feature']) || settings.defaultFeatureGroup);
    this.bands.set(bandsFrom(saved['lmh_check']));
    this.serverStatus.set(serverStatusFrom(saved['act_inact']));
    this.notExpired.set(saved['not_expired'] !== 'N');
    this.myColumns.set(myColumnsFrom(saved['my_columns']));
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

export function bandsFrom(saved: unknown): UsageBand[] {
  const savedFlags = saved as Partial<StoredBands> | undefined;
  if (!savedFlags || typeof savedFlags !== 'object') {
    return [...ALL_BANDS];
  }
  return ALL_BANDS.filter((band) => savedFlags[BAND_PREFERENCE_KEYS[band]] !== false);
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

export function serverStatusFrom(saved: unknown): ServerStatus {
  const savedStatus = saved as Partial<ServerStatus> | undefined;
  if (!savedStatus || typeof savedStatus !== 'object') {
    return { ...DEFAULT_SERVER_STATUS };
  }
  return { active: savedStatus.active !== false, inactive: savedStatus.inactive === true };
}
