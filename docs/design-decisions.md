# Design decisions

**Direction.** Competitors look alike: white or navy, blue accents, stock heroes. Seudocom gets a recognizably different look, while staying sober enough for enterprise buyers: mostly black and white, with lime used deliberately.

**System**
- **Color:** #111111, #D7FF00 and #FFFFFF, plus one quiet off-white (#F3F3EE) to separate bands and one red (#B00020) for form errors only, because error states shouldn't rely on brand colors.
- **Type:** Oxanium throughout. Weight 800 for headlines, regular for body text, with Bahnschrift, Segoe UI and system fonts as fallback.
- **Shape:** 3px black lines, hard offset shadows, no radius. The 45-degree corner on photos comes from the logo's geometry.
- **Grid:** a faint 48px grid in hero sections and ruled cell grids make the structure visible.
- **Photos:** all grayscale, so mismatched sources look like one set and lime stays the only color.
- **Motion:** button and card shifts, a short fade-in on service cards, and a nav transition. All are effectively off under reduced motion.

**Content.** Copy stays with the positioning supplied in the brief and avoids specific capability claims. Where detail is missing, the section says so with a dashed "Draft" marker that a single setting hides. Because Seudocom has no track record to show yet, the About page says so plainly and treats that candor as a brand trait.

**Architecture**
- A small Node build assembles shared header and footer into plain HTML. The server only receives static files.
- Jobs and hiring steps live in `careers-data.js`, separate from the interface.
- Endpoints live in `site-config.js`. With none set, forms validate and clearly say nothing was sent, and no form data is written to browser storage.
- Job details use the native `<dialog>` element, which provides focus handling and Esc without a library. Positions have direct links (`careers.html#job-<id>`).
- There are no third-party scripts. Google Fonts is the only external request.

## Recruitment backend

A static site cannot issue codes, show status or send mass email, so careers runs on PHP and SQLite, which shared cPanel hosting normally provides. Applicants are not emailed their code. It is shown once and only its hash is stored. Mass email goes to each person individually and also appears on their dashboard.
