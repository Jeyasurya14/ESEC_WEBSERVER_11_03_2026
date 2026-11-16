import { literal } from '../utils/data';
import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

export const StorageKey = literal({
  userId: 'loggedInUsername',
  adUserName: 'ADLoggedInUsername',
  loginType: 'loggedInType',

  licenseHoursPerDay: 'SP_REPORT_LHPD',
  longDuration: 'SP_REPORT_LONGDURATION',
  percentile: 'SP_REPORT_PERCENTILE',
  defaultPercentile: 'PERCENTILE',
  cpuHoursPerDay: 'SP_REPORT_CPU_HOURS_PER_DAY',
  reportStartTime: 'SP_REPORT_STIME',
  reportEndTime: 'SP_REPORT_ETIME',
  reportRange: 'SP_REPORT_RANGE_SUB',
  reportStartDate: 'SP_REPORT_SDATE',
  reportEndDate: 'SP_REPORT_EDATE',

  bandLowBelow: 'LS_CBAND_1_VALUE',
  bandHighFrom: 'LS_CBAND_2_VALUE',
  bandLowColor: 'CBAND_1_COLOR',
  bandMediumColor: 'CBAND_2_COLOR',
  bandHighColor: 'CBAND_3_COLOR',
  workingHoursPerDay: 'LICENSE_WORKING_HOURS_PER_DAY',
  workingHourStart: 'WORKING_HOUR_START_TIME',
  workingHourEnd: 'WORKING_HOUR_END_TIME',
  featureGroups: 'MY_FEATURE_GROUP',
  today: 'TODAY_DATE',
  version: 'ESEC_VERSION',
});

export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey];

const OBFUSCATION_KEY = 'pass$1234';

const KEPT_ON_SIGN_OUT: ReadonlySet<StorageKey> = new Set([StorageKey.version]);

@Injectable({ providedIn: 'root' })
export class BrowserStorage {
  get(storageKey: StorageKey): string | null {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  set(storageKey: StorageKey, value: string | number): void {
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      // Storage unavailable: nothing is remembered.
    }
  }

  remove(storageKey: StorageKey): void {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Storage unavailable: nothing to remove.
    }
  }

  setHidden(storageKey: StorageKey, value: string): void {
    this.set(storageKey, CryptoJS.AES.encrypt(JSON.stringify(value), OBFUSCATION_KEY).toString());
  }

  getHidden(storageKey: StorageKey): string | null {
    const encryptedValue = this.get(storageKey);
    if (!encryptedValue) {
      return null;
    }
    try {
      const decodedValue: unknown = JSON.parse(
        CryptoJS.AES.decrypt(encryptedValue, OBFUSCATION_KEY).toString(CryptoJS.enc.Utf8),
      );
      return typeof decodedValue === 'string' && decodedValue !== '' ? decodedValue : null;
    } catch {
      return null;
    }
  }

  clearOnSignOut(): void {
    for (const storageKey of Object.values(StorageKey)) {
      if (!KEPT_ON_SIGN_OUT.has(storageKey)) {
        this.remove(storageKey);
      }
    }
  }
}
