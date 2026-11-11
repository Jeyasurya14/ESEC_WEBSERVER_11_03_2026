import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export type UsageBand = 'low' | 'medium' | 'high';

export interface BandLimits {
  lowBelow: number;
  highFrom: number;
  bandColors?: Readonly<Record<UsageBand, string>>;
}

export const ALL_BANDS: readonly UsageBand[] = ['low', 'medium', 'high'];

export const BAND_COLORS: Readonly<Record<UsageBand, string>> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};

export function bandOf(percent: number, limits: BandLimits): UsageBand {
  if (percent < limits.lowBelow) return 'low';
  if (percent < limits.highFrom) return 'medium';
  return 'high';
}

/** The band's colour from the settings, or the default colour. */
export function bandColor(band: UsageBand, limits: BandLimits): string {
  return (limits.bandColors ?? BAND_COLORS)[band];
}

/**
 * Whether a row's percentage is in one of the selected bands. With every band selected all rows
 * pass, including rows without a percentage; otherwise a row needs a value in a selected band.
 */
export function matchesBands(
  percent: unknown,
  selected: readonly UsageBand[],
  limits: BandLimits,
): boolean {
  if (ALL_BANDS.every((band) => selected.includes(band))) {
    return true;
  }
  if (
    percent === null ||
    percent === undefined ||
    percent === '' ||
    Number.isNaN(Number(percent))
  ) {
    return false;
  }
  return selected.includes(bandOf(Number(percent), limits));
}

@Component({
  selector: 'app-usage-band-filter',
  template: `
    @for (band of bands; track band) {
      <label class="filter check">
        <input type="checkbox" [checked]="selected().includes(band)" (change)="toggle(band)" />
        <span class="band-dot" [style.background]="colorOf(band)" aria-hidden="true"></span>
        {{ labelOf(band) }}
      </label>
    }
  `,
  styles: `
    .band-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
  `,
  host: { class: 'filter-group', role: 'group', 'aria-label': 'Usage level' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageBandFilter {
  readonly selected = model.required<UsageBand[]>();
  readonly limits = input.required<BandLimits>();

  protected readonly bands = ALL_BANDS;

  protected colorOf(band: UsageBand): string {
    return bandColor(band, this.limits());
  }

  protected labelOf(band: UsageBand): string {
    const { lowBelow, highFrom } = this.limits();
    if (band === 'low') return `< ${lowBelow}%`;
    if (band === 'medium') return `≥ ${lowBelow}% to < ${highFrom}%`;
    return `≥ ${highFrom}%`;
  }

  protected toggle(band: UsageBand): void {
    this.selected.update((current) =>
      current.includes(band) ? current.filter((item) => item !== band) : [...current, band],
    );
  }
}
