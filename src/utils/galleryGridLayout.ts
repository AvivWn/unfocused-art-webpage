import { GALLERY_PACK_GAP } from '../constants/gallery';
import { ASSUMED_PRINT_DPI, getImagePixelDimensions } from './getImagePixelDimensions';
import { parseDimensionsToCm } from './parseArtworkDimensions';

export const GALLERY_GRID_RESOLUTION = 100;

/** One grid unit equals one centimetre on the virtual 100×100 cm wall. */
export const CM_PER_GRID_UNIT = 1;

/** Screen pixels per grid unit (1 cm physical). */
export const GALLERY_DISPLAY_PX_PER_GRID_UNIT = 10;

const PACK_GAP = GALLERY_PACK_GAP;

/** Try every permutation when a section has at most this many works. */
const PERMUTATION_LIMIT = 8;

/** Extra random orderings for larger sections. */
const RANDOM_RESTARTS = 80;

export type GalleryCard = {
  artwork: {
    dimensions?: unknown;
    image?: unknown;
    thumbnail?: unknown;
    layout?: { x?: unknown; y?: unknown };
  };
  index: number;
};

export type PlacedGalleryCard = GalleryCard & {
  x: number;
  y: number;
  w: number;
  h: number;
  rowExtent: number;
  colExtent: number;
};

type PackItem = GalleryCard & { w: number; h: number; area: number };

type PackedItem = PackItem & { x: number; y: number };

type Rect = { x: number; y: number; w: number; h: number };

type LayoutMetrics = {
  compactness: number;
  neighborPenalty: number;
  rowExtent: number;
  colExtent: number;
};

export function effectiveDimensionsCm(artwork: {
  dimensions?: unknown;
  image?: unknown;
}): { wCm: number; hCm: number } | null {
  const parsed = parseDimensionsToCm(artwork.dimensions);
  if (parsed) return { wCm: parsed.wCm, hCm: parsed.hCm };

  const px = getImagePixelDimensions(artwork.image);
  if (!px) return null;

  return {
    wCm: (px.width / ASSUMED_PRINT_DPI) * 2.54,
    hCm: (px.height / ASSUMED_PRINT_DPI) * 2.54,
  };
}

function thumbnailAspectRatio(artwork: GalleryCard['artwork']): number | null {
  const path =
    typeof artwork.thumbnail === 'string'
      ? artwork.thumbnail
      : typeof artwork.image === 'string'
        ? artwork.image
        : null;
  if (!path) return null;

  const px = getImagePixelDimensions(path);
  if (!px) return null;
  return px.height / px.width;
}

/**
 * Width from physical cm (1 unit = 1 cm); height from thumbnail aspect ratio so the
 * box matches the image and object-fit: contain does not letterbox.
 */
function dimensionsToGridUnits(
  wCm: number,
  hCm: number,
  thumbAspect: number | null,
  gridResolution: number,
): { w: number; h: number } {
  const w = Math.max(1, Math.min(gridResolution, Math.round(wCm)));
  const h =
    thumbAspect != null && Number.isFinite(thumbAspect) && thumbAspect > 0
      ? Math.max(1, w * thumbAspect)
      : Math.max(1, Math.round(hCm));
  return { w, h };
}

function buildPackItems(cards: GalleryCard[], gridResolution: number): PackItem[] {
  return cards.map((card) => {
    const d = effectiveDimensionsCm(card.artwork);
    const wCm = d?.wCm ?? 1;
    const hCm = d?.hCm ?? 1;
    const thumbAspect = thumbnailAspectRatio(card.artwork);
    const { w, h } = dimensionsToGridUnits(wCm, hCm, thumbAspect, gridResolution);
    return { ...card, w, h, area: w * h };
  });
}

function rectsOverlapWithGap(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

function horizontalOverlap(ax: number, aw: number, bx: number, bw: number): boolean {
  return ax < bx + bw + PACK_GAP && ax + aw + PACK_GAP > bx;
}

function minYAtX(x: number, w: number, placed: Rect[]): number {
  let y = 0;
  for (const p of placed) {
    if (horizontalOverlap(x, w, p.x, p.w)) {
      y = Math.max(y, p.y + p.h + PACK_GAP);
    }
  }
  return y;
}

function candidateXs(item: PackItem, placed: PackedItem[], gridResolution: number): number[] {
  const xs = new Set<number>([0]);

  for (const p of placed) {
    xs.add(p.x);
    xs.add(p.x + p.w + PACK_GAP);
    const left = p.x - item.w - PACK_GAP;
    if (left >= 0) xs.add(left);
  }

  return [...xs]
    .filter((x) => x >= 0 && x + item.w <= gridResolution)
    .sort((a, b) => a - b);
}

/** Skyline bottom-left pack: lowest y, then leftmost x. */
function packWithSkyline(items: PackItem[], gridResolution: number): PackedItem[] | null {
  const placed: PackedItem[] = [];

  for (const item of items) {
    let best: { x: number; y: number } | null = null;

    for (const x of candidateXs(item, placed, gridResolution)) {
      const y = minYAtX(x, item.w, placed);
      const trial = { x, y, w: item.w, h: item.h };
      if (placed.some((p) => rectsOverlapWithGap(trial, p, PACK_GAP))) continue;

      if (!best || y < best.y - 1e-9 || (Math.abs(y - best.y) < 1e-9 && x < best.x)) {
        best = { x, y };
      }
    }

    if (!best) return null;
    placed.push({ ...item, x: best.x, y: best.y });
  }

  return placed;
}

function leftShift(placed: PackedItem[]): PackedItem[] {
  if (placed.length === 0) return placed;
  const minX = Math.min(...placed.map((p) => p.x));
  return placed.map((p) => ({ ...p, x: p.x - minX }));
}

/** Sum of center distances between consecutive works in JSON section order. */
function neighborPenalty(placed: PackedItem[], sectionItems: PackItem[]): number {
  if (sectionItems.length < 2) return 0;

  const byIndex = new Map(placed.map((p) => [p.index, p]));
  let penalty = 0;

  for (let i = 0; i < sectionItems.length - 1; i++) {
    const a = byIndex.get(sectionItems[i].index);
    const b = byIndex.get(sectionItems[i + 1].index);
    if (!a || !b) continue;

    const acx = a.x + a.w / 2;
    const acy = a.y + a.h / 2;
    const bcx = b.x + b.w / 2;
    const bcy = b.y + b.h / 2;
    penalty += Math.hypot(acx - bcx, acy - bcy);
  }

  return penalty;
}

function measureLayout(placed: PackedItem[], sectionItems: PackItem[]): LayoutMetrics {
  if (placed.length === 0) {
    return { compactness: Infinity, neighborPenalty: Infinity, rowExtent: 0, colExtent: 0 };
  }

  const rowExtent = Math.max(...placed.map((p) => p.y + p.h));
  const colExtent = Math.max(...placed.map((p) => p.x + p.w));

  return {
    compactness: rowExtent * 10 + colExtent,
    neighborPenalty: neighborPenalty(placed, sectionItems),
    rowExtent,
    colExtent,
  };
}

function isBetterLayout(next: LayoutMetrics, best: LayoutMetrics): boolean {
  if (next.compactness < best.compactness - 1e-9) return true;
  if (next.compactness > best.compactness + 1e-9) return false;
  return next.neighborPenalty < best.neighborPenalty - 1e-9;
}

function orderKey(order: PackItem[]): string {
  return order.map((o) => o.index).join(',');
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let state = seed >>> 0;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const head = items[i];
    const tail = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const rest of permutations(tail)) {
      yield [head, ...rest];
    }
  }
}

function candidateOrderings(items: PackItem[]): PackItem[][] {
  const orders: PackItem[][] = [];
  const seen = new Set<string>();

  const add = (order: PackItem[]) => {
    const key = orderKey(order);
    if (seen.has(key)) return;
    seen.add(key);
    orders.push(order);
  };

  add(items);
  add([...items].sort((a, b) => a.index - b.index));
  add([...items].sort((a, b) => b.area - a.area || a.index - b.index));
  add([...items].sort((a, b) => b.h - a.h || b.w - a.w || a.index - b.index));
  add([...items].sort((a, b) => b.w - a.w || b.h - a.h || a.index - b.index));
  add([...items].sort((a, b) => b.w + b.h - (a.w + a.h) || a.index - b.index));
  add([...items].sort((a, b) => b.h / b.w - a.h / a.w || a.index - b.index));

  if (items.length <= PERMUTATION_LIMIT) {
    for (const order of permutations(items)) add(order);
  } else {
    const baseSeed = items.reduce((s, it) => (s * 31 + it.index) >>> 0, 1);
    for (let i = 0; i < RANDOM_RESTARTS; i++) {
      add(seededShuffle(items, (baseSeed + i * 997) >>> 0));
    }
  }

  return orders;
}

function optimizeLayout(items: PackItem[], gridResolution: number): {
  placed: PackedItem[];
  rowExtent: number;
  colExtent: number;
} {
  let bestPlaced: PackedItem[] = [];
  let bestMetrics: LayoutMetrics = {
    compactness: Infinity,
    neighborPenalty: Infinity,
    rowExtent: 0,
    colExtent: gridResolution,
  };

  for (const order of candidateOrderings(items)) {
    const packed = packWithSkyline(order, gridResolution);
    if (!packed) continue;

    const shifted = leftShift(packed);
    const metrics = measureLayout(shifted, items);

    if (isBetterLayout(metrics, bestMetrics)) {
      bestPlaced = shifted;
      bestMetrics = metrics;
    }
  }

  if (bestPlaced.length === 0) {
    const fallback = packWithSkyline(
      [...items].sort((a, b) => b.area - a.area || a.index - b.index),
      gridResolution,
    );
    bestPlaced = leftShift(fallback ?? []);
    bestMetrics = measureLayout(bestPlaced, items);
  }

  return {
    placed: bestPlaced,
    rowExtent: bestMetrics.rowExtent,
    colExtent: bestMetrics.colExtent || gridResolution,
  };
}

function readManualLayout(artwork: GalleryCard['artwork']): { x: number; y: number } | null {
  const layout = artwork.layout;
  if (!layout || typeof layout !== 'object') return null;
  const x = layout.x;
  const y = layout.y;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

export function hasManualLayout(artwork: GalleryCard['artwork']): boolean {
  return readManualLayout(artwork) != null;
}

function sectionAllManual(cards: GalleryCard[]): boolean {
  return cards.length > 0 && cards.every((card) => hasManualLayout(card.artwork));
}

function placeFromManualItems(items: PackItem[]): PackedItem[] {
  return items.map((item) => {
    const manual = readManualLayout(item.artwork);
    if (!manual) {
      throw new Error('placeFromManualItems called without manual layout on every card');
    }
    return { ...item, x: manual.x, y: manual.y };
  });
}

function extentsFromPlaced(placed: { x: number; y: number; w: number; h: number }[]): {
  rowExtent: number;
  colExtent: number;
} {
  if (placed.length === 0) return { rowExtent: 0, colExtent: 0 };
  return {
    rowExtent: Math.max(...placed.map((p) => p.y + p.h)),
    colExtent: Math.max(...placed.map((p) => p.x + p.w)),
  };
}

/**
 * Pack artworks on a 100×100 cm virtual wall (1 grid unit = 1 cm). Order and positions
 * are optimized for a tight bounding box; optional `layout: { x, y }` in JSON overrides.
 */
export function layoutGallerySection(
  cards: GalleryCard[],
  gridResolution = GALLERY_GRID_RESOLUTION,
  options?: { ignoreManualLayout?: boolean },
): PlacedGalleryCard[] {
  if (cards.length === 0) return [];

  const items = buildPackItems(cards, gridResolution);

  let placed: PackedItem[];
  let rowExtent: number;
  let colExtent: number;

  if (!options?.ignoreManualLayout && sectionAllManual(cards)) {
    placed = placeFromManualItems(items);
    const extents = extentsFromPlaced(placed);
    rowExtent = extents.rowExtent;
    colExtent = extents.colExtent;
  } else {
    const optimized = optimizeLayout(items, gridResolution);
    placed = optimized.placed;
    rowExtent = optimized.rowExtent;
    colExtent = optimized.colExtent;
  }

  const final = placed.map((p) => {
    const manual = options?.ignoreManualLayout ? null : readManualLayout(p.artwork);
    return {
      artwork: p.artwork,
      index: p.index,
      x: manual?.x ?? p.x,
      y: manual?.y ?? p.y,
      w: p.w,
      h: p.h,
    };
  });

  const extents = extentsFromPlaced(final);

  return final.map((p) => ({
    ...p,
    rowExtent: extents.rowExtent || rowExtent,
    colExtent: extents.colExtent || colExtent,
  }));
}
