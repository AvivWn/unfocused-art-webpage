export type ParsedDimensions = { wCm: number; hCm: number };

/**
 * Parse strings like "40 × 40 cm", "35 x 25 in", "800 × 600 mm" into cm.
 */
export function parseDimensionsToCm(str: unknown): ParsedDimensions | null {
  if (str == null || typeof str !== 'string') return null;
  const s = str.trim();
  const m = s.match(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*(cm|mm|in)?/i);
  if (!m) return null;
  let w = parseFloat(m[1]);
  let h = parseFloat(m[2]);
  const unit = (m[3] || 'cm').toLowerCase();
  if (unit === 'mm') {
    w /= 10;
    h /= 10;
  } else if (unit === 'in') {
    w *= 2.54;
    h *= 2.54;
  }
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { wCm: w, hCm: h };
}

export function maxSideCm(parsed: ParsedDimensions): number {
  return Math.max(parsed.wCm, parsed.hCm);
}
