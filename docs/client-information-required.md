# Information needed from Seudocom

Written so that each item can be answered directly. Nothing below was assumed on the site; each gap shows as a marked placeholder or neutral wording.

## Needed before launch

1. **Domain.** Set `siteUrl` in `src/site.config.mjs`. Canonical links, the sitemap and social previews all depend on it.
2. **Contact details: confirmed.** Email is contact@seudocom.org and hours are "Always available". Phone and address are deliberately not shown.
3. **Form handling.** Where should inquiries and applications go? Both forms stay in preview mode until a real backend exists.
4. **Employment workflow.** The six steps on the Careers page come from the brief and await your explanation. Edit `process` in `src/assets/js/careers-data.js`.
5. **Real positions, or none.** Delete the two samples in `careers-data.js`. With no positions, the page shows an empty state and the general application.
6. **Privacy policy.** Drafted at `src/pages/privacy.html` and kept out of search engines until approved. It needs legal review and its [square bracket] items filled in. Remove `"noindex"` from the page once approved.
7. **Copy approval.** Mission, values and "Why Seudocom" are drafts. Set `showDraftMarkers` to false once approved.
8. **Photography decision.** See the risks in [asset-register.md](asset-register.md).

## Needed to strengthen the site

**Services**
- Which specific capabilities can you state? For example fiber, tower, splicing, 5G, emergency restoration. None are claimed today.
- What maintenance scope and service models do you offer?
- What belongs under Infrastructure Support, if anything?
- Where do you operate?

**Workforce**
- Which role categories do you supply?
- Which engagement models: contract, temp-to-hire, direct hire?
- Who employs the workers, and how are they vetted, as far as you want to say publicly?

**Company**
- Legal entity name, for the footer and legal text.
- Founding facts and leadership, if you want them shown.
- Licenses, insurance, safety programs and certifications. None are claimed today.
- Verified projects, clients or testimonials, with permission to publish.
- Social media profiles.

**Careers**
- Should the site carry an EEO statement and an accommodation contact?
- Do you want eligibility questions, such as work authorization or driver's license?
- Is a 5 MB resume limit right? It is an assumption.
- Do you want a separate subcontractor route?

## Recruitment items to confirm

- Domain spelling: the site is set to pseudocom.org, while the email is contact@seudocom.org.
- Legal review of the affidavit wording, including the Nigeria-specific statements and the blanket criminal record statement.
- Notarization partners, added from the admin console.
- Approval of the drafted job duties, assignments and interview questions.
- Legal advice on requiring nationality on the application.
- A privacy notice covering applicant data, video recordings and Google Drive sharing.
- Replacement photographs and the specific service features, which will be supplied by Seudocom.
