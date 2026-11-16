import { inputValue } from '../input-value';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  UserPreferencesService,
  StoredPreferences,
} from '../../core/preferences/user-preferences.service';
import { BrowserStorage, StorageKey } from '../../core/storage/browser-storage.service';
import { TabService } from '../../features/tabs/tab.service';
import { formatDate } from '../dates';
import { RangeFilter } from '../filters/range-filter';
import { assertNever, hasKey } from '../../core/utils/data';
import { RefreshButton } from '../refresh-button/refresh-button';
import {
  REPORT_PARAMETERS,
  ReportDates,
  ReportParameterKey,
  ReportParameters,
  ReportTimes,
  datePreset,
  validParameter,
  validReportDates,
  validReportTimes,
} from './report-controls';

@Component({
  selector: 'app-status-bar',
  imports: [RangeFilter, RefreshButton],
  templateUrl: './status-bar.html',
  styleUrl: './status-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBar {
  protected readonly inputValue = inputValue;

  readonly userId = input('');
  private readonly tabs = inject(TabService);
  private readonly injector = inject(Injector);
  private readonly storage = inject(BrowserStorage);
  private readonly dialogElement = viewChild<ElementRef<HTMLDialogElement>>('editorDialog');
  protected readonly activeReport = this.tabs.activeReportHandle;
  protected readonly reportControls = computed(() => this.activeReport()?.controls?.() ?? {});
  protected readonly editorType = signal<'dates' | 'times' | 'parameters' | null>(null);
  protected readonly draftDates = signal<ReportDates>({ start: '', end: '' });
  protected readonly draftTimes = signal<ReportTimes>({ startTime: '', endTime: '' });
  protected readonly draftParameters = signal<ReportParameters>({});
  protected readonly validationError = signal('');
  protected readonly selectedPreset = signal('');
  protected readonly parameterKeys = computed(() =>
    Object.keys(REPORT_PARAMETERS).filter(
      (key): key is ReportParameterKey =>
        hasKey(REPORT_PARAMETERS, key) && this.draftParameters()[key] !== undefined,
    ),
  );
  protected readonly parameterRules = REPORT_PARAMETERS;
  protected readonly formatDate = formatDate;
  private editingTabId: number | null = null;

  constructor() {
    effect(() => {
      const activeId = this.tabs.activeTabId();
      if (this.editorType() && activeId !== this.editingTabId) this.closeDialog();
    });
  }

  protected openDialog(editorType: 'dates' | 'times' | 'parameters'): void {
    this.editingTabId = this.tabs.activeTabId();
    this.draftDates.set(this.reportControls().dates?.value() ?? { start: '', end: '' });
    this.draftTimes.set(this.reportControls().times?.value() ?? { startTime: '', endTime: '' });
    this.draftParameters.set({ ...this.reportControls().parameters?.value() });
    this.validationError.set('');
    this.selectedPreset.set('');
    this.editorType.set(editorType);
    afterNextRender(
      () => {
        const dialog = this.dialogElement()?.nativeElement;
        if (this.editorType() === editorType && dialog && !dialog.open) dialog.showModal();
      },
      { injector: this.injector },
    );
  }

  protected closeDialog(): void {
    this.dialogElement()?.nativeElement.close();
    this.editorType.set(null);
  }

  protected preset(value: string): void {
    this.selectedPreset.set(value);
    if (value) this.draftDates.set(datePreset(value));
  }
  protected changeDate(fieldName: keyof ReportDates, value: string): void {
    this.selectedPreset.set('');
    this.draftDates.update((draftValues) => ({ ...draftValues, [fieldName]: value }));
  }
  protected changeTime(fieldName: keyof ReportTimes, value: string): void {
    this.draftTimes.update((draftValues) => ({ ...draftValues, [fieldName]: value }));
  }
  protected changeParameter(fieldName: ReportParameterKey, value: string): void {
    this.draftParameters.update((draftValues) => ({
      ...draftValues,
      [fieldName]: value.trim() ? Number(value) : NaN,
    }));
  }

  protected apply(): void {
    if (this.tabs.activeTabId() !== this.editingTabId) {
      this.closeDialog();
      return;
    }
    const controls = this.reportControls();
    const preferenceChanges: StoredPreferences = {};
    const editor = this.editorType();
    if (editor === null) return;
    switch (editor) {
      case 'dates': {
        const value = this.draftDates();
        if (!validReportDates(value)) {
          this.validationError.set('Choose valid dates with From on or before To.');
          return;
        }
        controls.dates?.set(value);
        this.storage.set(StorageKey.reportRange, this.selectedPreset() || 'daterange');
        this.storage.set(StorageKey.reportStartDate, value.start);
        this.storage.set(StorageKey.reportEndDate, value.end);
        Object.assign(preferenceChanges, {
          range_sub: this.selectedPreset() || 'daterange',
          range_sub_sdate: value.start,
          range_sub_edate: value.end,
        });
        break;
      }
      case 'times': {
        const value = this.draftTimes();
        if (!validReportTimes(value)) {
          this.validationError.set('End time must be later than start time.');
          return;
        }
        controls.times?.set(value);
        this.storage.set(StorageKey.reportStartTime, value.startTime);
        this.storage.set(StorageKey.reportEndTime, value.endTime);
        Object.assign(preferenceChanges, {
          range_sub_stime: value.startTime,
          range_sub_etime: value.endTime,
        });
        break;
      }
      case 'parameters': {
        const parameterValues = this.draftParameters();
        if (
          this.parameterKeys().some(
            (fieldName) => !validParameter(fieldName, parameterValues[fieldName]!),
          )
        ) {
          this.validationError.set('Enter a valid value within each field’s limits.');
          return;
        }
        controls.parameters?.set(parameterValues);
        for (const fieldName of this.parameterKeys()) {
          const parameterRule = REPORT_PARAMETERS[fieldName];
          this.storage.set(parameterRule.storage, parameterValues[fieldName]!);
          preferenceChanges[parameterRule.preference] = String(parameterValues[fieldName]);
        }
        break;
      }
      default:
        return assertNever(editor);
    }
    void this.injector.get(UserPreferencesService).save(preferenceChanges);
    this.closeDialog();
  }
}
