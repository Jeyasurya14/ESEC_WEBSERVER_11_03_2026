import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

/**
 * Every value the app keeps in the browser's localStorage. The names (and the obfuscation of the
 * signed-in user) match the company app's, so both apps read each other's values on the same site.
 */
export const StorageKey = {
  // The signed-in user, so a page reload keeps the session. Never the password.
  userId: 'loggedInUsername',
  adUserName: 'ADLoggedInUsername',
  loginType: 'loggedInType',

  // Report parameters: reset to the defaults once per session, then reports read them.
  licenseHoursPerDay: 'SP_REPORT_LHPD',
  longDuration: 'SP_REPORT_LONGDURATION',
  percentile: 'SP_REPORT_PERCENTILE',
  defaultPercentile: 'PERCENTILE',

  // Copies of settings, written when they load.
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

/**
 * The company app's AES key. It ships inside the app, so this hides values from a casual glance
 * only; it is not protection. That is why a password is never stored.
 */
const OBFUSCATION_KEY = 'pass$1234';

/** Kept when the user signs out, as in the company app. */
const KEPT_ON_SIGN_OUT: readonly StorageKey[] = [StorageKey.version];

/**
 * localStorage, made safe: if the browser blocks storage (private mode, full disk, policy) the app
 * keeps working, just without remembering.
 */
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

  /** For the signed-in user's details: stored obfuscated, in the company app's format. */
  setHidden(key: StorageKey, value: string): void {
    this.set(key, CryptoJS.AES.encrypt(JSON.stringify(value), OBFUSCATION_KEY).toString());
  }

  getHidden(key: StorageKey): string | null {
    const stored = this.get(key);
    if (!stored) {
      return null;
    }
    try {
      const value: unknown = JSON.parse(CryptoJS.AES.decrypt(stored, OBFUSCATION_KEY).toString(CryptoJS.enc.Utf8));
      return typeof value === 'string' && value !== '' ? value : null;
    } catch {
      return null; // unreadable or tampered with: treat as absent
    }
  }

  /** Forgets everything this app stored, except what survives a sign-out. */
  clearOnSignOut(): void {
    for (const key of Object.values(StorageKey)) {
      if (!KEPT_ON_SIGN_OUT.includes(key)) {
        this.remove(key);
      }
    }
  }
}
