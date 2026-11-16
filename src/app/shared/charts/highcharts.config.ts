import { EnvironmentProviders } from '@angular/core';
import { provideHighcharts } from 'highcharts-angular';

/**
 * Configures the single Highcharts instance shared by every chart in the app. Loaded once here
 * instead of per component: the gauge needs `highcharts-more` (the "gauge" series), the usage
 * heatmap needs `heatmap`; Summary also offers chart/data exports and accessibility.
 */
export function provideHighchartsCharts(): EnvironmentProviders {
  return provideHighcharts({
    instance: () => import('highcharts/esm/highcharts').then((module) => module.default),
    modules: () => [
      import('highcharts/esm/highcharts-more'),
      import('highcharts/esm/modules/heatmap'),
      import('highcharts/esm/modules/accessibility'),
      // export-data composes the Exporting class, so it must load after that module.
      import('highcharts/esm/modules/exporting').then(
        () => import('highcharts/esm/modules/export-data'),
      ),
    ],
    options: {
      chart: { backgroundColor: '#ffffff', plotBackgroundColor: '#ffffff' },
      credits: { enabled: false },
      exporting: { enabled: false },
    },
  });
}
