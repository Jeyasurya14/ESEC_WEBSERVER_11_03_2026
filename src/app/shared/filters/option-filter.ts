import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';

export type UsageOption = 'DP' | 'DPM' | 'DA' | 'DAM' | 'WP' | 'WPM' | 'WA' | 'WAM';

export const DAY_OPTIONS = [
  { value: 'DP', label: 'Peak (DP)' },
  { value: 'DPM', label: 'Peak Mean (DPM)' },
  { value: 'DA', label: 'Avg (DA)' },
  { value: 'DAM', label: 'Avg Mean (DAM)' },
] as const;

export const WORK_OPTIONS = [
  { value: 'WP', label: 'Peak (WP)' },
  { value: 'WPM', label: 'Peak Mean (WPM)' },
  { value: 'WA', label: 'Avg (WA)' },
  { value: 'WAM', label: 'Avg Mean (WAM)' },
] as const;

export function toUsageOption(text: string): UsageOption {
  const value = text.trim().toUpperCase();
  return [...DAY_OPTIONS, ...WORK_OPTIONS].some((option) => option.value === value)
    ? (value as UsageOption)
    : 'DP';
}

export type PercentField = `p_${Lowercase<UsageOption>}`;

export function percentField(option: UsageOption): PercentField {
  return `p_${option.toLowerCase()}` as PercentField;
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
      <app-dropdown [options]="options" [value]="option()" (valueChange)="pickOption($event)" />
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionFilter {
  readonly option = model.required<UsageOption>();

  protected readonly options = OPTIONS;

  protected pickOption(value: string): void {
    this.option.set(toUsageOption(value));
  }
}
