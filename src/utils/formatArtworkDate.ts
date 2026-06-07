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

export type ArtworkDateParts = {
  year: string;
  month: string | null;
};

export function getArtworkDateParts(artwork: ArtworkDateInput): ArtworkDateParts | null {
  const { year, month } = artwork;

  if (year == null || (typeof year === 'string' && year.trim() === '')) {
    return null;
  }

  if (typeof year === 'string') {
    const n = Number(year);
    if (!Number.isFinite(n) || String(n) !== year.trim()) {
      return { year, month: null };
    }
    return splitYearAndOptionalMonth(n, month);
  }

  return splitYearAndOptionalMonth(year, month);
}

export function formatArtworkDate(artwork: ArtworkDateInput): string {
  const parts = getArtworkDateParts(artwork);
  if (!parts) return '';
  return parts.month ? `${parts.month} ${parts.year}` : parts.year;
}

function splitYearAndOptionalMonth(year: number, month: number | undefined): ArtworkDateParts {
  if (month == null || !Number.isInteger(month) || month < 1 || month > 12) {
    return { year: String(year), month: null };
  }
  return { year: String(year), month: MONTHS[month - 1] };
}
