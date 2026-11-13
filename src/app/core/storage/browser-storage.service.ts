import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

export const StorageKey = {
  userId: 'loggedInUsername',
  adUserName: 'ADLoggedInUsername',
  loginType: 'loggedInType',

  licenseHoursPerDay: 'SP_REPORT_LHPD',
  longDuration: 'SP_REPORT_LONGDURATION',
  percentile: 'SP_REPORT_PERCENTILE',
  defaultPercentile: 'PERCENTILE',

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
} as const;

export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey];

const OBFUSCATION_KEY = 'pass$1234';

const KEPT_ON_SIGN_OUT: ReadonlySet<StorageKey> = new Set([StorageKey.version]);

@Injectable({ providedIn: 'root' })
export class BrowserStorage {
  get(key: StorageKey): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: StorageKey, value: string | number): void {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Storage unavailable: nothing is remembered.
    }
  }

  remove(key: StorageKey): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage unavailable: nothing to remove.
    }
  }

  setHidden(key: StorageKey, value: string): void {
    this.set(key, CryptoJS.AES.encrypt(JSON.stringify(value), OBFUSCATION_KEY).toString());
  }

  getHidden(key: StorageKey): string | null {
    const stored = this.get(key);
    if (!stored) {
      return null;
    }
    try {
      const decodedValue: unknown = JSON.parse(
        CryptoJS.AES.decrypt(stored, OBFUSCATION_KEY).toString(CryptoJS.enc.Utf8),
      );
      return typeof decodedValue === 'string' && decodedValue !== '' ? decodedValue : null;
    } catch {
      return null; // unreadable or tampered with: treat as absent
    }
  }

  clearOnSignOut(): void {
    for (const key of Object.values(StorageKey)) {
      if (!KEPT_ON_SIGN_OUT.has(key)) {
        this.remove(key);
      }
    }
  }
}
