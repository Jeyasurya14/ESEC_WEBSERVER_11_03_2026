import { describe, expect, it } from 'vitest';
import { formatSqlDate } from '../../../shared/dates';
import { ReportRange } from '../../../shared/filters/range-filter';
import { reportDrilldownRange } from './drilldown-range';

describe('bottom report period', () => {
  const today = new Date(2026, 10, 15, 17, 30);
  it.each<[ReportRange, string, string]>([
    [{ kind: 'days', days: '07' }, '2026-11-09', '2026-11-15'],
    [{ kind: 'days', days: '30' }, '2026-10-17', '2026-11-15'],
    [{ kind: 'days', days: 'YTD' }, '2026-01-01', '2026-11-15'],
    [{ kind: 'month', month: 2, year: 2024 }, '2024-02-01', '2024-02-29'],
    [{ kind: 'quarter', quarter: 4, year: 2025 }, '2025-10-01', '2025-12-31'],
    [{ kind: 'year', year: 2025 }, '2025-01-01', '2025-12-31'],
  ])('resolves %j into SQL-safe local calendar boundaries', (selected, from, to) => {
    const range = reportDrilldownRange(selected, today);
    expect(formatSqlDate(range.startDate)).toBe(from);
    expect(formatSqlDate(range.endDate)).toBe(to);
    expect(range.workingDaysOnly).toBe(true);
    expect(today).toEqual(new Date(2026, 10, 15, 17, 30));
  });

  it('resolves relative periods afresh after midnight rather than caching yesterday', () => {
    const selected: ReportRange = { kind: 'days', days: '07' };
    expect(formatSqlDate(reportDrilldownRange(selected, today).endDate)).toBe('2026-11-15');
    expect(formatSqlDate(reportDrilldownRange(selected, new Date(2026, 10, 16)).endDate)).toBe(
      '2026-11-16',
    );
  });
});
