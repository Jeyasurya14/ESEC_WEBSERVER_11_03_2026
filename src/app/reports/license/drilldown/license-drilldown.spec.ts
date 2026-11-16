import { reportSettings, organizationRow } from '../../../../testing/report-fixtures';
import { LicenseDetail } from '../detail/license-detail';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TabService } from '../../../features/tabs/tab.service';

import { OrganizationRow, OrganizationTile } from '../organization/organization.data';
import { LicenseBundle } from '../bundle/license-bundle';
import { LicenseDrilldown } from './license-drilldown';
import { GaugeTile } from '../../../shared/gauge/gauge-tile';
import {
  LICENSE_DRILLDOWN_LOADER,
  LicenseDrilldownLoader,
  LicenseDrilldownView,
} from './license-drilldown-loader';
import { formatSqlDate } from '../../../shared/dates';

const settings = reportSettings({ lowBelow: 50, highFrom: 80, workingHoursPerDay: 12 });

/** A fresh tile each call, as `organizationTiles` builds one every time a row is selected. */
function tile(): OrganizationTile {
  return {
    title: 'Matlab, srv-01, MATLAB_Report_Gen',
    percent: 72,
    stats: [],
    row: organizationRow({ server: 'srv-01', lic: 'MATLAB' }),
  };
}

describe('LicenseDrilldown', () => {
  let openComponent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openComponent = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: TabService, useValue: { openComponent } }],
    });
  });

  async function open(selectedTile: OrganizationTile | null, rows: OrganizationRow[] = []) {
    const fixture = TestBed.createComponent(LicenseDrilldown);
    fixture.componentRef.setInput('tile', selectedTile);
    fixture.componentRef.setInput('reportSettings', settings);
    fixture.componentRef.setInput('allRows', rows);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** Simulates clicking a row's Software link again - the company app's actual open trigger. */
  async function selectRow(
    fixture: Awaited<ReturnType<typeof open>>,
    selectedTile: OrganizationTile,
  ) {
    fixture.componentRef.setInput('tile', selectedTile);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function clickTab(fixture: Awaited<ReturnType<typeof open>>, label: string): void {
    const element: HTMLElement = fixture.nativeElement;
    const button = Array.from(element.querySelectorAll<HTMLButtonElement>('.report-action')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    expect(button, `Missing report action: ${label}`).toBeDefined();
    button!.click();
    fixture.detectChanges();
  }

  it('opens the armed view (Summary, by default) as a new app tab as soon as a row is selected', async () => {
    await open(tile());

    expect(openComponent).toHaveBeenCalledTimes(1);
    const [menu, , inputs] = openComponent.mock.calls[0];
    expect(menu).toEqual({ mainMenuName: tile().title, subMenuName: 'Summary' });
    expect(inputs.title).toBe(tile().title);
  });

  it('opens nothing while no row is selected yet (Bundle excepted)', async () => {
    await open(null);

    expect(openComponent).not.toHaveBeenCalled();
  });

  it("arms a tab on click without opening it - the company app's own selectNode does the same", async () => {
    const fixture = await open(null);

    clickTab(fixture, 'Heatmap');

    expect(openComponent).not.toHaveBeenCalled();
  });

  it('only opens the newly armed tab once a row is (re-)selected, not on the tab click itself', async () => {
    const fixture = await open(tile());
    openComponent.mockClear(); // the initial Summary-on-select call, above

    clickTab(fixture, 'History');
    expect(openComponent).not.toHaveBeenCalled();

    await selectRow(fixture, tile());
    expect(openComponent).toHaveBeenCalledTimes(1);
    const [menu, component] = openComponent.mock.calls[0];
    expect(menu.subMenuName).toBe('History');
    expect(component).toBe(LicenseDetail);
  });

  it('shares one component between Checkout User and Long Duration, distinguished by view', async () => {
    const fixture = await open(tile());
    openComponent.mockClear();

    clickTab(fixture, 'Checkout User');
    await selectRow(fixture, tile());
    clickTab(fixture, 'Long Duration');
    await selectRow(fixture, tile());

    expect(openComponent).toHaveBeenCalledTimes(2);
    const [, checkoutComponent, checkoutInputs] = openComponent.mock.calls[0];
    const [, longDurationComponent, longDurationInputs] = openComponent.mock.calls[1];
    expect(checkoutComponent).toBe(LicenseDetail);
    expect(longDurationComponent).toBe(LicenseDetail);
    expect(checkoutInputs.view).toBe('checkoutUser');
    expect(longDurationInputs.view).toBe('longDuration');
  });

  it('opens Bundle immediately on click, with no row selected, since it covers every loaded row', async () => {
    const rows = [tile().row];
    const fixture = await open(null, rows);

    clickTab(fixture, 'Bundle');
    await fixture.whenStable();

    expect(openComponent).toHaveBeenCalledTimes(1);
    const [, component, inputs] = openComponent.mock.calls[0];
    expect(component).toBe(LicenseBundle);
    expect(inputs.rows).toEqual(rows);
    expect(inputs.rows).not.toBe(rows);
  });

  it('prevents opening an empty Bundle', async () => {
    const fixture = await open(null);
    clickTab(fixture, 'Bundle');
    await fixture.whenStable();
    expect(openComponent).not.toHaveBeenCalled();
  });

  it('passes the parent reporting period into date-based destinations without opening on filter changes', async () => {
    const fixture = await open(tile());
    openComponent.mockClear();
    clickTab(fixture, 'History');
    fixture.componentRef.setInput('reportRange', { kind: 'month', year: 2024, month: 2 });
    await fixture.whenStable();
    expect(openComponent).not.toHaveBeenCalled();
    await selectRow(fixture, tile());
    const range = openComponent.mock.calls[0][2].range;
    expect(formatSqlDate(range.startDate)).toBe('2024-02-01');
    expect(formatSqlDate(range.endDate)).toBe('2024-02-29');
  });

  it('shows a failed chunk load and retries the selected report', async () => {
    const loader = vi
      .fn<LicenseDrilldownLoader>()
      .mockRejectedValueOnce(new Error('Chunk load failed'))
      .mockResolvedValue({ component: GaugeTile, inputs: {} });
    TestBed.overrideProvider(LICENSE_DRILLDOWN_LOADER, { useValue: loader });
    const fixture = await open(tile());
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to open Summary',
    );
    expect(openComponent).not.toHaveBeenCalled();
    element.querySelector<HTMLButtonElement>('.open-error button')!.click();
    await fixture.whenStable();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(openComponent).toHaveBeenCalledOnce();
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('opens only the newest selected row when lazy loads finish in reverse order', async () => {
    let firstComplete!: (view: LicenseDrilldownView) => void;
    let secondComplete!: (view: LicenseDrilldownView) => void;
    const loader = vi
      .fn<LicenseDrilldownLoader>()
      .mockReturnValueOnce(new Promise((resolve) => (firstComplete = resolve)))
      .mockReturnValueOnce(new Promise((resolve) => (secondComplete = resolve)));
    TestBed.overrideProvider(LICENSE_DRILLDOWN_LOADER, { useValue: loader });
    const fixture = await open(null);
    fixture.componentRef.setInput('tile', { ...tile(), title: 'First' });
    fixture.detectChanges();
    fixture.componentRef.setInput('tile', { ...tile(), title: 'Second' });
    fixture.detectChanges();
    expect(loader).toHaveBeenCalledTimes(2);
    secondComplete({ component: GaugeTile, inputs: { title: 'Second' } });
    firstComplete({ component: GaugeTile, inputs: { title: 'First' } });
    await fixture.whenStable();
    expect(openComponent).toHaveBeenCalledExactlyOnceWith(
      { mainMenuName: 'Second', subMenuName: 'Summary' },
      GaugeTile,
      { title: 'Second' },
    );
  });

  it('does not open a stale report after the user changes the armed action', async () => {
    let complete!: (view: LicenseDrilldownView) => void;
    TestBed.overrideProvider(LICENSE_DRILLDOWN_LOADER, {
      useValue: () => new Promise<LicenseDrilldownView>((resolve) => (complete = resolve)),
    });
    const fixture = await open(null);
    fixture.componentRef.setInput('tile', tile());
    fixture.detectChanges();
    clickTab(fixture, 'Hours');
    complete({ component: GaugeTile, inputs: {} });
    await fixture.whenStable();
    expect(openComponent).not.toHaveBeenCalled();
  });

  it('does not open tabs after the originating component is destroyed', async () => {
    let complete!: (view: LicenseDrilldownView) => void;
    TestBed.overrideProvider(LICENSE_DRILLDOWN_LOADER, {
      useValue: () => new Promise<LicenseDrilldownView>((resolve) => (complete = resolve)),
    });
    const fixture = await open(null);
    fixture.componentRef.setInput('tile', tile());
    fixture.detectChanges();
    fixture.destroy();
    complete({ component: GaugeTile, inputs: {} });
    await Promise.resolve();
    expect(openComponent).not.toHaveBeenCalled();
  });
});
