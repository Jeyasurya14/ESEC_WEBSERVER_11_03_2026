import { Injectable, InjectionToken, Type, computed, signal } from '@angular/core';
import { UserMenu } from '../../core/models';
import { loadReport } from '../../reports/reports';

export interface Tab {
  id: number;
  menu: UserMenu;
  component: Type<unknown>;
  pinned: boolean;
}

/**
 * The id of the tab a report is running in, if any - inject it (it's optional) to reach
 * `TabService.setRefreshHandle` and put a refresh control in the shared status bar instead of a
 * report's own toolbar. Provided per tab by TabsComponent, not by the report itself.
 */
export const TAB_ID = new InjectionToken<number>('TAB_ID');

/** How a report's own refresh button reaches the shared status bar: its loading state and what to call. */
export interface RefreshHandle {
  loading: () => boolean;
  refresh: () => void;
}

@Injectable()
export class TabService {
  private nextId = 1;

  readonly tabs = signal<Tab[]>([]);
  readonly activeId = signal<number | null>(null);
  readonly activeTab = computed(() => this.tabs().find((tab) => tab.id === this.activeId()) ?? null);

  // A report registers its refresh handle under its own tab id (see Organization for how); this
  // map isn't a signal itself, so refreshVersion stands in for "something in it changed".
  private readonly refreshHandles = new Map<number, RefreshHandle>();
  private readonly refreshVersion = signal(0);

  /** The open tab whose refresh should show in the status bar - the active tab's, if it has one. */
  readonly activeRefreshHandle = computed<RefreshHandle | null>(() => {
    this.refreshVersion();
    const id = this.activeId();
    return id === null ? null : (this.refreshHandles.get(id) ?? null);
  });

  setRefreshHandle(tabId: number, handle: RefreshHandle | null): void {
    if (handle) {
      this.refreshHandles.set(tabId, handle);
    } else {
      this.refreshHandles.delete(tabId);
    }
    this.refreshVersion.update((version) => version + 1);
  }

  async open(menu: UserMenu): Promise<void> {
    const component = await loadReport(menu);
    const tab: Tab = { id: this.nextId++, menu, component, pinned: false };

    this.tabs.update((tabs) => {
      const pinnedCount = tabs.filter((existing) => existing.pinned).length;
      return [...tabs.slice(0, pinnedCount), tab, ...tabs.slice(pinnedCount)];
    });
    this.activeId.set(tab.id);
  }

  activate(id: number): void {
    this.activeId.set(id);
  }

  close(id: number): void {
    this.removeWhere((tab) => tab.id === id);
  }

  closeAll(): void {
    this.removeWhere((tab) => !tab.pinned);
  }

  closeOthers(id: number): void {
    this.removeWhere((tab) => tab.id !== id && !tab.pinned);
    this.activate(id);
  }

  closeLeftOf(id: number): void {
    const at = this.indexOf(id);
    this.removeWhere((tab, index) => index < at && !tab.pinned);
    this.activate(id);
  }

  closeRightOf(id: number): void {
    const at = this.indexOf(id);
    this.removeWhere((tab, index) => index > at && !tab.pinned);
    this.activate(id);
  }

  togglePin(id: number): void {
    this.tabs.update((tabs) => {
      const tab = tabs.find((candidate) => candidate.id === id);
      if (!tab) {
        return tabs;
      }

      const others = tabs.filter((candidate) => candidate.id !== id);
      const moved = { ...tab, pinned: !tab.pinned };
      const position = moved.pinned ? 0 : others.filter((other) => other.pinned).length;
      return [...others.slice(0, position), moved, ...others.slice(position)];
    });
    this.activate(id);
  }

  canCloseLeftOf(id: number): boolean {
    const tabs = this.tabs();
    return tabs.length > 2 && tabs.slice(0, this.indexOf(id)).some((tab) => !tab.pinned);
  }

  canCloseRightOf(id: number): boolean {
    const tabs = this.tabs();
    return tabs.length > 2 && tabs.slice(this.indexOf(id) + 1).some((tab) => !tab.pinned);
  }

  private indexOf(id: number): number {
    return this.tabs().findIndex((tab) => tab.id === id);
  }

  private removeWhere(shouldRemove: (tab: Tab, index: number) => boolean): void {
    const before = this.tabs();
    const activeIndex = this.indexOf(this.activeId() ?? -1);
    const after = before.filter((tab, index) => !shouldRemove(tab, index));

    before
      .filter((tab, index) => shouldRemove(tab, index))
      .forEach((tab) => this.setRefreshHandle(tab.id, null));

    this.tabs.set(after);

    if (!after.some((tab) => tab.id === this.activeId())) {
      const replacement = after[Math.min(Math.max(activeIndex, 0), after.length - 1)];
      this.activeId.set(replacement?.id ?? null);
    }
  }
}
