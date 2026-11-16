import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { HighchartsChartComponent } from 'highcharts-angular';
import { BandLimits, bandColor, bandOf } from '../filters/usage-band-filter';
import { gaugeChartOptions } from './gauge-options';

@Component({
  selector: 'app-gauge',
  imports: [HighchartsChartComponent],
  template: `
    <div class="gauge" [attr.aria-label]="accessibleLabel()" role="img">
      @if (isVisible()) {
        <highcharts-chart class="gauge-chart" [options]="chartOptions()" />
      }
      <div class="gauge-readout">
        <span class="gauge-value" [style.color]="gaugeColor()">{{ roundedPercent() }}%</span>
        <span class="gauge-caption">Utilization</span>
      </div>
    </div>
  `,
  styleUrl: './gauge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gauge {
  protected readonly isVisible = signal(false);
  readonly percent = input.required<number>();
  readonly limits = input.required<BandLimits>();
  readonly ariaLabel = input('Usage gauge');

  private readonly safePercent = computed(() =>
    Number.isFinite(this.percent()) ? this.percent() : 0,
  );
  protected readonly roundedPercent = computed(() => Math.round(this.safePercent()));
  protected readonly accessibleLabel = computed(
    () => `${this.ariaLabel()}: ${this.roundedPercent()}% utilization`,
  );
  protected readonly usageBand = computed(() => bandOf(this.safePercent(), this.limits()));
  protected readonly gaugeColor = computed(() => bandColor(this.usageBand(), this.limits()));
  protected readonly chartOptions = computed(() =>
    gaugeChartOptions(this.safePercent(), this.limits()),
  );

  constructor() {
    const element = inject(ElementRef<HTMLElement>);
    const destroyRef = inject(DestroyRef);
    // Charts must first measure a visible tile, including when its workspace tab was hidden.
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        this.isVisible.set(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          this.isVisible.set(entries.some((entry) => entry.isIntersecting));
        },
        { rootMargin: '0px' },
      );
      observer.observe(element.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
