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
    <div class="gauge-tile-header">
      <span class="gauge-tile-eyebrow">License usage</span>
      <span class="gauge-tile-badge"><span aria-hidden="true"></span>{{ usageBand() }} usage</span>
    </div>
    <p class="gauge-tile-title" [title]="title()">{{ title() }}</p>
    <app-gauge [percent]="percent()" [limits]="limits()" [ariaLabel]="title()" />
    @if (stats().length) {
      <dl class="gauge-tile-stats">
        @for (stat of stats(); track stat.label) {
          <div class="gauge-tile-stat">
            <dt class="gauge-tile-stat-label">{{ stat.label }}</dt>
            <dd class="gauge-tile-stat-value" [title]="stat.value">{{ stat.value }}</dd>
          </div>
        }
      </dl>
    }
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

  protected readonly usageBand = computed(() =>
    bandOf(Number.isFinite(this.percent()) ? this.percent() : 0, this.limits()),
  );
  protected readonly accentColor = computed(() => bandColor(this.usageBand(), this.limits()));
}
