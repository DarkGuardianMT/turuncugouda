# TuruncuGouda

A custom website for **Turuncu Café en Bakkerij**, a café in Gouda, the Netherlands.
It includes Dutch-language pages, a reservation-request backend and a protected
administration workflow.

**Status:** deployed on Hostinger as an Astro Node standalone app. Reservation
submissions are requests awaiting Turuncu's confirmation. Some menu details, the retention period,
browser acceptance and production safeguards still require review.

## Implemented features

- Responsive homepage with business information, a structured digital menu and a
  photo gallery with category filters and a keyboard-accessible native lightbox.
- Reservation form with server validation, a honeypot and a create-only JSON API.
  Requests start as pending; visitors cannot list records or choose their status.
- Single-admin login with scrypt password hashing, signed HttpOnly sessions,
  strict Origin checks and session-bound CSRF protection for authenticated actions.
  Admins can filter requests and confirm or cancel them with stale-update checks.
- Dutch privacy information and a manual anonymization command with an explicit
  cutoff, separate maintenance credentials and a dry-run default.
- Semantic HTML, skip links, visible focus states, responsive optimized images,
  no-JavaScript navigation and contact alternatives. Full browser acceptance is
  still pending; these measures are not a claim of accessibility certification.
- Page-specific metadata, canonical URLs, social cards, business structured data,
  a public-only sitemap, robots.txt and a custom 404. Admin responses are private
  and excluded from public indexing metadata.

Email/SMS notifications, capacity management, a CMS and a chatbot are not implemented.

## Stack and architecture

- **Astro 7 + strict TypeScript:** prerendered public content, with the official
  Node standalone adapter for reservation and admin runtime routes.
- **MySQL/MariaDB + mysql2:** parameterized queries, versioned SQL migrations,
  lazy server-only connection pooling and separate runtime/maintenance privileges.
- **Plain CSS + vanilla TypeScript:** focused browser interactions; business
  content stays in local typed data files. No client framework or ORM.
- **Native Node tests:** validation, form behavior, authentication, CSRF, status
  transitions, retention and SEO helpers. Additional built-output/HTTP and opt-in
  local database checks are available.

Public pages are built into `dist/client/`; protected pages and API handlers run
from `dist/server/`. Credentials are supplied through the server environment.
Customer records are fetched at runtime and never included in static pages.
Deployment uses Hostinger's Node runtime behind an HTTPS reverse proxy, with
MySQL/MariaDB access configured privately through the server environment.

## Run locally

Use Node.js 22.12.0 or newer on a supported even-numbered release and npm 10.8.2
or newer. The existing setup was verified with Node 24.

```sh
npm ci
npm run dev
```

Open `http://localhost:4321`. Public pages work without database credentials.
To submit reservations or use admin, copy `.env.example` to ignored `.env` and
configure your own local database and admin credentials following the
[development guide](docs/DEVELOPMENT.md). Never use real customer data in tests.

| Command | Purpose |
| --- | --- |
| `npm run check` | Astro and TypeScript diagnostics |
| `npm test` | Database-free unit/controller tests |
| `npm run build` | Build public assets and the Node runtime |
| `npm run test:seo` | Audit built output and local HTTP behavior after building |
| `npm start` | Run the built standalone server |
| `npm run preview` | Preview the build locally |
| `npm run db:migrate` | Apply pending migrations to the explicitly configured database |
| `npm run admin:hash-password` | Generate a salted hash using hidden interactive input |
| `npm run reservations:cleanup -- --before=YYYY-MM-DD` | Count eligible records; no changes without `--apply` |
| `npm run test:admin-integration` | Explicitly enabled local database/admin verification |
| `npm run test:retention-integration` | Explicitly enabled local anonymization verification |

Builds and unit tests need no database or admin secrets. The production standalone
server reads process environment variables; it does not automatically load `.env`.
Integration tests write and remove synthetic records and must only use a local test
database with the documented opt-in flags and privileges.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `src/pages/` | Public pages, protected admin pages/actions and create-only API |
| `src/components/`, `src/layouts/`, `src/styles/` | Shared presentation and plain CSS |
| `src/data/` | Typed business content, menu and gallery metadata |
| `src/assets/` | Supplied logo, photographs and original menu references |
| `src/server/` | Database configuration, authentication and reservation services |
| `db/migrations/` | Schema-only, versioned SQL migrations |
| `scripts/`, `tests/` | Maintenance, verification scripts and automated tests |

See the [development and operations guide](docs/DEVELOPMENT.md) for setup, API
contracts, authentication, maintenance and the production prelaunch checklist.
[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) records architecture and project status;
[AGENTS.md](AGENTS.md) records engineering conventions.

## Publication, assets and license

This repository contains application code and business-specific content for Turuncu.
The café's logo, photographs, menu artwork and business content must be treated
separately from application code. The business owner has approved public GitHub
redistribution of the Turuncu assets included in this project. This approval does
not grant third parties general reuse rights or establish authorship of those assets.

No project license has been selected. Public visibility would not itself grant
broad reuse rights; dependency licenses remain applicable. No open-source license
is claimed for the code or business assets.

Before launch, complete production rate limiting, HTTPS/proxy and trusted-host
verification, database/TLS/backups, owner-approved retention and content review,
and mobile/desktop browser acceptance. Publishing source and launching the live
reservation service are separate decisions.
