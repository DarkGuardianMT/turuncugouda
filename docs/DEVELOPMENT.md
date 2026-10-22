# Development and operations

Local setup, API behavior, security boundaries, maintenance and future deployment
requirements. Start with the [project overview](../README.md). Production runs on
Hostinger behind an HTTPS reverse proxy; the acceptance checklist remains relevant.

## Local reservation backend setup

1. Install dependencies with `npm ci` and start MySQL or MariaDB separately.
   XAMPP users only need **MySQL** for the application. Astro does not require
   Apache; phpMyAdmin may require Apache if you choose to use it.
2. Create an empty database, for example `turuncugouda`, using utf8mb4.
   Use a database user with access to this database only; do not assume a local
   root account or an empty password. This version requires a nonempty password.
3. Copy `.env.example` to `.env` and fill in your own local `DB_HOST`, `DB_PORT`,
   `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. `DB_CONNECTION_LIMIT` defaults to 5
   (technical range 1–100). Quote values containing `#` or spaces as needed.
4. Run `npm run db:migrate`.
5. Run `npm run dev` and use `http://localhost:4321`.

Astro loads local environment files during development. The migration command
uses Node's built-in `--env-file-if-exists=.env` and reads only `.env` plus the
process environment; already exported variables take precedence. It does not
load `.env.local`. The standalone production server reads the process environment,
so configure it in hosting rather than assuming it loads `.env`. For a local
built-server test with your `.env`, run
`node --env-file=.env ./dist/server/entry.mjs` after building. `HOST` and `PORT`
can configure the standalone listener.

No connection or required DB configuration is evaluated until a reservation is
stored or migrations are run. `npm run check`, `npm test`, and `npm run build`
work without database credentials. Local environment files remain ignored by Git;
never prefix database credentials with `PUBLIC_` or put them in client scripts.
The pool imports `astro:env/server`, which Astro rejects in a client dependency
graph. The shared configuration helper takes explicit input and reads no secrets
itself.

### Migrations and schema

`001_create_reservations.sql` creates only `reservations`: an unsigned BIGINT ID,
name (120), optional email (254), phone (32), reservation date/time, unsigned
SMALLINT guest count, optional message, status, and creation/update timestamps.
Status is `pending`, `confirmed`, or `cancelled`, defaulting to `pending`.
Indexes cover date/time and status; date/time is deliberately not unique.

The runner applies filenames in order and records filename, SHA-256 checksum,
and application timestamp in `schema_migrations`. Use zero-padded filenames and
one SQL statement per migration. Applied files must remain unchanged; line-ending
differences are ignored for checksums. The runner only operates within `DB_NAME`,
does not create/drop databases, and never resets data. Migration credentials need
CREATE/ALTER/INDEX and migration-history SELECT/INSERT privileges; the application
account needs INSERT and SELECT on `reservations`, plus UPDATE on its `status`
column for admin actions. Separate migration credentials can be exported for the
command, overriding `.env`.

MySQL/MariaDB DDL implicitly commits. If execution stops after a table is created
but before history is recorded, rerunning fails safely on the existing table.
Inspect the actual schema and migration history before manually recording a
verified completed migration; do not drop tables or mark failed SQL as applied.
Back up production before future schema changes. No automatic rollback is offered.

### API contract and manual verification

`POST /api/reservations` accepts `Content-Type: application/json`:

```json
{
  "name": "Example Name",
  "phone": "+31612345678",
  "email": "example@example.com",
  "reservationDate": "2026-10-20",
  "reservationTime": "13:30",
  "guestCount": 4,
  "message": "Optional message"
}
```

Choose a non-past Tuesday–Saturday for testing. Email and message are optional.
Text is trimmed and email lowercased; phone formatting is preserved. Limits are
120/32/254/1000 characters for name/phone/email/message. Phone validation permits
common international punctuation and requires at least six digits, without
country-specific parsing. Guest count must be an integer from 1 to 65535; the
upper bound is the SQL type's technical limit, **not restaurant capacity**.
Dates use the `Europe/Amsterdam` calendar, Monday/Sunday are closed, and times
must be `10:00` or later and strictly before `16:30`. Any minute is accepted;
same-day requests have no additional lead-time or High Tea rule.

Success returns HTTP 201 with `{ "success": true, "reservationId": 123,
"status": "pending" }`. `createReservation` takes validated/normalized data and
always inserts the literal `pending` using prepared parameters. The public form
uses this API; future chatbot callers must reuse the same validator and service.
Unknown fields (including status, IDs, and timestamps) are rejected. The optional
transport-only `contact_url` honeypot is removed before reservation validation;
nonempty or non-string values return a generic 400 `INVALID_REQUEST` without
creating a row or describing the trap. No public read/list endpoint exists.

Validation returns 400 with `error.code: "VALIDATION_ERROR"` and `error.fields`;
malformed JSON returns 400, unsupported content types 415, bodies above the 16 KiB
technical limit 413, and other HTTP methods 405 with `Allow: POST`. Database/server
failures return only a generic Dutch 500 message. Responses use `Cache-Control:
no-store`; logs contain only configuration field names or safe error codes,
never SQL or complete reservation payloads. No permissive CORS headers are added.

With a configured local database, run migrations twice to verify the second run
skips them. Send the JSON above using your HTTP client, verify HTTP 201 and the
stored `pending` row, then test missing fields, impossible/past dates, Monday,
Sunday, `09:59`, `16:30`, and a client-supplied `status: "confirmed"` (all 400).
Check `10:00`, `16:29`, and a time such as `13:31` succeed. Query the test row using
your local database client, then delete **only its returned ID**, with a
parameterized query; do not clear the table. Do not use real customer data in tests.

### Public reservation form

`/reserveren` uses native controls and a small vanilla TypeScript enhancement to
POST JSON. Successful submissions require runtime DB configuration. Name and phone
are required; email and message remain optional. The date minimum and immediate
closed-day feedback share pure Amsterdam date helpers with server validation.
Desired times are 30-minute options from 10:00 through 16:00, not live availability;
the backend still accepts any valid minute before 16:30. No capacity or High Tea
rule is added. Server field errors remain authoritative.

The form locks submission during a request, associates inline errors with controls,
and replaces itself with a request-received panel on HTTP 201. Personal fields
are reset, the summary contains only date/time/party size, and no database ID is
displayed. Requests remain pending until Turuncu confirms them. No automatic
confirmation or email is implemented. The separate admin workflow is described
below. Without JavaScript the form stays disabled to prevent accidental non-JSON
submission; phone, Instagram,
and Contact remain usable. A concise purpose-of-use note is shown near Submit.

Astro's `security.allowedDomains` permits exactly `turuncugouda.com` and
`www.turuncugouda.com`, using HTTPS. `security.checkOrigin` stays enabled.
Astro reconstructs the external URL from validated proxy headers
before its built-in CSRF check and application routes. The shared application
guard then requires a supplied `Origin` to match that URL exactly: apex and www
are not interchangeable within a request. Remote HTTP origins, other hosts and
nondefault ports are rejected. Direct loopback development/tests retain exact
scheme/host/port checks. Origin-less public clients remain supported; admin POSTs
always require Origin and authenticated mutations still require session-bound CSRF.

Hostinger must overwrite client-supplied forwarding headers, provide
`X-Forwarded-Proto: https`, and preserve the public `Host` or set
`X-Forwarded-Host` to the matching approved domain. Optional forwarded port must be
`443`. The guard rejects unapproved/conflicting hosts, HTTP or malformed protocols,
nondefault ports and comma-separated header chains even if Astro would ignore them.
Missing external scheme/host information fails closed; it is not guessed from Origin.
Keep the Node origin inaccessible outside the trusted proxy and verify live HTTPS
login, requests and trusted client IPs after deployment. No CORS permission or spam
protection is introduced. See Astro's
[proxy/security configuration](https://docs.astro.build/en/reference/configuration-reference/#securityalloweddomains).

Real production rate limiting remains required before public launch. The public
endpoint has no in-memory/distributed limiter or CAPTCHA. Assess additional spam
protection if needed and define privacy/retention/deletion policy. Email, chatbot,
capacity management, and deployment remain later checkpoints.

## Local reservation admin setup

One environment-configured administrator is supported. No user table, registration,
password recovery, or frontend framework is involved. Keep all credentials in ignored
local `.env` configuration or the hosting environment, never `PUBLIC_` variables.

1. Run `npm run admin:hash-password` in an interactive terminal. Enter and repeat
   your chosen password (at least 12 characters; input is hidden). The helper rejects
   pipes and password arguments, writes prompts to stderr, and prints only the final
   encoded hash to stdout. Use `npm run --silent admin:hash-password` to suppress npm's
   command banner. It never writes your password or hash to a file.
2. Add `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET` to your
   existing `.env` without replacing the existing DB settings. Username matching is
   case-sensitive and trims outer whitespace; passwords are never trimmed.
3. Generate the session secret locally using
   `node -p "require('node:crypto').randomBytes(32).toString('base64url')"`.
   Copy its output into `ADMIN_SESSION_SECRET`; keep it private. The example file
   contains placeholders, not usable credentials.
4. The existing DB account needs SELECT and INSERT on `reservations`, and
   `UPDATE (status)` on `reservations`. A local database administrator can grant
   the latter using the existing account's exact user/host; no schema migration
   or database reset is needed. DELETE is only needed for integration-test cleanup,
   never by the admin application. Keep migration privileges separate in production.
5. Run `npm run dev` and open `http://localhost:4321/admin/login`.

`/admin/reservations` lists today and future reservations using the Amsterdam
calendar, sorted by reservation date/time then creation time. Creation timestamps
are also displayed in Europe/Amsterdam. Status links use validated URL filters:
Alle, In afwachting, Bevestigd, Geannuleerd. Cards show contact links and escaped
customer messages. Pending requests can be confirmed/cancelled; confirmed ones can
be cancelled. Cancelled requests remain stored. Updates compare the expected current
status and report stale submissions instead of overwriting. No email or SMS is sent:
the administrator must contact the guest separately.

Passwords use Node scrypt (N=32768, r=8, p=1), a random 32-byte salt and a 64-byte
key, encoded as `scrypt:32768:8:1:<salt-hex>:<key-hex>`. Colon separators avoid
Astro/Vite's dollar-variable expansion, so the same `.env` works with Node's env-file
loader. Verification and authentication signatures use constant-time comparison.
Sessions are HMAC-SHA256 authenticated
cookies with a random session nonce, identity, issued-at and expiry. Cookies are
HttpOnly, SameSite=Strict, scoped to `/admin`, and expire after ten hours without
sliding renewal. Secure is mandatory in production and on HTTPS requests; development
HTTP remains usable. Changing the username/hash/session secret invalidates existing
sessions. Logout expires the browser cookie; a separately copied signed cookie remains
valid until expiry or credential rotation (there is no server-side session registry).

All admin POSTs require an exact Origin; authenticated status/logout forms also
require a cryptographically authenticated, session-bound CSRF token. Login uses
same-origin enforcement and generic errors. A bounded process-local limiter allows
five login attempts per client address per 15 minutes, resets after successful login,
and expires automatically. It is neither durable across restarts nor shared across
instances. It is a local safeguard, not production-grade rate limiting. Saturation
temporarily rejects new addresses until entries expire. Client addresses come from
the adapter; trusted-proxy/IP handling must be reviewed before deployment, including
stripping untrusted forwarded headers and preventing direct access to the origin.

Admin responses use `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`,
`Referrer-Policy: same-origin` and anti-framing headers. This keeps native same-origin
form POSTs compatible with strict Origin checks while suppressing cross-origin
referrer leakage. Authentication is checked on every
protected request; there is no public list API. Missing admin configuration fails
closed with a generic response and safe server-side diagnostics. Builds and unit
tests do not need admin credentials or a running database.

For repeatable **local-only** integration verification, first build, then explicitly
set `ADMIN_INTEGRATION_LOCAL=1` and run `npm run test:admin-integration`. In PowerShell:

```powershell
npm run build
$env:ADMIN_INTEGRATION_LOCAL = '1'
npm run test:admin-integration
Remove-Item Env:ADMIN_INTEGRATION_LOCAL
```

The script reads existing `.env` DB settings, generates temporary admin credentials
only in child-process memory, starts an isolated built server, checks the public/admin
HTTP flows and real status updates, and removes only exact IDs with its unique test
marker. It checks that the row count returns to its initial value. Run without other
writers against the local database. It never changes `.env`, users, grants, schema,
migration history, or existing reservations. No generated login password is printed.
For manual login, set your own hash using the interactive helper above.

Production acceptance still requires verifying HTTPS/proxy Origin reconstruction,
Secure cookies, trusted client IPs, authentication hardening
and durable upstream rate limiting before launch. Privacy/retention/deletion rules
remain unresolved. Future notifications may use Hostinger SMTP once available;
database state remains authoritative and future email failure must not roll back a
successful reservation/status update. No SMTP dependency or settings are added now.

## Reservation privacy and manual retention maintenance

`/privacy` describes reservation-data collection and use in Dutch and is linked
from the reservation form and public footer. The exact retention period still
requires owner approval before production launch. No automatic cleanup, cron,
cookie banner, or notifications are added.

Migration `002_allow_reservation_anonymization.sql` makes `name` and `phone`
nullable and adds nullable `anonymized_at`. Public requests still require name and
phone and start pending. Anonymization clears name, phone, email and message,
marks the row, and preserves ID, visit date/time, guest count, status and creation
time. The existing update timestamp records the change. Marked rows are skipped
on later runs. Admin rendering uses “Geanonimiseerd” without contact links or
messages; the current today/future view is retained.

Maintenance shares `DB_HOST`, `DB_PORT`, `DB_NAME` and connection settings, but
requires separate server-only `MAINTENANCE_DB_USER` and `MAINTENANCE_DB_PASSWORD`.
It never falls back to the runtime account. Supply these privately in the process
environment or ignored local configuration. Missing credentials fail closed.
Only an explicitly supplied empty maintenance password is permitted for loopback
database hosts; external maintenance connections require a nonempty password.
The application account's nonempty-password requirement is unchanged.

Use a maintenance account with SELECT and column-level UPDATE on `name`, `phone`,
`email`, `message`, `anonymized_at` for the reservations table only. Do not broaden
the runtime account, which only needs UPDATE(status). Neither DROP nor DELETE is
needed by cleanup. Schema migrations require a separately privileged account with
ALTER/CREATE/INDEX and migration-history SELECT/INSERT permissions; the migration
runner can explicitly use the maintenance configuration:

```sh
npm run db:migrate -- --maintenance
npm run reservations:cleanup -- --before=YYYY-MM-DD
npm run reservations:cleanup -- --before=YYYY-MM-DD --apply
```

Replace `YYYY-MM-DD` with an explicitly reviewed cutoff. It is exclusive: only
visits before it are eligible, in any reservation status. Today and future visits
are always protected using Europe/Amsterdam, and future cutoffs are rejected.
Today's date is allowed as an exclusive bound. There is no default age or period.
Without `--apply` the command only counts; with it, one parameterized UPDATE clears
the personal fields of matching, not-yet-anonymized rows. Output contains only mode,
cutoff and count. Repeating it does not rewrite marked rows.

Use this mechanism only after an owner-approved retention decision or a specifically
reviewed maintenance need. Anonymization cannot be undone without a backup. Never
apply against production without backup and review of the dry-run count/cutoff and
the intended database. No row deletion, schema/migration-history modification,
AUTO_INCREMENT reset or automatic schedule is performed by cleanup.

After building, the opt-in `npm run test:retention-integration` requires
`RETENTION_INTEGRATION_LOCAL=1` and explicitly configured local maintenance
credentials, plus the existing runtime DB settings. Its test setup/cleanup needs
INSERT/DELETE in addition to maintenance privileges; these are test-only needs,
not permissions required by the cleanup command. It refuses to apply if unrelated
eligible rows exist at its old test cutoff. It verifies real dry-run/apply behavior,
idempotence, date protection, anonymized admin cards and public privacy links, then
removes only its exact test IDs. Use a local database without concurrent writers.
Do not run this test against production.

## Deployment direction

Production direction is Hostinger **Node hosting/runtime plus Hostinger MySQL**.
A static-only or PHP/Apache-only plan cannot run this API. Confirm the actual
plan, supported Node version, runtime start command (`npm start`), network access
and database TLS requirements, and GitHub delivery workflow before deployment.
No hosting connection, deployment, or CI workflow is configured here.

Build with `npm run build`; deploy both `dist/client/` and `dist/server/` plus
the runtime dependencies. Configure production `DB_*` variables in hosting, using
the supplied database hostname and credentials rather than localhost assumptions.
For an external database connection, confirm the provider's private-network/TLS
setup before enabling traffic; this initial configuration does not specify custom
TLS certificates. Run `npm run db:migrate` with production migration credentials
and the repository's migration files **before enabling reservation submissions**.
Public content remains prerendered using `output: 'static'`; the API and admin
pages/actions opt out with `prerender = false`, following Astro's
[on-demand rendering model](https://docs.astro.build/en/guides/on-demand-rendering/)
and [official Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/).
Customer data never enters static output.

## SEO and production environment

`astro.config.mjs` is the canonical production-origin source. It currently uses
`https://www.turuncugouda.com`. Public BaseLayout metadata, homepage business JSON-LD,
sitemap and robots.txt derive absolute URLs from that configuration. Canonicals use
`/` for the homepage and omit trailing slashes elsewhere; existing slash-tolerant
routing is retained and query/hash variants share the preferred canonical. Canonical
metadata does not configure DNS, redirects, HTTPS or trusted proxy hosts.

The shared public layout requires a title/description and accepts `canonicalPath`,
an optional `socialImage` (src/alt/optional dimensions), optional `robots` and trusted
`structuredData`. Page descriptions are Dutch and unique. Open Graph/Twitter cards
use a built JPEG generated from the real börek-and-coffee photo; normal page-image
optimization is unchanged. Only the homepage emits CafeOrCoffeeShop JSON-LD, using
verified address, phone, social links and Tuesday–Saturday 10:00–16:30 hours.

The official `@astrojs/sitemap` integration generates `sitemap-index.xml` and
`sitemap-0.xml`. Only `/`, `/menu`, `/galerij`, `/reserveren`, `/privacy` are included.
The prerendered `robots.txt` points to that index and discourages admin/API crawling;
authentication remains authoritative. The Dutch custom 404 is noindex/follow and
excluded from the sitemap. Admin uses its separate layout and noindex/no-store
headers. A clean favicon-ready brand export is still needed; the supplied logo with
black margins remains unchanged. No analytics, tracking or consent banner is added.

After `npm run build`, run `npm run test:seo` for repeatable output/HTTP checks.
It checks titles, descriptions, canonical/social URLs, JSON-LD, sitemap/robots,
404 status, headings, internal anchors, image metadata, inline/external script sizes,
private headers and absence of baked configuration secrets. It needs no database
or real admin configuration and starts/stops an isolated local built server.

Configure actual production values privately in the server process environment.
Never commit them, prefix them with `PUBLIC_`, or assume the standalone server loads
a local `.env` file:

| Scope | Server-side variables | Use |
| --- | --- | --- |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Required for reservation/admin DB access; use the production database and least-privilege runtime account |
| Database | `DB_CONNECTION_LIMIT` | Optional pool bound, default 5; review against hosting limits |
| Admin | `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` | Required for one admin; generate a production scrypt hash and fresh strong session secret, never reuse the temporary local credential |
| Maintenance | `MAINTENANCE_DB_USER`, `MAINTENANCE_DB_PASSWORD` | Required only for explicit cleanup or `db:migrate -- --maintenance`; use separate credentials with appropriate operation-specific privileges |

Hostinger-specific runtime/start settings, database credentials/networking/TLS,
maintenance access and external URL reconstruction must be verified on Hostinger.
The two approved HTTPS hosts are configured in `security.allowedDomains`; verify real
HTTPS Origin/client-IP handling through the trusted proxy. Do not trust arbitrary
forwarded headers. Production must consistently redirect the noncanonical domain
variant, likely apex to www; the decision and actual Hostinger redirect syntax remain
pending. No DNS, redirect or hosting configuration is supplied here.

## Production prelaunch checklist

All items below remain unverified launch requirements:

- [ ] Owner confirms remaining menu prices/product wording and High Tea details.
- [ ] Owner approves a concrete reservation retention duration and reviews privacy copy.
- [ ] Hostinger Node runtime and start configuration are confirmed; production MySQL exists.
- [ ] Production DB/admin environment values and any separate maintenance credentials are configured securely.
- [ ] Database networking/TLS, least privileges, backups and recovery procedure are reviewed.
- [ ] Versioned migrations are applied with the appropriate credentials before accepting requests.
- [ ] HTTPS works; www/apex canonical and redirect decisions are implemented consistently in hosting.
- [ ] External host/scheme, allowed domains, Origin checks and trusted client-IP handling are verified behind the real proxy.
- [ ] Public reservation requests are tested in production and remain pending until Turuncu confirms.
- [ ] Admin login, Secure cookies, CSRF, status actions and logout are tested over HTTPS.
- [ ] Durable production reservation/admin rate limiting is enabled; the process-local login limiter alone is insufficient.
- [ ] Mobile/desktop browser acceptance is completed for navigation, gallery, form, privacy and 404.
- [ ] Sitemap, robots.txt, canonical/social image URLs and structured data are checked on the deployed domain.
- [ ] SMTP notifications are configured and tested only if desired once hosting/mail is available; they are currently absent.

SMTP setup, deployment, durable rate limiting and automatic retention scheduling
are separate tasks. No SMTP variables, mail package or cron are introduced here.
