import { instance } from '../../../testing/instances';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HEATMAP_COLORS } from '../report-settings.service';
import { HeatmapControls } from './heatmap-controls';

describe('Heatmap color bands', () => {
  it('keeps Peak/Average and quantity controls independent per heatmap', () => {
    const fixture = TestBed.createComponent(HeatmapControls);
    fixture.componentRef.setInput('colors', DEFAULT_HEATMAP_COLORS);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();
    element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.metric()).toBe('average');
    expect(fixture.componentInstance.used()).toBe(true);
    expect(element.querySelector('.value-key')?.textContent).toContain('Percentage');
    const second = TestBed.createComponent(HeatmapControls);
    second.componentRef.setInput('colors', DEFAULT_HEATMAP_COLORS);
    second.detectChanges();
    expect(second.componentInstance.metric()).toBe('peak');
    expect(second.nativeElement.querySelector('input[type="radio"]').name).not.toBe(
      element.querySelector<HTMLInputElement>('input[type="radio"]')!.name,
    );
  });
  it('toggles a band without losing its visible accessible label and reverses date order', () => {
    const fixture = TestBed.createComponent(HeatmapControls);
    fixture.componentRef.setInput('colors', DEFAULT_HEATMAP_COLORS);
    fixture.detectChanges();
    const buttons = instance(
      fixture.nativeElement,
      HTMLElement,
    ).querySelectorAll<HTMLButtonElement>('button');
    expect(buttons).toHaveLength(8);
    expect(buttons[1].textContent?.trim()).toBe('0% - 50%');
    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.hidden()).toEqual(['from0To50']);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    buttons[1].click();
    buttons[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.hidden()).toEqual([]);
    expect(fixture.componentInstance.descending()).toBe(true);
  });
});
