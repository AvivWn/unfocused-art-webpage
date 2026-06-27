# Art portfolio

A minimal single-page site for paintings: about section, responsive gallery, and a full-screen viewer with details (title, optional description, year, dimensions, materials, optional source image).

Built with [Astro](https://astro.build). `npm run build` outputs plain static files in `dist/` — deploy anywhere (Vercel, Netlify, Cloudflare Pages, GitHub Pages) with no server.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 18 or later

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

### Build for production

```bash
npm run build
```

The output goes to the `dist/` folder — ready to deploy.

### Preview a production build

```bash
npm run preview
```

## How to update content

### Artworks

All artwork data lives in a single file: `src/data/artworks.json`.

Each entry has these fields:

| Field        | Type             | Description                                          |
| ------------ | ---------------- | ---------------------------------------------------- |
| `sectionTitle` | string (optional) | Groups consecutive pieces under one heading on the main page. Omit to use **`Works`** for that run of entries. |
| `title`      | string           | Title of the artwork                                 |
| `year`       | number or string | Calendar year (e.g. `2024`), or a custom string such as `"2023–24"` (shown as-is; `month` is ignored) |
| `month`      | number (optional)| Month completed, **1–12**. Omit when unknown; gallery and viewer then show **year only** |
| `dimensions` | string (optional)| Physical size, e.g. `"60 × 80 cm"` (supports **`cm`**, **`mm`**, **`in`**). Used in the viewer when set. On the main page, every piece gets an effective **longest side in cm**: from `dimensions` when set, otherwise from the **`image`** file’s pixel size assuming **300 DPI** print (300 px = 1 in → cm via × 2.54). All works share **one** scale vs the **largest** effective cm side. Thumbnails fill the tile width; height follows the image. |
| `materials`  | string           | Medium used, e.g. `"Oil on canvas"`                  |
| `description`| string (optional)| Short text about the work; shown in the viewer below the title when non-empty |
| `image`      | string           | Full image in the lightbox (path under `public/`). Use **`.jpg`**, **`.jpeg`**, **`.png`**, or **`.webp`** (extension in the path must match the file). |
| `thumbnail`  | string (optional)| Thumbnail on the main page; if omitted, `image` is used (same formats). If set and different from `image`, the wall shows the **thumbnail** at its **natural aspect ratio** (full width, height from the file)—it is **not** cropped to match the full image. |
| `source`     | string \| null   | Optional single reference image (same formats as `image`). Ignored if `sources` is set. |
| `sources`    | string[] (optional) | Multiple reference images, shown in order in the viewer. Use this **or** `source`, not both. |
| `layout`     | object (optional)   | Wall position in **grid units** (1 unit = 1 cm): `{ "x": 0, "y": 44 }`. When a section already has manual layouts, **add a `layout` for new works** by placing them near existing neighbors (dev **Reorganize** tool, or copy/adjust coordinates from siblings). Existing positions are preserved; auto-pack only fills in works that omit `layout`. |

The viewer lists this as **Date**: with `month` set it shows e.g. `February 2022`; with only `year` it shows e.g. `2022`.

**To add an artwork:**

1. Create a folder under `public/artworks/` for that piece (use a short slug, e.g. `golden-hour`).
2. Put files there using a consistent layout (any of **`.jpg`**, **`.jpeg`**, **`.png`**, **`.webp`**):
   - **`full`** — main image for the lightbox (required), e.g. `full.jpg` or `full.webp`.
   - **`thumbnail`** — optional; wall thumbnail, e.g. `thumbnail.webp`. Omit `thumbnail` in JSON to use `full` on the main page.
   - **`source`** — one reference photo, e.g. `source.jpg`, or `null`.
   - **`source-1.jpg`**, **`source-2.jpg`**, etc. — optional; list all paths in JSON as **`sources`**: `["/artworks/slug/source-1.webp", "/artworks/slug/source-2.webp"]`.
3. Add an entry to `src/data/artworks.json` with paths that match the real filenames, e.g. `/artworks/golden-hour/full.webp`.
4. If the section already has `layout` on other works, give the new entry a `layout` too — refer to nearby pieces (same row/column alignment, `PACK_GAP` = 2 units between edges). Do **not** rely on full-section auto layout once a wall has been arranged by hand.

Example folder `public/artworks/golden-hour/` and entry:

```json
{
  "sectionTitle": "Landscapes",
  "title": "Golden Hour",
  "year": 2024,
  "month": 6,
  "dimensions": "50 × 70 cm",
  "materials": "Oil on canvas",
  "thumbnail": "/artworks/golden-hour/thumbnail.jpg",
  "image": "/artworks/golden-hour/full.jpg",
  "source": null
}
```

Use the same `sectionTitle` string on each work in a group so they appear under one heading. When `sectionTitle` changes, a new heading starts.

Within each section, works use a **flex wall**: side by side with **wrap**, **level alignment** (no rotation), a **single uniform gap** between neighbors (horizontal and vertical), and **shrink-to-fit width** so the cluster sits together instead of stretching across the row.

### Site title and about text

Edit `src/data/site.json`:

- **`siteTitle`** — shown in the header, page title, and footer.
- **`metaDescription`** — short description for search engines and link previews.
- **`aboutParagraphs`** — array of strings; each becomes a paragraph in the About section.

## Image tips

- **Aspect ratio:** Thumbnails on the wall follow each image file’s proportions (square canvases stay square). Export main images with the same aspect ratio as the physical work so the wall matches reality.
- **No `dimensions`:** The build reads pixel size from **`image`** and treats it as a **300 DPI** print so digital pieces use the **same cm-based wall scale** as real canvases (adjust `ASSUMED_PRINT_DPI` in `src/utils/getImagePixelDimensions.ts` if needed).
- **Formats:** **JPEG** (`.jpg` / `.jpeg`), **PNG** (`.png`), and **WebP** (`.webp`) are all supported for `image`, `thumbnail`, and `source`. The browser loads whatever URL you put in JSON; pick the extension that matches the file on disk. JPEG or WebP usually give the smallest files for photos; PNG is lossless (good for flat graphics or when you need no compression artifacts).
- **Resolution:** 1600–2400 px on the longest side gives a good full-screen experience.
- **File size:** Aim for under 400 KB per image. Use [Squoosh](https://squoosh.app) to compress.
- **Naming:** Use descriptive names (`sunset-over-lake.jpg`, not `IMG_4521.jpg`).

## Deployment

Output is static HTML/CSS/JS. **Recommended:** connect the repo to [Vercel](https://vercel.com) or [Netlify](https://www.netlify.com) (build command `npm run build`, publish directory `dist`). Alternatives: [Cloudflare Pages](https://pages.cloudflare.com), [GitHub Pages](https://pages.github.com). No backend required.
