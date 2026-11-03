import * as CryptoJS from 'crypto-js';

/** Test-only: produces the stored form of a licence date (the app itself only reads licences). */
export function encryptLicenseDate(date: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(date), 'pass$1234').toString();
}
