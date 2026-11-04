import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Division } from './division';

describe('License / Division', () => {
  it('shows which screen it is and its placeholder text', async () => {
    const fixture = TestBed.createComponent(Division);
    fixture.componentRef.setInput('menu', { mainMenuName: 'LICENSE', subMenuName: 'Division' });
    await fixture.whenStable();

    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('h1')?.textContent).toBe('LICENSE / Division');
    expect(page.textContent).toContain('Division report');
    expect(page.classList.contains('report-page')).toBe(true);
  });
});
