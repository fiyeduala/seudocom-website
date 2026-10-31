// Downloads the licensed originals into source-images/ and writes grayscale responsive WebP files.
// The originals are not deployed. Run: npm run images
import fs from 'node:fs';
import sharp from 'sharp';

const UA = { 'User-Agent': 'SeudocomWebsiteBuild/1.0 (licensed image download)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const imgs = {
  'lineman-on-utility-pole': 'Telecommunications engineer - geograph.org.uk - 8092160.jpg',
  'fiber-conduit-in-trench': 'Fiber optic cable installation (rubin-20170124-101126).jpg',
  'fiber-cable-reel-at-manhole': 'SRNL Fiber Optic Cable Installation (8057285939).jpg',
  'technician-at-equipment-rack': 'Splicing fiber optic cables in a communications cabinet in a power facility in Queens. 10-02-2019 (48844065016).jpg',
  'technician-with-fiber-patch-panel': 'Telecommunications technician.jpg',
  'climber-on-lattice-tower': 'Telecommunications Tower Technician in Argentina 5.jpg',
  'cell-tower-antennas': 'Cell Tower Ciudad del Carmen2020.jpg',
};
async function get(u) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(u, { headers: UA });
    if (r.ok) return r;
    console.log('wait', r.status);
    await sleep(25000 * (a + 1));
  }
  throw new Error('failed ' + u);
}
const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const widths = [1800, 1200, 720];
const manifest = {}, meta = {};
fs.mkdirSync('src/assets/img', { recursive: true });
fs.mkdirSync('source-images', { recursive: true });
for (const [name, title] of Object.entries(imgs)) {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&titles=' + encodeURIComponent('File:' + title);
  const page = Object.values((await (await get(api)).json()).query.pages)[0].imageinfo[0];
  const m = page.extmetadata;
  meta[name] = { title, page: page.descriptionurl, original: page.url, license: m.LicenseShortName?.value, licenseUrl: m.LicenseUrl?.value || null, artist: strip(m.Artist?.value), credit: strip(m.Credit?.value), cropNote: name === 'technician-at-equipment-rack' };
  const orig = `source-images/${name}.jpg`;
  if (!fs.existsSync(orig)) {
    fs.writeFileSync(orig, Buffer.from(await (await get(page.url)).arrayBuffer()));
    await sleep(8000);
  }
  const { width, height } = await sharp(orig).metadata();
  const list = [];
  for (const w of widths) {
    const tw = Math.min(w, width);
    // The rack photo has a camera date stamp along its lower edge, so it is cropped out.
    const rotated = await sharp(orig).rotate().toBuffer();
    const source = name === 'technician-at-equipment-rack'
      ? sharp(rotated).extract({ left: 0, top: 0, width, height: Math.round(height * 0.84) })
      : sharp(rotated);
    const info = await source.resize({ width: tw, withoutEnlargement: true }).grayscale().normalise({ lower: 1, upper: 99 }).webp({ quality: 68, effort: 5 }).toFile(`src/assets/img/${name}-${tw}.webp`);
    list.push({ w: info.width, h: info.height });
  }
  manifest[name] = list;
  console.log(name, width, height, meta[name].license, '|', meta[name].artist);
  await sleep(3000);
}
fs.writeFileSync('scripts/image-manifest.json', JSON.stringify(manifest, null, 1));
fs.writeFileSync('docs/image-source-metadata.json', JSON.stringify(meta, null, 1));
