import { literal } from '../../core/utils/data';
import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';

export type UsageOption = 'DP' | 'DPM' | 'DA' | 'DAM' | 'WP' | 'WPM' | 'WA' | 'WAM';

export const DAY_OPTIONS = literal([
  { value: 'DP', label: 'Peak (DP)' },
  { value: 'DPM', label: 'Peak Mean (DPM)' },
  { value: 'DA', label: 'Avg (DA)' },
  { value: 'DAM', label: 'Avg Mean (DAM)' },
]);

export const WORK_OPTIONS = literal([
  { value: 'WP', label: 'Peak (WP)' },
  { value: 'WPM', label: 'Peak Mean (WPM)' },
  { value: 'WA', label: 'Avg (WA)' },
  { value: 'WAM', label: 'Avg Mean (WAM)' },
]);

const USAGE_OPTIONS = [...DAY_OPTIONS, ...WORK_OPTIONS];

export function toUsageOption(savedOption: string): UsageOption {
  const normalizedOption = savedOption.trim().toUpperCase();
  return USAGE_OPTIONS.find((option) => option.value === normalizedOption)?.value ?? 'DP';
}

export type PercentField = `p_${Lowercase<UsageOption>}`;
const PERCENT_FIELDS = {
  DP: 'p_dp',
  DPM: 'p_dpm',
  DA: 'p_da',
  DAM: 'p_dam',
  WP: 'p_wp',
  WPM: 'p_wpm',
  WA: 'p_wa',
  WAM: 'p_wam',
} satisfies Record<UsageOption, PercentField>;

export function percentField(option: UsageOption): PercentField {
  return PERCENT_FIELDS[option];
}

export type QuantityField = `qty_${Lowercase<UsageOption>}`;
const QUANTITY_FIELDS = {
  DP: 'qty_dp',
  DPM: 'qty_dpm',
  DA: 'qty_da',
  DAM: 'qty_dam',
  WP: 'qty_wp',
  WPM: 'qty_wpm',
  WA: 'qty_wa',
  WAM: 'qty_wam',
} satisfies Record<UsageOption, QuantityField>;

export function quantityField(option: UsageOption): QuantityField {
  return QUANTITY_FIELDS[option];
}

const OPTIONS: DropdownOption[] = [
  ...DAY_OPTIONS.map((item) => ({ ...item, group: 'Day (00:00 - 23:59)' })),
  ...WORK_OPTIONS.map((item) => ({ ...item, group: 'Work hours' })),
];

@Component({
  selector: 'app-option-filter',
  imports: [Dropdown],
  template: `
    <label class="filter">
      <span class="filter-label">Option</span>
      <app-dropdown
        ariaLabel="Option"
        [options]="options"
        [value]="option()"
        (valueChange)="pickOption($event)"
      />
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionFilter {
  readonly option = model.required<UsageOption>();

  protected readonly options = OPTIONS;

  protected pickOption(selectedOption: string): void {
    this.option.set(toUsageOption(selectedOption));
  }
}
