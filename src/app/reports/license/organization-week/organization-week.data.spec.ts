import { GridFixture } from '../../../../testing/grid-fixture';
import { describe, expect, it } from 'vitest';
import {
  WeekReportRow,
  holidayCall,
  holidaySet,
  pivotWeekRows,
  startOfWeek,
  weekCall,
  weekColumns,
  weekDates,
} from './organization-week.data';

function reportRow(values: Partial<WeekReportRow>): WeekReportRow {
  return {
    sw: 'MATLAB',
    server: 'srv-01',
    lic: 'MATLAB',
    date: '02-Nov-2026',
    qty_i: 10,
    qty_dp: 4,
    di: 3,
    used_lic_hours: 20,
    avail_lic_hours: 80,
    p_dw_q: 25,
    li_holi: 'n',
    ...values,
  };
}

describe('Organization By Week data', () => {
  it('calls the week report with the date range, working hours and primary-feature flag', () => {
    expect(weekCall(new Date(2026, 10, 1), new Date(2026, 10, 7), 9, true)).toBe(
      "call esms_m.r_organization_week_report('2026-11-01','2026-11-07','9','Y');",
    );
    expect(weekCall(new Date(2026, 10, 1), new Date(2026, 10, 7), 24, false)).toBe(
      "call esms_m.r_organization_week_report('2026-11-01','2026-11-07','24','');",
    );
  });

  it('loads the holiday list for the same range', () => {
    expect(holidayCall(new Date(2026, 10, 1), new Date(2026, 10, 7))).toBe(
      "call esms.r_load_holiday_list('2026-11-01','2026-11-07');",
    );
  });

  it('sends the reported failing week as MySQL dates, retaining local midnight', () => {
    const dates = weekDates(startOfWeek(new Date(2026, 10, 15, 0, 0, 0)));
    expect(weekCall(dates[0], dates[6], 7, false)).toBe(
      "call esms_m.r_organization_week_report('2026-11-15','2026-11-21','7','');",
    );
    expect(holidayCall(dates[0], dates[6])).toBe(
      "call esms.r_load_holiday_list('2026-11-15','2026-11-21');",
    );
  });

  it('formats a week crossing a year boundary without shifting its dates', () => {
    const dates = weekDates(startOfWeek(new Date(2027, 0, 1)));
    expect(weekCall(dates[0], dates[6], 7, false)).toBe(
      "call esms_m.r_organization_week_report('2026-12-27','2027-01-02','7','');",
    );
  });

  it('matches SQL-format response dates to the displayed date columns and holidays', () => {
    const [row] = pivotWeekRows(
      [reportRow({ date: '2026-11-15' })],
      holidaySet([{ DATE: '2026-11-15', REMARKS: 'Holiday' }]),
    );
    expect(row.periods['15-Nov-2026']).toMatchObject({ dayPeak: 4, isHoliday: true });
  });

  it('starts every week on its Sunday and spans seven days', () => {
    const start = startOfWeek(new Date(2026, 10, 5)); // a Thursday
    expect(start).toEqual(new Date(2026, 10, 1));
    expect(weekDates(start)).toHaveLength(7);
    expect(weekDates(start)[6]).toEqual(new Date(2026, 10, 7));
  });

  it('pivots one row per server/license, with each date under its own key', () => {
    const rows = pivotWeekRows(
      [
        reportRow({ date: '02-Nov-2026', qty_dp: 4 }),
        reportRow({ date: '03-Nov-2026', qty_dp: 6 }),
        reportRow({ lic: 'SIMULINK', date: '02-Nov-2026', qty_dp: 1 }),
      ],
      new Set(),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].periods['02-Nov-2026'].dayPeak).toBe(4);
    expect(rows[0].periods['03-Nov-2026'].dayPeak).toBe(6);
    expect(rows[0].periods['02-Nov-2026']).toMatchObject({
      issued: 10,
      users: 3,
      usedHours: 20,
      availableHours: 80,
      percent: 25,
    });
    expect(rows[1].lic).toBe('SIMULINK');
  });

  it('marks a date as a holiday from the row itself or from the holiday list', () => {
    const rows = pivotWeekRows(
      [
        reportRow({ date: '02-Nov-2026', li_holi: 'y' }),
        reportRow({ date: '03-Nov-2026' }),
        reportRow({ date: '04-Nov-2026' }),
      ],
      holidaySet([{ DATE: '03-Nov-2026', REMARKS: 'Festival' }]),
    );

    expect(rows[0].periods['02-Nov-2026'].isHoliday).toBe(true);
    expect(rows[0].periods['03-Nov-2026'].isHoliday).toBe(true);
    expect(rows[0].periods['04-Nov-2026'].isHoliday).toBe(false);
  });

  it('builds one column group per date, dropping holidays when only working days are shown', () => {
    const dates = weekDates(new Date(2026, 10, 1));
    const limits = { lowBelow: 60, highFrom: 80 };
    const holidays = new Set(['03-Nov-2026']);
    const groupCount = (workingDaysOnly: boolean) =>
      weekColumns(dates, limits, holidays, workingDaysOnly).filter((column) => 'children' in column)
        .length;

    expect(groupCount(false)).toBe(7);
    expect(groupCount(true)).toBe(6);
  });

  it("reads each date column's value out of that date's period", () => {
    const [row] = pivotWeekRows([reportRow({ date: '02-Nov-2026', qty_i: 12 })], new Set());
    const columns = weekColumns(
      [new Date(2026, 10, 2)],
      { lowBelow: 60, highFrom: 80 },
      new Set(),
      false,
    );
    const dateGroup = columns.find((column) => 'children' in column);
    const issued = dateGroup && 'children' in dateGroup ? dateGroup.children[0] : undefined;
    const valueGetter = issued && 'valueGetter' in issued ? issued.valueGetter : undefined;

    if (typeof valueGetter !== 'function') throw new Error('Missing weekly getter');
    using grid = new GridFixture(row);
    expect(valueGetter(grid.valueParams(row))).toBe(12);
  });
});
