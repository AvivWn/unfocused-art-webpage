const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type ArtworkDateInput = {
  year?: number | string;
  month?: number;
};

export function formatArtworkDate(artwork: ArtworkDateInput): string {
  const { year, month } = artwork;

  if (year == null || (typeof year === 'string' && year.trim() === '')) {
    return '';
  }

  if (typeof year === 'string') {
    const n = Number(year);
    if (!Number.isFinite(n) || String(n) !== year.trim()) {
      return year;
    }
    return formatYearAndOptionalMonth(n, month);
  }

  return formatYearAndOptionalMonth(year, month);
}

function formatYearAndOptionalMonth(year: number, month: number | undefined): string {
  if (month == null || !Number.isInteger(month) || month < 1 || month > 12) {
    return String(year);
  }
  return `${MONTHS[month - 1]} ${year}`;
}
