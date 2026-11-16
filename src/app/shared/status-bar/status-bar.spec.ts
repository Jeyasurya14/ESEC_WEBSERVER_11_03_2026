import { instance } from '../../../testing/instances';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserPreferencesService } from '../../core/preferences/user-preferences.service';
import { BrowserStorage, StorageKey } from '../../core/storage/browser-storage.service';
import { TabService } from '../../features/tabs/tab.service';
import {
  ReportControls,
  datePreset,
  reportDates,
  reportParameter,
  reportTimes,
  restoreReportDefaults,
} from './report-controls';
import { StatusBar } from './status-bar';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class ReportStub {}

describe('Shared report status bar', () => {
  let tabs: TabService;
  let controls: ReportControls;
  const dates = signal({ start: '2026-11-01', end: '2026-11-15' });
  const times = signal({ startTime: '10:00', endTime: '17:00' });
  const parameters = signal({ usageHours: 7, percentile: 95 });
  const loading = signal(false);
  let save: ReturnType<typeof vi.fn>;
  let refresh = vi.fn<() => void>();

  beforeEach(() => {
    localStorage.clear();
    dates.set({ start: '2026-11-01', end: '2026-11-15' });
    times.set({ startTime: '10:00', endTime: '17:00' });
    parameters.set({ usageHours: 7, percentile: 95 });
    loading.set(false);
    save = vi.fn().mockResolvedValue(undefined);
    refresh = vi.fn<() => void>();
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value() {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value() {
          this.open = false;
          this.dispatchEvent(new Event('close'));
        },
      },
    });
    TestBed.configureTestingModule({
      providers: [TabService, { provide: UserPreferencesService, useValue: { save } }],
    });
    tabs = TestBed.inject(TabService);
    tabs.openComponent({ mainMenuName: 'LICENSE', subMenuName: 'Test' }, ReportStub, {});
    controls = {
      dates: { value: dates, set: (value) => dates.set(value) },
      times: { value: times, set: (value) => times.set(value) },
      parameters: {
        value: parameters,
        set: (value) =>
          parameters.set({ usageHours: value.usageHours!, percentile: value.percentile! }),
      },
    };
    tabs.setReportHandle(tabs.activeTabId()!, {
      loading,
      lastUpdated: () => '15-Nov-2026 10:00',
      refresh,
      controls: () => controls,
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(StatusBar);
    fixture.componentRef.setInput('userId', 'john');
    await fixture.whenStable();
    return fixture;
  }
  function click(element: HTMLElement, text: string) {
    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim().startsWith(text))!
      .click();
  }
  function change(element: HTMLElement, label: string, value: string) {
    const input = [...element.querySelectorAll('label')]
      .find((node) => node.textContent?.trim().startsWith(label))!
      .querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event(input.type === 'number' ? 'input' : 'change', { bubbles: true }));
  }
  function apply(element: HTMLElement) {
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }

  it('shows active-report controls and refresh state, and clears controls on tab closure', async () => {
    const fixture = await render();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('10:00 – 17:00');
    expect(element.querySelector('.status-user')?.textContent).toBe('john');
    instance(element.querySelector('.refresh-button'), HTMLButtonElement).click();
    expect(refresh).toHaveBeenCalledOnce();
    loading.set(true);
    await fixture.whenStable();
    expect(instance(element.querySelector('.refresh-button'), HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(element.querySelector('output')?.textContent).toContain('Loading');
    tabs.close(tabs.activeTabId()!);
    await fixture.whenStable();
    expect(element.querySelector('.status-action')).toBeNull();
    expect(element.textContent).toContain('License Monitoring System');
  });

  it('validates time edits, applies them together and saves the company preference keys', async () => {
    const fixture = await render();
    const element: HTMLElement = fixture.nativeElement;
    click(element, 'Time');
    await fixture.whenStable();
    expect(element.querySelector('dialog')!.open).toBe(true);
    change(element, 'End time', '09:00');
    apply(element);
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('later');
    expect(times().endTime).toBe('17:00');
    expect(save).not.toHaveBeenCalled();
    change(element, 'End time', '18:00');
    apply(element);
    await fixture.whenStable();
    expect(times()).toEqual({ startTime: '10:00', endTime: '18:00' });
    expect(save).toHaveBeenCalledWith({ range_sub_stime: '10:00', range_sub_etime: '18:00' });
    expect(localStorage.getItem(StorageKey.reportEndTime)).toBe('18:00');
    expect(element.querySelector('dialog')!.open).toBe(false);
  });

  it('keeps parameter drafts local until Apply and rejects invalid limits', async () => {
    const fixture = await render();
    const element: HTMLElement = fixture.nativeElement;
    click(element, 'Parameters');
    await fixture.whenStable();
    change(element, 'Usage Per Day', '25');
    apply(element);
    await fixture.whenStable();
    expect(parameters().usageHours).toBe(7);
    expect(save).not.toHaveBeenCalled();
    change(element, 'Usage Per Day', '7.5');
    change(element, 'Percentile', '90');
    expect(parameters().percentile).toBe(95);
    apply(element);
    await fixture.whenStable();
    expect(parameters()).toEqual({ usageHours: 7.5, percentile: 90 });
    expect(save).toHaveBeenCalledWith({ parameters_lhpd: '7.5', parameters_percentile: '90' });
  });

  it('applies a complete date range and cancels pending edits when the active tab changes', async () => {
    const fixture = await render();
    const element: HTMLElement = fixture.nativeElement;
    click(element, 'Range');
    await fixture.whenStable();
    change(element, 'From', '2026-11-05');
    change(element, 'To', '2026-11-10');
    apply(element);
    await fixture.whenStable();
    expect(dates()).toEqual({ start: '2026-11-05', end: '2026-11-10' });
    expect(save).toHaveBeenCalledWith({
      range_sub: 'daterange',
      range_sub_sdate: '2026-11-05',
      range_sub_edate: '2026-11-10',
    });
    click(element, 'Parameters');
    await fixture.whenStable();
    change(element, 'Percentile', '80');
    tabs.openComponent({ mainMenuName: 'LICENSE', subMenuName: 'Other' }, ReportStub, {});
    await fixture.whenStable();
    expect(element.querySelector('dialog')!.open).toBe(false);
    expect(parameters().percentile).toBe(95);
    expect(save).toHaveBeenCalledOnce();
  });
});

describe('Company report defaults', () => {
  it('ignores corrupt stored times instead of blocking report queries', () => {
    localStorage.clear();
    const storage = new BrowserStorage();
    storage.set(StorageKey.reportStartTime, 'bad');
    storage.set(StorageKey.reportEndTime, '7');
    storage.set(StorageKey.workingHourStart, '10:00:00');
    storage.set(StorageKey.workingHourEnd, '17:00:00');
    expect(reportTimes(storage)).toEqual({ startTime: '10:00', endTime: '17:00' });
  });
  it('restores valid legacy preferences and ignores corrupt parameter values', () => {
    localStorage.clear();
    const storage = new BrowserStorage();
    restoreReportDefaults(storage, {
      parameters_lhpd: '7.5',
      parameters_percentile: '101',
      parameters_long_duration: '12',
      range_sub: 'daterange',
      range_sub_sdate: '01-Nov-2026',
      range_sub_edate: '15-Nov-2026',
      range_sub_stime: '10:00',
      range_sub_etime: '17:00',
    });
    expect(reportParameter(storage, 'usageHours', 24)).toBe(7.5);
    expect(reportParameter(storage, 'percentile', 95)).toBe(95);
    expect(reportParameter(storage, 'longDuration', 24)).toBe(12);
    expect(reportDates(storage, { start: '', end: '' })).toEqual({
      start: '2026-11-01',
      end: '2026-11-15',
    });
    expect(storage.get(StorageKey.reportStartTime)).toBe('10:00');
  });
  it('resolves rolling presets using local calendar dates', () => {
    const today = new Date(2026, 10, 15);
    expect(datePreset('7', today)).toEqual({ start: '2026-11-09', end: '2026-11-15' });
    expect(datePreset('YTD', today)).toEqual({ start: '2026-01-01', end: '2026-11-15' });
    expect(datePreset('week', today)).toEqual({ start: '2026-11-15', end: '2026-11-15' });
  });
});
