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
  procedureName: string,
  range: ReportRange,
  leadingArguments: string[],
  trailingArguments: string[],
): string {
  const { procedureSuffix, rangeValues } = rangeArguments(range);
  const allArguments = [...leadingArguments, ...rangeValues, ...trailingArguments]
    .map(sqlString)
    .join(',');
  return `call ${procedureName}${procedureSuffix}(${allArguments});`;
}

function rangeArguments(selectedRange: ReportRange): {
  procedureSuffix: string;
  rangeValues: string[];
} {
  switch (selectedRange.kind) {
    case 'days':
      return { procedureSuffix: '', rangeValues: [selectedRange.days] };
    case 'month':
      return {
        procedureSuffix: '_month_year',
        rangeValues: [String(selectedRange.month), String(selectedRange.year)],
      };
    case 'quarter':
      return {
        procedureSuffix: '_qtr_year',
        rangeValues: [String(selectedRange.quarter), String(selectedRange.year)],
      };
    case 'year':
      return { procedureSuffix: '_year', rangeValues: [String(selectedRange.year)] };
  }
}

export function parseRange(savedRange: string): ReportRange {
  const rangeText = savedRange.trim();
  const quarterMatch = /^Q([1-4])-(\d{4})$/i.exec(rangeText);
  const monthMatch = /^([A-Za-z]{3})-(\d{4})$/.exec(rangeText);

  if (quarterMatch) {
    return { kind: 'quarter', quarter: Number(quarterMatch[1]), year: Number(quarterMatch[2]) };
  }
  if (monthMatch && monthIndex(monthMatch[1]) >= 0) {
    return {
      kind: 'month',
      month: monthIndex(monthMatch[1]) + 1,
      year: Number(monthMatch[2]),
    };
  }
  if (/^\d{4}$/.test(rangeText)) {
    return { kind: 'year', year: Number(rangeText) };
  }

  const dayRange = rangeText === '7' ? '07' : rangeText.toUpperCase();
  const isKnownDayRange = DAY_RANGES.some((preset) => preset.value === dayRange);
  return { kind: 'days', days: isKnownDayRange ? dayRange : '30' };
}

export function formatRange(selectedRange: ReportRange): string {
  switch (selectedRange.kind) {
    case 'days':
      return selectedRange.days;
    case 'month':
      return `${MONTHS[selectedRange.month - 1]}-${selectedRange.year}`;
    case 'quarter':
      return `Q${selectedRange.quarter}-${selectedRange.year}`;
    case 'year':
      return String(selectedRange.year);
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
        const monthDate = new Date(year, today.getMonth() - back, 1);
        const monthRange: ReportRange = {
          kind: 'month',
          year: monthDate.getFullYear(),
          month: monthDate.getMonth() + 1,
        };
        return {
          label: `${MONTHS[monthDate.getMonth()]} - ${monthDate.getFullYear()}`,
          range: monthRange,
        };
      });
    case 'quarter': {
      const currentQuarterIndex = Math.floor(today.getMonth() / 3);
      return Array.from({ length: QUARTERS_LISTED }, (_, back) => {
        const quarterIndex = currentQuarterIndex - back;
        const quarterYear = year + Math.floor(quarterIndex / 4);
        const quarterNumber = (((quarterIndex % 4) + 4) % 4) + 1;
        return {
          label: `Q${quarterNumber} - ${quarterYear}`,
          range: { kind: 'quarter', year: quarterYear, quarter: quarterNumber },
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

function sameRange(firstRange: ReportRange, secondRange: ReportRange): boolean {
  return formatRange(firstRange) === formatRange(secondRange);
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

  protected pickKind(selectedKind: string): void {
    if (selectedKind === 'month' || selectedKind === 'quarter' || selectedKind === 'year') {
      this.range.set(periodsFor(selectedKind, this.today)[0].range);
    } else {
      this.range.set({ kind: 'days', days: selectedKind });
    }
  }

  protected pickPeriod(selectedPeriodIndex: string): void {
    this.range.set(this.periods()[Number(selectedPeriodIndex)].range);
  }
}
