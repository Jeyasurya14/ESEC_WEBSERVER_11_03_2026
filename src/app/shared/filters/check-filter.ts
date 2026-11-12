import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * One filter toggle, styled as a filled/outlined pill rather than a bare OS checkbox - the same
 * look every checkbox-style filter uses (Usage Band, License Server, Expiry). Give it a
 * `dotColor` and that becomes the option's own colour: a small dot while off, a solid fill while
 * on - e.g. Usage Band's green/yellow/red. Without one, it toggles like a plain on/off pill.
 */
@Component({
  selector: 'app-check-filter',
  template: `
    <label class="chip-toggle" [class.active]="checked()" [style.--chip-color]="dotColor()">
      <input
        type="checkbox"
        class="check-input"
        [checked]="checked()"
        (change)="toggled.emit()"
      />
      @if (!checked() && dotColor(); as color) {
        <span class="check-dot" [style.background]="color" aria-hidden="true"></span>
      }
      {{ label() }}
    </label>
  `,
  styleUrl: './check-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckFilter {
  readonly label = input.required<string>();
  readonly checked = input.required<boolean>();
  readonly dotColor = input<string>();
  readonly toggled = output<void>();
}
