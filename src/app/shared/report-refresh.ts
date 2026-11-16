import { DestroyRef, inject } from '@angular/core';
import { ReportHandle, TAB_ID, TabService } from '../features/tabs/tab.service';
import { ReportControls } from './status-bar/report-controls';

/** Connect one report instance to the workspace refresh control; clean up with its view. */
export function registerReportRefresh(
  reportData: Pick<ReportHandle, 'loading' | 'lastUpdated'>,
  refresh: () => void,
  controls?: () => ReportControls,
): void {
  const tabId = inject(TAB_ID, { optional: true });
  if (tabId === null) return;
  const tabs = inject(TabService);
  tabs.setReportHandle(tabId, {
    loading: () => reportData.loading(),
    refresh,
    lastUpdated: () => reportData.lastUpdated(),
    ...(controls ? { controls } : {}),
  });
  inject(DestroyRef).onDestroy(() => tabs.setReportHandle(tabId, null));
}
