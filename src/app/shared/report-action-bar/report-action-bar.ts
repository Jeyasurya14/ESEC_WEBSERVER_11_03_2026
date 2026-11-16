import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';

export interface ReportAction<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly disabled?: boolean;
}

/** A report selector; the owner decides whether a selection arms or immediately opens a report. */
@Component({
  selector: 'app-report-action-bar',
  templateUrl: './report-action-bar.html',
  styleUrl: './report-action-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportActionBar<Id extends string = string> {
  readonly actions = input.required<readonly ReportAction<Id>[]>();
  readonly activeId = input<Id | null>(null);
  readonly label = input('Report views');
  readonly busy = input(false);
  readonly actionSelected = output<Id>();

  private readonly resizeFrame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('actionButton');
  private readonly focusedActionId = signal<Id | null>(null);
  protected readonly hasOverflow = signal(false);
  protected readonly canScrollBack = signal(false);
  protected readonly canScrollForward = signal(false);
  protected readonly tabStop = computed(() => {
    const enabled = this.actions().filter((action) => !action.disabled);
    return (
      enabled.find((action) => action.id === this.focusedActionId())?.id ??
      enabled.find((action) => action.id === this.activeId())?.id ??
      enabled[0]?.id
    );
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // Observe the content as well as the viewport: labels, permissions and workspace size change.
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.resizeFrame().nativeElement);
      observer.observe(this.track().nativeElement);
      observer.observe(this.viewport().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    afterRenderEffect(() => {
      this.actions();
      const active = this.activeId();
      const index = this.actions().findIndex((action) => action.id === active);
      const button = this.buttons()[index]?.nativeElement;
      if (button) this.reveal(button);
      this.measure();
    });
  }

  protected choose(action: ReportAction<Id>): void {
    if (action.disabled) return;
    this.focusedActionId.set(action.id);
    this.actionSelected.emit(action.id);
  }

  protected focusAction(id: Id, button: HTMLButtonElement): void {
    this.focusedActionId.set(id);
    this.reveal(button);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const enabled = this.buttons()
      .map((ref) => ref.nativeElement)
      .filter((button) => !button.disabled);
    if (!enabled.length) return;
    if (!(event.target instanceof HTMLButtonElement)) return;
    const index = enabled.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? enabled.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
    enabled[nextIndex].focus({ preventScroll: true });
    this.reveal(enabled[nextIndex]);
  }

  protected scroll(direction: -1 | 1): void {
    const viewport = this.viewport().nativeElement;
    // CSS controls smooth scrolling and respects prefers-reduced-motion.
    viewport.scrollBy({ left: direction * Math.max(120, viewport.clientWidth * 0.8) });
  }

  protected measure(): void {
    const viewport = this.viewport().nativeElement;
    // Use the full frame width to avoid arrow visibility changing its own overflow threshold.
    this.hasOverflow.set(
      this.track().nativeElement.scrollWidth > this.resizeFrame().nativeElement.clientWidth + 1,
    );
    this.canScrollBack.set(viewport.scrollLeft > 1);
    this.canScrollForward.set(
      viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
    );
  }

  private reveal(button: HTMLButtonElement): void {
    const viewport = this.viewport().nativeElement;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    if (left < viewport.scrollLeft) viewport.scrollLeft = left;
    else if (right > viewport.scrollLeft + viewport.clientWidth) {
      viewport.scrollLeft = right - viewport.clientWidth;
    }
  }
}
