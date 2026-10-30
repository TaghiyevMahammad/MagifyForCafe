import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('az-AZ', {
    style: 'currency',
    currency: 'AZN',
  }).format(amount);
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getBakuDateString(date: Date = new Date()) {
  // bakuOffset is +4. To get Baku time, we add 4 hours to the UTC time.
  const bakuDate = new Date(date.getTime() + (4 * 60 * 60 * 1000));
  return bakuDate.toISOString().split('T')[0];
}

export function getBakuFullISOString(date: string | number | Date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const bakuDate = new Date(d.getTime() + (4 * 60 * 60 * 1000));
  return bakuDate.toISOString().replace('Z', '');
}

/**
 * Converts a Baku local time string (e.g. "2026-04-20 11:00") to a UTC string (e.g. "2026-04-20 07:00")
 * for backend queries.
 */
export function convertBakuToUTC(dateStr: string, timeStr: string) {
  if (!dateStr || !timeStr) return '';
  // Combine into an ISO-like string and explicitly treat as Baku time (+04:00)
  const d = new Date(`${dateStr}T${timeStr}:00+04:00`);
  if (isNaN(d.getTime())) return '';
  
  // toISOString() always returns UTC
  return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

export function applyHiddenOffset(date: Date | string | number, hours: number = -4) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return d;
  d.setHours(d.getHours() + hours);
  return d;
}

export function formatDateTime(date: string | number | Date) {
  if (!date) return '-';
  
  let d: Date;
  if (typeof date === 'string') {
    if (date.includes(' ') && !date.includes('T')) {
      d = new Date(date.replace(' ', 'T') + 'Z');
    } else if (!date.endsWith('Z') && !date.includes('+') && !date.includes('T')) {
      d = new Date(date + 'Z');
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return '-';

  // Manually add 4 hours for Baku display
  const bakuDate = new Date(d.getTime() + (4 * 60 * 60 * 1000));
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(bakuDate.getUTCDate());
  const month = pad(bakuDate.getUTCMonth() + 1);
  const year = bakuDate.getUTCFullYear();
  const hours = pad(bakuDate.getUTCHours());
  const minutes = pad(bakuDate.getUTCMinutes());
  const seconds = pad(bakuDate.getUTCSeconds());

  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Calculates the current business day date (YYYY-MM-DD) in Baku time (+04:00).
 * A business day runs from 09:00 of day X to 09:00 of day X+1.
 * If current Baku time is before 09:00, the shift belongs to yesterday.
 */
export function getBakuBusinessDayDate(date: Date = new Date()): string {
  // Convert to Baku local time representation (+4 hours)
  const bakuDate = new Date(date.getTime() + (4 * 60 * 60 * 1000));
  const hours = bakuDate.getUTCHours();

  // If before 09:00 in Baku, it belongs to the previous business day
  if (hours < 9) {
    bakuDate.setUTCDate(bakuDate.getUTCDate() - 1);
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = bakuDate.getUTCFullYear();
  const month = pad(bakuDate.getUTCMonth() + 1);
  const day = pad(bakuDate.getUTCDate());
  return `${year}-${month}-${day}`;
}

/**
 * Adds or subtracts days from a YYYY-MM-DD date string.
 */
export function shiftBusinessDay(dateStr: string, offsetDays: number): string {
  if (!dateStr) return getBakuBusinessDayDate();
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + offsetDays);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  return `${year}-${month}-${day}`;
}

/**
 * Returns the full business day shift range info (start date 09:00 -> next day 09:00)
 */
export function getBusinessDayRange(dateStr: string) {
  if (!dateStr) dateStr = getBakuBusinessDayDate();
  const nextDateStr = shiftBusinessDay(dateStr, 1);
  return {
    startDate: dateStr,
    startTime: '09:00',
    endDate: nextDateStr,
    endTime: '09:00',
  };
}
