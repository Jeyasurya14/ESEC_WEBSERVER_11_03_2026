import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ApiService } from '../core/api/api.service';
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

  // Covers every report that gets added later: each must load, accept `menu`, and render.
  // The server never answers here, so reports that fetch data render in their loading state.
  // A report with a grid renders the full grid, which can take several seconds in jsdom under load.
  it.each([...REPORTS.keys()])('%s loads and renders', { timeout: 20_000 }, async (key) => {
    const silentServer = {
      getSetting: () => '',
      query: () => NEVER,
      call: () => NEVER,
      write: () => NEVER,
      post: () => NEVER,
    };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: silentServer }],
    });

    const [mainMenuName, subMenuName] = key.split('/');
    const component = await loadReport({ mainMenuName, subMenuName });
    expect(component).not.toBe(ReportPlaceholderComponent);

    const fixture = TestBed.createComponent(component);
    fixture.componentRef.setInput('menu', { mainMenuName, subMenuName });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).childElementCount).toBeGreaterThan(0);
  });
});
