# TuruncuGouda project context

## Project overview and purpose

This is a complete rebuild of the website for Turuncu Café en Bakkerij in Gouda:
https://www.turuncugouda.com/. The site will present the business, its menu and
products, photos, practical visit information, and a public reservation-request form.

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
  which opts out with `prerender = false`; admin pages/actions do likewise. No deprecated hybrid mode is used.
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

Reservation requests: `/reserveren`, connected to the existing create-only API.

Existing bakery/product promotional sections may be removed, merged, or redesigned;
those decisions are not final. The homepage now includes structural versions of
these sections with real branding, photography, and approved business copy.
Empty extra-content and Instagram-feed placeholders have been removed for now.
`/galerij` has a captioned responsive photo grid and an accessible lightbox;
`/reserveren` accepts requests awaiting confirmation by Turuncu.

Current shared navigation: Menu → `/menu`, Over ons → `/#over-ons`,
Galerij → `/galerij`, Contact → `/#contact`, and Reserveer → `/reserveren`.
The hero's visit link still targets Contact. `/menu`, `/galerij`, and Reserveer have visible active states
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
and CMS remain deferred; the public reservation form is now connected separately.

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
The `/reserveren` form uses this API; future AI chatbot callers must share the
validation and service rather than duplicating business rules or connecting directly to MySQL.
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

### Public reservation form

`/reserveren` uses a semantic form and focused vanilla TypeScript. It POSTs the
existing JSON contract, maps authoritative server field errors to native controls,
prevents simultaneous submission, and replaces the form with a received-request
panel on HTTP 201. Personal fields are reset; the summary contains date, desired
time, and party size only. A successful request remains `pending`, never automatically
confirmed or guaranteed a table. A new-request action starts with empty fields.

The UI offers 30-minute desired-time options from 10:00 through 16:00. Backend
minute rules remain unchanged. Pure helpers in `src/lib/reservationDate.ts` share
Amsterdam date/minimum and closed-day feedback with server validation. Email and
message remain optional. No restaurant capacity, special High Tea rule, or response
time is invented; High Tea conditions remain separate and need owner confirmation.

The header Reserveer CTA and homepage primary reservation action now link to
`/reserveren`; ordinary Contact links retain their destination. Verified phone,
Instagram, and Contact alternatives remain usable without JavaScript. Before
enhancement the fieldset is disabled, preventing accidental non-JSON submissions.
A concise data-use note is shown beside Submit, without inventing a full privacy policy.

The transport-only `contact_url` honeypot is hidden, unfocusable, and excluded from
reservation data. Empty/absent values reach normal validation; filled or mistyped
values receive a generic 400 `INVALID_REQUEST` before creation, without describing
the trap. Status/ID/timestamp injection remains rejected. The API rejects a supplied
Origin that differs from the request URL's origin and cross-site fetch metadata;
Origin-less non-browser clients remain supported. No CORS permissions are added
by the application. Hostinger must preserve the external host/scheme through its
trusted proxy, and real HTTPS same-origin requests must be verified before launch.
The installed Node adapter normalizes unlisted hosts to localhost; standalone
local checks use localhost. Configure the canonical allowed host and verify URL
scheme reconstruction after TLS termination when hosting is known. Until then,
Origin mismatches fail closed; no arbitrary forwarded-header trust is introduced.

Production rate limiting remains required before public launch; the public API has
no in-memory/distributed limiter or CAPTCHA. The separate admin workflow below has
a local login safeguard. Email, capacity management, and chatbot implementation
are deferred. Privacy, retention,
deletion, and any further spam protection remain production decisions.

## Minimal local reservation admin (19 October 2026)

- `/admin/login` and `/admin/reservations` are runtime-rendered Astro pages, with
  POST-only login/logout/status endpoints under `/admin`. Public content remains
  prerendered; no reservation records are included in static output or a public list API.
- One administrator is configured with server-only `ADMIN_USERNAME`,
  `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET`. Node scrypt uses N=32768/r=8/p=1,
  a random 32-byte salt and 64-byte key. `npm run admin:hash-password` prompts twice
  with hidden terminal input and emits the encoded hash; no plaintext is stored.
  The format `scrypt:32768:8:1:<salt-hex>:<key-hex>` avoids Astro/Vite dollar expansion
  and works unchanged in the shared `.env` with Node's env-file loader.
- Authentication uses HMAC-SHA256 signed HttpOnly, SameSite=Strict cookies scoped
  to `/admin`, expiring after ten hours. Secure is required in production/HTTPS;
  local development HTTP works. Identity/hash/secret changes invalidate sessions.
  Logout expires the browser cookie. There is no session registry: copied cookies
  remain valid until expiry or credential rotation.
- Every protected request validates the session. Admin POSTs require exact Origin
  checking shared with the public API (which retains its Origin-less client support).
  Authenticated mutations additionally require a signed, session-bound CSRF token.
  Login has a bounded in-memory five-attempt/15-minute safeguard per adapter client
  address. It resets on restart, is not shared across instances, and is not
  production-grade rate limiting.
- The focused admin service reuses the existing pool and parameterized queries.
  Cards list today/future dates using Europe/Amsterdam, ordered by visit date/time
  then creation time. Creation timestamps are converted from SQL epoch values and
  displayed in Amsterdam time. Validated query filters support all three statuses.
  Contact links and escaped plain-text messages are included.
- Allowed transitions are pending → confirmed/cancelled and confirmed → cancelled.
  Updates compare the expected current status and report stale submissions. Statuses
  remain pending/confirmed/cancelled; cancelled rows are retained. No deletion UI,
  schema migration, notifications, scheduling, roles, registration, or recovery exists.
- Admin responses are no-store/noindex/nofollow, suppress referrers and framing,
  and contain no reservation PII in metadata. Configuration/DB errors fail safely;
  logs avoid credentials, SQL and customer payloads. The application account needs
  SELECT/INSERT and UPDATE(status); DELETE is only for explicit local test cleanup.
- README documents setup and opt-in `npm run test:admin-integration`, which uses
  temporary credentials only in child-process memory and exact-ID/marker cleanup.
  Existing local `.env` credentials are preserved; manual login requires setting
  a chosen password through the helper. No real admin credentials are committed.
- Email/SMS remain absent; the owner must contact guests separately. Future
  notifications may use Hostinger SMTP once available. Database state is authoritative;
  future notification failure must not roll back successful writes. No SMTP package
  or configuration has been added.
- Production authentication, durable upstream rate limiting, HTTPS/Secure cookies,
  canonical hosts, reverse-proxy Origin/client-IP handling, and privacy/retention
  policy still require review before deployment. Browser acceptance remains pending
  because no browser surface is available and Chrome creation fails in this session.

Verification for this checkpoint: Astro/type checks have zero diagnostics; all
77 native Node tests pass, including the original 65 public reservation tests.
Credential-free build succeeds with four static public pages and no admin HTML.
Local MariaDB/built-runtime checks pass for authentication, cookie flags, CSRF,
safe configuration/database failures, escaped messages, date/status filters,
public creation remaining pending, honeypot/Origin/managed-field rejection,
confirm, stale update refusal, cancel, logout, and the local login limiter.
Only UPDATE(status) on turuncugouda.reservations was added to the existing local
application account with user authorization; SHOW GRANTS and a no-match UPDATE
verified it. Temporary records are removed by exact ID/test marker and the starting
row count is restored. Local `.env`, existing rows, schema and migration history
are unchanged. Actual responsive rendering at 320/375/768/1440px, keyboard behavior,
and header/gallery/form browser interactions remain unverified. An existing Astro
development process was left running; the integration harness uses isolated built servers.

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
- Capacity management and email notifications
- Owner confirmation of remaining menu prices/product wording and High Tea conditions
- AI chatbot implementation

## Current implementation status

Public-facing frontend v1 feature implementation is functionally complete after
the focused polish checkpoint of 15 October 2026. Browser acceptance of this pass
and the remaining owner content confirmations are still outstanding. Phase 2 now
includes the verified reservation backend and connected public request form;
the minimal local admin workflow is implemented. Email, CMS, deployment, and chatbot
remain separate future tasks.

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
  Dutch introduction, and the shared layout. `/reserveren` now has the public request form.
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

## Public reservation form verification (17 October 2026)

- No dependencies added. Astro/type checks pass without diagnostics; all 65 native
  Node tests pass, retaining the original 40 validation/configuration tests.
  New tests cover transport guards and the actual form controller with DOM stubs:
  inline errors/focus, date feedback, payload mapping, submission locking, reset,
  success summary, new request, server errors, network failure, and malformed responses.
  These automated controller checks do not replace browser verification.
- Build succeeds with the same four prerendered pages and 69 optimized image outputs.
  Standalone HTTP checks cover every route/linked asset, actual form labels and
  required/optional attributes, autocomplete, described errors, 13 desired-time
  choices, disabled no-JS submission, confirmation wording, navigation/CTAs, and
  existing gallery filter/lightbox markup. Safely invalid runtime DB configuration
  returns a generic 500 without internal details; production responses add no CORS.
- Real local XAMPP MariaDB integration returns HTTP 201 for a same-origin public-form
  payload and stores normalized values/timestamps with status pending. Invalid
  dates, closed days, contact fields, status/ID injection, honeypots, and wrong
  origins create no additional rows. Each temporary successful row is deleted only
  by its returned ID with a matching test marker; removal is verified. Existing
  schema, migration history, credentials, and unrelated databases are retained.
- Actual rendering at 320/375/768/1440px, browser keyboard navigation, focus visibility,
  native control behavior, and gallery/header interaction regression remain pending:
  no browser surfaces are exposed and opening Chrome is unavailable. CSS stacks
  controls on small screens, uses native controls and 48px targets, and preserves
  existing tokens, focus styling, and shared navigation logic.
- No admin/authentication, email/SMS, automatic confirmation, capacity scheduling,
  chatbot, CMS, or deployment is included. Production rate limiting, host/HTTPS
  proxy verification, and privacy/retention policy remain launch requirements.

## Near-term roadmap

1. Confirm remaining Smoothies/Softies prices, product wording, High Tea conditions,
   and any additional business content with the owner.
2. Refine homepage sections, anchor navigation, and responsive design direction.
3. Refine the homepage, digital menu, and gallery incrementally using local data.
4. Confirm Hostinger capabilities and establish the GitHub deployment workflow.
5. Verify the public form in a browser, confirm reservation operations with the
   owner, and add production rate limiting and privacy safeguards before launch.

## Important unresolved decisions

- Final homepage sections and the fate of existing promotional sections
- Remaining menu prices/product wording, High Tea conditions, and any future email contact
- Final design tokens, gallery organization, and any additional high-resolution photo assets
- Hostinger plan, GitHub deployment integration, and future server capabilities
- Reservation operations/capacity, public-form launch safeguards, retention policy,
  admin workflow, and notification requirements

Update this document whenever significant architecture, scope, feature, or status
decisions change.
