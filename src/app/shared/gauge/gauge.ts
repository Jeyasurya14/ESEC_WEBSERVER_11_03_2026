import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BandLimits, bandColor, bandOf } from '../filters/usage-band-filter';

// The gauge is a half circle: 0% points left, 100% points right, 50% points straight up.
const CENTER = 100;
const RADIUS = 80;
const START_ANGLE = 180;
const END_ANGLE = 0;

/** A point on the gauge's circle. angleDeg follows normal maths angles: 0 = right, 90 = up. */
function pointOnCircle(angleDeg: number, radius: number): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER - radius * Math.sin(angleRad),
  };
}

/** Where a 0-100 value sits on the gauge's half-circle sweep. */
export function angleForPercent(percent: number): number {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return START_ANGLE + (clamped / 100) * (END_ANGLE - START_ANGLE);
}

/** The SVG path for the arc between two percentages (always a short way round, since the gauge never exceeds half a circle). */
export function arcPath(fromPercent: number, toPercent: number): string {
  const start = pointOnCircle(angleForPercent(fromPercent), RADIUS);
  const end = pointOnCircle(angleForPercent(toPercent), RADIUS);
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y}`;
}

interface GaugeZone {
  path: string;
  color: string;
}

/**
 * A half-circle gauge: a pale low/medium/high "zone map" (the same bands the usage filter uses)
 * with a bold arc drawn over it from 0 up to the current percentage, in that percentage's own
 * band colour - a progress ring that also shows how close the value is to its next threshold.
 * Reusable anywhere a percentage needs a dial instead of a number - give it a percent and the
 * report's band limits.
 */
@Component({
  selector: 'app-gauge',
  template: `
    <svg class="gauge" viewBox="0 0 200 112" [attr.aria-label]="ariaLabel()" role="img">
      @for (zone of zones(); track zone.color) {
        <path [attr.d]="zone.path" [attr.stroke]="zone.color" class="gauge-zone" />
      }
      <path [attr.d]="progressPath()" [attr.stroke]="color()" class="gauge-progress" />
      <text class="gauge-value" x="100" y="96" [attr.fill]="color()">{{ roundedPercent() }}%</text>
    </svg>
  `,
  styleUrl: './gauge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gauge {
  readonly percent = input.required<number>();
  readonly limits = input.required<BandLimits>();
  readonly ariaLabel = input('Usage gauge');

  protected readonly roundedPercent = computed(() => Math.round(this.percent()));
  protected readonly band = computed(() => bandOf(this.percent(), this.limits()));
  protected readonly color = computed(() => bandColor(this.band(), this.limits()));

  /** The pale background showing where the low/medium/high zones are, regardless of the value. */
  protected readonly zones = computed<GaugeZone[]>(() => {
    const limits = this.limits();
    const { lowBelow, highFrom } = limits;
    return [
      { path: arcPath(0, lowBelow), color: bandColor('low', limits) },
      { path: arcPath(lowBelow, highFrom), color: bandColor('medium', limits) },
      { path: arcPath(highFrom, 100), color: bandColor('high', limits) },
    ];
  });

  /** The bold arc: how far the value has filled the gauge, from empty (0) to now. */
  protected readonly progressPath = computed(() => arcPath(0, this.percent()));
}
