import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BAND_COLORS, BandLimits } from '../filters/usage-band-filter';
import { GaugeStat, GaugeTile } from './gauge-tile';

@Component({
  selector: 'app-gauge-tile-host',
  imports: [GaugeTile],
  template: `
    <app-gauge-tile
      [title]="title"
      [percent]="percent"
      [limits]="limits"
      [stats]="stats"
    />
  `,
})
class HostComponent {
  title = 'ORACLE, srv-01, Design Suite';
  percent = 72;
  limits: BandLimits = { lowBelow: 60, highFrom: 80 };
  stats: GaugeStat[] = [
    { label: 'Percentage', value: '72' },
    { label: 'Value', value: '1,204' },
  ];
}

describe('GaugeTile', () => {
  it('shows the title and every stat it is given', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.gauge-tile-title')?.textContent).toContain(
      'ORACLE, srv-01, Design Suite',
    );

    const stats = Array.from(element.querySelectorAll('.gauge-tile-stat'));
    expect(stats).toHaveLength(2);
    expect(stats[0].textContent).toContain('72');
    expect(stats[0].textContent).toContain('Percentage');
    expect(stats[1].textContent).toContain('1,204');
    expect(stats[1].textContent).toContain('Value');
  });

  it('renders the gauge for the same percentage it was given', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.gauge-value')?.textContent).toBe('72%');
  });

  it("accents the card with the gauge's own band colour", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('app-gauge-tile') as HTMLElement;

    // 72% is medium (>= 60, < 80) under this host's limits.
    expect(tile.style.getPropertyValue('--tile-accent')).toBe(BAND_COLORS.medium);
  });
});
