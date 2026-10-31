// Zero-dependency static build: src/ -> dist/. Run: npm run build
// dist/ is what gets uploaded to public_html. The server never needs Node.
import fs from 'node:fs';
import path from 'node:path';
import config from '../src/site.config.mjs';

const SRC = 'src', OUT = 'dist';
const manifest = JSON.parse(fs.readFileSync('scripts/image-manifest.json', 'utf8'));
const credits = JSON.parse(fs.readFileSync('docs/image-source-metadata.json', 'utf8'));
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(SRC, 'assets'), path.join(OUT, 'assets'), { recursive: true });
fs.cpSync(path.join(SRC, 'api'), path.join(OUT, 'api'), { recursive: true });
for (const f of fs.readdirSync(path.join(SRC, 'root'))) fs.copyFileSync(path.join(SRC, 'root', f), path.join(OUT, f));

// {{img name|alt|sizes|eager}}: responsive image with intrinsic size, which prevents layout shift.
function img(name, alt, sizes = '100vw', mode = '') {
  const v = manifest[name];
  if (!v) throw new Error(`Unknown image: ${name}`);
  const srcset = v.map(x => `assets/img/${name}-${x.w}.webp ${x.w}w`).join(', ');
  const mid = v[1];
  const load = mode === 'eager' ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<img src="assets/img/${name}-${mid.w}.webp" srcset="${srcset}" sizes="${sizes}" width="${mid.w}" height="${mid.h}" alt="${esc(alt)}" decoding="async" ${load}>`;
}

// A missing contact detail renders as a visible placeholder, never as an invented value.
function contact(key, label) {
  const v = config.contact[key];
  if (!v) return `<span class="tbc" data-client-placeholder>${label}: to be provided</span>`;
  if (key === 'email') return `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
  if (key === 'phone') return `<a href="tel:${esc(v.replace(/[^+\d]/g, ''))}">${esc(v)}</a>`;
  return esc(v);
}

const creditRows = Object.values(credits).map(c => {
  const file = esc(c.title.replace(/\.[a-z]+$/i, ''));
  const lic = c.licenseUrl ? `<a href="${esc(c.licenseUrl)}" rel="license noopener">${esc(c.license)}</a>` : esc(c.license);
  return `<tr><td data-label="Image"><a href="${esc(c.page)}" rel="noopener">${file}</a></td><td data-label="Credit">${esc(c.artist)}</td><td data-label="License">${lic}</td><td data-label="Changes">Converted to grayscale, resized${c.cropNote ? ', cropped' : ''}; displayed cropped</td></tr>`;
}).join('');

const expand = (html, active = '') => html
  .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, p) => read(`partials/${p}.html`))
  .replace(/\{\{img ([^}]+)\}\}/g, (_, a) => img(...a.split('|').map(s => s.trim())))
  .replace(/\{\{contact (\w+)\|([^}]+)\}\}/g, (_, k, l) => contact(k, l))
  .replace(/\{\{credits\}\}/g, creditRows)
  .replace(/\{\{year\}\}/g, String(new Date().getFullYear()))
  .replace(/\{\{siteUrl\}\}/g, config.siteUrl)
  .replace(/data-nav="([\w-]+)"/g, (_, n) => (n === active ? 'aria-current="page"' : ''));

const layout = read('partials/layout.html');
const pages = fs.readdirSync(path.join(SRC, 'pages')).filter(f => f.endsWith('.html'));
const sitemap = [];
for (const file of pages) {
  const raw = read(`pages/${file}`);
  const m = raw.match(/^<!--meta\s+([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`Missing meta block: ${file}`);
  const meta = JSON.parse(m[1]);
  const url = `${config.siteUrl}/${file === 'index.html' ? '' : file.replace(/\.html$/, '')}`;
  const head = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}">`,
    meta.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`,
    meta.base ? '<base href="/">' : '',
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Seudocom">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${config.siteUrl}/assets/img/og-seudocom.jpg">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean).join('\n  ');
  const scripts = (meta.scripts || []).map(s => `<script src="assets/js/${s}" defer></script>`).join('\n  ');
  let html = layout
    .replace('{{head}}', () => head)
    .replace('{{scripts}}', () => scripts)
    .replace('{{bodyClass}}', config.showDraftMarkers ? 'show-draft' : '')
    .replace('{{content}}', () => raw.slice(m[0].length));
  html = expand(html, meta.nav || '');
  fs.writeFileSync(path.join(OUT, file), html);
  if (!meta.noindex) sitemap.push(url);
}

fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`);

console.log(`Built ${pages.length} pages into ${OUT}/`);
if (config.siteUrl.includes('example.')) console.warn('WARNING: siteUrl is still the placeholder. Set the real domain in src/site.config.mjs before launch.');
if (config.showDraftMarkers) console.warn('NOTE: draft markers are visible. Turn off showDraftMarkers in src/site.config.mjs once copy is approved.');
