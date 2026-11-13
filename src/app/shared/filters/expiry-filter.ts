import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { parseDate } from '../dates';
import { CheckFilter } from './check-filter';

export function isNotExpired(expiryValue: unknown, today: Date): boolean {
  const expiryDate = parseDate(expiryValue);
  if (!expiryDate) {
    return true;
  }
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return expiryDate >= startOfToday;
}

@Component({
  selector: 'app-expiry-filter',
  imports: [CheckFilter],
  template: `
    <app-check-filter
      label="Not Expired"
      [checked]="notExpired()"
      (toggled)="notExpired.set(!notExpired())"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpiryFilter {
  readonly notExpired = model.required<boolean>();
}
