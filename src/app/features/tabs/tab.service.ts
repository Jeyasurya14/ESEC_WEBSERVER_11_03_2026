import { Injectable, Type, computed, signal } from '@angular/core';
import { UserMenu } from '../../core/models';
import { loadReport } from '../../reports/reports';

export interface Tab {
  id: number;
  menu: UserMenu;
  component: Type<unknown>;
  pinned: boolean;
}


@Injectable()
export class TabService {
  private nextId = 1;

  readonly tabs = signal<Tab[]>([]);
  readonly activeId = signal<number | null>(null);
  readonly activeTab = computed(() => this.tabs().find((tab) => tab.id === this.activeId()) ?? null);

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

    this.tabs.set(after);

    if (!after.some((tab) => tab.id === this.activeId())) {
      const replacement = after[Math.min(Math.max(activeIndex, 0), after.length - 1)];
      this.activeId.set(replacement?.id ?? null);
    }
  }
}
