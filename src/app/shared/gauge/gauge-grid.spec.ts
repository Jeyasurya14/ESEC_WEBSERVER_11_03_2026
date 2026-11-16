import { instance } from '../../../testing/instances';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GaugeGrid, gaugeWindow } from './gauge-grid';
import { GaugeTile } from './gauge-tile';

describe('Gauge scrolling window', () => {
  it('keeps a large report bounded at the beginning, middle and end', () => {
    for (const top of [0, 20300, 405244]) {
      const range = gaugeWindow(3000, 960, 780, top);
      expect(range.end - range.start).toBeGreaterThan(0);
      expect(range.end - range.start).toBeLessThanOrEqual(15);
      expect(range.offset).toBeLessThanOrEqual(top);
      expect(range.height).toBe(405984);
    }
    expect(gaugeWindow(3000, 960, 780, 0).start).toBe(0);
    expect(gaugeWindow(3000, 960, 780, 405244).end).toBe(3000);
  });

  it('adapts the columns to the viewport and includes an incomplete last row', () => {
    for (const [width, columns] of [
      [320, 1],
      [640, 2],
      [960, 3],
      [1360, 4],
    ]) {
      const range = gaugeWindow(17, width, 780, 100000);
      expect(range.columns).toBe(columns);
      expect(range.end).toBe(17);
      expect(range.start % columns).toBe(0);
    }
  });

  it('has no spacer or cards for an empty report', () => {
    expect(gaugeWindow(0, 0, 0, 0)).toMatchObject({ start: 0, end: 0, height: 0 });
  });
});

describe('Gauge list lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reflows on resize, coalesces scroll events and cleans up pending work', async () => {
    let resized!: ResizeObserverCallback;
    let resizeObserver!: ResizeObserver;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resized = callback;
          resizeObserver = this;
        }
        observe() {}
        unobserve() {}
        disconnect = disconnect;
      },
    );
    const request = vi.fn().mockReturnValue(42);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    TestBed.overrideComponent(GaugeTile, { set: { template: '' } });
    const fixture = TestBed.createComponent(GaugeGrid);
    fixture.componentRef.setInput(
      'items',
      Array.from({ length: 3000 }, (_, index) => ({
        title: `CAD${index}`,
        percent: 50,
        stats: [],
      })),
    );
    fixture.componentRef.setInput('limits', { lowBelow: 50, highFrom: 80 });
    await fixture.whenStable();
    const viewport = instance(fixture.nativeElement.querySelector('.gauge-viewport'), HTMLElement);
    Object.defineProperties(viewport, {
      clientWidth: { value: 320 },
      clientHeight: { value: 780 },
    });
    resized([], resizeObserver);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.gauge-window').style.gridTemplateColumns).toBe(
      'repeat(1, minmax(0, 1fr))',
    );
    request.mockClear();
    viewport.dispatchEvent(new Event('scroll'));
    const scheduledFrames = request.mock.calls.length;
    viewport.dispatchEvent(new Event('scroll'));
    // Angular can schedule its own render frame alongside the list's measurement.
    expect(scheduledFrames).toBeGreaterThan(0);
    expect(request).toHaveBeenCalledTimes(scheduledFrames);
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith(42);
  });
});
