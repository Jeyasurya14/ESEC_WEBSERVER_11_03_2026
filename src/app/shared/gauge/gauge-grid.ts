import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BandLimits } from '../filters/usage-band-filter';
import { GaugeStat, GaugeTile } from './gauge-tile';

export interface GaugeListItem {
  title: string;
  percent: number;
  stats: readonly GaugeStat[];
}

const CARD_HEIGHT = 390;
const GAP = 16;
const PADDING = 20;
const MIN_CARD_WIDTH = 280;
const ROW_HEIGHT = CARD_HEIGHT + GAP;

/** Visible rows plus one buffer row on each side; spacers preserve the full scrollbar. */
export function gaugeWindow(count: number, width: number, height: number, scrollTop: number) {
  const columns = Math.max(
    1,
    Math.floor((Math.max(0, width - PADDING * 2) + GAP) / (MIN_CARD_WIDTH + GAP)),
  );
  const rows = Math.ceil(count / columns);
  const top = Math.max(0, scrollTop);
  const firstRow = Math.min(
    Math.max(0, rows - 1),
    Math.floor(Math.max(0, top - PADDING) / ROW_HEIGHT),
  );
  const startRow = Math.max(0, firstRow - 1);
  const endRow = Math.min(
    rows,
    Math.max(firstRow + 1, Math.ceil((top + Math.max(1, height) - PADDING) / ROW_HEIGHT)) + 1,
  );
  return {
    columns,
    start: startRow * columns,
    end: Math.min(count, endRow * columns),
    offset: startRow * ROW_HEIGHT,
    height: rows ? rows * ROW_HEIGHT - GAP : 0,
  };
}

@Component({
  selector: 'app-gauge-grid',
  imports: [GaugeTile],
  template: `
    <div
      #viewport
      class="gauge-viewport"
      role="region"
      aria-label="License gauges"
      tabindex="0"
      [style.padding.px]="padding"
      (scroll)="onScroll()"
    >
      <div class="gauge-space" [style.height.px]="visibleRange().height">
        <div
          class="gauge-window"
          [style.grid-template-columns]="'repeat(' + visibleRange().columns + ', minmax(0, 1fr))'"
          [style.grid-auto-rows.px]="cardHeight"
          [style.gap.px]="gap"
          [style.transform]="'translateY(' + visibleRange().offset + 'px)'"
        >
          @for (item of visibleCards(); track visibleRange().start + $index) {
            <button type="button" class="gauge-card" (click)="itemSelected.emit(item)">
              <app-gauge-tile
                [title]="item.title"
                [percent]="item.percent"
                [stats]="item.stats"
                [limits]="limits()"
              />
            </button>
          }
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
    }
    .gauge-viewport {
      position: relative;
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: auto;
      overflow-anchor: none;
      background: #f5f7fb;
    }
    .gauge-space {
      position: relative;
      width: 100%;
    }
    .gauge-window {
      position: absolute;
      inset: 0 0 auto;
      display: grid;
    }
    .gauge-card {
      display: block;
      width: 100%;
      height: 100%;
      min-width: 0;
      padding: 0;
      text-align: left;
      background: none;
      border: 0;
      border-radius: 14px;
      cursor: pointer;
    }
    .gauge-card > app-gauge-tile {
      height: 100%;
      min-height: 0;
    }
    .gauge-card:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaugeGrid<T extends GaugeListItem> {
  readonly items = input.required<readonly T[]>();
  readonly limits = input.required<BandLimits>();
  readonly itemSelected = output<T>();
  protected readonly cardHeight = CARD_HEIGHT;
  protected readonly padding = PADDING;
  protected readonly gap = GAP;
  private readonly viewport = viewChild<ElementRef<HTMLDivElement>>('viewport');
  private readonly viewportSize = signal({ width: 960, height: 780, top: 0 });
  private scrollFrame: number | null = null;
  protected readonly visibleRange = computed(() => {
    const { width, height, top } = this.viewportSize();
    return gaugeWindow(this.items().length, width, height, top);
  });
  protected readonly visibleCards = computed(() =>
    this.items().slice(this.visibleRange().start, this.visibleRange().end),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      this.items();
      untracked(() => {
        const scrollElement = this.viewport()?.nativeElement;
        if (scrollElement) scrollElement.scrollTop = 0;
        this.viewportSize.update((oldSize) => ({ ...oldSize, top: 0 }));
      });
    });
    afterNextRender(() => {
      this.measure();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => this.measure());
        observer.observe(this.viewport()!.nativeElement);
        destroyRef.onDestroy(() => observer.disconnect());
      }
    });
    destroyRef.onDestroy(() => {
      if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
    });
  }

  protected onScroll(): void {
    if (this.scrollFrame !== null) return;
    if (typeof requestAnimationFrame === 'undefined') {
      this.measure();
      return;
    }
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      this.measure();
    });
  }

  private measure(): void {
    const scrollElement = this.viewport()?.nativeElement;
    if (!scrollElement) return;
    const oldSize = this.viewportSize();
    const newSize = {
      width: scrollElement.clientWidth || oldSize.width,
      height: scrollElement.clientHeight || oldSize.height,
      top: scrollElement.scrollTop,
    };
    if (
      newSize.width !== oldSize.width ||
      newSize.height !== oldSize.height ||
      newSize.top !== oldSize.top
    )
      this.viewportSize.set(newSize);
  }
}
