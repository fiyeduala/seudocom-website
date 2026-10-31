// Regenerates the downloadable affidavit from scripts/affidavit-template.html using installed Chrome.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '../src/assets/docs/seudocom-affidavit-of-confirmation.pdf');
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files', `--print-to-pdf=${out}`, pathToFileURL(path.join(here, 'affidavit-template.html')).href], { stdio: 'ignore' });
console.log('Wrote', out);
