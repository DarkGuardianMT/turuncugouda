# TuruncuGouda project context

## Project overview and purpose

This is a complete rebuild of the website for Turuncu Café en Bakkerij in Gouda:
https://www.turuncugouda.com/. The site will present the business, its menu and
products, photos, and practical visit information, with reservations planned later.

The existing site's source code and hosting are inaccessible. We are rebuilding
from scratch in the existing GitHub repository, preserving its Git history.
The live site can be consulted later as reference material; its content is not
automatically verified or current.

## Why rebuild

Preserve recognizable branding while improving design, user experience, mobile
responsiveness, performance, accessibility, and SEO. A pixel-perfect clone is
not the goal. The gallery will be one of the largest new features.

## Current architecture decisions

- Current stable Astro, strict TypeScript, npm, and plain CSS.
- `output: 'static'` keeps public content prerendered. The official `@astrojs/node`
  standalone adapter provides runtime execution for `POST /api/reservations`,
  which opts out with `prerender = false`; no deprecated hybrid mode is used.
- MySQL/MariaDB via `mysql2/promise`; production direction is Hostinger MySQL.
- Prefer Astro components for content; add client JavaScript only for real interaction needs.
- Vue may be added later for focused interactive islands when justified.
- Hybrid navigation: main business content on `/` with anchor navigation,
  with separate digital menu and gallery pages.
- Keep content local and separate from presentation.
- Avoid abstractions, integrations, or services for features that do not exist yet.

## Planned pages and navigation — current direction

This is a working direction, not an irreversible specification. Final sections
and content will be refined with the business owner.

Homepage `/`:

- Header/navigation
- Hero
- Menu/highlights
- Over ons
- Gallery preview
- Contact, reservations guidance, and opening information
- Footer

Separate pages: `/menu` for the digital menu and `/galerij` for the photo collection.

Future reservation functionality: `/reserveren` (currently a placeholder route).

Existing bakery/product promotional sections may be removed, merged, or redesigned;
those decisions are not final. The homepage now includes structural versions of
these sections with real branding, photography, and approved business copy.
Empty extra-content and Instagram-feed placeholders have been removed for now.
`/galerij` has a captioned responsive photo grid and an accessible lightbox; `/reserveren` remains
a placeholder without reservation functionality.

Current shared navigation: Menu → `/menu`, Over ons → `/#over-ons`,
Galerij → `/galerij`, Contact → `/#contact`, and Reserveer → `/#contact`.
The hero's visit link also targets Contact. `/menu` and `/galerij` have visible active states
with `aria-current="page"`; no scroll-spy is used for homepage anchors.

## Design direction

Largely preserve the existing brand identity, including its recognizable warm/orange
character. The supplied real logo is integrated, with the current approved subtitle
`Café • Bakkerij • Lunch` kept as editable HTML text.
The visual foundation uses restrained orange, cream, warm white, and dark brown.
Warm cream is the primary page background, with slightly lighter cream sections
and a deeper warm footer surface for subtle hierarchy. White and near-white are
reserved mainly for cards, image containers, and small UI surfaces. The established
orange/brown Turuncu identity remains the basis.
CSS custom properties define palette, spacing, radii, container width, typography,
and a subtle shadow. Dark orange is used for accessible CTA backgrounds and accent
text; the brighter orange remains a decorative brand accent. System sans-serif
body text and a system serif heading font provide warmth without font downloads.
The shared brand lockup uses a circular CSS crop to hide the supplied logo's large
black margins without modifying the source image or cutting the logo. Its raster
source is retained; a clean transparent export would simplify future presentation.
The header uses its mobile disclosure below 1024px so the logo and subtitle fit
comfortably alongside navigation at tablet sizes.
The main header is sticky across all routes, with an opaque warm cream background.
CSS anchor clearance keeps homepage section headings below it. The mobile menu
opens over the content without shifting the page layout.
These are initial design decisions, not final owner-approved brand specifications.

## Data and content strategy

Initially use local TypeScript/JSON-style files in `src/data/`. The current file
contains the business name, approved subtitle, and verified contact information. Public-facing
content is primarily Dutch. Do not invent business facts, prices, opening hours,
menu items, addresses, or claims; verify real content with the owner.
No CMS is being added at this stage.

### Verified business information (8 October 2026)

Owner-provided current details are used in Contact and the footer:

- Turuncu Café en Bakkerij, Lekkenburg 67, 2804 XB Gouda, Winkelcentrum Bloemendaal
- Phone: `+31 6 36044912` with `tel:+31636044912`
- Instagram: `@turuncugouda.nl`; TikTok: `@turuncugouda`
- Monday and Sunday closed; Tuesday through Saturday `10:00–16:30`.
  Conflicting old-site references to 09:30 or around 17:00 must not be used.
- No verified email address is available; do not invent one.

Approved Over ons copy describes Turkish hospitality, Dutch gezelligheid, the
café/bakery/lunch offering, and a welcome for families and children. No founder,
opening-year, sourcing, or award claims have been added.

### Photography and menu references

Real supplied assets are kept under `src/assets/`. Local imports and Astro's
`Image` component generate optimized responsive WebP images with Dutch alt text,
explicit sizes and intrinsic dimensions. Only the primary hero photo is eager
and high priority; other photos are lazy loaded. Generated widths are capped at
source resolution. No external or generated photography is used.

Main assignments: `borek-coffee.webp` for the contained 4:3 hero, `latte-art.webp`
for Café, `ig-08.webp` for Bakkerij, `menemen.webp` for Lunch, and
`counter-tulips.webp` for Over ons. The homepage preview displays three photos on
small mobiles and six from 576px upwards;
`src/data/gallery.ts` shares image metadata with a reusable `PhotoGrid` component
and the full gallery. The gallery currently includes 13 distinct suitable photos.
The letterboxed `ig-07.webp` is preserved but not displayed.
Gallery items have short Dutch titles, descriptions, and category metadata from
the stable set Café, Bakkerij, Lunch, Zoet, and Sfeer. Uncertain products retain
generic labels; specific varieties still need owner confirmation. `/galerij` offers
category filtering with Alles selected on each page load, followed by Café,
Bakkerij, Lunch, Zoet, and Sfeer in that order where photos exist. The supported
category list is shared with the metadata type; Alles is only a filter state.
Real buttons expose selection through `aria-pressed` and an underline as well as
color, wrap on small screens, and announce the result count to assistive technology.
Filtering is instant and client-side; it neither changes the URL/history nor
persists across refreshes. The filter bar is hidden without JavaScript, leaving
all photos visible. The homepage preview stays static and
intentionally simpler, with its existing link to `/galerij` and no lightbox script.
The full gallery uses consistent 4:3 photo crops with captions underneath and
one column on small mobiles, two from 576px, and three from 1024px.
The full gallery opens with food, coffee, bakery, lunch, and atmosphere. Small
per-image presentation hints bring the latte cup into focus and preserve space
above the portrait subject's head, without changing source assets.

Both menu PNGs remain unchanged source/reference assets and are not displayed as
the menu UI. The supplied manual extraction, with publication corrections provided
by the user, is now implemented as the first structured digital menu. Gallery pagination,
CMS, and the public reservation form remain deferred.

### Digital menu

`src/data/menu.ts` stores local typed groups, categories, descriptions, numeric
prices, variants, supplements, and optional per-person units. `/menu` renders
static semantic menu lists with six native category anchor links and sticky-header
clearance. Original detailed category names remain visible under those groups.
Shared Menu navigation now links to `/menu` with the existing active-page treatment.
The homepage retains its three Café/Bakkerij/Lunch photos and a “Bekijk het menu”
CTA; it does not duplicate the full menu.

Obvious source spelling errors are normalized for publication while preserving
Turkish names and the supplied products/descriptions. Currency uses Dutch comma
decimals via `Intl.NumberFormat`. French toast, Turkse thee, and Baklava have
explicit variants; supplements display separately with a plus sign. High Tea has
editable numeric per-person prices and a separate 48-hour reservation note.
Seven unconfirmed Smoothies/Softies prices are stored as `null` and omitted from
visitor-facing output, without placeholder text or guessed prices. Confirm those
prices, the name “Warme sinass”, and current High Tea conditions with the owner.
No CMS, extra client-side menu JavaScript, email address, or WhatsApp-only
instruction is added to the menu; verified Contact remains authoritative.

### Gallery interaction

The full gallery uses one small vanilla TypeScript script and native `dialog`:
previous/next buttons and arrow keys wrap through the currently visible filtered
set, with position counts relative to that set. The visible trigger list is
captured on opening; filters cannot change while the modal is open. Closing
preserves the chosen filter and returns focus to the original visible trigger.
Escape and an explicit close button dismiss it, and a complete backdrop click also
closes it. Native modal behavior keeps background content inert and keyboard focus
inside; focus moves to Close on opening.
Root scroll overflow is locked while open and its previous inline value restored
on close; a stable scrollbar gutter avoids layout jumps. Without JavaScript or
native dialog support, photos and captions remain visible with disabled triggers.
Astro generates larger WebP versions capped at 1600px and source resolution;
their URLs are data attributes, assigned to the modal image only when requested.
No large images are preloaded. Thumbnails retain responsive Astro Image output.

## Reservation backend foundation — Phase 2

The foundation uses a create-only `POST /api/reservations` runtime endpoint,
reusable pure validation, and `src/server/reservations/reservationService.ts`.
Future `/reserveren` form and AI chatbot callers must share this validation and
service rather than duplicating business rules or connecting directly to MySQL.
The service takes validated/normalized data, uses prepared parameters, returns
only ID/status, and always inserts `pending`. Statuses are `pending`, `confirmed`,
and `cancelled`; public clients cannot choose status or database-managed fields.
There is no public reservation list/read endpoint.

`src/server/db/pool.ts` creates a lazy, reusable mysql2 Promise pool guarded by
`astro:env/server`. DB configuration is checked only on use, so static builds
need no credentials or active database. Server-side `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, and nonempty `DB_PASSWORD` are required; `DB_CONNECTION_LIMIT` defaults
to 5. `.env.example` has placeholders only. Never use public database variables.

Versioned single-statement SQL lives in `db/migrations/`; the first migration
creates reservations with contact details, date/time, guest count, message,
status, timestamps, and nonunique date/time and status indexes. `npm run db:migrate`
uses a small Node runner, filename/checksum history in `schema_migrations`, and a
database-scoped advisory lock. It neither creates/drops databases nor resets data.
DDL implicitly commits: interrupted migrations require schema/history inspection,
not an automatic reset. README contains local setup and recovery guidance.

Validation trims text, lowercases optional email, and preserves phone formatting.
Dates must be real, non-past dates in Europe/Amsterdam and Tuesday–Saturday.
Times are `>= 10:00` and `< 16:30` with no enforced slot interval or extra lead time.
Guest count is an integer 1–65535 (SQL storage limit, not confirmed capacity).
Name/phone/email/message maxima are 120/32/254/1000 characters. Email/message are
optional; unexpected fields are rejected. Requests have a 16 KiB technical body
limit and JSON-only transport. Internal errors and reservation PII are not returned
or logged. No permissive CORS configuration is added.

The public form is not connected. Reserveer still leads to Contact, while
`/reserveren` retains the verified phone, Instagram, and Contact fallback.
Admin/authentication, email notifications, capacity rules, and chatbot implementation
are deferred. Rate limiting/spam protection and form origin/CSRF handling must be
addressed before or during public-form production launch. Privacy, data retention,
and deletion policy remain production decisions.

## Hosting and deployment direction

Use GitHub for version control. Hostinger is the intended deployment target,
ideally connected to GitHub. Production requires Hostinger Node hosting/runtime
and Hostinger MySQL; the actual plan and delivery workflow remain unconfirmed.
The build produces prerendered pages/assets in `dist/client/` and a standalone
runtime in `dist/server/`; `npm start` runs its entry point. Production DB variables
must be supplied at runtime, and migrations must run against the production
database before submissions are enabled. Verify provider networking/TLS requirements
before launch; no custom database TLS configuration is supplied yet. No live
deployment, hosting integration, or CI workflow is configured by this task.

## Future AI chatbot

A lightweight AI chatbot is a later learning/feature goal, after the core site and
likely around or after reservation functionality. It may answer opening-hours,
location, menu and common café questions, guide visitors through reservation
information, and eventually integrate with a reservation backend. Nothing is
implemented or selected for it yet.

## Explicitly deferred technologies and features

- Vue integration, React, Tailwind, UI/component and animation libraries
- Sanity or another CMS, Supabase, and unrelated backend/API services
- Public reservation form, admin/authentication, capacity management, and email notifications
- Owner confirmation of remaining menu prices/product wording and High Tea conditions
- AI chatbot implementation

## Current implementation status

Public-facing frontend v1 feature implementation is functionally complete after
the focused polish checkpoint of 15 October 2026. Browser acceptance of this pass
and the remaining owner content confirmations are still outstanding. Phase 2 now
includes the reservation backend foundation; public form, admin, email, CMS,
deployment, and chatbot remain separate future tasks.

- Official minimal Astro starter incorporated in the existing repository root.
- Existing README identity and Git history preserved; README expanded for developers.
- `/` contains hero, menu/highlights, Over ons, gallery preview, and verified Contact
  information, followed by the shared footer. Empty extra-content and social-feed
  placeholders are removed. The header is compact and mobile category photos are shorter.
  The hero uses “Turuncu Café en Bakkerij”, the approved brand subtitle, and a real
  börek/coffee photograph, with “Bekijk de galerij” and “Bezoek ons” CTAs.
  Contact includes approved address, hours, phone, social links, Google Maps directions,
  and reservation guidance. Over ons has real approved copy. The menu section is
  a visual preview linking to the dedicated menu page.
- `/menu` renders the supplied structured menu with grouped anchor navigation,
  variant/supplement prices, and intentionally omitted unconfirmed prices.
- `/galerij` has category filters, 13 captioned photos and a native accessible lightbox, a neutral
  Dutch introduction, and the shared layout. `/reserveren` remains a clearly marked placeholder.
- Reusable `src/layouts/BaseLayout.astro`, `SiteHeader`, `SiteFooter`, and `Section`
  components, plus shared `Brand` and `PhotoGrid`, global CSS patterns, and local data.
- Mobile-first layouts stack on small screens and use grids at wider widths.
  Shared navigation uses native JavaScript only for the mobile disclosure, with
  ARIA state, keyboard controls, Escape-to-close, link selection closure, and a
  visible navigation fallback when JavaScript is disabled. A skip link and visible
  focus styles are included.
- Strict TypeScript configuration and npm development, check, build, and preview scripts.
- `public/` is available for future static assets and currently empty. Git does not
  track empty directories; create it when adding assets in a fresh clone.
- `src/assets/` contains the untouched supplied logo, photographs, and menu references.
- Root `AGENTS.md` and this document provide persistent project guidance.
- Build output, Astro generated types, dependencies, logs, and local environment
  files are ignored. No secrets or deployment credentials are included.

### Installed versions and initial setup verification (7 October 2026)

- Astro `7.3.6` (current stable npm release at initialization)
- TypeScript `6.0.3` (supported by the checker; TypeScript 7 is not yet supported)
- `@astrojs/check` `0.9.10` (development-only Astro/TypeScript validation)
- Verified with Node.js `24.11.0` and npm `11.6.1`.
- `npm run check`: zero errors, warnings, or hints.
- `npm run build`: succeeded; one static homepage generated.
- Development HTTP smoke check: `/` returns 200 with Dutch language and the expected placeholder.
- Production preview: `/` returns 200 with the expected placeholder and no client-side scripts.
- Clean `npm ci` from the lockfile succeeded.
- Installation audit: zero reported vulnerabilities.
- Astro telemetry was disabled via the session environment during verification
  because the sandbox cannot write to the user-level Astro configuration folder.
  This does not change the project scripts or production output.

## Visual foundation verification (7 October 2026)

- Astro/type checks pass without errors, warnings, or hints; static build generates three pages.
- Browser checks cover `/`, `/galerij`, and `/reserveren` at 320, 390, 768, and
  1440 pixels: no horizontal overflow, one main landmark and one H1 per page.
- Mobile keyboard toggle, Escape/focus return, anchor selection closure, viewport
  changes, and navigation with JavaScript disabled are verified.
- Final production preview passes the same responsive and interaction checks.
  Homepage screenshots reviewed at mobile and desktop sizes, along with both
  placeholder routes. No browser errors.
- No dependencies, web fonts, heavy images, or framework integrations added.
- Real content, logo, imagery, gallery functionality, and reservation functionality
  remain for subsequent tasks.

## Brand and photography checkpoint verification (8 October 2026)

- Astro/type checks: zero errors, warnings, or hints; build produces three static pages.
- Production browser checks at 320, 375, 768, 1024, and 1440px verify all routes,
  loaded images, logo/subtitle, mobile keyboard navigation, and no horizontal overflow.
- Mobile navigation also remains available without JavaScript.
- Homepage and gallery screenshots reviewed for subject crops and logo presentation.
- All 17 supplied source assets verified unchanged by SHA-256 comparison.
- Menu reference images and the unused letterboxed photo are absent from the build.
- No dependencies added; responsive outputs keep original source files intact.

## Verified business content checkpoint (8 October 2026)

- Astro/type checks pass with zero errors, warnings, or hints; static build succeeds.
- Production browser checks cover all three routes at 320, 375, 768, 1024, and 1440px,
  including all header links, Contact anchors, Reserveer routing, phone links,
  gallery active state, mobile keyboard/Escape behavior, and no horizontal overflow.
- Header measures 97px on mobile/tablet and 105px on desktop. The 320px homepage is
  approximately 20% shorter than the preceding checkpoint; preview count is three
  on small mobiles and six on larger screens. All 13 full-gallery photos remain.
- Screenshots reviewed for image crops, opening-hours layout, logo, and subtitle.
- Source-asset hashes remain unchanged. No dependencies added; online booking and
  final menu extraction remain deferred.

## Gallery lightbox checkpoint (14 October 2026)

- Astro/type checks pass without errors, warnings, or hints; production build
  generates all three static routes.
- HTTP smoke checks pass for `/`, `/galerij/`, and `/reserveren/`. Generated output
  has all 13 captioned photos, valid large-image assets/dimensions, no initial
  large-image sources, and the unchanged six-image static homepage preview.
- A temporary Node event harness exercises the actual lightbox script: all 13
  metadata updates, button/arrow navigation and wrapping, close/backdrop handlers,
  opener focus and previous overflow restoration, and image load/error handling.
- Source photography/menu assets and dependencies remain unchanged.
- Browser verification is still pending: this session exposed no browser surfaces,
  and both in-app browser and Chrome creation returned unavailable. Actual 320px,
  375px, tablet and desktop rendering, crops, overflow, native keyboard activation,
  Escape, focus containment and page scroll behavior require a browser check.

## Digital menu checkpoint (14 October 2026)

- Astro/type checks pass with zero diagnostics; the static build generates four pages.
- HTTP checks pass for all four routes. Generated output checks cover all 91 menu
  items/descriptions, 94 displayed prices, variants/supplements, seven omitted
  null prices, six category anchors, shared navigation/active state, and homepage CTA.
- The 101 numeric/null price fields match the supplied implementation request.
  Gallery filter/navigation checks still pass; source assets and dependencies are unchanged.
- Browser rendering at 320px, 375px, tablet and desktop, keyboard interaction,
  actual anchor clearance and overflow remain pending: no browser surfaces were
  exposed, and opening Chrome returned unavailable.

## Reservation foundation verification (17 October 2026)

- Dependencies: `@astrojs/node` 11.1.8 (Astro 7-compatible) and `mysql2` 3.24.6;
  Astro remains 7.3.6. Installation audit reports no vulnerabilities.
- Astro/type checks pass with zero errors, warnings, or hints. All 40 native Node
  tests pass, covering normalization, field bounds/types, rejected managed fields,
  opening hours, real dates, closed days, leap years, Amsterdam midnight boundaries,
  same-day behavior, and lazy configuration validation.
- Credential-free Node adapter build succeeds, prerenders the same four public
  pages, and generates/reuses 69 optimized images. A temporary client-script import
  of the actual reservation service fails the build on `astro:env/server`, as required;
  the temporary page is removed after verification.
- Built standalone HTTP checks pass for all four public routes and linked assets,
  Dutch document language, main/H1 landmarks, unchanged reservation fallback, gallery
  filter/lightbox markup and 13 image triggers. API checks cover invalid/missing JSON,
  validation failures, managed-field rejection, body size, content type, unsupported
  methods, absent permissive CORS, and generic missing-DB errors with no internal data.
- No local DB variables or credentials were available. The migration command fails
  clearly on missing `DB_HOST`; live SQL application/repeat-run, successful HTTP 201,
  stored `pending` status, and targeted test-row cleanup remain unverified until a
  dedicated empty database and local `.env` credentials are provided.
- Frontend source/assets/styles are unchanged. Actual sticky-header, filter/lightbox
  interaction and responsive browser regression remain pending: no browser surfaces
  are exposed and opening Chrome returns unavailable.
- No production deployment, public form connection, admin, authentication, email,
  or chatbot implementation is included.

## Near-term roadmap

1. Confirm remaining Smoothies/Softies prices, product wording, High Tea conditions,
   and any additional business content with the owner.
2. Refine homepage sections, anchor navigation, and responsive design direction.
3. Refine the homepage, digital menu, and gallery incrementally using local data.
4. Confirm Hostinger capabilities and establish the GitHub deployment workflow.
5. Verify the reservation foundation against a local MySQL/MariaDB database, then
   connect the public form in a separate checkpoint with launch safeguards.

## Important unresolved decisions

- Final homepage sections and the fate of existing promotional sections
- Remaining menu prices/product wording, High Tea conditions, and any future email contact
- Final design tokens, gallery organization, and any additional high-resolution photo assets
- Hostinger plan, GitHub deployment integration, and future server capabilities
- Reservation operations/capacity, public-form launch safeguards, retention policy,
  admin workflow, and notification requirements

Update this document whenever significant architecture, scope, feature, or status
decisions change.
