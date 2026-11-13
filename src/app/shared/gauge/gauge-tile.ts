import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BandLimits, bandColor, bandOf } from '../filters/usage-band-filter';
import { Gauge } from './gauge';

export interface GaugeStat {
  label: string;
  value: string;
}

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

  protected readonly accentColor = computed(() =>
    bandColor(bandOf(this.percent(), this.limits()), this.limits()),
  );
}
