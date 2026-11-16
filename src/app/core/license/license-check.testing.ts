import * as CryptoJS from 'crypto-js';

export function encryptLicenseDate(date: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(date), 'pass$1234').toString();
}
