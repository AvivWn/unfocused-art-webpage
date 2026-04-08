import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import imageSize from 'image-size';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');

/** Assumed print resolution when inferring physical size from pixel dimensions (px per inch). */
export const ASSUMED_PRINT_DPI = 300;

export type PixelDimensions = { width: number; height: number };

/**
 * Width and height in pixels for an image under `public/`, from a build-time file read.
 */
export function getImagePixelDimensions(imagePublicPath: unknown): PixelDimensions | null {
  if (typeof imagePublicPath !== 'string' || !imagePublicPath.startsWith('/')) return null;
  const rel = imagePublicPath.replace(/^\//, '');
  if (rel.includes('..')) return null;
  const abs = path.resolve(publicRoot, rel);
  if (!abs.startsWith(publicRoot + path.sep) && abs !== publicRoot) return null;
  try {
    if (!fs.existsSync(abs)) return null;
    const d = imageSize(fs.readFileSync(abs));
    if (!d.width || !d.height || d.width < 1 || d.height < 1) return null;
    return { width: d.width, height: d.height };
  } catch {
    return null;
  }
}

/**
 * Longest side in centimetres, as if the image were printed at `dpi` (default 300).
 */
export function maxSideCmFromPrintPixels(
  dim: PixelDimensions,
  dpi: number = ASSUMED_PRINT_DPI,
): number {
  const sidePx = Math.max(dim.width, dim.height);
  return (sidePx / dpi) * 2.54;
}

export function getEffectiveMaxSideCmFromPrintImage(
  imagePublicPath: unknown,
  dpi: number = ASSUMED_PRINT_DPI,
): number | null {
  const dim = getImagePixelDimensions(imagePublicPath);
  if (!dim) return null;
  return maxSideCmFromPrintPixels(dim, dpi);
}
