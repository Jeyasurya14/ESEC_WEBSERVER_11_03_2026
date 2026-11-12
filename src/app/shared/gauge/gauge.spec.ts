import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BAND_COLORS, BandLimits } from '../filters/usage-band-filter';
import { Gauge, angleForPercent, arcPath } from './gauge';

/** Pulls the two end points out of an `arcPath` string, for comparing against expected coordinates. */
function arcEndpoints(path: string): number[] {
  return (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

describe('angleForPercent', () => {
  it('maps 0% to the left, 100% to the right and 50% to the top', () => {
    expect(angleForPercent(0)).toBe(180);
    expect(angleForPercent(50)).toBe(90);
    expect(angleForPercent(100)).toBe(0);
  });

  it('clamps out-of-range percentages instead of pointing past the ends', () => {
    expect(angleForPercent(-10)).toBe(180);
    expect(angleForPercent(150)).toBe(0);
  });
});

describe('arcPath', () => {
  it('draws a half circle from the left point to the right point for the full 0-100 range', () => {
    const [startX, startY, , , , , , endX, endY] = arcEndpoints(arcPath(0, 100));
    expect(startX).toBeCloseTo(20);
    expect(startY).toBeCloseTo(100);
    expect(endX).toBeCloseTo(180);
    expect(endY).toBeCloseTo(100);
  });
});

const LIMITS: BandLimits = { lowBelow: 60, highFrom: 80 };

@Component({
  selector: 'app-gauge-host',
  imports: [Gauge],
  template: `<app-gauge [percent]="percent" [limits]="limits" />`,
})
class HostComponent {
  percent = 50;
  limits = LIMITS;
}

describe('Gauge', () => {
  function render(percent: number) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.percent = percent;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    return { element };
  }

  it('shows the rounded percentage in the middle of the dial', () => {
    const { element } = render(50);
    expect(element.querySelector('.gauge-value')?.textContent).toBe('50%');
  });

  it('colours the progress arc for the band the percentage falls in', () => {
    expect(render(50).element.querySelector('.gauge-progress')?.getAttribute('stroke')).toBe(
      BAND_COLORS.low, // 50 is below lowBelow (60)
    );
    expect(render(90).element.querySelector('.gauge-progress')?.getAttribute('stroke')).toBe(
      BAND_COLORS.high, // 90 is at/above highFrom (80)
    );
  });

  it('draws the progress arc from empty up to the percentage, so it reads as a fill level', () => {
    const { element } = render(25);
    const [, , , , , , , endX] = arcEndpoints(element.querySelector('.gauge-progress')!.getAttribute('d')!);
    // 0% sits at x=20 (the left end) and 100% at x=180 (the right end); 25% should land well
    // short of the top (x=100), proving the arc stops at the value instead of always being full.
    expect(endX).toBeGreaterThan(20);
    expect(endX).toBeLessThan(100);
  });

  it('still shows the three zone colours regardless of the current value', () => {
    const { element } = render(10);
    const zoneColors = Array.from(element.querySelectorAll('.gauge-zone')).map((zone) =>
      zone.getAttribute('stroke'),
    );
    expect(zoneColors).toEqual([BAND_COLORS.low, BAND_COLORS.medium, BAND_COLORS.high]);
  });
});
