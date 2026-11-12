import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A refresh action rendered as a spinning icon instead of a text button, so it looks and behaves
 * the same wherever a report puts it - a toolbar, a status bar, anywhere. While `loading` is
 * true the icon spins and the button disables itself, so there's nothing for a report to wire up
 * beyond its own loading signal and a click handler.
 *
 * `variant` picks how much chrome it draws: `chip` (default) is a bordered button sized for a
 * toolbar; `plain` is a small borderless icon sized for a slim status bar.
 */
@Component({
  selector: 'app-refresh-button',
  template: `
    <button
      type="button"
      class="refresh-button"
      [class.plain]="variant() === 'plain'"
      [class.spinning]="loading()"
      [disabled]="loading()"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="refresh.emit()"
    >
      <span
        class="app-icon"
        style="--icon-url: url('assets/icons/flaticon/refresh.svg')"
        aria-hidden="true"
      ></span>
    </button>
  `,
  styleUrl: './refresh-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefreshButton {
  readonly loading = input(false);
  readonly label = input('Refresh');
  readonly variant = input<'chip' | 'plain'>('chip');
  readonly refresh = output<void>();
}
