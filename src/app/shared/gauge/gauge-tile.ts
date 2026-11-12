import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BandLimits, bandColor, bandOf } from '../filters/usage-band-filter';
import { Gauge } from './gauge';

/** One labelled number shown under a gauge tile, e.g. `{ label: 'User', value: '1,204' }`. */
export interface GaugeStat {
  label: string;
  value: string;
}

/**
 * A card built around one `Gauge`: a title, the dial itself, and a row of labelled numbers
 * underneath. Any report can build its own list of `GaugeStat`s, so this card has no idea what
 * "Issued (Max)" or "True Denial" mean - it just lays out whatever it's given.
 */
@Component({
  selector: 'app-gauge-tile',
  imports: [Gauge],
  template: `
    <p class="gauge-tile-title" [title]="title()">{{ title() }}</p>
    <app-gauge [percent]="percent()" [limits]="limits()" [ariaLabel]="title()" />
    <div class="gauge-tile-stats">
      @for (stat of stats(); track stat.label) {
        <div class="gauge-tile-stat">
          <span class="gauge-tile-stat-value">{{ stat.value }}</span>
          <span class="gauge-tile-stat-label">{{ stat.label }}</span>
        </div>
      }
    </div>
  `,
  styleUrl: './gauge-tile.scss',
  host: { '[style.--tile-accent]': 'accentColor()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaugeTile {
  readonly title = input.required<string>();
  readonly percent = input.required<number>();
  readonly limits = input.required<BandLimits>();
  readonly stats = input<readonly GaugeStat[]>([]);

  /** The same band colour the gauge fills with - picked up by a thin accent border on the card. */
  protected readonly accentColor = computed(() =>
    bandColor(bandOf(this.percent(), this.limits()), this.limits()),
  );
}
