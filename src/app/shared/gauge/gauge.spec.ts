import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideHighchartsCharts } from '../charts/highcharts.config';
import { BandLimits } from '../filters/usage-band-filter';
import { Gauge } from './gauge';

const LIMITS: BandLimits = { lowBelow: 60, highFrom: 80 };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-gauge-host',
  imports: [Gauge],
  template: `<app-gauge [percent]="percent()" [limits]="limits" [ariaLabel]="ariaLabel" />`,
})
class HostComponent {
  percent = signal(50);
  limits = LIMITS;
  ariaLabel = 'Acme CAD, server-1, feature-x';
}

describe('Gauge', () => {
  afterEach(() => vi.unstubAllGlobals());
  function render(percent: number) {
    TestBed.configureTestingModule({ providers: [provideHighchartsCharts()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.percent.set(percent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    return { element, fixture };
  }

  it('shows the rounded percentage in the readout', () => {
    const { element } = render(49.6);
    expect(element.querySelector('.gauge-value')?.textContent).toBe('50%');
  });

  it("names the gauge with the caller's label and the current percentage", () => {
    const { element } = render(50);
    expect(element.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Acme CAD, server-1, feature-x: 50% utilization',
    );
  });

  it('renders a Highcharts gauge chart element for the dial', async () => {
    const { element, fixture } = render(50);
    await fixture.whenStable();
    expect(element.querySelector('.gauge-chart')).not.toBeNull();
  });

  it('loads the gauge module, renders its SVG, and updates the live value', async () => {
    const { element, fixture } = render(50);
    await fixture.whenStable();
    expect(element.querySelector('.highcharts-series.highcharts-gauge-series')).not.toBeNull();
    fixture.componentInstance.percent.set(85);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('.gauge-value')?.textContent).toBe('85%');
    expect(element.querySelector('svg.highcharts-root')).not.toBeNull();
    expect(element.querySelector('svg.highcharts-root')?.getAttribute('height')).toBe('168');
  });

  it('defers hidden tiles until they enter the viewport and cleans up the observer', async () => {
    let enter!: IntersectionObserverCallback;
    let observer!: IntersectionObserver;
    const entry = (isIntersecting: boolean): IntersectionObserverEntry => ({
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      time: 0,
      target: document.createElement('div'),
      rootBounds: null,
      boundingClientRect: new DOMRectReadOnly(),
      intersectionRect: new DOMRectReadOnly(),
    });
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          enter = callback;
          observer = this;
        }
        readonly root = null;
        readonly rootMargin = '';
        readonly thresholds = [0];
        observe() {}
        unobserve() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
        disconnect = disconnect;
      },
    );
    const { element, fixture } = render(50);
    await fixture.whenStable();
    expect(element.querySelector('highcharts-chart')).toBeNull();
    enter([entry(true)], observer);
    await fixture.whenStable();
    expect(element.querySelector('.highcharts-gauge-series')).not.toBeNull();
    enter([entry(false)], observer);
    await fixture.whenStable();
    expect(element.querySelector('highcharts-chart')).toBeNull();
    enter([entry(true)], observer);
    await fixture.whenStable();
    expect(element.querySelector('.highcharts-gauge-series')).not.toBeNull();
    fixture.destroy();
    expect(disconnect).toHaveBeenCalled();
  });

  it('keeps invalid values out of the readout and accessible name', () => {
    const { element } = render(NaN);
    expect(element.querySelector('.gauge-value')?.textContent).toBe('0%');
    expect(element.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain(
      '0% utilization',
    );
  });
});
