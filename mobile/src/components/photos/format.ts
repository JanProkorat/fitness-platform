/** "October 2026" for a "2026-10" key, in the active language; the raw key when it cannot be read. */
export function monthLabel(language: string, yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month) return yearMonth;
  const label = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  return label.charAt(0).toLocaleUpperCase(language) + label.slice(1);
}

/** Long date such as "3 October 2026"; an empty string when the date is missing or invalid. */
export function photoDateLabel(language: string, iso: string | undefined): string {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) return '';
  return new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(time));
}
