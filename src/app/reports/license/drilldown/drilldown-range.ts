import { literal } from '../../../core/utils/data';
import { ReportRange } from '../../../shared/filters/range-filter';

export const DRILLDOWN_DAY_RANGES = literal([7, 30, 60, 90, 180, 360]);
export type DrilldownDays = (typeof DRILLDOWN_DAY_RANGES)[number];

export interface DrilldownRange {
  startDate: Date;
  endDate: Date;
  workingDaysOnly: boolean;
}

export function drilldownRange(
  days: DrilldownDays,
  workingDaysOnly: boolean,
  today: Date,
): DrilldownRange {
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (days - 1));
  return { startDate, endDate: today, workingDaysOnly };
}

export function reportDrilldownRange(selected: ReportRange, today: Date): DrilldownRange {
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let startDate: Date;
  switch (selected.kind) {
    case 'days':
      startDate = new Date(endDate);
      if (selected.days === 'YTD') startDate = new Date(today.getFullYear(), 0, 1);
      else startDate.setDate(startDate.getDate() - (Number(selected.days) - 1));
      return { startDate, endDate, workingDaysOnly: true };
    case 'month':
      startDate = new Date(selected.year, selected.month - 1, 1);
      return {
        startDate,
        endDate: new Date(selected.year, selected.month, 0),
        workingDaysOnly: true,
      };
    case 'quarter': {
      const month = (selected.quarter - 1) * 3;
      startDate = new Date(selected.year, month, 1);
      return { startDate, endDate: new Date(selected.year, month + 3, 0), workingDaysOnly: true };
    }
    case 'year':
      return {
        startDate: new Date(selected.year, 0, 1),
        endDate: new Date(selected.year, 11, 31),
        workingDaysOnly: true,
      };
  }
}
