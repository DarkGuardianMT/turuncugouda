# Development and operations

Detailed local setup, API behavior, security boundaries, maintenance and deployment
operations. Start with the [project overview](../README.md) and
[current project status](../PROJECT_CONTEXT.md#current-status--27-october-2026).
Production is live on Hostinger behind an HTTPS reverse proxy; GitHub `main`
auto-deploys. NEVER commit or push without explicit user approval. Implement and
verify locally, report changes, and stop for approval as required by
[agent guidance](../AGENTS.md#git-workflow).

## Verification baseline — 27 October 2026

The audit reviewed main commit `e4b609483fa33d5fb00e86a3549b8a2dc2e766c8`.
These are recorded results, not checks repeated by this documentation cleanup:

| Evidence | Scope and limits |
| --- | --- |
| Local automated checks | 168/168 native Node tests, zero Astro diagnostics, build and SEO checks passed. |
| Prior local DB integrations | Reservation creation/pending storage, admin sessions/CSRF/status changes, manual anonymization and durable quotas across pools/processes/restarts passed in isolated local tests. These do not prove production behavior. |
| Live public/SEO checks | All five public pages returned 200; public content and SEO endpoints were checked. Unauthenticated `/admin/reservations` redirected to login. |
| Live backend acceptance | Still pending: successful reservation POST, authenticated admin session/update, SMTP acceptance/inbox delivery, actual DB grants, real proxy client IPs, production quota probe and isolated production-backup restore. Live checks were GET-only plus harmless UI interactions. |
| Owner-reported prerequisites | Migration 003 table/history and Hostinger `RATE_LIMIT_SECRET` were reported ready; runtime grants, secret validity and actual limiter behavior were not independently verified. |
| Dependency audit | undici and zod High, fast-uri Moderate were reported on 27 October (three affected packages). Re-run `npm audit` against the current lockfile before claiming current exposure or remediation; review changes and run relevant checks rather than applying a forced upgrade blindly. |

The release is deployed; end-to-end production acceptance is open. Use the
[categorized acceptance checklist](#production-acceptance-checklist) to record
new evidence without treating deployment or a login-page GET as backend verification.

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
4. Run `npm run db:migrate`. Set server-only `RATE_LIMIT_SECRET` as described
   under [durable rate limiting](#durable-rate-limiting) and grant the runtime
   account access to `rate_limits` before testing POSTs/login.
5. Run `npm run dev` and use `http://localhost:4321`.

Astro loads local environment files during development. The migration command
uses Node's built-in `--env-file-if-exists=.env` and reads only `.env` plus the
process environment; already exported variables take precedence. It does not
load `.env.local`. The standalone production server reads the process environment,
so configure it in hosting rather than assuming it loads `.env`. For a local
built-server test with your `.env`, run
`node --env-file=.env ./dist/server/entry.mjs` after building. `HOST` and `PORT`
can configure the standalone listener.

No connection or required DB configuration is evaluated until a rate-limited
reservation/login POST, another database operation or migrations run. Static pages,
`npm run check`, `npm test`, and `npm run build`
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
column for admin actions and SELECT/INSERT/UPDATE/DELETE on `rate_limits`.
Separate migration credentials can be exported for the
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
  "reservationDate": "2026-10-31",
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

After a successful insert, the API awaits one internal SMTP notification attempt.
Its result never changes the HTTP 201 contract or the stored `pending` reservation;
see [notification setup](#reservation-notification-email).

Validation returns 400 with `error.code: "VALIDATION_ERROR"` and `error.fields`;
malformed JSON returns 400, unsupported content types 415, bodies above the 16 KiB
technical limit 413, and other HTTP methods 405 with `Allow: POST`. Database/server
reservation-insert failures return only a generic Dutch 500 message. Limiter failures
return generic 503; quota exhaustion returns 429 with `Retry-After` (see below).
Responses use `Cache-Control:
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
confirmation or email is sent to the guest. The separate admin workflow is described
below. Without JavaScript the form stays disabled to prevent accidental non-JSON
submission; WhatsApp and phone remain available as contact alternatives.
A concise purpose-of-use note is shown near Submit.

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
login, requests and trusted client IPs for production acceptance. No CORS permission or
custom proxy-header parsing is introduced. See Astro's
[proxy/security configuration](https://docs.astro.build/en/reference/configuration-reference/#securityalloweddomains).

Durable MySQL limiting is implemented and included in the deployed release;
real proxy/client-address and quota acceptance remains pending. CAPTCHA is not
included. Assess additional spam protection if needed and define
privacy/retention/deletion policy. Guest email,
chatbot and capacity management remain deferred.

## Durable rate limiting

Both `admin_login` and `reservation` allow **five attempts per client address in
a fixed 15-minute window**, independently. State is shared through the existing
MySQL/MariaDB pool, including apex/www instances and process restarts. There is
no memory fallback or external service. Existing successful reservation creation
and its subsequent best-effort SMTP notification are unchanged.

### Configuration and privacy

Add **`RATE_LIMIT_SECRET`** to the server environment. Generate a private random
base64url value from at least 32 random bytes, independently of the admin session
secret, for example with
`node -p "require('node:crypto').randomBytes(32).toString('base64url')"`.
Do not put its output in documentation, Git, browser scripts or public env vars.
Use the same secret on every instance sharing the database. Rotation changes
subject hashes and effectively resets current quotas; coordinate rotation across
instances. `.env.example` contains only an intentionally unusable placeholder.

Validation is lazy, at consume/reset: 43–128 base64url characters decoding to at
least 32 bytes. Missing/invalid configuration fails closed with generic 503 on
the protected POST; it does not prevent public static rendering/builds. No
secret value or configuration/driver exception is returned or logged.

Only Astro's runtime `context.clientAddress` is used. The application never reads
`X-Forwarded-For`, `Forwarded` or another IP header for a fallback. IPv4 is
validated; IPv6 is canonicalized with Node's IP/URL APIs; IPv4-mapped IPv6 is
normalized to IPv4. Unavailable/invalid addresses (including getter errors, header
chains, ports and zone identifiers) fail closed. There is no shared anonymous key.
**Astro's adapter may itself use forwarding headers for a trusted host.** Hostinger
must overwrite untrusted forwarding headers and prevent direct public access to
the Node origin; actual runtime client-address verification is still pending.
The application supplies no Hostinger proxy configuration.

The stored subject is hexadecimal `HMAC-SHA-256(secret, normalizedAddress)` using
Node crypto; raw IPs never reach SQL. Scope/hash, current window/count and update
time are the only stored state. Hashes are pseudonymous limiter identifiers,
not anonymous statistics. Logs contain only fixed generic codes, never addresses,
hashes, bodies, credentials, SQL or provider errors.

### Storage, concurrency and request order

`003_create_rate_limits.sql` creates one InnoDB `rate_limits` table:
`scope VARCHAR(32)` + `subject_hash CHAR(64)` use ASCII binary collation and form
the primary key; `attempt_count` is unsigned INT; `window_started_at` and
`updated_at` are DATETIME(3), written using the database's **UTC clock**. An index
on `updated_at` supports cleanup. Migrations 001/002 remain unchanged.

Each consumption acquires one pool connection and starts a transaction. A
parameterized INSERT with a no-op duplicate-key update creates/locks the unique
row, followed by SELECT FOR UPDATE. Under that lock, expiry resets count to one;
otherwise an allowed attempt increments count. The sixth request is blocked
without extending the window or increasing the capped count. Commit precedes
the returned decision. No application lock coordinates requests. SQL failures
roll back and release the connection; a failed/uncertain commit never authorizes
work. `retryAfterSeconds` rounds the remaining database-clock window up to a
positive integer. Configurable windows are bounded to 15 minutes so cleanup can
never remove an active supported window.

Reservation ordering is: Origin → JSON content-type → durable consumption →
bounded 16 KiB body read/UTF-8/JSON parsing → honeypot → unchanged business
validation → reservation INSERT → unchanged SMTP attempt → existing HTTP 201.
Consequently malformed/oversized JSON, honeypots and invalid business fields
consume quota. Rejected Origins, incompatible media types and non-POST methods
are rejected cheaply without storage work. Exhaustion returns HTTP 429:

```json
{"success":false,"error":{"code":"RATE_LIMITED","message":"Te veel aanvragen. Probeer het later opnieuw."}}
```

`Retry-After` contains seconds; responses remain `no-store`. No hash, count or
internal database metadata is exposed. The existing form's generic-error path
handles this without changing its UX.

Admin login keeps existing same-origin/bounded form parsing first. Each eligible
login attempt consumes `admin_login` before expensive credential verification.
Failures retain the existing invalid-login redirect. Exhaustion redirects to
`/admin/login?notice=limited`. Successful authentication deletes only that
scope/subject before issuing the unchanged signed session cookie. Reset failure
returns 503 without a cookie. Existing session, CSRF, logout and status logic
are unchanged; the old memory limiter has been removed.

### Failure and cleanup policy

Limiter read/write/config/address failures **fail closed**: reservation POSTs
return HTTP 503 `SERVICE_UNAVAILABLE` with a generic Dutch message, admin login
returns its existing generic 503, and no reservation, notification or session is
created. Fixed `RATE_LIMIT_UNAVAILABLE` logs disclose no details. Reservations
already require the same database, so accepting unprotected requests during
storage failure would provide little availability benefit. There is no automatic
retry that could double-consume an uncertain committed attempt.

After a committed decision, at most once per minute per process, an indexed
DELETE removes **up to 100 rows older than one hour**, oldest first. Blocked
requests do not refresh timestamps. The local timer only bounds cleanup work;
it never holds quota state. No cron, worker or history table is added. Idle
systems retain stale rows until later traffic; a backlog drains in bounded
batches, so this is opportunistic retention rather than a hard deletion deadline.
Cleanup failure logs only `RATE_LIMIT_CLEANUP_FAILED` and leaves the committed
quota decision intact; consumption/storage failures still fail closed.

### Local verification and production ordering

`npm test` covers core behavior and both real routes using an isolated driver
stub, including failure, privacy and ordering cases. With a dedicated loopback
database and explicit maintenance credentials, after building run:

```powershell
$env:RATE_LIMIT_INTEGRATION_LOCAL = '1'
npm run test:rate-limit-integration
Remove-Item Env:RATE_LIMIT_INTEGRATION_LOCAL
```

This opt-in command applies/repeats migrations using the existing checksum runner,
checks 30 concurrent consumptions across independent pools, real expiry/reset,
bounded cleanup, and built HTTP across two processes, a restart and apex/www.
It verifies reservation success and admin session issuance, disables real SMTP,
deletes only its synthetic hashes/marked reservation IDs and preserves `.env`.
Runtime credentials need the permissions below before running. Do not run against
production or alongside unrelated writers. Existing admin/retention integration
scripts use independent ephemeral limiter secrets and remove their own keys.

Migration 003 was published in `74b1cc5`; the limiter implementation followed in
`611b212` and is included in the deployed main snapshot. The owner reported the
production table/history and `RATE_LIMIT_SECRET` ready. That is not verification
of production runtime grants, client addresses or quota behavior. Prior integration
verification used only an isolated loopback database and did not inspect/change
the hosting secret or execute production SQL.

For a new environment or future release, preserve this dependency order. Do not
reapply or manually mark existing migrations without inspecting history. Main
auto-deploys; every commit/push still requires explicit user approval:

1. Back up the intended production database and verify existing migration history.
2. Apply the reviewed migration 003, if outstanding, with
   `npm run db:migrate -- --maintenance` in a controlled shell configured for the
   intended database/maintenance account. It records the normalized SHA-256
   checksum in `schema_migrations`; never edit/replace migrations 001/002 or
   manually mark an unverified migration applied. Inspect schema/history on
   partial DDL failure; do not reset or drop existing tables.
3. Grant the existing production runtime account **SELECT, INSERT, UPDATE,
   DELETE on `rate_limits` only**, preserving all existing reservations grants.
   Example placeholders (use the account's actual host, not a guessed host):

   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON your_database.rate_limits
     TO 'your_runtime_user'@'your_runtime_host';
   ```

4. Configure `RATE_LIMIT_SECRET` on Hostinger and every instance,
   with the same private generated value. Existing DB/admin/SMTP vars stay as-is.
   For future additions, establish schema/settings before dependent code deploys.
5. Only after prerequisites and local verification are complete, report the
   release and stop for explicit user approval before committing or pushing main.
   A push triggers the normal Hostinger deployment.
6. Verify runtime health, reservation 201/429/Retry-After, admin login/reset and
   actual trusted client-address behavior over live HTTPS. Missing prerequisites
   intentionally produce 503; static content continues working.

Step 6 remains open for the deployed release. Production testing needs an
explicitly authorized synthetic test and reviewed cleanup, not a replay of the
local integration scripts against production. Future deployments still need the
schema, runtime grants and shared secret ready before an auto-deploying push.

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
   never for reservation rows by the admin application. The shared limiter also
   requires `RATE_LIMIT_SECRET` and SELECT/INSERT/UPDATE/DELETE on `rate_limits`;
   see [durable rate limiting](#durable-rate-limiting). Keep migration privileges
   separate in production.
5. Run `npm run dev` and open `http://localhost:4321/admin/login`.

`/admin/reservations` lists today and future reservations using the Amsterdam
calendar, sorted by reservation date/time then creation time. Creation timestamps
are also displayed in Europe/Amsterdam. Status links use validated URL filters:
Alle, In afwachting, Bevestigd, Geannuleerd. Cards show contact links and escaped
customer messages. Pending requests can be confirmed/cancelled; confirmed ones can
be cancelled. Cancelled requests remain stored. Updates compare the expected current
status and report stale submissions instead of overwriting. Admin status actions send no email or SMS:
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
same-origin enforcement and generic errors. The shared MySQL limiter allows five
attempts per runtime client address per 15 minutes and resets after successful
login; see [durable rate limiting](#durable-rate-limiting). Trusted-proxy/IP handling
remains pending for production acceptance, including stripping untrusted forwarded
headers and preventing direct access to the origin.

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
and actual durable MySQL limiter behavior in the deployed release. Privacy/retention/deletion rules
remain unresolved. New public requests trigger the internal SMTP notification below;
admin status updates send no mail. The administrator still contacts guests separately.

## Reservation notification email

Nodemailer sends an internal plain-text Dutch notification after a successful
`POST /api/reservations` insert. Set these **server process environment** values
in Hostinger; `.env.example` contains placeholders only:

| Variable | Production value |
| --- | --- |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `reserveringen@turuncugouda.com` |
| `SMTP_PASSWORD` | The mailbox password, supplied privately through the environment only |
| `SMTP_FROM` | `reserveringen@turuncugouda.com` |
| `RESERVATION_NOTIFICATION_TO` | `turuncugouda@gmail.com` |

All six variables are required for mail. They are read with `astro:env/server`
only when the mail service is called. Never use `PUBLIC_`, `VITE_`, client scripts,
or a checked-in environment file for these values. Use plain single email addresses
for From and recipient. The client always uses `secure: true` (direct SSL/TLS),
with normal certificate validation; use port 465 for Hostinger. No credentials,
addresses or SMTP host are hardcoded in application code. See the official
[Nodemailer SMTP options](https://nodemailer.com/smtp).

The exact flow is validation → parameterized MySQL INSERT with status `pending`
→ one awaited `sendMail` attempt → the existing HTTP 201 JSON response. The message
has subject `Nieuwe reserveringsaanvraag`, From `SMTP_FROM`, and a single recipient
`RESERVATION_NOTIFICATION_TO`. It includes name, date (DD-MM-YYYY), time, guest
count, phone, optional email/message and `Status: In afwachting`. Optional fields
are omitted when empty. Customer input is used only in the plain-text body, never
in recipient or subject headers. No guest email or admin-status notification is sent.

A failed insert never sends mail. Missing/invalid SMTP settings, transport setup
errors and SMTP rejection/timeouts are caught separately after storage. They never
delete/roll back a row or change API success. Only the fixed diagnostic
`Reservation notification failed: SMTP_NOTIFICATION_FAILED` is logged; no error
object, provider response, credentials or reservation fields are logged. SMTP
debugging is disabled. Connection/DNS/greeting timeouts are 5 seconds and the idle
socket timeout is 10 seconds, so an unavailable provider does not use Nodemailer's
long defaults. The response waits for the attempt; these are stage/idle timeouts,
not a total delivery deadline. There is no retry queue or automatic resend. SMTP
acceptance does not guarantee inbox delivery; stored requests remain visible in admin.

Public rendering, checks and builds require no SMTP configuration or connection.
`npm test` uses synthetic environment values and mocked DB/SMTP boundaries to exercise
the real API/services without sending mail or touching records. Production acceptance
must separately verify the configured mailbox and receipt in Gmail with an authorized
test request. Mail copies contain personal data; the manual database anonymization
command does not remove copies from the sender/recipient mailboxes.

The opt-in DB integration scripts run the built API and inherit the process
environment. Leave SMTP unconfigured or use an isolated test SMTP inbox when running
them locally; configured production SMTP would also receive their synthetic requests.

## Reservation privacy and manual retention maintenance

`/privacy` describes reservation-data collection and use in Dutch and is linked
from the reservation form and public footer. The exact retention period still
requires owner approval for live operations. No automatic cleanup, cron,
cookie banner, or retention notifications are added.

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

## Backup and isolated restore verification

Backup availability and recovery are not verified by the public-site checks or
local integration tests. Before schema changes or production anonymization, obtain
an authorized backup of the intended database and confirm the actual provider's
backup/export procedure, access controls and recovery options. Keep dumps out of
Git and documentation; they may contain personal data. Record only safe operational
metadata, not credentials, records or dump contents.

1. Review the intended source database and backup scope, including schema,
   reservations and `schema_migrations`; check that the backup completed.
2. Prepare a separate, isolated test database/account with no access to production
   or unrelated databases. Confirm the restore target explicitly before importing.
   Use a provider-reviewed procedure; do not invent Hostinger restore commands or
   assume a production backup can safely be imported with unchanged database names.
3. Restore only into that isolated database. Check schema, migration history and
   aggregate row counts without logging customer data. Use the restored migration
   history to determine any outstanding migrations; do not edit applied files or
   reset tables to make checks pass.
4. If exercising a built server, use isolated DB credentials, fresh test admin and
   limiter secrets, and disabled SMTP or an isolated test inbox. Prevent public
   access. Do not run integration scripts that insert/delete records on the backup
   copy without separately reviewing their isolation requirements.
5. Record the date, reviewed backup scope and recovery outcome. Clean up the
   isolated copy under the approved maintenance policy. Do not overwrite production
   as a restore test. Restoring/anonymizing real production data remains a separate,
   explicitly reviewed operation; no restore was performed during the audit.

## Deployment and release operations

Production already runs on Hostinger **Node standalone hosting plus Hostinger
MySQL**, behind HTTPS termination. GitHub `main` automatically deploys to
`https://www.turuncugouda.com/`. The reviewed main snapshot is
`e4b609483fa33d5fb00e86a3549b8a2dc2e766c8` on 27 October 2026. There is no
repository CI workflow currently configured. A working public deployment does not
verify database grants, successful admin sessions, SMTP delivery or proxy client IPs.

For future releases, implement and verify locally, review the diff and dependencies,
and report the concrete change before requesting explicit commit/push approval.
Do not treat historical approval for a prior release as permission for another push.
Check migration/runtime prerequisites before allowing the auto-deploying push.

Build with `npm run build`; the artifact contains `dist/client/` and
`dist/server/` and needs runtime dependencies. `npm start` runs the standalone
entry point. Package engines require Node >=22.12.0 and npm >=10.8.2; Node 24 was
used for prior local verification. Confirm the actual Hostinger runtime/start
settings rather than assuming them from a successful static-page response.

Configure production `DB_*`, admin, SMTP and limiter variables privately in the
server process environment. Verify the provider's actual database hostname,
networking/TLS and least-privilege grants; this repository supplies no custom DB TLS
certificates. Back up before schema changes, inspect existing history and apply
only outstanding reviewed migrations with the appropriate migration credentials
before code depends on them. Migration 003/history and the limiter secret are
owner-reported ready; runtime grants and behavior still require live verification.

Public content stays prerendered with `output: 'static'`; API/admin routes use
`prerender = false`, following Astro's
[on-demand rendering model](https://docs.astro.build/en/guides/on-demand-rendering/)
and [official Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/).
Customer data never enters static output. After an approved release, distinguish
public GET/SEO checks from the authorized reservation/admin/SMTP and quota
acceptance checks below. Never run local-only integration scripts against production.

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
headers. No analytics, tracking or consent banner is added.

Favicons use the unchanged transparent source artwork in `src/assets/faviconturuncu.png`.
Run `npm run favicon:generate` after replacing that source to regenerate the four
committed files in `public/`: a 16/32/48px ICO, 16px and 32px PNGs, and the 180px
Apple touch icon. The script uses the existing Sharp installation to trim transparent
outer whitespace, ignoring alpha-1 noise with a two-source-pixel guard around the
full visible circle. It preserves aspect ratio and adds approximately 6.25%
transparent margin per side (1px at 16px, 2px at 32px), then applies lossless PNG
compression. The source stays unchanged; visible artwork is not cropped or flattened.
The shared `BaseLayout.astro` head links these root-relative assets on every public page,
including 404. No manifest or PWA behavior is needed for these icons.

After `npm run build`, run `npm run test:seo` for repeatable output/HTTP checks.
It checks titles, descriptions, canonical/social URLs, JSON-LD, sitemap/robots,
404 status, headings, internal anchors, image metadata, inline/external script sizes,
private headers, favicon links/transparency/visible coverage/dimensions/file sizes/HTTP responses and
absence of baked configuration secrets. It needs no database or real admin
configuration and starts/stops an isolated local built server.

Configure actual production values privately in the server process environment.
Never commit them, prefix them with `PUBLIC_`, or assume the standalone server loads
a local `.env` file:

| Scope | Server-side variables | Use |
| --- | --- | --- |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Required for reservation/admin DB access; use the production database and least-privilege runtime account |
| Database | `DB_CONNECTION_LIMIT` | Optional pool bound, default 5; review against hosting limits |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `RESERVATION_NOTIFICATION_TO` | Required for internal reservation alerts; use the Hostinger values above and supply the password privately |
| Admin | `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` | Required for one admin; generate a production scrypt hash and fresh strong session secret, never reuse the temporary local credential |
| Rate limiting | `RATE_LIMIT_SECRET` | Required server-only random base64url secret, at least 32 random bytes; identical across all instances; migration 003 and runtime table privileges are prerequisites |
| Maintenance | `MAINTENANCE_DB_USER`, `MAINTENANCE_DB_PASSWORD` | Required only for explicit cleanup or `db:migrate -- --maintenance`; use separate credentials with appropriate operation-specific privileges |

The runtime is deployed, but its actual start settings, database networking/TLS,
maintenance access and external URL reconstruction still need operational review.
The two approved HTTPS hosts are configured in `security.allowedDomains`; real
HTTPS Origin/client-IP handling through the trusted proxy remains unverified.
Do not trust arbitrary forwarded headers.

The preferred canonical origin is www. **A previous apex-to-www redirect attempt
caused a loop.** Do not blindly repeat it or infer provider redirect syntax from
canonical metadata. Inspect the real apex/www HTTP/HTTPS chain, TLS termination
and existing Hostinger rules before proposing an approved, tested redirect change.
Relevant security headers also need review against current public/admin behavior.
This reference supplies no new DNS, redirect, header or hosting configuration.

## Production acceptance checklist

Status below uses the 27 October audit and prior recorded evidence. Checked items
mean only the stated scope was confirmed. Update with dated evidence when further
verification is performed; deployment alone is not backend acceptance.

### Confirmed within scope

- [x] Hostinger Node deployment is live; GitHub main auto-deploys to production.
- [x] The reviewed main commit is `e4b609483fa33d5fb00e86a3549b8a2dc2e766c8`.
- [x] Recorded local checks passed: 168/168 tests, zero Astro diagnostics, build and SEO checks.
- [x] Prior isolated local DB integrations covered reservation/admin/CSRF/status,
  anonymization and durable quotas, concurrency and restart persistence.
- [x] Live GET checks returned 200 for all five public pages; public content and
  SEO endpoints were checked, including sitemap/robots and canonical metadata.
- [x] Unauthenticated live admin reservations redirected to login. This proves no
  successful admin session, cookie or mutation behavior.
- [x] Durable limiter code and migration 003 are present in main. Production
  table/history and limiter secret readiness are owner-reported only.

### Pending technical and operational verification

- [ ] A01: With explicit authorization, send a synthetic live reservation; verify
  HTTP 201 and the corresponding stored `pending` row without exposing customer data.
- [ ] A01: Verify successful HTTPS admin login, Secure cookies, session/CSRF/Origin
  protection, stale-update refusal, valid status actions and logout. Admin status
  changes send no guest email; test guest contact separately under the agreed policy.
- [ ] A01/A09: Verify production SMTP configuration, provider acceptance and receipt
  in the intended inbox. Review safe failure visibility and that failed notification
  preserves the pending row/HTTP 201; current automated evidence for this is local.
- [ ] A02: Verify actual production DB connectivity/networking/TLS, migration history
  including 003, runtime table grants, and shared valid `RATE_LIMIT_SECRET`, without
  publishing secrets or broadening unrelated permissions.
- [ ] A02: Verify real runtime `clientAddress`, overwritten untrusted forwarding
  headers and private Node origin access. Confirm shared production quotas,
  429/Retry-After, admin limiter/reset and fail-closed behavior in a controlled test;
  no real production quota probe was performed by the audit.
- [ ] A03: Recheck/remediate dependency findings recorded on 27 October: undici/zod
  High and fast-uri Moderate. Date fresh results and verify compatible upgrades.
- [ ] A04: Review production backup access/completion and verify restore into an
  isolated test database using the procedure above. No production restore is verified.
- [ ] A07: Keep guidance/status/operations docs consistent and agree minimal CI
  using existing checks; a CI workflow is not currently implemented.
- [ ] A09: Improve specific 429/503 user guidance and safe SMTP failure visibility.
- [ ] A10: Review apex/www canonical redirects and relevant security headers after
  inspecting the actual proxy/hosting chain; the previous redirect attempt looped.
- [ ] A12: Complete live mobile/desktop accessibility and performance acceptance
  across navigation, gallery/menu dialogs, reservation, privacy and 404. Prior
  local responsive/keyboard reviews do not prove complete live acceptance.

### Owner-dependent decisions and optional scope

- [ ] A05: Approve retention duration, privacy wording, mailbox-copy handling,
  maintenance ownership and reviewed manual cutoff/dry-run/apply workflow. Automatic
  reservation retention needs separate approval; no cron is configured. Limiter
  cleanup is opportunistic and separate from reservation-data retention.
- [ ] A06: Confirm remaining menu prices/product wording, High Tea minimum-party/
  48-hour conditions and reservation policy/capacity expectations. Published High Tea
  copy is not enforced by reservation validation; do not invent a policy or prices.
- [ ] A08/A11: Agree whether to add past reservations in admin and optional guest
  confirmation/cancellation emails; current admin lists today/future only.
- [ ] A12/A13: Obtain authentic replacement photography where appropriate; agree
  chatbot/CMS/capacity scope before implementation.

No retention period, new hosting configuration or business policy is established by
this checklist. Record live verification separately from local tests and owner reports.
