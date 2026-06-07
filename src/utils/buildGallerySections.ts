export function buildGallerySections<T extends { sectionTitle?: unknown }>(
  items: T[],
): { title: string; cards: { artwork: T; index: number }[] }[] {
  const sections: { title: string; cards: { artwork: T; index: number }[] }[] = [];
  let index = 0;
  for (const artwork of items) {
    const title =
      'sectionTitle' in artwork && typeof artwork.sectionTitle === 'string'
        ? artwork.sectionTitle
        : 'Works';
    const last = sections[sections.length - 1];
    if (!last || last.title !== title) {
      sections.push({ title, cards: [] });
    }
    sections[sections.length - 1].cards.push({ artwork, index: index++ });
  }
  return sections;
}
