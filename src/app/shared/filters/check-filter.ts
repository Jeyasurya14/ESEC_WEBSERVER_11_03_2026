import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * One checkbox "chip" - the same look every checkbox-style filter uses (Usage Band, License
 * Server, Expiry). An optional coloured dot lets a filter show what an option means at a glance,
 * the way Usage Band shows its green/yellow/red.
 */
@Component({
  selector: 'app-check-filter',
  template: `
    <label class="filter check">
      <input type="checkbox" [checked]="checked()" (change)="toggled.emit()" />
      @if (dotColor(); as color) {
        <span class="check-dot" [style.background]="color" aria-hidden="true"></span>
      }
      {{ label() }}
    </label>
  `,
  styles: `
    .check-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckFilter {
  readonly label = input.required<string>();
  readonly checked = input.required<boolean>();
  readonly dotColor = input<string>();
  readonly toggled = output<void>();
}
