import {
  DestroyRef,
  Injectable,
  InjectionToken,
  Type,
  computed,
  inject,
  signal,
} from '@angular/core';
import { UserMenu } from '../../core/models';
import { loadReport } from '../../reports/report-registry';
import type { ReportControls } from '../../shared/status-bar/report-controls';

export interface Tab {
  id: number;
  menu: UserMenu;
  component: Type<unknown>;
  /** Passed to the tab's component via `ngComponentOutletInputs` - `{ menu }` for a report opened by `open()`. */
  inputs: Record<string, unknown>;
  pinned: boolean;
}

/**
 * The id of the tab a report is running in, if any - inject it (it's optional) to reach
 * `TabService.setReportHandle` and put a refresh control in the shared status bar instead of a
 * report's own toolbar. Provided per tab by TabsComponent, not by the report itself.
 */
export const TAB_ID = new InjectionToken<number>('TAB_ID');

/** How a report's own refresh button reaches the shared status bar: its loading state, what to call, and when it last loaded. */
export interface ReportHandle {
  loading: () => boolean;
  refresh: () => void;
  lastUpdated: () => string;
  controls?: () => ReportControls;
}

@Injectable()
export class TabService {
  private nextTabId = 1;
  private isDestroyed = false;
  private openRequestId = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.isDestroyed = true;
      this.reportHandles.clear();
    });
  }

  readonly tabs = signal<Tab[]>([]);
  readonly activeTabId = signal<number | null>(null);
  readonly activeTab = computed(
    () => this.tabs().find((tab) => tab.id === this.activeTabId()) ?? null,
  );

  // A report registers its refresh handle under its own tab id (see Organization for how); this
  // map isn't a signal itself, so refreshVersion stands in for "something in it changed".
  private readonly reportHandles = new Map<number, ReportHandle>();
  private readonly reportRevision = signal(0);

  /** The open tab whose refresh should show in the status bar - the active tab's, if it has one. */
  readonly activeReportHandle = computed<ReportHandle | null>(() => {
    this.reportRevision();
    const tabId = this.activeTabId();
    return tabId === null ? null : (this.reportHandles.get(tabId) ?? null);
  });

  setReportHandle(tabId: number, refreshHandle: ReportHandle | null): void {
    if (refreshHandle) {
      this.reportHandles.set(tabId, refreshHandle);
    } else {
      this.reportHandles.delete(tabId);
    }
    this.reportRevision.update((revision) => revision + 1);
  }

  async open(menu: UserMenu): Promise<void> {
    const openRequestId = this.openRequestId;
    const component = await loadReport(menu);
    if (this.isDestroyed || openRequestId !== this.openRequestId) return;
    this.addTab(menu, component, { menu });
  }

  /**
   * Opens an arbitrary component as its own permanent tab, the way the company app's
   * `addReportInTab` opens a report from a grid row - used by report drilldowns (e.g. the
   * Organization report's bottom section) rather than the main menu's `open()`.
   */
  openComponent(menu: UserMenu, component: Type<unknown>, inputs: Record<string, unknown>): void {
    this.addTab(menu, component, inputs);
  }

  private addTab(menu: UserMenu, component: Type<unknown>, inputs: Record<string, unknown>): void {
    if (this.isDestroyed) return;
    const tab: Tab = { id: this.nextTabId++, menu, component, inputs, pinned: false };

    this.tabs.update((tabs) => {
      const pinnedTabCount = tabs.filter((existingTab) => existingTab.pinned).length;
      return [...tabs.slice(0, pinnedTabCount), tab, ...tabs.slice(pinnedTabCount)];
    });
    this.activeTabId.set(tab.id);
  }

  activate(tabId: number): void {
    if (this.indexOf(tabId) >= 0) this.activeTabId.set(tabId);
  }

  close(tabId: number): void {
    this.removeWhere((tab) => tab.id === tabId);
  }

  closeAll(): void {
    this.openRequestId++;
    this.removeWhere((tab) => !tab.pinned);
  }

  closeOthers(tabId: number): void {
    if (this.indexOf(tabId) < 0) return;
    this.removeWhere((tab) => tab.id !== tabId && !tab.pinned);
    this.activate(tabId);
  }

  closeLeftOf(tabId: number): void {
    const targetTabIndex = this.indexOf(tabId);
    if (targetTabIndex < 0) return;
    this.removeWhere((tab, tabIndex) => tabIndex < targetTabIndex && !tab.pinned);
    this.activate(tabId);
  }

  closeRightOf(tabId: number): void {
    const targetTabIndex = this.indexOf(tabId);
    if (targetTabIndex < 0) return;
    this.removeWhere((tab, tabIndex) => tabIndex > targetTabIndex && !tab.pinned);
    this.activate(tabId);
  }

  togglePin(tabId: number): void {
    this.tabs.update((tabs) => {
      const tab = tabs.find((candidate) => candidate.id === tabId);
      if (!tab) {
        return tabs;
      }

      const otherTabs = tabs.filter((candidate) => candidate.id !== tabId);
      const updatedTab = { ...tab, pinned: !tab.pinned };
      const insertAt = updatedTab.pinned
        ? 0
        : otherTabs.filter((otherTab) => otherTab.pinned).length;
      return [...otherTabs.slice(0, insertAt), updatedTab, ...otherTabs.slice(insertAt)];
    });
    this.activate(tabId);
  }

  canCloseLeftOf(tabId: number): boolean {
    const tabs = this.tabs();
    return tabs.length > 2 && tabs.slice(0, this.indexOf(tabId)).some((tab) => !tab.pinned);
  }

  canCloseRightOf(tabId: number): boolean {
    const tabs = this.tabs();
    return tabs.length > 2 && tabs.slice(this.indexOf(tabId) + 1).some((tab) => !tab.pinned);
  }

  private indexOf(tabId: number): number {
    return this.tabs().findIndex((tab) => tab.id === tabId);
  }

  private removeWhere(shouldRemove: (tab: Tab, index: number) => boolean): void {
    const existingTabs = this.tabs();
    const activeIndex = this.indexOf(this.activeTabId() ?? -1);
    const remainingTabs: Tab[] = [];

    for (const [tabIndex, tab] of existingTabs.entries()) {
      if (shouldRemove(tab, tabIndex)) {
        this.setReportHandle(tab.id, null);
      } else {
        remainingTabs.push(tab);
      }
    }

    this.tabs.set(remainingTabs);

    if (!remainingTabs.some((tab) => tab.id === this.activeTabId())) {
      const nextActiveTab =
        remainingTabs[Math.min(Math.max(activeIndex, 0), remainingTabs.length - 1)];
      this.activeTabId.set(nextActiveTab?.id ?? null);
    }
  }
}
