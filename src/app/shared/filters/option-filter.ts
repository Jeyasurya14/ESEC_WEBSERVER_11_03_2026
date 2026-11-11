import { ChangeDetectionStrategy, Component, model } from '@angular/core';

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

@Component({
  selector: 'app-option-filter',
  template: `
    <label class="filter">
      <span class="filter-label">Option</span>
      <select (change)="option.set($any($event.target).value)">
        <optgroup label="Day (00:00 - 23:59)">
          @for (item of dayOptions; track item.value) {
            <option [value]="item.value" [selected]="option() === item.value">
              {{ item.label }}
            </option>
          }
        </optgroup>
        <optgroup label="Work hours">
          @for (item of workOptions; track item.value) {
            <option [value]="item.value" [selected]="option() === item.value">
              {{ item.label }}
            </option>
          }
        </optgroup>
      </select>
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionFilter {
  readonly option = model.required<UsageOption>();

  protected readonly dayOptions = DAY_OPTIONS;
  protected readonly workOptions = WORK_OPTIONS;
}
