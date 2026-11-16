import { BrowserStorage, StorageKey } from '../../core/storage/browser-storage.service';
import { StoredPreferences } from '../../core/preferences/user-preferences.service';
import { formatSqlDate, parseDate } from '../dates';
import { ReportRange } from '../filters/range-filter';
import { hasKey } from '../../core/utils/data';

export interface ReportDates {
  start: string;
  end: string;
}
export interface ReportTimes {
  startTime: string;
  endTime: string;
}
export type ReportParameterKey = 'usageHours' | 'percentile' | 'longDuration' | 'cpuHours';
export type ReportParameters = Partial<Record<ReportParameterKey, number>>;
interface Control<T> {
  value: () => T;
  set: (parameterValue: T) => void;
}

/** Each report exposes only the controls its query or local calculations actually use. */
export interface ReportControls {
  range?: Control<ReportRange>;
  dates?: Control<ReportDates>;
  times?: Control<ReportTimes>;
  parameters?: Control<ReportParameters>;
}

export const REPORT_PARAMETERS: Record<
  ReportParameterKey,
  {
    label: string;
    min: number;
    max?: number;
    step: number;
    preference: string;
    storage: StorageKey;
  }
> = {
  usageHours: {
    label: 'Usage Per Day',
    min: 0.01,
    max: 24,
    step: 0.01,
    preference: 'parameters_lhpd',
    storage: StorageKey.licenseHoursPerDay,
  },
  percentile: {
    label: 'Percentile',
    min: 0,
    max: 100,
    step: 1,
    preference: 'parameters_percentile',
    storage: StorageKey.percentile,
  },
  longDuration: {
    label: 'Long Duration',
    min: 0.01,
    step: 0.01,
    preference: 'parameters_long_duration',
    storage: StorageKey.longDuration,
  },
  cpuHours: {
    label: 'CPU Hours Per Day',
    min: 0.01,
    step: 0.01,
    preference: 'parameters_cpu_hours_per_day',
    storage: StorageKey.cpuHoursPerDay,
  },
};

export function validParameter(parameterName: ReportParameterKey, parameterValue: number): boolean {
  const parameterRule = REPORT_PARAMETERS[parameterName];
  return (
    Number.isFinite(parameterValue) &&
    parameterValue >= parameterRule.min &&
    (parameterRule.max === undefined || parameterValue <= parameterRule.max)
  );
}

export function reportParameter(
  storage: BrowserStorage,
  parameterName: ReportParameterKey,
  defaultValue: number,
): number {
  const storedText = storage.get(REPORT_PARAMETERS[parameterName].storage);
  const parameterValue = storedText?.trim() ? Number(storedText) : NaN;
  return validParameter(parameterName, parameterValue) ? parameterValue : defaultValue;
}

export function validReportDates(dateRange: ReportDates): boolean {
  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  return (
    dateFormat.test(dateRange.start) &&
    dateFormat.test(dateRange.end) &&
    !!parseDate(dateRange.start) &&
    !!parseDate(dateRange.end) &&
    dateRange.start <= dateRange.end
  );
}
export function validReportTimes(timeRange: ReportTimes): boolean {
  const timeFormat = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return (
    timeFormat.test(timeRange.startTime) &&
    timeFormat.test(timeRange.endTime) &&
    timeRange.startTime < timeRange.endTime
  );
}

export function reportTimes(storage: BrowserStorage): ReportTimes {
  const savedTimes = {
    startTime: storage.get(StorageKey.reportStartTime) ?? '',
    endTime: storage.get(StorageKey.reportEndTime) ?? '',
  };
  if (validReportTimes(savedTimes)) return savedTimes;
  const workingTimes = {
    startTime: storage.get(StorageKey.workingHourStart)?.slice(0, 5) ?? '',
    endTime: storage.get(StorageKey.workingHourEnd)?.slice(0, 5) ?? '',
  };
  return validReportTimes(workingTimes) ? workingTimes : { startTime: '00:00', endTime: '23:59' };
}

/** Restore the company preference keys without making another API request per report. */
export function restoreReportDefaults(
  storage: BrowserStorage,
  savedPreferences: StoredPreferences,
): void {
  for (const parameterName of Object.keys(REPORT_PARAMETERS)) {
    if (!hasKey(REPORT_PARAMETERS, parameterName)) continue;
    const parameterRule = REPORT_PARAMETERS[parameterName];
    const storedValue = savedPreferences[parameterRule.preference];
    const parameterValue =
      typeof storedValue === 'string' && storedValue.trim() === ''
        ? NaN
        : Number(storedValue ?? NaN);
    if (validParameter(parameterName, parameterValue))
      storage.set(parameterRule.storage, parameterValue);
  }
  const times = {
    startTime: String(savedPreferences['range_sub_stime'] ?? '').slice(0, 5),
    endTime: String(savedPreferences['range_sub_etime'] ?? '').slice(0, 5),
  };
  if (validReportTimes(times)) {
    storage.set(StorageKey.reportStartTime, times.startTime);
    storage.set(StorageKey.reportEndTime, times.endTime);
  }
  const preset = String(savedPreferences['range_sub'] ?? '');
  const startDate = parseDate(savedPreferences['range_sub_sdate']);
  const endDate = parseDate(savedPreferences['range_sub_edate']);
  if (startDate && endDate && startDate <= endDate) {
    storage.set(StorageKey.reportStartDate, formatSqlDate(startDate));
    storage.set(StorageKey.reportEndDate, formatSqlDate(endDate));
    storage.set(StorageKey.reportRange, preset || 'daterange');
  } else if (isDatePreset(preset)) storage.set(StorageKey.reportRange, preset);
}

function isDatePreset(presetName: string): boolean {
  return ['1', 'today', 'week', 'ytd', '7', '07', '30', '60', '90', '180', '360'].includes(
    presetName.toLowerCase(),
  );
}

export function reportDates(storage: BrowserStorage, defaultDates: ReportDates): ReportDates {
  const preset = storage.get(StorageKey.reportRange) ?? '';
  if (isDatePreset(preset)) return datePreset(preset.toLowerCase() === 'ytd' ? 'YTD' : preset);
  const dates = {
    start: storage.get(StorageKey.reportStartDate) ?? '',
    end: storage.get(StorageKey.reportEndDate) ?? '',
  };
  return validReportDates(dates) ? dates : defaultDates;
}

export function datePreset(preset: string, today = new Date()): ReportDates {
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(endDate);
  if (preset === 'YTD') startDate.setMonth(0, 1);
  else if (preset === 'week') startDate.setDate(startDate.getDate() - startDate.getDay());
  else startDate.setDate(startDate.getDate() - (Math.max(1, Number(preset) || 1) - 1));
  return { start: formatSqlDate(startDate), end: formatSqlDate(endDate) };
}
