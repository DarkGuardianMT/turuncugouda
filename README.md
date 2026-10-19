# turuncugouda

The new website for Turuncu Café en Bakkerij in Gouda. This project is under
active development; the homepage now has a responsive visual foundation with
real Turuncu branding and photography. The gallery has an initial photo grid;
verified contact details and opening hours are included. `/reserveren` now accepts
reservation requests through the runtime API; successful requests await Turuncu's
confirmation. The digital menu is available at `/menu`, with some prices still
awaiting owner confirmation. Reserveer links to the form, while phone and Instagram
remain alternatives. Nothing has been deployed by this checkpoint.

## Stack and prerequisites

- Astro 7 with prerendered public pages and the official Node standalone adapter for runtime APIs
- MySQL/MariaDB via `mysql2/promise` (no ORM)
- TypeScript with Astro's strict configuration
- Plain CSS and local TypeScript content data
- npm, GitHub version control, and intended Hostinger deployment
- Node.js 22.12.0 or newer on a supported even-numbered release (Node 24 LTS recommended)
- npm 9.6.5 or newer

## Local development

Run these commands from the repository root:

```sh
npm ci
npm run dev
```

The development server normally runs at `http://localhost:4321`.

| Command | Purpose |
| --- | --- |
| `npm run check` | Check Astro files and TypeScript |
| `npm run build` | Build public pages into `dist/client/` and the Node runtime into `dist/server/` |
| `npm run preview` | Preview the built site locally |
| `npm start` | Run the built Node standalone server |
| `npm run db:migrate` | Apply pending database migrations |
| `npm test` | Run reservation, authentication, CSRF, and validation tests without a database |
| `npm run admin:hash-password` | Interactively generate a salted admin password hash with hidden input |
| `npm run test:admin-integration` | Opt-in local MariaDB/built-runtime verification; see admin setup below |
| `npm run astro -- --help` | Show Astro CLI help |

Run `npm run build` before `npm run preview`. Preview is a local verification
server, not a production server.

## Structure

- `src/pages/`: public routes plus runtime `/admin/login` and protected `/admin/reservations`
- `src/components/`: shared branding, header, footer, section wrapper, and photo grid
- `src/assets/`: supplied logo, real photos, and menu reference images
- `src/layouts/`: reusable document layout
- `src/styles/`: global plain CSS and provisional design tokens
- `src/data/`: local content separated from presentation
- `src/server/db/`: lazy server-only MySQL pool and shared configuration validation
- `src/server/reservations/`: reusable input validation, types, and reservation service
- `src/pages/api/reservations.ts`: runtime create-only JSON API
- `src/server/admin/`: single-admin configuration, scrypt verification, signed sessions, CSRF, and local login limiter
- `db/migrations/`: versioned, non-destructive SQL migrations
- `scripts/migrate.mjs`: small migration runner with history, checksums, and a database-scoped lock
- `public/`: static assets copied without transformation (currently empty)

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for scope and architecture decisions
and [AGENTS.md](AGENTS.md) for engineering guidance. Dependency versions are locked
in `package-lock.json`.

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
CREATE/INDEX and migration-history SELECT/INSERT privileges; the application
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

The endpoint rejects supplied `Origin` values that differ from the request URL's
origin, including mismatched local ports, and rejects `Sec-Fetch-Site: cross-site`.
Origin-less non-browser clients remain supported. No CORS permissions are added;
this is not authentication or spam prevention. Before deployment, ensure the
trusted reverse proxy preserves the external host/scheme and verify real HTTPS
same-origin submissions. The installed Node adapter normalizes unlisted request
hosts to localhost: use `localhost` for built local verification. Production must
explicitly permit the canonical host via `security.allowedDomains`, and verify
the request URL scheme after HTTPS termination. These deployment-specific settings
remain a launch prerequisite; the form fails closed on an Origin mismatch.
Do not add ad-hoc trust in arbitrary forwarded headers;
review Astro's [proxy/security configuration](https://docs.astro.build/en/reference/configuration-reference/#securityalloweddomains)
when the Hostinger setup is known.

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
no-referrer policy and anti-framing headers. Authentication is checked on every
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

Hostinger production work remains deferred: verify HTTPS/proxy Origin reconstruction,
Secure cookies, canonical allowed hosts, trusted client IPs, authentication hardening
and durable upstream rate limiting before launch. Privacy/retention/deletion rules
remain unresolved. Future notifications may use Hostinger SMTP once available;
database state remains authoritative and future email failure must not roll back a
successful reservation/status update. No SMTP dependency or settings are added now.

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
