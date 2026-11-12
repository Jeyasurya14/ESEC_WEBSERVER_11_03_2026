import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TabService } from './tab.service';

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

  describe('a tab\'s refresh control', () => {
    it('is only there once a tab registers one, and only for the active tab', () => {
      expect(tabs.activeRefreshHandle()).toBeNull();

      tabs.setRefreshHandle(idOf('D'), { loading: () => true, refresh: () => {} });
      expect(tabs.activeRefreshHandle()?.loading()).toBe(true);

      tabs.activate(idOf('A'));
      expect(tabs.activeRefreshHandle()).toBeNull();
    });

    it('clears when the tab says so', () => {
      tabs.setRefreshHandle(idOf('D'), { loading: () => false, refresh: () => {} });
      tabs.setRefreshHandle(idOf('D'), null);
      expect(tabs.activeRefreshHandle()).toBeNull();
    });

    it('is forgotten once the tab closes', () => {
      tabs.setRefreshHandle(idOf('D'), { loading: () => false, refresh: () => {} });
      tabs.close(idOf('D'));
      tabs.activate(idOf('C'));
      expect(tabs.activeRefreshHandle()).toBeNull();
    });
  });
});
