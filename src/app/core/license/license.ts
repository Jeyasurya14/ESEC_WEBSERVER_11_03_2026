import * as CryptoJS from 'crypto-js';

const LICENSE_KEY = 'pass$1234';

export const RENEWAL_WARNING_DAYS = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type LicenseVerdict =
  | { status: 'valid' }
  | { status: 'expiring'; expiryText: string }
  | { status: 'expired' }
  | { status: 'invalid' };

export function evaluateLicense(encryptedValue: string | undefined, today: Date): LicenseVerdict {
  if (!encryptedValue) {
    return { status: 'invalid' };
  }

  const expiryText = decryptLicenseDate(encryptedValue);
  const expiryDate = parseLicenseDate(expiryText);

  if (!expiryDate) {
    return { status: 'invalid' };
  }

  const daysRemaining = (expiryDate.getTime() - startOfDay(today).getTime()) / MS_PER_DAY; 

  if (daysRemaining < 0) {
    return { status: 'expired' };
  }
  if (daysRemaining < RENEWAL_WARNING_DAYS) {
    return { status: 'expiring', expiryText };
  }
  return { status: 'valid' };
}

function decryptLicenseDate(encryptedValue: string): string {
  try {
    const plainText = CryptoJS.AES.decrypt(encryptedValue, LICENSE_KEY).toString(CryptoJS.enc.Utf8);
    const decryptedValue: unknown = JSON.parse(plainText);
    return typeof decryptedValue === 'string' ? decryptedValue : '';
  } catch {
    return '';
  }
}

function parseLicenseDate(dateText: string): Date | null {
  if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(dateText)) {
    return null;
  }

  const [year, month, day] = dateText.split(/[-/]/).map(Number);
  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isRealDate ? date : null;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
