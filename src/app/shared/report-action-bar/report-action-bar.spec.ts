import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportActionBar } from './report-action-bar';

describe('ReportActionBar', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function open() {
    const fixture = TestBed.createComponent(ReportActionBar);
    fixture.componentRef.setInput('actions', [
      { id: 'summary', label: 'Summary' },
      { id: 'bundle', label: 'Bundle', disabled: true },
      { id: 'history', label: 'History' },
      { id: 'hours', label: 'Hours' },
    ]);
    fixture.componentRef.setInput('activeId', 'summary');
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('.report-action'));
    const selected = vi.fn();
    fixture.componentInstance.actionSelected.subscribe(selected);
    return { fixture, element, buttons, selected };
  }

  it('exposes a labelled toolbar with a single tab stop and pressed selection', async () => {
    const { element, buttons } = await open();
    expect(element.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(
      'Report views',
    );
    expect(element.querySelector('[role="tablist"]')).toBeNull();
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('emits enabled selections without controlling the owner selection', async () => {
    const { buttons, selected } = await open();
    buttons[1].click();
    expect(selected).not.toHaveBeenCalled();
    buttons[2].click();
    expect(selected).toHaveBeenCalledExactlyOnceWith('history');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('moves focus with arrows, Home and End, skipping disabled actions without opening reports', async () => {
    const { fixture, buttons, selected } = await open();
    function key(index: number, value: string): void {
      buttons[index].dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
      fixture.detectChanges();
    }
    buttons[0].focus();
    key(0, 'ArrowRight');
    expect(document.activeElement).toBe(buttons[2]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, -1, 0, -1]);
    key(2, 'End');
    expect(document.activeElement).toBe(buttons[3]);
    key(3, 'ArrowRight');
    expect(document.activeElement).toBe(buttons[0]);
    key(0, 'ArrowLeft');
    expect(document.activeElement).toBe(buttons[3]);
    key(3, 'Home');
    expect(document.activeElement).toBe(buttons[0]);
    expect(selected).not.toHaveBeenCalled();
  });

  it('keeps an enabled tab stop when actions are removed or disabled', async () => {
    const { fixture, buttons, element } = await open();
    buttons[2].focus();
    fixture.componentRef.setInput('actions', [{ id: 'hours', label: 'Hours' }]);
    await fixture.whenStable();
    expect(element.querySelector<HTMLButtonElement>('.report-action')?.tabIndex).toBe(0);
    fixture.componentRef.setInput('actions', [{ id: 'hours', label: 'Hours', disabled: true }]);
    await fixture.whenStable();
    expect(element.querySelector<HTMLButtonElement>('.report-action')?.tabIndex).toBe(-1);
  });

  it('updates overflow controls from measured sizes and native scrolling', async () => {
    const { fixture, element } = await open();
    const viewport = element.querySelector<HTMLElement>('.action-viewport')!;
    const frame = element.querySelector<HTMLElement>('.action-bar')!;
    const track = element.querySelector<HTMLElement>('.action-track')!;
    const back = element.querySelector<HTMLButtonElement>('[aria-label="Previous report views"]')!;
    const next = element.querySelector<HTMLButtonElement>('[aria-label="Next report views"]')!;
    Object.defineProperty(frame, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 336 });
    Object.defineProperty(viewport, 'scrollWidth', { configurable: true, value: 900 });
    viewport.scrollBy = vi.fn();
    viewport.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(next.hidden).toBe(false);
    expect(back.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    next.click();
    expect(viewport.scrollBy).toHaveBeenCalledWith({ left: 268.8 });
    viewport.scrollLeft = 564;
    viewport.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(next.disabled).toBe(true);
    expect(back.disabled).toBe(false);
    Object.defineProperty(frame, 'clientWidth', { value: 1000 });
    viewport.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(next.hidden).toBe(true);
    expect(back.hidden).toBe(true);
  });

  it('disconnects resize observation when its workspace view is destroyed', async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        disconnect = disconnect;
      },
    );
    const { fixture } = await open();
    expect(observe).toHaveBeenCalledTimes(3);
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
