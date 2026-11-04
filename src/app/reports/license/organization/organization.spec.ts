import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Organization } from './organization';

describe('License / Organization', () => {
  it('shows which screen it is and its placeholder text', async () => {
    const fixture = TestBed.createComponent(Organization);
    fixture.componentRef.setInput('menu', { mainMenuName: 'LICENSE', subMenuName: 'Organization' });
    await fixture.whenStable();

    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelector('h1')?.textContent).toBe('LICENSE / Organization');
    expect(page.textContent).toContain('Organization report');
    expect(page.classList.contains('report-page')).toBe(true);
  });
});
