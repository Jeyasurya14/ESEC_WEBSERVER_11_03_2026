import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BandLimits, bandColor, bandOf } from '../filters/usage-band-filter';

const CENTER = 100;
const RADIUS = 80;
const START_ANGLE = 180;
const END_ANGLE = 0;

function pointOnCircle(angleDeg: number, radius: number): { x: number; y: number } {
  const angleRadians = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(angleRadians),
    y: CENTER - radius * Math.sin(angleRadians),
  };
}

export function angleForPercent(usagePercent: number): number {
  const clampedPercent = Math.min(Math.max(usagePercent, 0), 100);
  return START_ANGLE + (clampedPercent / 100) * (END_ANGLE - START_ANGLE);
}

export function arcPath(fromPercent: number, toPercent: number): string {
  const startPoint = pointOnCircle(angleForPercent(fromPercent), RADIUS);
  const endPoint = pointOnCircle(angleForPercent(toPercent), RADIUS);
  return `M ${startPoint.x} ${startPoint.y} A ${RADIUS} ${RADIUS} 0 0 1 ${endPoint.x} ${endPoint.y}`;
}

interface GaugeZone {
  path: string;
  color: string;
}

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

  protected readonly zones = computed<GaugeZone[]>(() => {
    const limits = this.limits();
    const { lowBelow, highFrom } = limits;
    return [
      { path: arcPath(0, lowBelow), color: bandColor('low', limits) },
      { path: arcPath(lowBelow, highFrom), color: bandColor('medium', limits) },
      { path: arcPath(highFrom, 100), color: bandColor('high', limits) },
    ];
  });

  protected readonly progressPath = computed(() => arcPath(0, this.percent()));
}
