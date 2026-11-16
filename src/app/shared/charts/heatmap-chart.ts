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
  viewChild,
} from '@angular/core';
import type { Options } from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';
import {
  groupHeatmapPoints,
  visibleHeatmapRows,
  viewportHeatmapOptions,
} from './heatmap-chart.utils';

/** Headers and chart share one scroll surface, isolated from the report's filter toolbars. */
@Component({
  selector: 'app-heatmap-chart',
  imports: [HighchartsChartComponent],
  template: `
    <div
      #viewport
      class="matrix-scroll"
      role="region"
      aria-label="Hourly utilization matrix"
      tabindex="0"
      (scroll)="onScroll()"
    >
      <div class="matrix-surface">
        <div class="matrix-header">
          <span>Date</span>
          @for (hour of hours; track hour) {
            <span>{{ hour }}</span>
          }
        </div>
        <div class="matrix-body" [style.height.px]="matrixHeight()">
          <highcharts-chart
            [options]="chartOptions()"
            [style.transform]="'translateY(' + scrollOffset() + 'px)'"
          />
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .matrix-scroll {
      position: relative;
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: auto;
      isolation: isolate;
    }
    .matrix-surface {
      min-width: 1794px;
      width: 100%;
    }
    .matrix-header {
      position: sticky;
      top: 0;
      z-index: 1;
      display: grid;
      grid-template-columns: 110px repeat(24, minmax(0, 1fr));
      height: 28px;
      padding-right: 4px;
      background: #1e293b;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
    }
    .matrix-header span {
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1px solid #64748b;
    }
    .matrix-header span:first-child {
      justify-content: flex-start;
      padding-left: 8px;
    }
    highcharts-chart {
      display: block;
      position: relative;
      z-index: 0;
      isolation: isolate;
      width: 100%;
    }
    .matrix-body {
      position: relative;
      overflow-anchor: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatmapChart {
  readonly options = input.required<Options>();
  protected readonly hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  private readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');
  private readonly viewportSize = signal({ top: 0, height: 640 });
  private scrollFrame: number | null = null;
  private readonly dateAxis = computed(() => {
    const axis = this.options().yAxis;
    return (Array.isArray(axis) ? axis[0] : axis) ?? {};
  });
  protected readonly matrixHeight = computed(() => Number(this.options().chart?.height) || 27);
  private readonly rowHeight = computed(() =>
    Math.max(1, (this.matrixHeight() - 4) / Math.max(1, this.dateAxis().categories?.length ?? 0)),
  );
  private readonly visibleRows = computed(() => {
    const { top, height } = this.viewportSize();
    return visibleHeatmapRows(
      top,
      height,
      this.dateAxis().categories?.length ?? 0,
      this.rowHeight(),
    );
  });
  protected readonly scrollOffset = computed(() => this.visibleRows().start * this.rowHeight());
  private readonly pointsByRow = computed(() => groupHeatmapPoints(this.options()));
  protected readonly chartOptions = computed(() =>
    viewportHeatmapOptions(
      this.options(),
      this.dateAxis(),
      this.visibleRows(),
      this.rowHeight(),
      this.hours,
      this.pointsByRow(),
    ),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.measure();
      const viewport = this.viewport()?.nativeElement;
      if (viewport && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => this.measure());
        observer.observe(viewport);
        destroyRef.onDestroy(() => observer.disconnect());
      }
    });
    destroyRef.onDestroy(() => {
      if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
    });
  }

  protected onScroll(): void {
    if (this.scrollFrame !== null) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      this.measure();
    });
  }

  private measure(): void {
    const element = this.viewport()?.nativeElement;
    if (!element) return;
    const oldSize = this.viewportSize();
    const newSize = { top: element.scrollTop, height: element.clientHeight || oldSize.height };
    if (newSize.top !== oldSize.top || newSize.height !== oldSize.height)
      this.viewportSize.set(newSize);
  }
}
