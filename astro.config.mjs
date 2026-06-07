import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const artworksPath = path.join(rootDir, 'src/data/artworks.json');

/** Cache artwork thumbnails and full images in the browser for one year. */
const ARTWORK_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const DEPLOY_HEADERS = `/artworks/*
  Cache-Control: ${ARTWORK_CACHE_CONTROL}
`;

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function invalidateArtworksModule(viteServer) {
  const mods = viteServer.moduleGraph.getModulesByFile(artworksPath);
  if (!mods) return;

  for (const mod of mods) {
    viteServer.moduleGraph.invalidateModule(mod);
  }
}

async function handleGalleryLayoutSave(req, res, viteServer) {
  const body = JSON.parse(await readRequestBody(req));
  const raw = await fs.readFile(artworksPath, 'utf8');
  const artworks = JSON.parse(raw);

  if (body.reset === true) {
    const { applyAutoLayoutToArtworks } = await viteServer.ssrLoadModule(
      '/src/utils/applyAutoGalleryLayout.ts',
    );
    applyAutoLayoutToArtworks(artworks);
  } else if (Array.isArray(body.positions)) {
    const byTitle = new Map();
    for (const entry of body.positions) {
      if (
        typeof entry?.title !== 'string' ||
        typeof entry?.layout?.x !== 'number' ||
        typeof entry?.layout?.y !== 'number'
      ) {
        continue;
      }
      byTitle.set(entry.title, { x: entry.layout.x, y: entry.layout.y });
    }

    for (const artwork of artworks) {
      if (typeof artwork.title !== 'string') continue;
      const layout = byTitle.get(artwork.title);
      if (layout) artwork.layout = layout;
    }
  } else {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid request body' }));
    return;
  }

  await fs.writeFile(artworksPath, `${JSON.stringify(artworks, null, 2)}\n`, 'utf8');
  await invalidateArtworksModule(viteServer);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}

function isArtworkAssetRequest(url) {
  return /^\/artworks\/.+\.(avif|gif|jpe?g|png|webp)$/i.test(url);
}

function artworkCacheMiddleware(req, res, next) {
  const url = req.url?.split('?')[0] ?? '';
  if (isArtworkAssetRequest(url)) {
    res.setHeader('Cache-Control', ARTWORK_CACHE_CONTROL);
  }
  next();
}

/** Dev-only layout API, artwork cache headers, and deploy _headers file. */
function galleryLayoutDevApi() {
  return {
    name: 'gallery-layout-dev-api',
    configureServer(viteServer) {
      viteServer.middlewares.use(artworkCacheMiddleware);
      viteServer.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/api/gallery-layout.json' || req.method !== 'POST') {
          next();
          return;
        }

        try {
          await handleGalleryLayoutSave(req, res, viteServer);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
    },
    configurePreviewServer(viteServer) {
      viteServer.middlewares.use(artworkCacheMiddleware);
    },
  };
}

function deployHeadersIntegration() {
  return {
    name: 'deploy-artwork-cache-headers',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const headersPath = new URL('_headers', dir);
        await fs.writeFile(headersPath, DEPLOY_HEADERS, 'utf8');
      },
    },
  };
}

export default defineConfig({
  integrations: [deployHeadersIntegration()],
  vite: {
    plugins: [galleryLayoutDevApi()],
    server: {
      watch: {
        // Writes on Done invalidate the module explicitly; ignore file watch to avoid auto-refresh.
        ignored: ['**/src/data/artworks.json'],
      },
    },
  },
});
