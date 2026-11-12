import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RefreshButton } from './refresh-button';

@Component({
  selector: 'app-refresh-button-host',
  imports: [RefreshButton],
  template: `
    <app-refresh-button
      [loading]="loading"
      [variant]="variant"
      (refresh)="refreshCount = refreshCount + 1"
    />
  `,
})
class HostComponent {
  loading = false;
  variant: 'chip' | 'plain' = 'chip';
  refreshCount = 0;
}

describe('RefreshButton', () => {
  function render(loading: boolean, variant: 'chip' | 'plain' = 'chip') {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.loading = loading;
    fixture.componentInstance.variant = variant;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const button = () => element.querySelector('button') as HTMLButtonElement;
    return { fixture, button };
  }

  it('emits refresh on click', () => {
    const { fixture, button } = render(false);
    button().click();
    expect(fixture.componentInstance.refreshCount).toBe(1);
  });

  it('disables itself and spins while loading', () => {
    expect(render(false).button().disabled).toBe(false);
    expect(render(false).button().classList).not.toContain('spinning');

    const loading = render(true);
    expect(loading.button().disabled).toBe(true);
    expect(loading.button().classList).toContain('spinning');
  });

  it('draws plain (no chip chrome) only when asked for it', () => {
    expect(render(false, 'chip').button().classList).not.toContain('plain');
    expect(render(false, 'plain').button().classList).toContain('plain');
  });
});
