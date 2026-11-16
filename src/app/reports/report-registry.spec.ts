import { instance } from '../../testing/instances';
import { TabService } from '../features/tabs/tab.service';
import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../core/api/api.service';
import { Organization } from './license/organization/organization';
import {
  REPORT_LOADERS,
  ReportPlaceholderComponent,
  assertNoDuplicateReportKeys,
  loadReport,
} from './report-registry';

describe('report registry', () => {
  it('refuses a report list with a repeated key', () => {
    expect(() =>
      assertNoDuplicateReportKeys([
        ['LICENSE/Organization', 1],
        ['LICENSE/Organization', 2],
      ]),
    ).toThrow('registers the same report key twice');
  });

  it('accepts a report list where every key is unique', () => {
    expect(() =>
      assertNoDuplicateReportKeys([
        ['LICENSE/Organization', 1],
        ['LICENSE/Division', 2],
      ]),
    ).not.toThrow();
  });

  it('opens the real component for a registered screen', async () => {
    const component = await loadReport({ mainMenuName: 'LICENSE', subMenuName: 'Organization' });
    expect(component).toBe(Organization);
  });

  it('opens the placeholder for a screen without a component yet', async () => {
    const component = await loadReport({ mainMenuName: 'LICENSE', subMenuName: 'Unknown report' });
    expect(component).toBe(ReportPlaceholderComponent);
  });

  it('does not mix up a same-named screen in another menu', async () => {
    const component = await loadReport({ mainMenuName: 'DASHBOARD', subMenuName: 'Organization' });
    expect(component).toBe(ReportPlaceholderComponent);
  });

  // Covers every report that gets added later: each must load, accept `menu`, and render.
  // Settings resolve, while report requests stay pending to exercise the loading state.
  // A report with a grid renders the full grid, which can take several seconds in jsdom under load.
  it.each([...REPORT_LOADERS.keys()])('%s loads and renders', { timeout: 20_000 }, async (key) => {
    const silentServer = {
      getSetting: () => '',
      query: () => of({ status: 'PASS', message: [] }),
      call: (sql: string) =>
        sql.includes('a_user_pref_load') ? of({ status: 'PASS', message: [] }) : NEVER,
      write: () => NEVER,
      post: () => NEVER,
    };
    TestBed.configureTestingModule({
      providers: [TabService, { provide: ApiService, useValue: silentServer }],
    });

    const [mainMenuName, subMenuName] = key.split('/');
    const component = await loadReport({ mainMenuName, subMenuName });
    expect(component).not.toBe(ReportPlaceholderComponent);

    const fixture = TestBed.createComponent(component);
    fixture.componentRef.setInput('menu', { mainMenuName, subMenuName });
    fixture.detectChanges();
    // Pending report resources intentionally keep Angular unstable.
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();

    expect(instance(fixture.nativeElement, HTMLElement).childElementCount).toBeGreaterThan(0);
    for (const control of instance(fixture.nativeElement, HTMLElement).querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('label input, label select')) {
      // Native labels supply the visible name; ARIA overrides must not replace that text.
      expect(Array.from(control.labels ?? [])).toContain(control.closest('label'));
      if (!control.closest('label')?.textContent?.trim()) continue;
      expect(control.hasAttribute('aria-label')).toBe(false);
      expect(control.hasAttribute('aria-labelledby')).toBe(false);
    }
  });
});

describe('recovering from a report that fails to load', () => {
  const RELOAD_MARKER = 'esec:reloaded-after-report-load-failure';
  const brokenMenu = { mainMenuName: 'TEST', subMenuName: 'Broken' };

  beforeEach(() => {
    sessionStorage.clear();
    REPORT_LOADERS.set(`${brokenMenu.mainMenuName}/${brokenMenu.subMenuName}`, () =>
      Promise.reject(new Error('chunk failed to load')),
    );
  });

  afterEach(() => {
    REPORT_LOADERS.delete(`${brokenMenu.mainMenuName}/${brokenMenu.subMenuName}`);
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('reloads once on the first failure, but not again on a second one', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    await expect(loadReport(brokenMenu)).rejects.toThrow('chunk failed to load');
    expect(reload).toHaveBeenCalledTimes(1);

    await expect(loadReport(brokenMenu)).rejects.toThrow('chunk failed to load');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('clears the reload marker once a report loads successfully again', async () => {
    sessionStorage.setItem(RELOAD_MARKER, 'true');

    const component = await loadReport({ mainMenuName: 'LICENSE', subMenuName: 'Organization' });

    expect(component).toBe(Organization);
    expect(sessionStorage.getItem(RELOAD_MARKER)).toBeNull();
  });
});
