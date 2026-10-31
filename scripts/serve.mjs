// Minimal local preview of dist/. Run: npm run serve
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
const root = path.resolve('dist');
const port = Number(process.env.PORT) || 8080;
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/html' });
  fs.createReadStream(path.join(root, '404.html')).pipe(res);
}).listen(port, () => console.log(`Preview: http://localhost:${port}`));
