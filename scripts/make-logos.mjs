// Generates every logo variant and favicon from one set of geometry. Run: npm run logos
import fs from 'node:fs';
import opentype from 'opentype.js';
import sharp from 'sharp';

const BLACK = '#111111', LIME = '#D7FF00', WHITE = '#FFFFFF';
const out = 'src/assets/svg';
const fav = 'src/assets/favicon';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(fav, { recursive: true });

// Mark geometry. All diagonals are exact 45 degree lines; every limb is the same weight.
const upper = 'M110 400 214 296H327V348H236L184 400 276 492H202Z';
const lower = 'M418 438 460 480 356 584H192L110 502H184L214 532H334L386 480 344 438Z';
const spine = 'M262 388H348V352A36 36 0 0 1 384 388V404L418 438H312Z';
const arc1 = 'M348 288A100 100 0 0 1 448 388H406A58 58 0 0 0 348 330Z';
const arc2 = 'M348 224A164 164 0 0 1 512 388H470A122 122 0 0 0 348 266Z';

// On white, pure lime needs a keyline to hold its edge; on black it does not.
const mark = (s, keyline) => {
  const k = keyline ? ` stroke="${BLACK}" stroke-width="7" stroke-linejoin="miter"` : '';
  return `<g id="s-mark"><path fill="${s}" d="${upper}"/><path fill="${s}" d="${lower}"/></g>` +
    `<g id="signal" fill="${LIME}"${k}><path d="${spine}"/><path d="${arc1}"/><path d="${arc2}"/></g>`;
};

const buf = fs.readFileSync('node_modules/@fontsource/oxanium/files/oxanium-latin-800-normal.woff');
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const fontSize = 214, tracking = 7;
let x = 0;
const parts = [];
for (const ch of 'SEUDOCOM') {
  const g = font.charToGlyph(ch);
  parts.push(g.getPath(x, 0, fontSize).toPathData(1));
  x += g.advanceWidth / font.unitsPerEm * fontSize + tracking;
}
const wordWidth = x - tracking;
// Centre the capitals on the vertical middle of the S mark.
const capH = font.charToGlyph('E').getBoundingBox().y2 / font.unitsPerEm * fontSize;
const baseline = 440 + capH / 2;
const wordX = 560;
const word = fill => `<path id="wordmark" fill="${fill}" transform="translate(${wordX} ${baseline.toFixed(1)})" d="${parts.join('')}"/>`;
const hW = Math.ceil(wordX + wordWidth + 12);

const svg = (vb, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const hVB = `98 212 ${hW - 98} 384`, iVB = '98 212 426 384';

const files = {
  'logo-horizontal.svg': svg(hVB, mark(BLACK, true) + word(BLACK), 'Seudocom'),
  'logo-horizontal-dark.svg': svg(hVB, mark(WHITE, false) + word(WHITE), 'Seudocom'),
  'logo-icon.svg': svg(iVB, mark(BLACK, true), 'Seudocom'),
  'logo-icon-dark.svg': svg(iVB, mark(WHITE, false), 'Seudocom'),
};
for (const [n, s] of Object.entries(files)) fs.writeFileSync(`${out}/${n}`, s);

// Favicon: the dark icon on a solid black tile, so it holds up on any browser chrome.
const tile = svg('50 150 510 510', `<rect x="50" y="150" width="510" height="510" fill="${BLACK}"/><g transform="translate(-6 -3)">${mark(WHITE, false)}</g>`, 'Seudocom');
fs.writeFileSync(`${fav}/favicon.svg`, tile);
const png = n => sharp(Buffer.from(tile), { density: 300 }).resize(n, n).png({ compressionLevel: 9 }).toBuffer();
for (const [n, f] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  fs.writeFileSync(`${fav}/${f}`, await png(n));
}
const p = await png(48);
const head = Buffer.alloc(22);
head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); head[6] = 48; head[7] = 48;
head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
head.writeUInt32LE(p.length, 14); head.writeUInt32LE(22, 18);
fs.writeFileSync(`${fav}/favicon.ico`, Buffer.concat([head, p]));

// Social share card
fs.mkdirSync('src/assets/img', { recursive: true });
const logoPng = await sharp(Buffer.from(files['logo-horizontal-dark.svg']), { density: 200 }).resize({ width: 860 }).png().toBuffer();
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${BLACK}"/><rect y="560" width="1200" height="70" fill="${LIME}"/></svg>`;
await sharp(Buffer.from(card)).composite([{ input: logoPng, left: 170, top: 150 }]).jpeg({ quality: 88 }).toFile('src/assets/img/og-seudocom.jpg');
console.log('logos written, wordmark width', Math.round(wordWidth), 'capH', Math.round(capH));
