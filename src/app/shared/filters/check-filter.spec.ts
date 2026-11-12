import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CheckFilter } from './check-filter';

@Component({
  selector: 'app-check-filter-host',
  imports: [CheckFilter],
  template: `
    <app-check-filter
      label="Active"
      [checked]="checked"
      [dotColor]="dotColor"
      (toggled)="toggledCount = toggledCount + 1"
    />
  `,
})
class HostComponent {
  checked = false;
  dotColor: string | undefined;
  toggledCount = 0;
}

describe('CheckFilter', () => {
  function render(checked: boolean, dotColor?: string) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.checked = checked;
    fixture.componentInstance.dotColor = dotColor;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const checkbox = () => element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    return { fixture, element, checkbox };
  }

  it('shows the label and reflects the checked state', () => {
    expect(render(false).checkbox().checked).toBe(false);
    expect(render(true).checkbox().checked).toBe(true);
  });

  it('shows the label text', () => {
    expect(render(false).element.textContent).toContain('Active');
  });

  it('emits toggled when the checkbox is clicked, without tracking its own state', () => {
    const { fixture, checkbox } = render(false);
    checkbox().click();
    expect(fixture.componentInstance.toggledCount).toBe(1);
  });

  it('only draws a dot when given a colour', () => {
    expect(render(false).element.querySelector('.check-dot')).toBeNull();
    expect(render(false, '#10b981').element.querySelector('.check-dot')).not.toBeNull();
  });
});
