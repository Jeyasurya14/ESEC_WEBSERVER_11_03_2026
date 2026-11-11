import { TestBed } from '@angular/core/testing';
import * as CryptoJS from 'crypto-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserStorage, StorageKey } from './browser-storage.service';

describe('browser storage', () => {
  let storage: BrowserStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = TestBed.inject(BrowserStorage);
  });

  afterEach(() => vi.restoreAllMocks());

  it('stores values under the company app key names', () => {
    storage.set(StorageKey.licenseHoursPerDay, 9.5);
    expect(localStorage.getItem('SP_REPORT_LHPD')).toBe('9.5');
    expect(storage.get(StorageKey.licenseHoursPerDay)).toBe('9.5');
  });

  it('hides the signed-in user the same way the company app does, so either app can read it', () => {
    storage.setHidden(StorageKey.userId, 'john');

    const stored = localStorage.getItem('loggedInUsername')!;
    expect(stored).not.toContain('john');
    expect(JSON.parse(CryptoJS.AES.decrypt(stored, 'pass$1234').toString(CryptoJS.enc.Utf8))).toBe('john');

    localStorage.setItem('loggedInType', CryptoJS.AES.encrypt(JSON.stringify('ADMIN'), 'pass$1234').toString());
    expect(storage.getHidden(StorageKey.loginType)).toBe('ADMIN');
  });

  it('treats a tampered or plain value as absent', () => {
    localStorage.setItem('loggedInUsername', 'john');
    expect(storage.getHidden(StorageKey.userId)).toBeNull();
  });

  it('forgets everything on sign-out except the app version', () => {
    storage.set(StorageKey.version, 'v1');
    storage.set(StorageKey.featureGroups, 'CATIA');
    storage.setHidden(StorageKey.userId, 'john');
    localStorage.setItem('someone-elses-key', 'kept');

    storage.clearOnSignOut();

    expect(storage.get(StorageKey.version)).toBe('v1');
    expect(storage.get(StorageKey.featureGroups)).toBeNull();
    expect(storage.get(StorageKey.userId)).toBeNull();
    expect(localStorage.getItem('someone-elses-key')).toBe('kept');
  });

  it('keeps the app working when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => storage.set(StorageKey.today, '01-Jan-2026')).not.toThrow();
    expect(storage.get(StorageKey.today)).toBeNull();
  });
});
