export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 0-based index of a three-letter month name, any case; -1 when it isn't one. */
export function monthIndex(name: string): number {
  return MONTHS.findIndex((month) => month.toLowerCase() === name.toLowerCase());
}

export function parseDate(text: unknown): Date | null {
  const value = String(text ?? '').trim();
  const iso = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(value);
  const named = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);

  if (iso) {
    return localDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  if (named) {
    const month = monthIndex(named[2]);
    return month < 0 ? null : localDate(Number(named[3]), month, Number(named[1]));
  }
  return null;
}

export function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) {
    return String(value ?? '');
  }
  return `${pad(date.getDate())}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function localDate(year: number, month: number, day: number): Date | null {
  if (year < 1) {
    return null;
  }
  const date = new Date(year, month, day);
  date.setFullYear(year);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
