import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReportHandle, TabService } from './tab.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-stub-report',
  template: '{{ label }}',
})
class StubReportComponent {
  label = '';
}

describe('report tabs', () => {
  let tabs: TabService;

  const report = (name: string) => ({ mainMenuName: 'DASHBOARD', subMenuName: name });
  const titles = () => tabs.tabs().map((tab) => tab.menu.subMenuName);
  const idOf = (name: string) => tabs.tabs().find((tab) => tab.menu.subMenuName === name)!.id;
  const activeTitle = () => tabs.activeTab()?.menu.subMenuName;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [TabService] });
    tabs = TestBed.inject(TabService);
    for (const name of ['A', 'B', 'C', 'D']) {
      await tabs.open(report(name));
    }
  });

  it('puts the newest tab on the left and brings it to the front', () => {
    expect(titles()).toEqual(['D', 'C', 'B', 'A']);
    expect(activeTitle()).toBe('D');
  });

  it('opens the same report twice as two tabs, as the company app does', async () => {
    await tabs.open(report('A'));
    expect(titles().filter((title) => title === 'A')).toHaveLength(2);
  });

  it('opens an arbitrary component as its own tab with its own inputs, as a drilldown does', () => {
    tabs.openComponent(report('Row History'), StubReportComponent, { row: 'srv-01' });

    expect(titles()[0]).toBe('Row History');
    expect(tabs.activeTab()?.component).toBe(StubReportComponent);
    expect(tabs.activeTab()?.inputs).toEqual({ row: 'srv-01' });
  });

  it('still passes a report opened by open() its menu as the input, as before', async () => {
    await tabs.open(report('E'));
    expect(tabs.activeTab()?.inputs).toEqual({ menu: report('E') });
  });

  it('closes the front tab and hands focus to its neighbour', () => {
    tabs.close(idOf('D'));
    expect(titles()).toEqual(['C', 'B', 'A']);
    expect(activeTitle()).toBe('C');
  });

  it('keeps the active tab when a different tab is closed', () => {
    tabs.activate(idOf('B'));
    tabs.close(idOf('D'));
    expect(activeTitle()).toBe('B');
  });

  it('shows the empty state after the last tab closes', () => {
    tabs.closeAll();
    expect(tabs.tabs()).toEqual([]);
    expect(tabs.activeTab()).toBeNull();
  });

  it('does not open a report whose load completes after Close All', async () => {
    const pending = tabs.open(report('Late'));
    tabs.closeAll();
    await pending;
    expect(tabs.tabs()).toEqual([]);
  });

  it('ignores stale tab ids without closing unrelated reports or losing the active tab', () => {
    const previous = titles();
    const active = tabs.activeTabId();
    tabs.closeOthers(-1);
    tabs.closeLeftOf(-1);
    tabs.closeRightOf(-1);
    tabs.activate(-1);
    expect(titles()).toEqual(previous);
    expect(tabs.activeTabId()).toBe(active);
  });

  it('pins a tab to the front and keeps it through Close All', () => {
    tabs.togglePin(idOf('B'));
    expect(titles()).toEqual(['B', 'D', 'C', 'A']);

    tabs.closeAll();
    expect(titles()).toEqual(['B']);
  });

  it('opens new tabs after the pinned ones', async () => {
    tabs.togglePin(idOf('A'));
    await tabs.open(report('E'));
    expect(titles()).toEqual(['A', 'E', 'D', 'C', 'B']);
  });

  it('unpins a tab to just after the remaining pinned tabs', () => {
    tabs.togglePin(idOf('A'));
    tabs.togglePin(idOf('C'));
    tabs.togglePin(idOf('C'));
    expect(titles()).toEqual(['A', 'C', 'D', 'B']);
  });

  it('closes all but one tab, keeping pinned tabs and selecting the kept tab', () => {
    tabs.togglePin(idOf('A'));
    tabs.closeOthers(idOf('C'));
    expect(titles()).toEqual(['A', 'C']);
    expect(activeTitle()).toBe('C');
  });

  it('closes tabs to the left and right of a tab, sparing pinned ones', () => {
    tabs.togglePin(idOf('D'));
    tabs.closeRightOf(idOf('C'));
    expect(titles()).toEqual(['D', 'C']);

    tabs.closeLeftOf(idOf('C'));
    expect(titles()).toEqual(['D', 'C']);
  });

  it('offers left/right close only when there is something to close', () => {
    expect(tabs.canCloseLeftOf(idOf('D'))).toBe(false);
    expect(tabs.canCloseLeftOf(idOf('B'))).toBe(true);
    expect(tabs.canCloseRightOf(idOf('A'))).toBe(false);
    expect(tabs.canCloseRightOf(idOf('C'))).toBe(true);
  });

  describe("a tab's refresh control", () => {
    const handle = (overrides: Partial<ReportHandle> = {}): ReportHandle => ({
      loading: () => false,
      refresh: () => {},
      lastUpdated: () => '',
      ...overrides,
    });

    it('is only there once a tab registers one, and only for the active tab', () => {
      expect(tabs.activeReportHandle()).toBeNull();

      tabs.setReportHandle(idOf('D'), handle({ loading: () => true }));
      expect(tabs.activeReportHandle()?.loading()).toBe(true);

      tabs.activate(idOf('A'));
      expect(tabs.activeReportHandle()).toBeNull();
    });

    it('clears when the tab says so', () => {
      tabs.setReportHandle(idOf('D'), handle());
      tabs.setReportHandle(idOf('D'), null);
      expect(tabs.activeReportHandle()).toBeNull();
    });

    it('is forgotten once the tab closes', () => {
      tabs.setReportHandle(idOf('D'), handle());
      tabs.close(idOf('D'));
      tabs.activate(idOf('C'));
      expect(tabs.activeReportHandle()).toBeNull();
    });
  });
});
