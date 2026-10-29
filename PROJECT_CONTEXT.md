# TuruncuGouda project context

## CURRENT STATUS — 29 October 2026

This section is the authoritative status summary. Dated checkpoints below record
earlier decisions and evidence; their test counts and pending items apply to those
snapshots. Technical contracts, commands and operational procedures belong in
[Development and operations](docs/DEVELOPMENT.md).

- **Implemented:** Astro 7, strict TypeScript, the Node standalone adapter,
  MySQL/MariaDB through mysql2, Nodemailer and plain CSS. Public content is
  prerendered; reservation API and protected admin routes run on the server.
  The five public pages are `/`, `/menu`, `/galerij`, `/reserveren` and `/privacy`.
  Responsive layouts include the homepage favorites/ticker, High Tea highlight,
  printed/text menu, filtered gallery/lightbox, shared footer and favicon set.
  Reservation requests start `pending`; protected admin supports `confirmed` and
  `cancelled` transitions. Internal SMTP alerts and persistent database rate
  limiting for reservation/login POSTs, including migration 003, are implemented.
- **Locally tested:** the 27 October audit of main commit
  `e4b609483fa33d5fb00e86a3549b8a2dc2e766c8` records 168/168 native Node tests,
  zero Astro check diagnostics, and passing build and SEO checks. Prior isolated
  local DB integrations exercised creation, admin/session/CSRF/status flows,
  retention and durable quotas across processes/restarts. These are local results.
- **Production verified within audit scope:** the site is deployed on Hostinger
  at `https://www.turuncugouda.com/`; GitHub `main` automatically deploys there.
  All five public pages returned 200; public content and SEO endpoints were
  checked, and unauthenticated admin reservations redirected to login. Live checks
  used GET requests and harmless UI interactions; they did not prove backend acceptance.
- **Pending live verification:** a successful reservation POST/stored pending row,
  authenticated admin session/status update, SMTP acceptance and inbox receipt,
  actual DB grants, trusted proxy `clientAddress`, shared production quotas,
  backup and isolated restore. The owner previously reported migration 003/history
  and `RATE_LIMIT_SECRET` ready; that report does not verify runtime access or quotas.
  Deployment is complete; end-to-end production acceptance remains open.
- **A03 locally verified — 27 October:** remediation on baseline
  `726a86077feb53de7760d197cdad23a53ddb0c3c` updates only lockfile entries for
  undici 8.11.2 → 8.12.3, zod 4.6.5 → 4.6.7 and fast-uri 3.1.8 → 3.1.9 within
  existing ranges. The fresh baseline audit found two High/one Moderate affected
  packages, covering 13 advisories; after clean installation, full and production-only
  npm audits report zero vulnerabilities. Under Node 22.19.0, all 168 tests pass,
  Astro check has zero diagnostics, and build/SEO verification pass in an isolated
  copy without project environment files or production services. Direct dependencies,
  application code and runtime requirements are unchanged; no overrides were added.
  Undici already required Node >=22.19.0 before this update; confirm the actual
  Hostinger Node 22 patch version before a release. These fixes are local only,
  awaiting explicit commit/push approval; production has not received them.
- **A05 locally implemented — 29 October:** the owner approved retaining personal
  reservation data for 90 days after the reservation date. Dutch privacy copy now
  explains anonymizing name, phone, email and message, retaining non-personal
  statistics, and exceptions for legal obligations or unresolved disputes. The
  existing manual cleanup service/CLI were reviewed and remain unchanged: explicit
  exclusive cutoff, count-only default, separate maintenance credentials and no PII
  in logs. The monthly procedure calculates today's Amsterdam date minus 90 calendar
  days, reviews the dry-run count and requires backup and separate explicit approval
  before each production apply. Bulk cleanup has no per-record holds: stop if an
  exception applies. Mail copies need manual retention management; backups follow
  their separate retention/rotation policy. No automatic cleanup or cron was added.
  No database was connected, no records changed and no release performed for A05.
  Assign the monthly operator and confirm mailbox/backup ownership before operations;
  production maintenance remains outstanding. See the linked manual procedure below.
  Local verification under Node 24.11.0: 168/168 database-free tests, zero Astro
  diagnostics, build, built privacy wording, SEO/HTTP checks, 25 relative Markdown
  links/anchors and cutoff examples pass. HTTP checks required local loopback access
  outside the restricted sandbox; no DB integration or cleanup command was run.
- **Owner-dependent/deferred:** maintenance ownership, remaining prices/High Tea
  conditions and reservation policy require confirmation.
  Guest emails, past-reservation admin view, capacity features, CMS and chatbot
  remain unimplemented; see the prioritized backlog below.

Never commit or push without explicit user approval: `main` auto-deploys to
Hostinger production. Historical publication approvals below apply only to their
original tasks. See [agent guidance](AGENTS.md).

## Project overview and purpose

This is a complete rebuild of the website for Turuncu Café en Bakkerij in Gouda:
https://www.turuncugouda.com/. The site presents the business, its menu and
products, photos, practical visit information, and a public reservation-request form.

The original site's source code and hosting were inaccessible. The rebuild was
created in the existing GitHub repository, preserving its history, and is now live
on Hostinger. Legacy-site content is reference material, not automatically verified
or current business information.

## Why rebuild

Preserve recognizable branding while improving design, user experience, mobile
responsiveness, performance, accessibility, and SEO. A pixel-perfect clone is
not the goal. The gallery is one of the implemented core features.

## Current architecture decisions

- Astro 7, strict TypeScript, npm, and plain CSS; the lockfile records installed versions.
- `output: 'static'` keeps public content prerendered. The official `@astrojs/node`
  standalone adapter provides runtime execution for `POST /api/reservations`,
  which opts out with `prerender = false`; admin pages/actions do likewise. No deprecated hybrid mode is used.
- MySQL/MariaDB via `mysql2/promise`, with Hostinger MySQL as the production database.
- Nodemailer provides server-only internal reservation notifications over SMTP.
- Prefer Astro components for content; add client JavaScript only for real interaction needs.
- Vue may be added later for focused interactive islands when justified.
- Hybrid navigation: main business content on `/` with anchor navigation,
  with separate digital menu and gallery pages.
- Keep content local and separate from presentation.
- Avoid abstractions, integrations, or services for features that do not exist yet.

## Implemented pages and navigation

The current structure is implemented. Further content changes require verified
business information and agreement with the owner.

Homepage `/` (redesign approved for publication on 23 October 2026):

- Header/navigation
- Hero
- Product-name ticker in warm dark brown with cream text and orange ornaments
- Compact nine-image favorites preview; the section label is screen-reader-only
- High Tea highlight with approved temporary AI image
- Over ons
- Contact, reservations guidance, and opening information
- Footer

Separate pages: `/menu` for the digital menu and `/galerij` for the photo collection.
`/privacy` describes reservation-data use and is linked from the form and footer.

Reservation requests: `/reserveren`, connected to the existing create-only API.

The homepage uses real branding, supplied photography and approved business copy;
the favorites mosaic replaces the earlier Café/Bakkerij/Lunch promotional cards.
Empty extra-content and Instagram-feed placeholders have been removed for now.
`/galerij` has a captioned responsive photo grid and an accessible lightbox;
`/reserveren` accepts requests awaiting confirmation by Turuncu.

Current shared navigation: Menu → `/menu`, Over ons → `/#over-ons`,
Galerij → `/galerij`, Contact → `/#contact`, and Reserveer → `/reserveren`.
The hero's visit link still targets Contact. `/menu`, `/galerij`, and Reserveer have visible active states
with `aria-current="page"`; no scroll-spy is used for homepage anchors.

## Design direction

Largely preserve the existing brand identity, including its recognizable warm/orange
character. The supplied real logo is integrated. In the local redesign, the header
uses `Turuncu maakt u blij` in warm dark-orange, regular italic Georgia with compact
balanced wrapping; `Café • Bakkerij • Lunch` remains in the hero and footer.
The visual foundation uses restrained orange, cream, warm white, and dark brown.
Warm cream is the primary page background, with slightly lighter cream sections
and a dark-brown footer with cream text. White and near-white are
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

Use local typed data in `src/data/` for business information, menu and photo metadata.
This includes the business name, approved subtitle, and verified contact information. Public-facing
content is primarily Dutch. Do not invent business facts, prices, opening hours,
menu items, addresses, or claims; verify real content with the owner.
No CMS is being added at this stage.

### Verified business information (8 October 2026)

Owner-provided current details are used in Contact and the footer:

- Turuncu Café en Bakkerij, Lekkenburg 67, 2804 XB Gouda, Winkelcentrum Bloemendaal
- Phone: `+31 6 36044912` with `tel:+31636044912`
- Preferred direct contact: WhatsApp, centralized as `site.whatsappHref`
  (`https://wa.me/31636044912`); phone remains visible as secondary information.
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
source resolution. The general gallery uses real supplied photography. The approved
High Tea highlight alone uses an owner-supplied temporary AI image.

Main assignments: `borek-coffee.webp` for the contained 4:3 hero, `latte-art.webp`
for Café, `ig-08.webp` for Bakkerij, `menemen.webp` for Lunch, and
`counter-tulips.webp` for Over ons. The local homepage redesign displays nine
favorites at every width in a single compact mosaic. `src/data/favorites.ts`
reuses existing gallery metadata and adds a generic coffee label for `ig-07.webp`;
its thumbnail framing avoids the letterbox edge without modifying the source.
`src/data/gallery.ts` continues to share metadata with the reusable `PhotoGrid`
and the unchanged 13-photo gallery.
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
all photos visible. The local homepage favorites reuse `PhotoGrid` and the same
`GalleryLightbox` component, with nine photos and one grid. Category headings,
captions, item names and zoom labels are absent from the visible homepage grid;
accessible button names and image metadata remain available to the lightbox.
The section retains a screen-reader-only h2. The standalone gallery's defaults
remain unchanged, with h2 captions, descriptions and its existing filters.
The full gallery uses consistent 4:3 photo crops with captions underneath and
one column on small mobiles, two from 576px, and three from 1024px.
The full gallery opens with food, coffee, bakery, lunch, and atmosphere. Small
per-image presentation hints bring the latte cup into focus and preserve space
above the portrait subject's head, without changing source assets.

Both menu PNGs remain unchanged source/reference assets. The approved menu redesign
uses two website-specific cropped sheets as its primary UI, with the existing structured
digital menu in a collapsed disclosure below. The supplied manual extraction and
publication corrections remain unchanged. Gallery pagination,
and CMS remain deferred; the public reservation form is now connected separately.

### Digital menu

`src/data/menu.ts` stores local typed groups, categories, descriptions, numeric
prices, variants, supplements, and optional per-person units. `/menu` retains
static semantic menu lists with six native category anchor links inside the optional
text disclosure, with sticky-header
clearance. Original detailed category names remain visible under those groups.
Shared Menu navigation now links to `/menu` with the existing active-page treatment.
The local homepage favorites replace the previous Café/Bakkerij/Lunch highlights;
the shared navigation still links directly to `/menu`. The homepage does not
duplicate the full menu.

Obvious source spelling errors are normalized for publication while preserving
Turkish names and the supplied products/descriptions. Currency uses Dutch comma
decimals via `Intl.NumberFormat`. French toast, Turkse thee, and Baklava have
explicit variants; supplements display separately with a plus sign. High Tea has
editable numeric per-person prices and a separate 48-hour reservation note.
Seven unconfirmed Smoothies/Softies prices are stored as `null` and omitted from
visitor-facing output, without placeholder text or guessed prices. Confirm those
prices, the name “Warme sinass”, and current High Tea conditions with the owner.
No CMS or business-data changes are included. The artwork viewer adds a
small menu-only script; verified Contact remains authoritative. The printed artwork
contains its original contact wording and some prices absent from the corrected
structured data. Both versions are preserved in the owner-approved presentation;
any future reconciliation requires verified business corrections.

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

## Implemented reservation backend

The create-only public reservation API and connected form share reusable validation
and a server-only service. Database access is lazy and parameterized, so public
builds require no credentials. New requests always start `pending`; the public
API exposes neither reservation records nor database-managed field control.
Dates use Europe/Amsterdam and verified opening hours. Desired times are requests,
not capacity availability; no extra High Tea lead-time rule is enforced by the API.

The form provides field errors, prevents duplicate concurrent submission and shows
received-request wording after success. It never promises a confirmed booking.
WhatsApp/phone remain available when JavaScript is absent. The protected admin
lists today/future requests, validates status transitions and stale updates, and
requires server authentication, exact Origin checks and session-bound CSRF for
mutations. The administrator contacts guests separately after status changes.

Migrations 001/002/003 cover reservations, manual anonymization and persistent rate
limiting. The shared database limiter protects reservation and login POSTs, fails
closed, and stores HMAC-derived address identifiers rather than raw IPs. Internal
SMTP notification follows storage; failure preserves the pending row and API success.
The owner-approved 90-day retention policy uses manual anonymization; operational
execution and production acceptance remain open as listed above.

See [local setup and API contracts](docs/DEVELOPMENT.md#local-reservation-backend-setup),
[admin security](docs/DEVELOPMENT.md#local-reservation-admin-setup),
[rate limiting](docs/DEVELOPMENT.md#durable-rate-limiting),
[SMTP](docs/DEVELOPMENT.md#reservation-notification-email) and
[manual retention](docs/DEVELOPMENT.md#reservation-privacy-and-manual-retention-maintenance)
for detailed procedures. Do not duplicate operational instructions here.

## Historical implementation checkpoints

The dated sections through the homepage redesign preserve major decisions and
verification evidence from 19–25 October. Statements about unavailable features,
local browser tooling, publication approval or outstanding launch work describe
that checkpoint only; use CURRENT STATUS for today's implementation and acceptance.
Historical “production build/preview” checks mean a local built server unless live
Hostinger verification is explicitly stated. Old test counts and dependency audits
are historical observations, not current assurance.

## Historical checkpoint: Minimal local reservation admin (19 October 2026)

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
  Login originally used a process-memory limiter at this checkpoint. The shared
  durable MySQL five-attempt/15-minute limiter replaced it on 24 October, resetting
  the login subject before session issuance after successful authentication.
- The focused admin service reuses the existing pool and parameterized queries.
  Cards list today/future dates using Europe/Amsterdam, ordered by visit date/time
  then creation time. Creation timestamps are converted from SQL epoch values and
  displayed in Amsterdam time. Validated query filters support all three statuses.
  Contact links and escaped plain-text messages are included.
- Allowed transitions are pending → confirmed/cancelled and confirmed → cancelled.
  Updates compare the expected current status and report stale submissions. Statuses
  remain pending/confirmed/cancelled; cancelled rows are retained. No deletion UI,
  schema migration, notifications, scheduling, roles, registration, or recovery exists.
- Admin responses are no-store/noindex/nofollow and prevent framing. They use
  `Referrer-Policy: same-origin` so native same-origin HTML form POSTs remain compatible
  with strict Origin validation while cross-origin referrer leakage is suppressed,
  and contain no reservation PII in metadata. Configuration/DB errors fail safely;
  logs avoid credentials, SQL and customer payloads. The application account needs
  SELECT/INSERT and UPDATE(status) on reservations; reservation-row DELETE is only
  for explicit local test cleanup. The later limiter needs separate table grants.
- Development and operations documents setup and opt-in `npm run test:admin-integration`, which uses
  temporary credentials only in child-process memory and exact-ID/marker cleanup.
  Existing local `.env` credentials are preserved; manual login requires setting
  a chosen password through the helper. No real admin credentials are committed.
- At this checkpoint email/SMS were absent. Internal SMTP notifications were added
  on 23 October; guest emails and status-change notifications remain deferred.
  Database state stays authoritative and mail failure must not roll back writes.
- This local checkpoint did not verify production authentication, HTTPS/Secure
  cookies, proxy/client IPs or privacy/retention operations. Durable database
  limiting was added later; its live acceptance is still open. Browser tooling was
  unavailable during this checkpoint; later local reviews are recorded below.

Verification for this checkpoint: Astro/type checks have zero diagnostics; all
78 native Node tests pass, including the original 65 public reservation tests and
the admin security-header regression added on 20 October 2026.
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

## Historical checkpoint: Reservation privacy and retention foundation (20 October 2026)

- Public `/privacy` describes the actual reservation fields and their use for
  request handling, contact and internal status management. The form note and
  shared public footer link to it. No consent checkbox or cookie banner is added.
- The exact retention period remains an unresolved owner decision for live operations.
  No automatic cleanup, scheduled deletion or cron exists. Anonymization is
  preferred over row deletion, retaining minimal reservation history.
- Non-destructive migration 002 permits NULL name/phone and adds `anonymized_at`;
  migration 001 is unchanged. Public validation still requires name/phone.
- `npm run reservations:cleanup -- --before=YYYY-MM-DD` is count-only by default;
  only `--apply` permits changes. The cutoff is mandatory and exclusive; future
  cutoffs are rejected and SQL independently excludes today/future Amsterdam dates.
  All old statuses can be processed. Name/phone/email/message become NULL, marked
  rows are skipped, and operational fields/creation time remain. Logs contain counts
  and cutoff only. No DELETE, reset or migration-history changes occur in cleanup.
- Maintenance requires explicit `MAINTENANCE_DB_USER`/`MAINTENANCE_DB_PASSWORD`,
  shares DB location settings, and never falls back to app credentials. A separate
  least-privilege account needs SELECT and UPDATE of the personal columns and marker.
  Explicit empty maintenance passwords are allowed only for local loopback hosts.
  Runtime credentials and privileges remain unchanged. `db:migrate -- --maintenance`
  supports a separately privileged schema-maintenance connection.
- Admin rendering suppresses all contact/message fields on marked rows and uses
  “Geanonimiseerd”; no archive, per-record cleanup or deletion UI is introduced.
- SMTP, deployment and durable rate limiting were separate work at this checkpoint
  and have since been implemented. Production acceptance and a concrete retention
  policy remain open; privacy copy must reflect actual use.

Verification: migration 002 applied locally through the existing runner and a
second run skipped both migrations. All 86 native Node tests pass, including the
previous 78. Astro/type checks have no diagnostics; the build prerenders five
public pages. Real local CLI tests prove no-change dry-run, selective anonymization,
exclusive cutoff/today/future protection and idempotence. Admin cards handle cleared
personal data, and public creation still starts pending. Tests remove only their
created IDs and restore the starting count. Existing app grants, `.env`, unrelated
rows and preexisting migration history remain intact. Browser verification at
320/375/768/1440px remains pending because Chrome tooling is unavailable.

## Historical checkpoint: SEO and production-readiness foundation (20 October 2026)

- Canonical production origin is configured once in `astro.config.mjs` as
  `https://www.turuncugouda.com`. Public canonicals/OG/schema/sitemap/robots use it,
  including during local builds. Root retains `/`; other preferred paths have no
  trailing slash. Existing slash-tolerant routes remain; query/hash variants normalize.
- Typed BaseLayout provides required title/description, canonical path, optional
  social image/robots/trusted JSON-LD. Dutch titles/descriptions are page-specific.
  Social cards use an optimized built JPEG from the supplied real hero photo.
- Homepage-only CafeOrCoffeeShop JSON-LD uses verified business data and machine-readable
  hours shared with the displayed opening-hours data. Serialization escapes script
  delimiters; no user/reservation content enters public metadata.
- Official `@astrojs/sitemap` 3.7.4 generates sitemap-index.xml/sitemap-0.xml for the
  five indexable public pages only. Prerendered robots.txt references the index and
  discourages admin/API crawling. Authentication and admin private headers remain
  authoritative and unchanged. Custom public 404 returns 404, is noindex/follow, has
  no canonical, and is excluded from sitemap. The favicon set was added on 23 October.
- `npm run test:seo` audits generated HTML/metadata/links/images/scripts/sitemap,
  secrets and actual standalone HTTP responses, including 404/private headers.
  Detailed setup and the current acceptance checklist are in Development and operations.
- Nothing had been deployed at this 20 October checkpoint; Hostinger deployment,
  SMTP and durable rate limiting were completed later. This was local SEO evidence,
  not production form/admin acceptance. Analytics and automatic reservation cleanup
  remain absent. Retention duration and remaining menu/High Tea conditions still
  need owner decisions; current live verification gaps are listed at the top.

Verification: 92 native tests pass with zero Astro/type diagnostics. Credential-free
build/output/HTTP audits pass for six public HTML files, 70 optimized images,
five sitemap URLs, actual 404 behavior, private-route separation and absence of
baked secrets. Public JS remains three inline modules totaling 7,327 unique bytes.
Existing admin and local retention integration checks also pass with exact test-row
cleanup; runtime credentials, privileges and privacy architecture are unchanged.
The only new direct dependency is the sitemap integration; its npm prerequisite
is reflected in package engines/README. Browser visual acceptance remains pending.

## Historical checkpoint: Pre-publication audit (22 October 2026)

At this 22 October checkpoint the repository was private and nothing was deployed;
Hostinger deployment followed on 23 October. The local audit found no
real credentials in tracked files or the available Git history, no reservation
records or database dumps, and no secret leakage in a credential-free build.
All 92 tests, Astro/type checks, the production build and built SEO/HTTP checks pass.
No application behavior, database records, credentials or supplied assets changed.

The business owner has approved public GitHub redistribution of the Turuncu assets
included in this project. The contributor has accepted the email disclosure in
existing Git history; no history rewriting or metadata changes are required.
No project license will be added at this stage. These approvals resolve the
identified publication decisions; the existing production-launch requirements
remain separate and outstanding. The audit findings apply to the reviewed snapshot
and do not constitute a production infrastructure or legal ownership assessment.

README now describes the website, implemented features and architecture; detailed
setup and operations are preserved in `docs/DEVELOPMENT.md`. Ignore rules cover
common local exports, logs, runtime databases and credential files while retaining
versioned migrations.

## Historical checkpoint: Hostinger HTTPS proxy origin handling (23 October 2026)

The application is now deployed on Hostinger as an Astro Node standalone app,
behind TLS termination. Both `https://turuncugouda.com` and
`https://www.turuncugouda.com` are public domains. Proxy acceptance must still be
verified over live HTTPS after deploying the fix; no hosting settings or secrets
are changed by this checkpoint.

`security.allowedDomains` is restricted to those two exact HTTPS hosts, with
`security.checkOrigin: true`. Astro reconstructs the validated external
Request URL before its CSRF middleware and route handlers. The shared application
guard additionally rejects invalid/conflicting/multivalue forwarded headers and
requires exact Origin equality, including apex versus www. Remote HTTP origins,
unapproved hosts and nondefault ports fail closed. Direct loopback development/test
requests retain their exact-origin behavior. Origin-less public callers remain
supported; admin forms require Origin and mutations retain session-bound CSRF.

The trusted proxy must overwrite supplied forwarding headers, send HTTPS as the
forwarded protocol and preserve a public Host or approved forwarded host. It must
also prevent direct origin access. Missing or invalid external URL information is
not inferred from the browser's Origin. Database-free built-HTTP regression checks
simulate HTTP upstream connections for both domains, native admin login, Secure
cookies, authenticated CSRF logout, API validation and hostile forwarding metadata.
Production rate limiting, client-IP verification and the remaining acceptance and
privacy requirements are unchanged. Detailed proxy requirements are in
`docs/DEVELOPMENT.md`.

Verification: 102 tests pass; Astro/type checks have zero diagnostics; the production
build and `npm run test:seo`, including the proxy HTTP regressions, pass. No database
rows, migrations, production credentials, menu data or source assets were changed.

## Historical checkpoint: Reservation notification email (23 October 2026)

- `POST /api/reservations` awaits one internal Nodemailer notification only after
  the existing parameterized MySQL INSERT succeeds. Database state is authoritative:
  SMTP/configuration failures never roll back/delete the row or change HTTP 201
  `{ success: true, reservationId, status: 'pending' }`.
- `src/server/reservations/notificationEmail.ts` imports `astro:env/server` and reads
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and
  `RESERVATION_NOTIFICATION_TO` only on use. Public rendering/builds need no SMTP
  configuration. No values are public/Vite env or hardcoded application defaults.
- Production configuration provided by the owner is Hostinger `smtp.hostinger.com`,
  port 465, direct TLS (`secure: true`), user/sender
  `reserveringen@turuncugouda.com`, recipient `turuncugouda@gmail.com`. The password
  is supplied only through the private runtime environment. These internal addresses
  are not added to public contact content or metadata. `.env.example` has placeholders.
- Subject is `Nieuwe reserveringsaanvraag`. Dutch plain text includes normalized
  name, requested date/time, party size, phone, optional email/message and
  `Status: In afwachting`. No guest confirmation or admin-status emails are added.
- Failures log only `Reservation notification failed: SMTP_NOTIFICATION_FAILED`.
  Provider errors, credentials and customer fields are never logged. SMTP logging
  is disabled; stage/idle timeouts limit stalled attempts. There is no retry queue,
  automatic resend or inbox-delivery guarantee. Admin remains the source of requests.
- Automated tests exercise the real route/INSERT/mail services with mocked DB/SMTP
  boundaries, including missing settings, optional fields, error isolation and
  unchanged responses. No live SMTP send or production environment change is part
  of this implementation. Production mailbox receipt still needs verification.
- Development documentation records the mail flow and configuration. Database
  anonymization does not remove notification copies in email mailboxes. Existing
  validation, migrations, admin authentication, origin/proxy rules and business
  content are unchanged.

Verification: all 126 tests pass (including 19 notification tests); `npm run check`
has zero errors, warnings or hints. `npm run build` and `npm run test:seo` pass,
including public-output SMTP leakage checks and the existing proxy HTTP regressions.
No live email was sent and no database records or private environment files changed.

## Historical checkpoint: Site favicon (23 October 2026)

The owner-supplied transparent `src/assets/faviconturuncu.png` is retained unchanged
as the favicon source. `npm run favicon:generate` uses the existing Sharp installation
to trim transparent outer whitespace before resizing with lossless PNG compression,
preserving the full visible circle, colors, aspect ratio and transparency. Trimming
ignores alpha-1 noise and retains a two-source-pixel guard around the logo. Square
outputs add approximately 6.25% transparent padding per side (rounded to pixels).
The source artwork is unchanged and no background flattening is used.
The previous opaque source has been removed;
only this source and the four required generated assets are retained.
Committed assets in `public/` are `favicon.ico`
(16/32/48px PNG frames), `favicon-16x16.png`, `favicon-32x32.png`, and
`apple-touch-icon.png` (180px). The shared public `BaseLayout.astro` head links
all four, including on 404. No manifest, PWA behavior or new dependency is added.
The built SEO audit verifies links on every public page, copied asset bytes,
PNG/ICO dimensions, alpha channels, transparent borders, visible artwork coverage, file size budgets and
successful production-runtime image responses, including `/favicon.ico`.

Verification: all 126 tests pass; Astro/type checks have zero diagnostics; the
production build and extended `npm run test:seo` pass. The generated PNGs and all
ICO frames preserve transparency around the artwork. The visible bounding boxes
are 14×14px on the 16px canvas and 28×28px on the 32px canvas: 87.5% of each axis
and 76.6% of canvas area. Coverage checks reject the previous tiny-logo output.

## Historical checkpoint: Approved homepage visual polish (25 October 2026)

The owner approved this variant for production after final verification.

- The homepage keeps its section order, hero content/layout, nine-image favorites,
  High Tea copy, Over Turuncu copy and verified business/contact data. Spacing is
  tightened only on the homepage: the hero's lower space and Over Turuncu use a
  48–72px rhythm; Contact starts with 32px rather than doubling the preceding
  section gap; High Tea's upper gap is 32px.
- ProductTicker uses warm brown `#3a281f`, cream serif text `#f6eddf`, thin cream
  rules at 20% opacity and orange `#d65b1c` ornaments. Natural case and tighter letter spacing
  soften the strip. Its product list, two-copy loop, 70-second animation,
  pause/resume, hover/focus pause and reduced-motion static row are unchanged.
- A shared static `SocialIcon.astro` provides 20px currentColor Instagram/TikTok
  SVGs, hidden from assistive technology and unfocusable. Contact retains visible
  platform names/handles and 44px targets; social links remain secondary to
  WhatsApp and separate from reservation actions. No dependency/JavaScript added.
- SiteFooter uses three columns from 768px: compact existing Brand, four public
  navigation links and semantic visit/contact information. Mobile stacks these
  blocks with a two-column navigation list. WhatsApp precedes secondary phone;
  the same social icons accompany platform names. A subtle rule separates the
  deterministic UTC build-year copyright and Privacy link.
- `--color-dark: #3a281f` is shared by the ticker, High Tea and the footer.
  Footer text is cream `#f6eddf`, secondary text `#d1beac`, rules cream at 20%
  opacity and underline accents orange `#d65b1c`.
  Scoped footer CSS replaces obsolete global footer rules. Cream focus outlines
  remain visible on its dark surface, including the Brand link and active routes.
- Built verification additionally checks footer navigation/current-page states,
  address/contact links, copyright/Privacy and decorative icon semantics on all
  public pages. Backend/rate-limit/admin/SMTP/migration files and SEO/domain
  configuration remain unchanged.
- Verification: 168 Node tests, zero-diagnostic Astro checks, build and expanded
  SEO/HTTP checks pass. Native Chrome review covers 390/768/1440/1920px and
  `/reserveren` at 390/1440px; the full-page PNG widths match the requested widths
  at DPR 2 without observed horizontal overflow. Lazy images were brought into
  view before the final desktop captures. Footer heights are about 595/389/366/366px.
  The final approved warm-brown palette retains cream text and visible focus states.
- Keyboard review confirms visible Contact social and cream footer focus states,
  logical WhatsApp/phone/social/Privacy order, and ticker pause/resume. Reduced
  motion was checked using DevTools tab emulation, then restored to no override.
  Public homepage/reservation console checks show no application warnings/errors;
  Chrome's console-paste protection was left intact when it blocked diagnostics.
  Screenshots remain ignored under `.tmp/ui-review/polish-home-{390,768,1440,1920}.png`,
  `polish-reserveren-{390,1440}.png` and `polish-ticker-reduced-motion-768.png`.
  No outstanding layout regression was found. Header navigation is unchanged,
  with no Home link; its existing reservation CTA remains labelled Reserveer.

## Historical checkpoint: Approved durable rate limiting (24 October 2026)

The owner's approval applied to this historical implementation task only.
Phase one committed migration 003 in `74b1cc5d674546f5e041f5660c980e2cfdd04449`.
The durable limiter implementation is on main in `611b212` and included in the
deployed release; live quota/client-address acceptance is still pending.
The owner reports the production table and migration-history filename/checksum
are correct and RATE_LIMIT_SECRET is configured on Hostinger. The implementation
does not read/change that hosting secret or execute production SQL. Migrations
001/002/003 remain unchanged. Existing UI, SEO configuration, reservations business
rules, SMTP, authentication/session and status workflow stay unchanged.

- New `003_create_rate_limits.sql` adds only an InnoDB limiter table with the
  composite scope/subject-hash primary key, unsigned count, millisecond window/update
  timestamps and an indexed cleanup timestamp. Migrations 001/002 are unchanged.
  The existing migration runner hashes UTF-8 SQL with CRLF normalized to LF:
  `b2871dfde78b171898242d796112ec03c3f2dca73eefaa89260eff6576446d3a`.
- `src/server/rateLimit/core.ts` holds the reusable limiter; `service.ts` guards
  runtime configuration/database access with `astro:env/server`. `admin_login`
  and `reservation` each allow five attempts per address in a fixed 15-minute
  window. The new `RATE_LIMIT_SECRET` is validated lazily like the session secret
  (43–128 base64url characters, at least 32 decoded bytes), without a default.
  All instances must share the database and secret; rotation changes the keys.
- Only Astro's runtime clientAddress is accepted. Conservative Node IP/URL
  normalization canonicalizes IPv6 and maps IPv4-mapped IPv6 to IPv4. Invalid or
  unavailable addresses fail closed; no IP headers are parsed as a fallback.
  SQL stores only hexadecimal HMAC-SHA-256(normalized address, secret), never
  raw IPs, credentials or request data. No digest is logged.
- A transaction inserts/locks the unique row, SELECTs FOR UPDATE, decides using
  the database UTC clock, then increments or resets the count and commits before
  authorizing work. Blocked attempts do not extend windows. This is shared across
  Node processes, restarts and apex/www; no in-memory lock or quota cache is used.
- Reservation ordering: Origin/content-type checks → durable consumption →
  bounded body parsing → honeypot → unchanged validation → INSERT → unchanged
  SMTP → HTTP 201. Malformed JSON, oversized bodies, honeypots and validation
  failures count; rejected protocols/origins are rejected cheaply first.
  Exhaustion returns Dutch `RATE_LIMITED` HTTP 429 and integer Retry-After seconds.
- Admin consumes before credential verification after existing form guards,
  retains invalid/limited redirects and resets only its login subject on success.
  Reset/storage/config/address errors return generic 503 without issuing a cookie;
  reservation limiter failures return generic `SERVICE_UNAVAILABLE` 503 without
  an insert/mail attempt. Logs use fixed RATE_LIMIT_UNAVAILABLE only. There is
  no fallback that silently disables limiting on database failure.
- After committed decisions, cleanup runs at most once/minute/process, deleting
  at most 100 rows older than one hour using the timestamp index. Only the cleanup
  timer is local. No cron/history/background worker; idle rows await traffic and
  backlogs drain in bounded batches. Cleanup errors preserve the committed quota
  decision and log fixed RATE_LIMIT_CLEANUP_FAILED without driver details.
- Tests cover policy boundaries, HMAC/privacy, normalization, lazy config,
  rollback/release, safe failures, reset, cleanup and both actual route handlers.
  Existing notification tests isolate the limiter so their SMTP guarantees remain
  independent. The database-free SEO/HTTP harness now expects closed 503 behavior
  without DB and uses signed test sessions to retain CSRF/proxy regression checks;
  public metadata/domain configuration is unchanged.
- `test:rate-limit-integration` is explicitly opt-in and loopback-only. It uses
  the existing migration mechanism, concurrent pools, multiple built Node servers,
  restarts and apex/www requests, disabling real mail and deleting exact synthetic
  hashes/reservation IDs. Existing admin/retention scripts use isolated ephemeral
  limiter secrets. `.env` is never edited. See DEVELOPMENT for full rollout order.
- The rollout prerequisites were: back up/inspect production history, apply migration 003,
  grant the runtime account SELECT/INSERT/UPDATE/DELETE only on rate_limits,
  configure one new server-only RATE_LIMIT_SECRET on all instances, and verify
  trusted proxy/client-address handling. Astro's adapter can use forwarding
  headers for approved hosts: Hostinger must overwrite untrusted headers and
  keep direct Node access private. No proxy parser/config change is included.
- Verification: 168 unit/route tests pass, Astro checks have zero diagnostics,
  build and SEO/HTTP checks pass. A disposable loopback MariaDB 10.4.32 instance
  verified migration application/repeat skip, 30 concurrent attempts (exactly five
  allowed), independent pools/processes, restart persistence, apex/www quotas,
  UTC expiry/reset, 100-row cleanup bounds and real reservation/admin HTTP flows.
  Existing admin and retention integrations pass with separate restricted test
  runtime/maintenance accounts. Exact synthetic rows and the temporary database
  files were removed; the existing local database, production and `.env` are unchanged.

## Historical checkpoint: Approved High Tea highlight (24 October 2026)

The owner approved the temporary AI image and warm-brown design and authorized
committing and pushing the highlight to main after final checks.

- `HighTeaHighlight` sits immediately after favorites and before Over Turuncu;
  the surrounding sections are unchanged. The exact owner-provided copy is
  `HIGH TEA`, `High Tea bij Turuncu`, `Vanaf 2 personen`,
  `Reserveer minimaal 48 uur van tevoren`, and `High Tea reserveren`.
  The single CTA links to `/reserveren`; no prices or additional conditions are added.
- Temporary image: owner-supplied AI artwork `src/assets/photos/high-tea-ai.png`,
  showing a tiered stand with sweet/savoury bites and tea. The original photos
  and gallery are unchanged.
  The source stays untouched. Astro supplies lazy WebP widths 320/480/640/960/1200px;
  CSS uses cover with `object-position: 65% 25%` to retain the stand and its top.
- A 50/50 image/content grid from 768px stacks image first on mobile. The image
  uses a 3:2 mobile frame and the desktop grid has a 416px minimum height.
  The warmer dark-brown panel is `#2b1d17`, text/CTA are existing cream `#f6eddf`, and a small
  decorative line uses orange `#d65b1c`. Headings retain Georgia; the CTA has a
  cream focus outline, normal 48px minimum height and no new JavaScript.
- Built verification checks placement, exact copy, one CTA, the supplied image,
  lazy loading and absence of prices. Reservation behavior and menu data are unchanged.
- The AI variant passes the same 136 tests, zero-diagnostic Astro checks, build
  and SEO/HTTP checks. Chrome review at 390/768/1440/1920px confirms balanced
  crops with the three-tier stand and handle retained, unchanged spacing/copy,
  no horizontal overflow and zero console messages. The cream/brown contrast
  is 14.02:1; keyboard focus stays visible and the CTA opens `/reserveren`.
  The 2,204,445-byte, 1448×1086px PNG is retained for regeneration, while public
  previews are optimized WebPs (approximately 19–121KB). No new dependency is added.
  Review screenshots remain ignored under `.tmp/ui-review/high-tea-ai-*.png`.

## Historical checkpoint: Approved contact redesign (24 October 2026)

The owner approved the Contact/WhatsApp redesign and authorized committing and
pushing it to main after final checks. Hostinger deployment configuration is unchanged.

- `ContactVisit` preserves `#contact` and displays cream panels for Contact,
  Openingstijden and Bezoek ons: stacked on mobile, two columns with a full-width
  location row from 768px, and three columns from 1024px. Styling is scoped, with
  subtle borders/radii and no shadows or new client JavaScript.
- The primary general-contact CTA uses `site.whatsappHref`, without a prefilled
  message. The phone remains a smaller secondary `tel:` link. Address, directions,
  hours and social handles are unchanged. Instagram/TikTok sit under `Volg ons`.
- A separate reservation area links to `/reserveren` and retains confirmation
  guidance. That page's secondary questions section and noscript fallback now
  prefer WhatsApp; form markup, initialization script and all backend behavior
  are unchanged. No Instagram messaging or prominent calling CTA remains.
- Automated checks cover centralized WhatsApp data, contact/booking/social
  separation, verified visit information, noscript wording and the existing form
  contract. The full suite contains 136 tests.
- Local visual review passed for Contact at 390/768/1440/1920px and `/reserveren`
  at 390/768/1440px, without overflow or a layout regression. The reservation
  console was clear after reload. The owner separately confirmed a clean homepage
  console and visible, logical keyboard focus on both pages before approval.
- Review screenshots stay ignored under `.tmp/ui-review/contact-*.png` and
  `reservation-contact-*.png`; they are not publication assets.

## Historical checkpoint: Approved printed-menu redesign (24 October 2026)

The owner approved the menu redesign and authorized committing and pushing it to
main after final verification. Main automatically deploys to Hostinger.
The approved homepage, gallery, business data, backend and hosting settings are unchanged.

- Original files `src/assets/menu/menu-1.png` (1,427,564 bytes) and `menu-2.png`
  (977,921 bytes) are both 997×2000px and remain byte-for-byte unchanged.
- The rejected four-card presentation, split assets and split generator are removed.
  `node scripts/generate-menu-web.mjs` regenerates `src/assets/menu/menu-web-1.webp`
  and `menu-web-2.webp`. Their individually inspected crop rectangles are
  (x=0, y=382, width=997, height=1618) and (x=0, y=384, width=997, height=1616).
  Only the redundant top flyer logo/title/Instagram branding is removed, leaving
  roughly 32px above the highest category heading. Every remaining pixel through
  the original bottom edge is retained, including contact and High Tea content.
- Lossless WebP sizes are 894,762 and 582,280 bytes. The viewer uses these same
  website crops at full resolution, never the flyer PNGs. Astro generates responsive
  320/480/640/800/997px WebP previews at quality 90 from those cropped sources.
- `MenuArtwork` renders two image-only native buttons. The desktop container caps
  at 1408px, with two columns and 32px gaps from 768px. Mobile stacks the sheets,
  with 24px gaps. No card borders, footer bars, labels or permanent overlays are used.
  The semantic `Onze menukaart` H1 is centered, regular Georgia serif in existing
  dark orange `#a83c0b`, at 22–28px, with 16px top padding and an 8px gap before
  the artwork. No extra decoration adds height. Original flyer headers never
  reappear in the viewer.
- `MenuViewer` uses a separate native modal dialog and focused vanilla TypeScript
  controller, leaving GalleryLightbox unchanged. Close, previous/next (wrapping),
  zoom in/out, fit reset, count and zoom percentage stay outside the scroll stage.
  Zoom is 100–400% of the fitted sheet in 50% steps, reset when changing sheets.
  Desktop mouse/pen drag uses pointer capture; touch uses native overflow scrolling.
  Pinch zoom is deliberately not implemented. Arrow keys change sheets, +/- zoom,
  0 resets, Shift+arrows pan, and native Escape closes. Opening focuses Close;
  closing restores the opener and the previous page overflow. Controls are at
  least 44px, have Dutch labels and visible focus; image failure exposes a text fallback.
- The native `Menukaart als tekst bekijken` details element is collapsed by default.
  All 91 original items, notes, descriptions, variants, prices, missing prices and
  category anchors remain rendered in HTML. `src/data/menu.ts` is unchanged, as
  are MenuCategory/MenuPrice and the menu contact aside.
- Asset tests check both original PNG hashes and every pixel below the two crop
  boundaries. Viewer tests use the cropped-sheet dimensions and retain navigation,
  close/focus, zoom/reset, pointer-capture/cancellation, native touch handoff and
  error coverage. Built checks require two labelled triggers, exact cropped viewer
  files, visual-before-text order, a collapsed disclosure and all structured menu data.
- All 134 tests, Astro/type checks (zero diagnostics), build and SEO/HTTP checks pass.
  Both generated crops have been visually inspected directly. Native Chrome responsive
  review at 390/768/1440/1920px confirms intact headings, balanced sheets and no
  horizontal page overflow. Full-page screenshots have exactly twice their CSS
  viewport widths at the browser's 2x pixel density. The viewer uses cropped sheets
  and retains zoom in/out/reset, pointer pan, next/previous, Escape and visible opener
  focus return. The text disclosure opens/closes with Enter and retains its categories.
  Console inspection shows no warning/error messages (two verbose messages hidden).
  A stale local dev asset error cleared after invalidating the importing module;
  the production build and generated image URLs also pass independently.
- Final centered-heading review at 390/768/1440px confirms a single-line mobile
  heading, unchanged tight artwork spacing and no horizontal overflow. Viewer zoom,
  two-sheet navigation, Escape/focus return and keyboard text disclosure still work;
  the console has no warning/error messages (three verbose messages hidden).
  Final native screenshots are `.tmp/ui-review/menu-final-390.png`,
  `menu-final-768.png`, `menu-final-1440.png` and `menu-final-console.png`.
- Earlier full-page native Chrome screenshots are `.tmp/ui-review/menu-cropped-390.png`,
  `menu-cropped-768.png`, `menu-cropped-1440.png` and `menu-cropped-1920.png`.
  Additional native viewer/console evidence is `menu-cropped-viewer-native-390.png`
  and `menu-cropped-console-native.png`. These ignored local artifacts include the
  Astro dev toolbar; earlier four-card screenshots do not represent this version.
  Source resolution limits sharpness beyond native pixels; a higher-resolution or
  vector export would improve zoom detail. Physical touch hardware remains untested.
- Printed-versus-text business wording/prices were preserved without corrections
  in this presentation task; the owner approved publishing the presentation.

## Historical checkpoint: Approved homepage redesign (23 October 2026)

The owner approved the refined homepage, including the orange ticker variant,
and authorized committing and pushing it to main after final verification.
Hostinger automatically deploys pushes to main; hosting configuration is unchanged.

- The header retains its logo and uses the owner-provided slogan in compact,
  regular (400) italic Georgia, dark orange and 0.01em letter spacing, with
  balanced wrapping on mobile. No font download or decorative frame is added.
  The footer and hero retain the café/bakery/lunch positioning.
- The hero heading/image and secondary visit CTA remain. `Ontdek onze favorieten`
  uses a native same-page `#favorieten` anchor, with smooth scrolling only when
  reduced motion is not requested and the existing sticky-header clearance.
- A CSS-only product-name ticker sits between the hero and compact image preview.
  Names verified against menu data are Cappuccino, Menemen, Börek, Warme matcha,
  Cheesecake, Gözleme, High Tea, Turkse koffie and Tiramisu. Two identical groups
  (including trailing spacing) translate by exactly one group width (-50% of the
  track) over 70 seconds, linearly and infinitely. Visual copies are hidden from
  assistive technology; one static text list supplies the accessible names.
  A native checkbox/label pauses/resumes the animation without JavaScript; hovering
  or focusing the row also pauses it. Reduced motion defaults to one static,
  horizontally scrollable row, with no duplicate or animation controls.
  The approved colors are existing dark orange `#a83c0b` and warm cream `#f6eddf`
  (5.46:1 text contrast), with cream separators at 85% opacity and matching light
  focus outlines. Typography remains regular-weight and the strip stays shallow.
- Nine images form a 3×3 grid from 360px, with two columns below that width. Its
  maximum width is the shared 1184px container, increased from 960px. Gaps are 8px
  below 768px, 12px from 768px and 16px from 1024px, with consistent 8:5 thumbnails. There are
  no visible headings, categories, captions, product names or zoom labels. A
  screen-reader-only heading preserves the named section, and a small 44px-tall
  branded `Ontdek de galerij` button to `/galerij` follows the mosaic. The later
  redundant preview stays removed. The light cream section stays unframed: no
  extra card, border or shadow competes with the photos.
- PhotoGrid adds an opt-in compact homepage variant and configurable grid IDs;
  its standalone defaults and the existing lightbox implementation are retained.
  All nine favorites share one native dialog, keyboard/arrows/Escape and focus return.
- The selection is Koffiemoment (`latte-art`), Börek en koffie (`borek-coffee`),
  Koffie & iets lekkers (`ig-07`); Uit de bakkerij (`ig-08`), Sesambroodjes (`ig-00`),
  Een puntje taart (`ig-01`); Menemen (`menemen`), Hartige gebakjes (`ig-03`),
  In de vitrine (`borek-display`). No prices, ingredients or product claims are added.
- Over Turuncu's copy/image, contact/hours, standalone menu/gallery sources,
  reservation/admin/SMTP/database/rate-limiting logic and domain/proxy settings are unchanged.
- The nine photos are a temporary selection awaiting better business photography;
  the refinement keeps the same image order, titles and descriptions in the lightbox.
- All 127 tests, zero-diagnostic Astro/type checks, the production build and extended
  SEO/HTTP audit pass. Built checks assert the nine distinct photos, no visible grid
  captions/category headings, retained lightbox metadata, shared script/unique IDs,
  CTA targets, verified ticker names/identical copies and the standalone gallery's
  original 13 photos/captions/zoom labels. The ticker adds no client script.
- Actual local browser inspection at 390px, 768px, 1440px and 1920px confirms layouts,
  same-page scrolling, all nine loaded images, lightbox keyboard opening/arrows/Escape
  and focus return, navigation and gallery CTA, with no horizontal overflow or console
  warnings/errors. Additional 320px/1024px checks show no slogan/navigation collision.
  Screenshots are local ignored review artifacts under `.tmp/ui-review/`.
- Refinement measurements at the same viewport widths: 390px preview height drops
  from about 3341px to 310px (91%); 768px from 1157px to 552px (52%); 1440px from
  1659px to 722px (57%). Mobile thumbnails at 390px are about 104×65px. The visible
  grid has no text, and all nine images retain their lightbox information and
  working keyboard/arrows/Escape/focus return. No overflow or console errors occur.
  These are the previous compact checkpoint measurements. The wider refinement
  keeps the 390px section at 310px, measures 556px at 768px and 868px at 1440px;
  both 1440px and 1920px use the capped 1184px-wide mosaic. The ticker adds 60px on
  mobile/tablet and about 66px on desktop. Equal ticker group widths, continuous
  transform movement, pause/resume and keyboard toggling are verified in-browser.
  The reduced-motion fallback is rendered using an ignored local CSS media fixture
  because the browser has no media-emulation capability; it has no animation,
  one visible copy and working keyboard horizontal scrolling without page overflow.
  New screenshots use the `ticker-` prefix in `.tmp/ui-review/`.
- The lighter slogan, wider mosaic, ticker pace and orange/cream strip are approved.
  Better business photography remains a future refinement. No High Tea promotion
  or new business information is included.

## Hosting and deployment

GitHub repository `DarkGuardianMT/turuncugouda` main automatically deploys to
Hostinger's live Node standalone runtime. The reviewed main snapshot on 27 October
is `e4b609483fa33d5fb00e86a3549b8a2dc2e766c8`. Deployment is complete; this does
not establish successful production reservation/admin/SMTP end-to-end behavior.
Database grants, actual proxy client IPs, quotas, networking/TLS and recovery still
need operational verification. Keep runtime configuration private.

The configured canonical origin is `https://www.turuncugouda.com`. A previous
apex-to-www redirect attempt caused a loop. Do not retry blindly: inspect the
actual Hostinger/proxy redirect chain and agree a tested change before applying it.
Relevant security headers also need review. See the
[deployment reference](docs/DEVELOPMENT.md#deployment-and-release-operations) and
[production acceptance checklist](docs/DEVELOPMENT.md#production-acceptance-checklist).

## Future AI chatbot

A lightweight AI chatbot is a later learning/feature goal after core production
acceptance. It may answer opening-hours,
location, menu and common café questions, guide visitors through reservation
information, and eventually integrate with a reservation backend. Nothing is
implemented or selected for it yet.

## Explicitly deferred technologies and features

- Vue integration, React, Tailwind, UI/component and animation libraries
- Sanity or another CMS, Supabase, and unrelated backend/API services
- Capacity management, guest confirmation emails and SMS notifications
- AI chatbot implementation

## Historical foundation checkpoints — 7–17 October 2026

The following setup, frontend and reservation checkpoints preserve early milestones.
Their placeholder pages, feature deferrals, audit results and unavailable browser
tooling describe those dates, not the current deployed application. Later local
visual reviews are recorded above; live backend acceptance remains open in CURRENT
STATUS. “Production preview” in these early checks refers to a local built server.

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

## Historical checkpoint: Visual foundation verification (7 October 2026)

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

## Historical checkpoint: Brand and photography checkpoint verification (8 October 2026)

- Astro/type checks: zero errors, warnings, or hints; build produces three static pages.
- Production browser checks at 320, 375, 768, 1024, and 1440px verify all routes,
  loaded images, logo/subtitle, mobile keyboard navigation, and no horizontal overflow.
- Mobile navigation also remains available without JavaScript.
- Homepage and gallery screenshots reviewed for subject crops and logo presentation.
- All 17 supplied source assets verified unchanged by SHA-256 comparison.
- Menu reference images and the unused letterboxed photo are absent from the build.
- No dependencies added; responsive outputs keep original source files intact.

## Historical checkpoint: Verified business content checkpoint (8 October 2026)

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

## Historical checkpoint: Gallery lightbox checkpoint (14 October 2026)

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

## Historical checkpoint: Digital menu checkpoint (14 October 2026)

- Astro/type checks pass with zero diagnostics; the static build generates four pages.
- HTTP checks pass for all four routes. Generated output checks cover all 91 menu
  items/descriptions, 94 displayed prices, variants/supplements, seven omitted
  null prices, six category anchors, shared navigation/active state, and homepage CTA.
- The 101 numeric/null price fields match the supplied implementation request.
  Gallery filter/navigation checks still pass; source assets and dependencies are unchanged.
- Browser rendering at 320px, 375px, tablet and desktop, keyboard interaction,
  actual anchor clearance and overflow remain pending: no browser surfaces were
  exposed, and opening Chrome returned unavailable.

## Historical checkpoint: Reservation foundation verification (17 October 2026)

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

## Historical checkpoint: Public reservation form verification (17 October 2026)

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

## Prioritized backlog — 29 October 2026

Order reflects production acceptance and operational risk before optional features.
Detailed procedures and verification status live in Development and operations.

| ID | Next action |
| --- | --- |
| A01 | Complete authorized live reservation → pending DB row → admin login/status update → internal SMTP/inbox verification. |
| A02 | Verify actual proxy `clientAddress`, untrusted-header handling and persistent/shared rate-limit behavior, including runtime grants and migration 003. |
| A03 | Verified locally on 27 October: undici 8.12.3, zod 4.6.7, fast-uri 3.1.9; clean install, full/production-only audit (zero findings), 168 tests, Astro check, build and SEO pass under Node 22.19.0. Await release approval and confirm the actual Hostinger Node patch version; production is unchanged. Recheck advisories for future releases. |
| A04 | Verify backups and a restore into an isolated test database, never over production or unrelated data. |
| A05 | Owner-approved 90-day policy implemented locally on 29 October: Dutch privacy copy and monthly manual workflow; existing safe CLI unchanged. Assign operators, manage mailbox copies and confirm separate backup rotation. No production cleanup or release performed; each production apply needs separate explicit approval. |
| A06 | Obtain owner confirmation of remaining menu prices/product wording, High Tea rules and reservation policy/capacity expectations. |
| A07 | Maintain consistency across project guidance and operations docs; add minimal CI for existing checks when agreed. No CI workflow is currently configured. |
| A08 | Add a past-reservations admin view if required; the current view covers today/future only. |
| A09 | Improve public 429/503 guidance and operational SMTP failure visibility; preserve successful pending records on mail failure. |
| A10 | Review apex/www canonical redirect and relevant security headers. The previous redirect attempt looped; inspect real hosting/proxy behavior before changing it. |
| A11 | Consider optional customer confirmation/cancellation emails with agreed wording and delivery policy. |
| A12 | Replace temporary photography with authentic assets where appropriate; complete accessibility and performance checks. Prior local visual checks do not replace full live acceptance. |
| A13 | Consider optional chatbot, CMS and capacity features only after agreed requirements. |

## Important unresolved decisions

- Owner confirmation of remaining prices/product wording and High Tea conditions;
  the published minimum-party/48-hour copy does not imply backend enforcement.
- Reservation handling/contact policy, capacity expectations, monthly retention
  operator, mailbox maintenance and backup/recovery ownership. The 90-day retention
  duration is approved; production maintenance has not been executed for A05.
- Tested canonical redirect behavior and relevant production security headers.
- Better photography and future design refinements; gallery and homepage structure
  are implemented, not awaiting an initial architecture decision.

Update this document when significant architecture, feature, scope, business or
status decisions change. Update [Development and operations](docs/DEVELOPMENT.md)
for technical behavior, APIs, migrations, commands, deployment and operations;
correct related stale sections rather than only appending new notes.
