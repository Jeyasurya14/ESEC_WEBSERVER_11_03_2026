export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function monthIndex(monthName: string): number {
  return MONTHS.findIndex((month) => month.toLowerCase() === monthName.toLowerCase());
}

export function parseDate(input: unknown): Date | null {
  const dateText = asText(input).trim();
  const isoParts = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(dateText);
  const namedParts = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(dateText);

  if (isoParts) {
    return localDate(Number(isoParts[1]), Number(isoParts[2]) - 1, Number(isoParts[3]));
  }
  if (namedParts) {
    const month = monthIndex(namedParts[2]);
    return month < 0 ? null : localDate(Number(namedParts[3]), month, Number(namedParts[1]));
  }
  return null;
}

export function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) {
    return asText(value);
  }
  return `${pad(date.getDate())}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
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
