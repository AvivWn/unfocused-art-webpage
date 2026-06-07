import { buildGallerySections } from './buildGallerySections';
import { GALLERY_GRID_RESOLUTION, layoutGallerySection } from './galleryGridLayout';

type ArtworkWithLayout = {
  layout?: { x?: unknown; y?: unknown };
};

/** Replace every artwork's `layout` with auto-packed positions for its gallery section. */
export function applyAutoLayoutToArtworks<T extends ArtworkWithLayout>(artworks: T[]): T[] {
  const sections = buildGallerySections(artworks);

  for (const section of sections) {
    const autoPlaced = layoutGallerySection(section.cards, GALLERY_GRID_RESOLUTION, {
      ignoreManualLayout: true,
    });

    for (const placed of autoPlaced) {
      const artwork = section.cards.find((card) => card.index === placed.index)?.artwork;
      if (!artwork) continue;
      artwork.layout = { x: placed.x, y: placed.y };
    }
  }

  return artworks;
}
