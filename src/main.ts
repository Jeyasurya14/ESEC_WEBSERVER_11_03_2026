import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './app/app.component';
import { provideHighchartsCharts } from './app/shared/charts/highcharts.config';

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHighchartsCharts()],
}).catch((error) => {
  console.error('Unable to start ESEC:', error);
});
