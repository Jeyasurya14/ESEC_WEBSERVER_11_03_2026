import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import { sqlString } from '../../core/api/api.service';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';
import { MONTHS, monthIndex } from '../dates';

export type ReportRange =
  | { kind: 'days'; days: string }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'quarter'; year: number; quarter: number }
  | { kind: 'year'; year: number };

export const DAY_RANGES = [
  { value: 'YTD', label: 'YTD' },
  { value: '360', label: '360 Days' },
  { value: '180', label: '180 Days' },
  { value: '90', label: '90 Days' },
  { value: '60', label: '60 Days' },
  { value: '30', label: '30 Days' },
  { value: '07', label: '7 Days' },
] as const;

const MONTHS_LISTED = 24;
const QUARTERS_LISTED = 8;
const YEARS_LISTED = 5;

export function rangeCall(
  procedure: string,
  range: ReportRange,
  before: string[],
  after: string[],
): string {
  const { suffix, values } = rangeArguments(range);
  const args = [...before, ...values, ...after].map(sqlString).join(',');
  return `call ${procedure}${suffix}(${args});`;
}

function rangeArguments(range: ReportRange): { suffix: string; values: string[] } {
  switch (range.kind) {
    case 'days':
      return { suffix: '', values: [range.days] };
    case 'month':
      return { suffix: '_month_year', values: [String(range.month), String(range.year)] };
    case 'quarter':
      return { suffix: '_qtr_year', values: [String(range.quarter), String(range.year)] };
    case 'year':
      return { suffix: '_year', values: [String(range.year)] };
  }
}

export function parseRange(text: string): ReportRange {
  const value = text.trim();
  const quarter = /^Q([1-4])-(\d{4})$/i.exec(value);
  const month = /^([A-Za-z]{3})-(\d{4})$/.exec(value);

  if (quarter) {
    return { kind: 'quarter', quarter: Number(quarter[1]), year: Number(quarter[2]) };
  }
  if (month && monthIndex(month[1]) >= 0) {
    return { kind: 'month', month: monthIndex(month[1]) + 1, year: Number(month[2]) };
  }
  if (/^\d{4}$/.test(value)) {
    return { kind: 'year', year: Number(value) };
  }

  const days = value === '7' ? '07' : value.toUpperCase();
  const known = DAY_RANGES.some((range) => range.value === days);
  return { kind: 'days', days: known ? days : '30' };
}

export function formatRange(range: ReportRange): string {
  switch (range.kind) {
    case 'days':
      return range.days;
    case 'month':
      return `${MONTHS[range.month - 1]}-${range.year}`;
    case 'quarter':
      return `Q${range.quarter}-${range.year}`;
    case 'year':
      return String(range.year);
  }
}

interface Period {
  label: string;
  range: ReportRange;
}

export function periodsFor(kind: 'month' | 'quarter' | 'year', today: Date): Period[] {
  const year = today.getFullYear();

  switch (kind) {
    case 'month':
      return Array.from({ length: MONTHS_LISTED }, (_, back) => {
        const date = new Date(year, today.getMonth() - back, 1);
        const range: ReportRange = {
          kind: 'month',
          year: date.getFullYear(),
          month: date.getMonth() + 1,
        };
        return { label: `${MONTHS[date.getMonth()]} - ${date.getFullYear()}`, range };
      });
    case 'quarter': {
      const current = Math.floor(today.getMonth() / 3);
      return Array.from({ length: QUARTERS_LISTED }, (_, back) => {
        const index = current - back;
        const quarterYear = year + Math.floor(index / 4);
        const quarter = (((index % 4) + 4) % 4) + 1;
        return {
          label: `Q${quarter} - ${quarterYear}`,
          range: { kind: 'quarter', year: quarterYear, quarter },
        };
      });
    }
    case 'year':
      return Array.from({ length: YEARS_LISTED }, (_, back) => ({
        label: String(year - back),
        range: { kind: 'year', year: year - back },
      }));
  }
}

export function sameRange(a: ReportRange, b: ReportRange): boolean {
  return formatRange(a) === formatRange(b);
}

/** A short, human label for a range, e.g. "30 Days", "Q1-2026" or "Jan-2026". */
export function rangeLabel(range: ReportRange): string {
  if (range.kind !== 'days') {
    return formatRange(range);
  }
  return DAY_RANGES.find((preset) => preset.value === range.days)?.label ?? `${range.days} Days`;
}

const KIND_OPTIONS: DropdownOption[] = [
  ...DAY_RANGES.map((preset) => ({ value: preset.value, label: preset.label })),
  { value: 'month', label: 'Month - Year' },
  { value: 'quarter', label: 'Qtr - Year' },
  { value: 'year', label: 'Year' },
];

@Component({
  selector: 'app-range-filter',
  imports: [Dropdown],
  template: `
    <label class="filter">
      <span class="filter-label">Range</span>
      <app-dropdown [options]="kindOptions" [value]="kindValue()" (valueChange)="pickKind($event)" />
    </label>

    @if (periodOptions().length > 0) {
      <app-dropdown
        ariaLabel="Period"
        [options]="periodOptions()"
        [value]="periodValue()"
        (valueChange)="pickPeriod($event)"
      />
    }
  `,
  host: { class: 'filter-group' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RangeFilter {
  readonly range = model.required<ReportRange>();

  protected readonly kindOptions = KIND_OPTIONS;
  private readonly today = new Date();

  protected readonly kindValue = computed(() => {
    const range = this.range();
    return range.kind === 'days' ? range.days : range.kind;
  });

  protected readonly periods = computed(() => {
    const range = this.range();
    return range.kind === 'days' ? [] : periodsFor(range.kind, this.today);
  });

  protected readonly periodOptions = computed<DropdownOption[]>(() => {
    return this.periods().map((period, index) => ({ value: String(index), label: period.label }));
  });

  protected readonly periodValue = computed(() => {
    const index = this.periods().findIndex((period) => sameRange(period.range, this.range()));
    return String(Math.max(index, 0));
  });

  protected pickKind(value: string): void {
    if (value === 'month' || value === 'quarter' || value === 'year') {
      this.range.set(periodsFor(value, this.today)[0].range);
    } else {
      this.range.set({ kind: 'days', days: value });
    }
  }

  protected pickPeriod(value: string): void {
    this.range.set(this.periods()[Number(value)].range);
  }
}
