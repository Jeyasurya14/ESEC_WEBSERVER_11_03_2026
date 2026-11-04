import { describe, expect, it } from 'vitest';
import { evaluateLicense } from './license';
import { encryptLicenseDate } from './license.testing';

describe('licence evaluation', () => {
  const today = new Date(2026, 5, 15, 14, 30); // 15 June 2026, mid-afternoon

  it('is valid when expiry is well in the future', () => {
    expect(evaluateLicense(encryptLicenseDate('2027-01-01'), today)).toEqual({ status: 'valid' });
  });

  it('warns when fewer than ten days remain, quoting the stored date', () => {
    expect(evaluateLicense(encryptLicenseDate('2026-06-20'), today)).toEqual({
      status: 'expiring',
      expiryText: '2026-06-20',
    });
  });

  it('is still valid, with a warning, on the day it expires', () => {
    expect(evaluateLicense(encryptLicenseDate('2026-06-15'), today).status).toBe('expiring');
  });

  it('is valid with exactly ten days remaining', () => {
    expect(evaluateLicense(encryptLicenseDate('2026-06-25'), today).status).toBe('valid');
  });

  it('is expired the day after expiry', () => {
    expect(evaluateLicense(encryptLicenseDate('2026-06-14'), today).status).toBe('expired');
  });

  it('accepts slash-separated dates', () => {
    expect(evaluateLicense(encryptLicenseDate('2027/01/01'), today).status).toBe('valid');
  });

  it('rejects missing, garbled and impossible licences', () => {
    expect(evaluateLicense(undefined, today).status).toBe('invalid');
    expect(evaluateLicense('', today).status).toBe('invalid');
    expect(evaluateLicense('not-encrypted', today).status).toBe('invalid');
    expect(evaluateLicense(encryptLicenseDate('2026-02-30'), today).status).toBe('invalid');
    expect(evaluateLicense(encryptLicenseDate('next year'), today).status).toBe('invalid');
  });
});
