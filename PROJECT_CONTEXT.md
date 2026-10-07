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
- Static output for the current foundation; no hosting adapter is required now.
- Prefer Astro components for content; add client JavaScript only for real interaction needs.
- Vue may be added later for focused interactive islands when justified.
- Hybrid navigation: main business content on `/` with anchor navigation,
  with a separate gallery page for a larger photo/product collection.
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
- Optional breakfast/high-tea content
- Instagram/social section
- Visit/contact/opening information
- Footer

Separate page: `/galerij`.

Future page: `/reserveren`.

Existing bakery/product promotional sections may be removed, merged, or redesigned;
those decisions are not final. None of these planned sections or routes beyond
the homepage placeholder has been implemented.

## Design direction

Largely preserve the existing brand identity, including its recognizable warm/orange
character. Keep the existing logo; the text/tagline below it will change later.
Logo assets and the final tagline are not yet supplied in this repository.
The foundation uses a small set of provisional CSS variables and system fonts,
not a final visual redesign or an approved brand palette.

## Data and content strategy

Initially use local TypeScript/JSON-style files in `src/data/`. The current file
contains only the supplied business name and development message. Public-facing
content is primarily Dutch. Do not invent business facts, prices, opening hours,
menu items, addresses, or claims; verify real content with the owner.
No CMS is being added at this stage.

## Future reservation system

Plan an integrated experience inside the website, likely at `/reserveren`.
It may later need server endpoints, a database, and email notifications.
None is implemented now. When requirements are confirmed, reconsider rendering,
adapter/runtime, and hosting capabilities while retaining static content where possible.

## Hosting and deployment direction

Use GitHub for version control. Hostinger is the intended deployment target,
ideally connected to GitHub. The current application builds static output to `dist/`.
The actual Hostinger plan, GitHub integration, and delivery workflow remain
unconfirmed. No live deployment, hosting integration, or CI workflow is configured.
Future reservations will require a separate decision about server/runtime support.

## Explicitly deferred technologies and features

- Vue integration, React, Tailwind, UI/component and animation libraries
- Sanity or another CMS, Supabase, databases, backend/API services
- Reservation implementation, endpoints, and email notifications
- Final homepage design, gallery implementation, and real content migration

## Current implementation status

- Official minimal Astro starter incorporated in the existing repository root.
- Existing README identity and Git history preserved; README expanded for developers.
- Only `/` exists, displaying “Turuncu Café en Bakkerij” and
  “Nieuwe website in ontwikkeling.” using semantic HTML and Dutch document language.
- Reusable `src/layouts/BaseLayout.astro`, global stylesheet, and local content file.
- Strict TypeScript configuration and npm development, check, build, and preview scripts.
- `public/` is available for future static assets and currently empty. Git does not
  track empty directories; create it when adding assets in a fresh clone.
- Add `src/components/` when the first reusable UI component is needed.
- Root `AGENTS.md` and this document provide persistent project guidance.
- Build output, Astro generated types, dependencies, logs, and local environment
  files are ignored. No secrets or deployment credentials are included.

### Installed versions and verification (7 October 2026)

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

## Near-term roadmap

1. Confirm real business content, logo assets, revised tagline, and page priorities with the owner.
2. Refine homepage sections, anchor navigation, and responsive design direction.
3. Implement the approved homepage and gallery incrementally using local data.
4. Confirm Hostinger capabilities and establish the GitHub deployment workflow.
5. Define reservation requirements before choosing server, database, and email services.

## Important unresolved decisions

- Final homepage sections and the fate of existing promotional sections
- Breakfast/high-tea scope and verified practical/menu information
- Final tagline, design tokens, imagery, gallery organization and photo assets
- Hostinger plan, GitHub deployment integration, and future server capabilities
- Reservation functionality, operations, data model, and notification requirements

Update this document whenever significant architecture, scope, feature, or status
decisions change.
