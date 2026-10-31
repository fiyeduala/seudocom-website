# Seudocom website

Static site for shared cPanel hosting. The server needs no Node, database or serverless functions.

## Layout

| Path | Purpose |
|---|---|
| `dist/` | **Finished site. Upload the contents of this folder.** |
| `src/pages/`, `src/partials/` | Page content and shared header, footer and layout |
| `src/assets/` | CSS, JavaScript, logos, favicons, optimized images |
| `src/root/` | `.htaccess` |
| `src/site.config.mjs` | Domain, contact details, draft markers |
| `scripts/` | Build, preview, logo and image tools |
| `source-images/` | Original photos (not deployed) |
| `docs/` | Research, asset register, client questions, design decisions |

## Local development

Requires Node 18 or later.

```
npm install
npm run build     # src/ to dist/
npm run serve     # http://localhost:8080
```

`npm run logos` and `npm run images` regenerate brand assets and photos. They are only needed when those change.

## Common edits

Run `npm run build` after any edit.

- **Domain, contact details, draft markers:** `src/site.config.mjs`
- **Positions and hiring steps:** `src/assets/js/careers-data.js`. Instructions are at the top of the file.
- **Form endpoints:** `src/assets/js/site-config.js`

## Deploy to cPanel

1. Set the real domain in `src/site.config.mjs`, then run `npm run build`.
2. In cPanel, turn on SSL for the domain (SSL/TLS Status > Run AutoSSL) and confirm `https://` works.
3. In File Manager, open `public_html` and upload the **contents** of `dist/`, not the folder itself. A zip and Extract works well.
4. Turn on "Show Hidden Files" in File Manager settings and confirm `.htaccess` is there.
5. Visit the site, check that `http://` redirects to `https://`, and try a nonexistent URL to see the 404 page.

The site expects to be at the domain root. In a subfolder, pages still work, but the 404 page and the `ErrorDocument` line in `.htaccess` need that folder in their paths.

## Connecting the forms

Both forms are in preview mode: they validate, send nothing, and say so. To connect one:

1. Create a backend on HTTPS, such as a PHP script on the same account. It must validate everything again on the server, including resume type and size, protect against spam, and store resumes outside `public_html`.
2. Set its URL in `site-config.js`, for example `application: { endpoint: 'api/apply.php' }`.
3. Rebuild and upload.

The form then POSTs `multipart/form-data`. A 2xx response shows a success message; anything else shows an error. The preview notice disappears automatically. Application field names are `fullName`, `email`, `phone`, `location`, `position`, `preferredRole`, `experience`, `resume`, `coverLetter`, `consent`; contact field names are `name`, `company`, `email`, `phone`, `inquiryType`, `requirements`, `message`.

Review the wording of the consent line and success messages (in `forms.js`) when the backend is connected, and link a privacy notice.

## Pre-launch checklist

- [ ] Domain set; the build no longer warns about it
- [ ] Search `dist/` for `data-client-placeholder`; none should remain
- [ ] Sample jobs removed, process steps confirmed
- [ ] Copy approved, `showDraftMarkers` set to `false`
- [ ] Privacy notice linked
- [ ] Forms connected and tested, or preview notices deliberately left in place
- [ ] Photo risks reviewed ([docs/asset-register.md](docs/asset-register.md))

## Recruitment backend

`dist/api/` is a PHP and SQLite backend for applications, assessments, the applicant dashboard (`dashboard.html`) and the admin console (`admin.html`). The contact form has no backend and stays in preview mode.

- Test locally with `npm run build`, then `npm run serve:full`, and open http://localhost:8080. Emails are written to `seudocom-data/mail.log` and are not sent.
- Application fields: fullName, email, phone, nationality, address, location, position, preferredRole, experience, coverLetter, resume, consent.
- Data, resumes and sessions are stored in `seudocom-data`, one level above the web root. Upload the contents of `dist/` to `public_html`, so the folder is created outside it. Back this folder up: it is not part of the build.
- The first visit to `admin.html` creates `seudocom-data/setup-key.txt`. Enter that key to create the admin account. The key file is then deleted.
- Hosting needs PHP 8 with pdo_sqlite and a working `mail()`. Override settings with `seudocom-config.php` beside `seudocom-data` (a PHP file returning an array, for example `mail_from` or `site_url`).
- The affidavit PDF is generated from `scripts/affidavit-template.html` with `npm run affidavit`. Run `npm run build` afterwards. Signed copies are stored in `seudocom-data/affidavits`.
- Access codes are stored only as keyed hashes, so a lost code can only be replaced from the admin console. Confirm the person's identity first.
