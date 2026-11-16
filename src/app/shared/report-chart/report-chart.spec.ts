import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HighchartsChartComponent } from 'highcharts-angular';
import { Options } from 'highcharts';
import { describe, expect, it, vi } from 'vitest';
import { ReportChart } from './report-chart';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'highcharts-chart',
  template: '',
})
class ChartStub {
  readonly options = input.required<Options>();
}

describe('ReportChart states', () => {
  async function open() {
    TestBed.overrideComponent(ReportChart, {
      remove: { imports: [HighchartsChartComponent] },
      add: { imports: [ChartStub] },
    });
    const source = { loading: signal(true), error: signal(''), rows: signal<unknown[]>([]) };
    const fixture = TestBed.createComponent(ReportChart);
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('options', { series: [] });
    fixture.componentRef.setInput('label', 'utilization');
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    return { fixture, source, element };
  }

  it('renders loading, empty and ready states without constructing an empty chart', async () => {
    const { fixture, source, element } = await open();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Loading utilization');
    expect(element.querySelector('highcharts-chart')).toBeNull();
    source.loading.set(false);
    await fixture.whenStable();
    expect(element.textContent).toContain('No data to show.');
    expect(element.querySelector('highcharts-chart')).toBeNull();
    source.rows.set([{}]);
    await fixture.whenStable();
    expect(element.querySelector('highcharts-chart')).not.toBeNull();
    expect(source.rows()).toEqual([{}]);
  });

  it('displays the error and delegates retry to the report owner', async () => {
    const { fixture, source, element } = await open();
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    source.loading.set(false);
    source.error.set('Network unavailable');
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Network unavailable');
    element.querySelector<HTMLButtonElement>('button')!.click();
    expect(retry).toHaveBeenCalledOnce();
    expect(source.error()).toBe('Network unavailable');
  });
});
