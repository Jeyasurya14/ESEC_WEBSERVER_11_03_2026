import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, parseDate } from '../dates';
import { isNotExpired } from './expiry-filter';
import { featureGroupParam } from './feature-group-filter';
import { percentField, toUsageOption } from './option-filter';
import { parseRange, periodsFor, rangeCall } from './range-filter';
import { matchesServerStatus } from './server-status-filter';
import { bandOf, matchesBands } from './usage-band-filter';

describe('range filter', () => {
  it('calls the procedure that matches each kind of range', () => {
    const call = (range: Parameters<typeof rangeCall>[1]) =>
      rangeCall('esms_m.r_x', range, ['john'], ['All']);

    expect(call({ kind: 'days', days: '30' })).toBe("call esms_m.r_x('john','30','All');");
    expect(call({ kind: 'month', year: 2026, month: 3 })).toBe(
      "call esms_m.r_x_month_year('john','3','2026','All');",
    );
    expect(call({ kind: 'quarter', year: 2026, quarter: 2 })).toBe(
      "call esms_m.r_x_qtr_year('john','2','2026','All');",
    );
    expect(call({ kind: 'year', year: 2025 })).toBe("call esms_m.r_x_year('john','2025','All');");
  });

  it('quotes every value, so a name with a quote cannot break the SQL', () => {
    expect(rangeCall('p', { kind: 'days', days: 'YTD' }, ["o'brien"], [])).toBe(
      "call p('o''brien','YTD');",
    );
  });

  it('reads saved ranges in the formats the company app stored', () => {
    expect(parseRange('YTD')).toEqual({ kind: 'days', days: 'YTD' });
    expect(parseRange('7')).toEqual({ kind: 'days', days: '07' });
    expect(parseRange('Mar-2026')).toEqual({ kind: 'month', month: 3, year: 2026 });
    expect(parseRange('Q4-2025')).toEqual({ kind: 'quarter', quarter: 4, year: 2025 });
    expect(parseRange('2024')).toEqual({ kind: 'year', year: 2024 });
    expect(parseRange('nonsense')).toEqual({ kind: 'days', days: '30' });
  });

  it('lists periods newest first, crossing into the previous year', () => {
    const today = new Date(2026, 0, 15);
    expect(
      periodsFor('month', today)
        .slice(0, 2)
        .map((p) => p.label),
    ).toEqual(['Jan - 2026', 'Dec - 2025']);
    expect(
      periodsFor('quarter', today)
        .slice(0, 2)
        .map((p) => p.label),
    ).toEqual(['Q1 - 2026', 'Q4 - 2025']);
    expect(periodsFor('year', today)[0].range).toEqual({ kind: 'year', year: 2026 });
  });
});

describe('usage bands', () => {
  const limits = { lowBelow: 50, highFrom: 80 };

  it('puts each percentage in one band', () => {
    expect(bandOf(49.9, limits)).toBe('low');
    expect(bandOf(50, limits)).toBe('medium');
    expect(bandOf(80, limits)).toBe('high');
  });

  it('shows every row, even without a value, when all bands are on', () => {
    expect(matchesBands(null, ['low', 'medium', 'high'], limits)).toBe(true);
  });

  it('otherwise keeps only rows with a value in a selected band', () => {
    expect(matchesBands(90, ['high'], limits)).toBe(true);
    expect(matchesBands(10, ['high'], limits)).toBe(false);
    expect(matchesBands('', ['low', 'medium'], limits)).toBe(false);
    expect(matchesBands(10, [], limits)).toBe(false);
  });
});

describe('license server status', () => {
  it('treats Installed as active, anything else as inactive', () => {
    expect(matchesServerStatus('Installed', { active: true, inactive: false })).toBe(true);
    expect(matchesServerStatus('installed', { active: false, inactive: true })).toBe(false);
    expect(matchesServerStatus('Uninstalled', { active: false, inactive: true })).toBe(true);
    expect(matchesServerStatus('Installed', { active: false, inactive: false })).toBe(false);
  });
});

describe('expiry', () => {
  const today = new Date(2026, 5, 15, 13, 0);

  it('reads both date formats the server sends', () => {
    expect(parseDate('2026-06-15')).toEqual(new Date(2026, 5, 15));
    expect(parseDate('15-Jun-2026')).toEqual(new Date(2026, 5, 15));
    expect(parseDate('1-jan-0')).toBeNull();
    expect(parseDate('01-jan-0000')).toBeNull();
  });

  it('keeps licenses expiring today or later, and those with no real expiry date', () => {
    expect(isNotExpired('2026-06-15', today)).toBe(true);
    expect(isNotExpired('2026-06-14', today)).toBe(false);
    expect(isNotExpired('1-jan-0', today)).toBe(true);
    expect(isNotExpired('01-jan-0000', today)).toBe(true);
    expect(isNotExpired('', today)).toBe(true);
  });

  it('shows dates as 15-Jun-2026 and leaves non-dates alone', () => {
    expect(formatDate('2026-06-05')).toBe('05-Jun-2026');
    expect(formatDate('01-jan-0000')).toBe('01-jan-0000');
    expect(formatDateTime(new Date(2026, 2, 5, 9, 4, 7))).toBe('05-Mar-2026 09:04:07');
  });
});

describe('option and feature group', () => {
  it('maps an option to its percentage field, defaulting to Day Peak', () => {
    expect(percentField(toUsageOption('wam'))).toBe('p_wam');
    expect(toUsageOption('unknown')).toBe('DP');
  });

  it('sends the short codes for the built-in feature groups', () => {
    expect(featureGroupParam('All Feature')).toBe('All');
    expect(featureGroupParam('Primary Feature')).toBe('Pri');
    expect(featureGroupParam('CATIA')).toBe('CATIA');
  });
});
