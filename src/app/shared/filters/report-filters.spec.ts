import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { UserPreferencesService } from '../../core/preferences/user-preferences.service';
import { ReportSettings, ReportSettingsService } from '../report-settings.service';
import { formatRange, parseRange } from './range-filter';
import { ReportFilters, bandsFrom, bandsToStored, serverStatusFrom } from './report-filters';

const settings = {
  defaultRange: '30',
  defaultOption: 'DP',
  defaultFeatureGroup: 'All Feature',
} as ReportSettings;

describe('stored filter formats (shared with the company app)', () => {
  it('writes ranges the way it reads them', () => {
    for (const text of ['YTD', '07', 'Mar-2026', 'Q2-2025', '2024']) {
      expect(formatRange(parseRange(text))).toBe(text);
    }
  });

  it('stores bands as colour flags plus the bit mask', () => {
    expect(bandsToStored(['low', 'high'])).toEqual({
      bandstate: 5,
      boolgreen: true,
      boolyellow: false,
      boolred: true,
    });
    expect(bandsFrom({ bandstate: 2, boolgreen: false, boolyellow: true, boolred: false })).toEqual(
      ['medium'],
    );
    expect(bandsFrom(undefined)).toEqual(['low', 'medium', 'high']);
  });

  it('defaults to active license servers only', () => {
    expect(serverStatusFrom(undefined)).toEqual({ active: true, inactive: false });
    expect(serverStatusFrom({ active: false, inactive: true })).toEqual({
      active: false,
      inactive: true,
    });
  });
});

describe('report filters', () => {
  function setUp(saved: Record<string, unknown>) {
    const preferences = {
      load: vi.fn().mockResolvedValue(saved),
      save: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        ReportFilters,
        { provide: ReportSettingsService, useValue: { load: vi.fn().mockResolvedValue(settings) } },
        { provide: UserPreferencesService, useValue: preferences },
      ],
    });
    return { filters: TestBed.inject(ReportFilters), preferences };
  }

  it('starts from the saved choices, and from the app defaults where nothing is saved', async () => {
    const { filters } = setUp({ range_main: 'Q1-2026', not_expired: 'N' });

    await filters.start();

    expect(filters.range()).toEqual({ kind: 'quarter', quarter: 1, year: 2026 });
    expect(filters.notExpired()).toBe(false);
    expect(filters.option()).toBe('DP');
    expect(filters.featureGroup()).toBe('All Feature');
  });

  it('saves when a choice changes, but not just for having started', async () => {
    const { filters, preferences } = setUp({});
    await filters.start();
    TestBed.tick();
    expect(preferences.save).not.toHaveBeenCalled();

    filters.option.set('WAM');
    TestBed.tick();

    expect(preferences.save).toHaveBeenCalledOnce();
    expect(preferences.save.mock.calls[0][0]).toMatchObject({
      option: 'WAM',
      range_main: '30',
      not_expired: 'Y',
    });
  });

  it('does not save the search text', async () => {
    const { filters, preferences } = setUp({});
    await filters.start();

    filters.search.set('catia');
    TestBed.tick();

    expect(preferences.save).not.toHaveBeenCalled();
  });
});

describe('active filters summary', () => {
  async function setUp() {
    TestBed.configureTestingModule({
      providers: [
        ReportFilters,
        { provide: ReportSettingsService, useValue: { load: vi.fn().mockResolvedValue(settings) } },
        {
          provide: UserPreferencesService,
          useValue: { load: vi.fn().mockResolvedValue({}), save: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    });
    const filters = TestBed.inject(ReportFilters);
    await filters.start();
    return filters;
  }

  it('is empty until something is away from its default', async () => {
    const filters = await setUp();
    expect(filters.activeFilters()).toEqual([]);
  });

  it('lists what changed, in plain words', async () => {
    const filters = await setUp();

    filters.search.set('catia');
    filters.option.set('WAM');
    filters.bands.set(['low']);
    filters.notExpired.set(false);

    const labels = filters.activeFilters().map((filter) => filter.label);
    expect(labels).toEqual([
      'Search: "catia"',
      'Option: WAM',
      'Usage: Low',
      'Including expired',
    ]);
  });

  it('clears one filter at a time without touching the others', async () => {
    const filters = await setUp();
    filters.search.set('catia');
    filters.option.set('WAM');

    const searchFilter = filters.activeFilters().find((filter) => filter.key === 'search')!;
    searchFilter.clear();

    expect(filters.search()).toBe('');
    expect(filters.option()).toBe('WAM');
  });

  it('clearAll resets every filter back to its default', async () => {
    const filters = await setUp();
    filters.search.set('catia');
    filters.option.set('WAM');
    filters.bands.set(['low']);
    filters.notExpired.set(false);

    filters.clearAll();

    expect(filters.activeFilters()).toEqual([]);
    expect(filters.search()).toBe('');
    expect(filters.option()).toBe('DP');
    expect(filters.bands()).toEqual(['low', 'medium', 'high']);
    expect(filters.notExpired()).toBe(true);
  });
});
