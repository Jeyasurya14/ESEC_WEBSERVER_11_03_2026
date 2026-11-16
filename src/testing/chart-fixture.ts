import { Chart, Options } from 'highcharts';

export class ChartFixture implements Disposable {
  readonly chart: Chart;
  constructor(options: Options = {}) {
    this.chart = new Chart(document.createElement('div'), {
      accessibility: { enabled: false },
      series: [],
      ...options,
    });
  }
  [Symbol.dispose](): void {
    this.chart.destroy();
  }
}
