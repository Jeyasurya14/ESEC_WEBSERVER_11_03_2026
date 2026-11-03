import { Injectable, Type, computed, signal } from '@angular/core';
import { UserMenu } from '../models';
import { loadReport } from './reports';

export interface Tab {
  id: number;
  menu: UserMenu;
  component: Type<unknown>;
  pinned: boolean;
}

/**
 * The open report tabs. Provided by HomeComponent, so a sign-out discards every tab.
 *
 * Order is always: pinned tabs first, then the rest with the newest on the left.
 */
@Injectable()
export class TabService {
  private nextId = 1;

  readonly tabs = signal<Tab[]>([]);
  readonly activeId = signal<number | null>(null);
  readonly activeTab = computed(() => this.tabs().find((tab) => tab.id === this.activeId()) ?? null);

  /** Opens the report in a new tab (opening the same report twice gives two tabs) and shows it. */
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

  /** Pinned tabs always stay. */
  closeAll(): void {
    this.removeWhere((tab) => !tab.pinned);
  }

  closeOthers(id: number): void {
    this.removeWhere((tab) => tab.id !== id && !tab.pinned);
    this.activate(id);
  }

  closeLeftOf(id: number): void {
    this.removeWhere((tab, index) => index < this.indexOf(id) && !tab.pinned);
    this.activate(id);
  }

  closeRightOf(id: number): void {
    this.removeWhere((tab, index) => index > this.indexOf(id) && !tab.pinned);
    this.activate(id);
  }

  /** Pinning moves the tab to the front; unpinning moves it just after the remaining pinned tabs. */
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

  /** "Close left/right" only makes sense with 3+ tabs and something unpinned on that side. */
  canCloseLeftOf(id: number): boolean {
    const index = this.indexOf(id);
    return this.tabs().length > 2 && this.tabs().slice(0, index).some((tab) => !tab.pinned);
  }

  canCloseRightOf(id: number): boolean {
    const index = this.indexOf(id);
    return this.tabs().length > 2 && this.tabs().slice(index + 1).some((tab) => !tab.pinned);
  }

  private indexOf(id: number): number {
    return this.tabs().findIndex((tab) => tab.id === id);
  }

  /** Removes matching tabs. If the active tab goes, the tab that takes its place becomes active. */
  private removeWhere(shouldRemove: (tab: Tab, index: number) => boolean): void {
    const before = this.tabs();
    const activeIndex = this.indexOf(this.activeId() ?? -1);
    const after = before.filter((tab, index) => !shouldRemove(tab, index));

    this.tabs.set(after);

    if (!after.some((tab) => tab.id === this.activeId())) {
      const replacement = after[Math.min(Math.max(activeIndex, 0), after.length - 1)];
      this.activeId.set(replacement?.id ?? null);
    }
  }
}
