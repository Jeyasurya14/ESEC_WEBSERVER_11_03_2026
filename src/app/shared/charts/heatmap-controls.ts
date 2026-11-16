import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { HeatmapColorScale } from '../report-settings.service';
import { HEATMAP_BANDS } from './heatmap-options';

let nextHeatmapId = 0;

/** Company-style heatmap controls shared by Organization and scoped heatmaps. */
@Component({
  selector: 'app-heatmap-controls',
  template: `
    <div class="metric-row">
      <div class="metric-options" role="radiogroup" aria-label="Utilization">
        <span class="metric-caption">Utilization</span>
        <label
          ><input
            type="radio"
            [name]="metricName"
            [checked]="metric() === 'peak'"
            (change)="metric.set('peak')"
          />
          Peak</label
        >
        <label
          ><input
            type="radio"
            [name]="metricName"
            [checked]="metric() === 'average'"
            (change)="metric.set('average')"
          />
          Average</label
        >
      </div>
      <label><input type="checkbox" [checked]="used()" (change)="used.set(!used())" /> Used</label>
      <label
        ><input type="checkbox" [checked]="issued()" (change)="issued.set(!issued())" />
        Issued</label
      >
      <span class="value-key">
        @if (used() || issued()) {
          {{ used() && issued() ? 'Used / Issued' : used() ? 'Used' : 'Issued' }}<br />
        }
        Percentage
      </span>
    </div>
    <div class="heatmap-controls" role="toolbar" aria-label="Heatmap color bands">
      <button
        type="button"
        class="date-sort"
        (click)="descending.set(!descending())"
        [title]="descending() ? 'Sort dates oldest first' : 'Sort dates newest first'"
      >
        Date
        <span aria-hidden="true">
          @if (descending()) {
            &#8595;
          } @else {
            &#8593;
          }
        </span>
      </button>
      @for (band of bands; track band.key) {
        <button
          type="button"
          [attr.aria-pressed]="!hidden().includes(band.key)"
          [style.background-color]="hidden().includes(band.key) ? '#e2e8f0' : colors()[band.key]"
          [class.inactive]="hidden().includes(band.key)"
          (click)="toggle(band.key)"
        >
          {{ band.label }}
        </button>
      }
      <span class="holiday">Holiday</span>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex: none;
      flex-wrap: nowrap;
      align-items: center;
      min-width: 0;
      max-width: 100%;
      overflow-x: auto;
      border-bottom: 1px solid #d4d9df;
      background: #fafafa;
      scrollbar-width: thin;
    }
    .metric-row {
      display: flex;
      flex: none;
      align-items: center;
      gap: 10px;
      min-height: 36px;
      padding: 4px 10px;
      font-size: 12px;
    }
    .metric-options {
      display: flex;
      flex: none;
      align-items: center;
      gap: 8px;
      border: 0;
      padding: 0;
      margin: 0;
      white-space: nowrap;
    }
    .metric-caption {
      font-weight: 600;
    }
    label {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    input {
      margin: 0;
      accent-color: #2563eb;
    }
    .value-key {
      flex: none;
      line-height: 15px;
      text-align: center;
      font-size: 11px;
    }
    .heatmap-controls {
      display: flex;
      flex: none;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      padding: 4px 10px;
      font-size: 11px;
    }
    button {
      flex: none;
      min-height: 24px;
      padding: 2px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      color: #111827;
      font: inherit;
      white-space: nowrap;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
    button.inactive {
      color: #64748b;
      text-decoration: line-through;
    }
    .date-sort {
      background: #f5f7f9;
    }
    .holiday {
      padding: 3px 10px;
      margin-left: 8px;
      background: #faa0a0;
      border-radius: 3px;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatmapControls {
  protected readonly metricName = 'heatmap-metric-' + ++nextHeatmapId;
  readonly metric = model<'peak' | 'average'>('peak');
  readonly used = model(false);
  readonly issued = model(false);
  readonly colors = input.required<HeatmapColorScale>();
  readonly hidden = model<readonly (keyof HeatmapColorScale)[]>([]);
  readonly descending = model(false);
  protected readonly bands = HEATMAP_BANDS;

  protected toggle(band: keyof HeatmapColorScale): void {
    this.hidden.update((current) =>
      current.includes(band) ? current.filter((value) => value !== band) : [...current, band],
    );
  }
}
