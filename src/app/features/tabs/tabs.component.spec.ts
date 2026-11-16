import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { TabService } from './tab.service';
import { TabsComponent } from './tabs.component';

describe('tab strip', () => {
  let element: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<TabsComponent>>;

  const labels = () =>
    Array.from(element.querySelectorAll<HTMLElement>('[role="tab"] .title')).map(
      (itemElement) => itemElement.textContent,
    );
  const menuItems = () =>
    Array.from(element.querySelectorAll('[role="menuitem"]')).map((itemElement) =>
      itemElement.textContent?.trim(),
    );

  async function setUp() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [TabService] });
    const tabs = TestBed.inject(TabService);
    for (const name of ['One', 'Two', 'Three']) {
      await tabs.open({ mainMenuName: 'DASHBOARD', subMenuName: name });
    }
    fixture = TestBed.createComponent(TabsComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  }

  it('shows one tab per report, selected one in front, all reports kept alive', async () => {
    await setUp();

    expect(labels()).toEqual(['Three', 'Two', 'One']);
    expect(element.querySelector('[role="tab"][aria-selected="true"] .title')?.textContent).toBe(
      'Three',
    );
    expect(element.querySelectorAll('[role="tabpanel"]')).toHaveLength(3);
    expect(element.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
    expect(element.querySelector('[role="tabpanel"]:not([hidden]) h1')?.textContent).toContain(
      'Three',
    );
  });

  it('switches tab on click and closes with the cross', async () => {
    await setUp();

    element.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2].click();
    fixture.detectChanges();
    expect(element.querySelector('[role="tabpanel"]:not([hidden]) h1')?.textContent).toContain(
      'One',
    );

    element.querySelector<HTMLButtonElement>('button[aria-label="Close One"]')!.click();
    fixture.detectChanges();
    expect(labels()).toEqual(['Three', 'Two']);
  });

  it('names tabs from their visible title and abbreviation while keeping full context in the description', async () => {
    await setUp();
    const tab = element.querySelector<HTMLElement>('[role="tab"]')!;
    const references = tab.getAttribute('aria-labelledby')!.split(' ');
    const labelParts = references.map((id) => element.querySelector(`[id="${id}"]`)!.textContent);
    expect(labelParts).toEqual(['Three', 'Dash']);
    expect(tab.hasAttribute('aria-label')).toBe(false);
    expect(tab.getAttribute('aria-description')).toBe('DASHBOARD');
  });

  it('offers the right-click menu and pins a tab from it', async () => {
    await setUp();

    const tab = element.querySelectorAll('.tab')[1];
    tab.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    fixture.detectChanges();
    expect(menuItems()).toEqual([
      'Close All',
      'Close All But This',
      'Close Tabs to the Left',
      'Close Tabs to the Right',
      'Pin Tab',
    ]);

    element.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[4].click();
    fixture.detectChanges();
    expect(labels()).toEqual(['Two', 'Three', 'One']);
    expect(element.querySelector('.context-menu')).toBeNull();
  });

  it('closes the menu on Escape', async () => {
    await setUp();

    element.querySelector('.tab')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelector('.context-menu')).toBeNull();
  });

  // ngComponentOutlet recreates its component whenever it's given a different injector object, so
  // a tab's injector (which is how a report reaches TAB_ID) has to stay the same one every time.
  it("keeps the same injector for a tab across calls, so its report isn't torn down and rebuilt", async () => {
    await setUp();
    const [tab] = fixture.componentInstance.tabService.tabs();

    expect(fixture.componentInstance.injectorFor(tab)).toBe(
      fixture.componentInstance.injectorFor(tab),
    );
  });

  it('destroys and releases the injector of a closed tab exactly once', async () => {
    await setUp();
    const tabs = fixture.componentInstance.tabService;
    const [tab] = tabs.tabs();
    const injector = fixture.componentInstance.injectorFor(tab);
    const destroy = vi.spyOn(injector, 'destroy');
    tabs.close(tab.id);
    await fixture.whenStable();
    expect(destroy).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
