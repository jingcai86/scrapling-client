/**
 * Calculates the timezone offset in minutes from UTC for a given timezone or browser default.
 * Positive values indicate timezones ahead of UTC (e.g. UTC+2 = +120).
 * Negative values indicate timezones behind UTC (e.g. America/Los_Angeles PDT = -420).
 */
export function getTimezoneOffsetMinutes(
  timeZone?: string,
  date: Date = new Date(),
): number {
  const tz = timeZone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
  } catch {
    // Fallback to browser offset
    return -date.getTimezoneOffset();
  }
}

/**
 * Converts a UTC "HH:MM" 24-hour string into a local "HH:MM" 24-hour string.
 * e.g. "02:00" UTC -> "19:00" in America/Los_Angeles (PDT)
 */
export function formatUtcBaseTimeToLocal(
  utcBaseTime: string,
  timeZone?: string,
): string {
  if (!utcBaseTime || !utcBaseTime.includes(':')) {
    return utcBaseTime || '19:00';
  }
  const [hStr, mStr] = utcBaseTime.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (isNaN(hours) || isNaN(minutes)) {
    return utcBaseTime;
  }

  const offset = getTimezoneOffsetMinutes(timeZone);
  const totalUtcMinutes = hours * 60 + minutes;
  let totalLocalMinutes = (totalUtcMinutes + offset) % 1440;
  if (totalLocalMinutes < 0) totalLocalMinutes += 1440;

  const localH = String(Math.floor(totalLocalMinutes / 60)).padStart(2, '0');
  const localM = String(totalLocalMinutes % 60).padStart(2, '0');
  return `${localH}:${localM}`;
}

/**
 * Converts a local "HH:MM" 24-hour string into a UTC "HH:MM" 24-hour string for backend persistence.
 * e.g. "19:00" in America/Los_Angeles (PDT) -> "02:00" UTC
 */
export function formatLocalBaseTimeToUtc(
  localBaseTime: string,
  timeZone?: string,
): string {
  if (!localBaseTime || !localBaseTime.includes(':')) {
    return '02:00';
  }
  const [hStr, mStr] = localBaseTime.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (isNaN(hours) || isNaN(minutes)) {
    return '02:00';
  }

  const offset = getTimezoneOffsetMinutes(timeZone);
  const totalLocalMinutes = hours * 60 + minutes;
  let totalUtcMinutes = (totalLocalMinutes - offset) % 1440;
  if (totalUtcMinutes < 0) totalUtcMinutes += 1440;

  const utcH = String(Math.floor(totalUtcMinutes / 60)).padStart(2, '0');
  const utcM = String(totalUtcMinutes % 60).padStart(2, '0');
  return `${utcH}:${utcM}`;
}

export const DEFAULT_SCHEDULER_ID = 'c1000000-0000-4000-8000-000000000001';

export function isDefaultScheduleId(id?: string | null): boolean {
  if (!id) return true;
  const trimmed = id.trim().toLowerCase();
  return (
    trimmed === '' ||
    trimmed === 'default' ||
    trimmed === '00000000-0000-0000-0000-000000000000' ||
    trimmed === DEFAULT_SCHEDULER_ID
  );
}

export function areSameScheduleIds(a?: string | null, b?: string | null): boolean {
  if (isDefaultScheduleId(a) && isDefaultScheduleId(b)) return true;
  return (a || '').trim() === (b || '').trim();
}

export function resolveScheduleSelectValue(
  scheduleId: string | undefined | null,
  schedulers: Array<{ id?: string; isDefault?: boolean }>,
): string {
  if (isDefaultScheduleId(scheduleId)) {
    const def = schedulers.find((s) => s.isDefault || isDefaultScheduleId(s.id));
    return def?.id || DEFAULT_SCHEDULER_ID;
  }
  const exact = schedulers.find((s) => s.id === scheduleId);
  if (exact?.id) return exact.id;
  const def = schedulers.find((s) => s.isDefault || isDefaultScheduleId(s.id));
  return def?.id || scheduleId || DEFAULT_SCHEDULER_ID;
}


