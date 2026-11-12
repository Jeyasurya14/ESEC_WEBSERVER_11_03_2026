import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  StoredPreferences,
  UserPreferencesService,
} from '../../core/preferences/user-preferences.service';
import { myColumnsFrom } from '../grid/my-columns';
import { ReportSettings, ReportSettingsService } from '../report-settings.service';
import { UsageOption, toUsageOption } from './option-filter';
import { ReportRange, formatRange, parseRange, rangeLabel, sameRange } from './range-filter';
import { ServerStatus } from './server-status-filter';
import { ALL_BANDS, UsageBand } from './usage-band-filter';

export const DEFAULT_SERVER_STATUS: Readonly<ServerStatus> = { active: true, inactive: false };

/** One filter that is away from its default - shown as a chip the user can clear on its own. */
export interface ActiveFilter {
  readonly key: string;
  readonly label: string;
  clear(): void;
}

@Injectable()
export class ReportFilters {
  private readonly settingsService = inject(ReportSettingsService);
  private readonly preferences = inject(UserPreferencesService);

  readonly settings = signal<ReportSettings | null>(null);
  readonly error = signal('');

  readonly range = signal<ReportRange>({ kind: 'days', days: '30' });
  readonly featureGroup = signal('All Feature');
  readonly option = signal<UsageOption>('DP');
  readonly bands = signal<UsageBand[]>([...ALL_BANDS]);
  readonly serverStatus = signal<ServerStatus>({ ...DEFAULT_SERVER_STATUS });
  readonly notExpired = signal(true);

  readonly search = signal('');
  readonly myColumns = signal<Record<string, boolean>>(myColumnsFrom(undefined));

  private lastSaved = '';

  /** Every filter currently away from its default, for a summary bar with per-filter clear buttons. */
  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const settings = this.settings();
    if (!settings) {
      return [];
    }

    const active: ActiveFilter[] = [];
    const add = (key: string, label: string, clear: () => void) => active.push({ key, label, clear });

    if (this.search().trim()) {
      add('search', `Search: "${this.search().trim()}"`, () => this.search.set(''));
    }
    if (!sameRange(this.range(), parseRange(settings.defaultRange))) {
      const defaultRange = parseRange(settings.defaultRange);
      add('range', `Range: ${rangeLabel(this.range())}`, () => this.range.set(defaultRange));
    }
    if (this.option() !== toUsageOption(settings.defaultOption)) {
      const defaultOption = toUsageOption(settings.defaultOption);
      add('option', `Option: ${this.option()}`, () => this.option.set(defaultOption));
    }
    if (this.featureGroup() !== settings.defaultFeatureGroup) {
      add('feature', `Feature: ${this.featureGroup()}`, () =>
        this.featureGroup.set(settings.defaultFeatureGroup),
      );
    }
    if (this.bands().length !== ALL_BANDS.length) {
      add('bands', `Usage: ${bandsLabel(this.bands())}`, () => this.bands.set([...ALL_BANDS]));
    }
    if (!isDefaultServerStatus(this.serverStatus())) {
      add('serverStatus', serverStatusLabel(this.serverStatus()), () =>
        this.serverStatus.set({ ...DEFAULT_SERVER_STATUS }),
      );
    }
    if (!this.notExpired()) {
      add('notExpired', 'Including expired', () => this.notExpired.set(true));
    }

    return active;
  });

  /** Resets every filter to its default - the app settings' defaults where it has one. */
  clearAll(): void {
    const settings = this.settings();
    if (!settings) {
      return;
    }
    this.search.set('');
    this.range.set(parseRange(settings.defaultRange));
    this.option.set(toUsageOption(settings.defaultOption));
    this.featureGroup.set(settings.defaultFeatureGroup);
    this.bands.set([...ALL_BANDS]);
    this.serverStatus.set({ ...DEFAULT_SERVER_STATUS });
    this.notExpired.set(true);
  }

  constructor() {
    effect(() => {
      const choices = this.choices();
      if (!this.settings()) {
        return;
      }
      const snapshot = JSON.stringify(choices);
      if (snapshot !== this.lastSaved) {
        this.lastSaved = snapshot;
        untracked(() => void this.preferences.save(choices));
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
      this.apply(saved, settings);
      this.lastSaved = JSON.stringify(this.choices());
      this.settings.set(settings);
      return true;
    } catch {
      this.error.set('Unable to load the report settings. Please refresh to try again.');
      return false;
    }
  }

  private apply(saved: StoredPreferences, settings: ReportSettings): void {
    this.range.set(parseRange(text(saved['range_main']) || settings.defaultRange));
    this.option.set(toUsageOption(text(saved['option']) || settings.defaultOption));
    this.featureGroup.set(text(saved['my_feature']) || settings.defaultFeatureGroup);
    this.bands.set(bandsFrom(saved['lmh_check']));
    this.serverStatus.set(serverStatusFrom(saved['act_inact']));
    this.notExpired.set(saved['not_expired'] !== 'N');
    this.myColumns.set(myColumnsFrom(saved['my_columns']));
  }

  private choices(): StoredPreferences {
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

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

interface StoredBands {
  bandstate: number;
  boolgreen: boolean;
  boolyellow: boolean;
  boolred: boolean;
}

const colourKey: Record<UsageBand, 'boolgreen' | 'boolyellow' | 'boolred'> = {
  low: 'boolgreen',
  medium: 'boolyellow',
  high: 'boolred',
};

export function bandsFrom(saved: unknown): UsageBand[] {
  const flags = saved as Partial<StoredBands> | undefined;
  if (!flags || typeof flags !== 'object') {
    return [...ALL_BANDS];
  }
  return ALL_BANDS.filter((band) => flags[colourKey[band]] !== false);
}

export function bandsToStored(bands: UsageBand[]): StoredBands {
  const has = (band: UsageBand) => bands.includes(band);
  return {
    bandstate: (has('low') ? 4 : 0) | (has('medium') ? 2 : 0) | (has('high') ? 1 : 0),
    boolgreen: has('low'),
    boolyellow: has('medium'),
    boolred: has('high'),
  };
}

export function serverStatusFrom(saved: unknown): ServerStatus {
  const status = saved as Partial<ServerStatus> | undefined;
  if (!status || typeof status !== 'object') {
    return { ...DEFAULT_SERVER_STATUS };
  }
  return { active: status.active !== false, inactive: status.inactive === true };
}

function isDefaultServerStatus(status: ServerStatus): boolean {
  return status.active === DEFAULT_SERVER_STATUS.active && status.inactive === DEFAULT_SERVER_STATUS.inactive;
}

function serverStatusLabel(status: ServerStatus): string {
  const parts = [status.active && 'Active', status.inactive && 'Inactive'].filter(Boolean);
  return `License Server: ${parts.length ? parts.join(' & ') : 'None'}`;
}

function bandsLabel(bands: UsageBand[]): string {
  const capitalize = (band: UsageBand) => band[0].toUpperCase() + band.slice(1);
  return bands.length ? bands.map(capitalize).join(', ') : 'None';
}
