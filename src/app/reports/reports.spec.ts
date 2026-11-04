import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Organization } from './license/organization/organization';
import { REPORTS, ReportPlaceholderComponent, loadReport } from './reports';

describe('report registry', () => {
  it('opens the real component for a registered screen', async () => {
    const component = await loadReport({ mainMenuName: 'LICENSE', subMenuName: 'Organization' });
    expect(component).toBe(Organization);
  });

  it('opens the placeholder for a screen without a component yet', async () => {
    const component = await loadReport({ mainMenuName: 'LICENSE', subMenuName: 'Department' });
    expect(component).toBe(ReportPlaceholderComponent);
  });

  it('does not mix up a same-named screen in another menu', async () => {
    const component = await loadReport({ mainMenuName: 'DASHBOARD', subMenuName: 'Organization' });
    expect(component).toBe(ReportPlaceholderComponent);
  });

  // Covers every report that gets added later: each must load, accept `menu`, and show its screen.
  it.each([...REPORTS.keys()])('%s loads and renders its screen', async (key) => {
    const [mainMenuName, subMenuName] = key.split('/');
    const component = await loadReport({ mainMenuName, subMenuName });
    expect(component).not.toBe(ReportPlaceholderComponent);

    const fixture = TestBed.createComponent(component);
    fixture.componentRef.setInput('menu', { mainMenuName, subMenuName });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(subMenuName);
  });
});
