# Agent guidance

## General engineering

- Read `PROJECT_CONTEXT.md` before significant changes and inspect existing code before editing.
- Preserve established conventions unless there is a good reason to change them.
- Prefer simple solutions over unnecessary abstraction. Keep components small and focused.
- Add dependencies only with a clear benefit. Do not introduce frameworks or services for speculative future use.
- Avoid premature backend, database, or CMS work.
- Maintain accessibility, mobile responsiveness, performance, and SEO. Use semantic HTML.
- Keep TypeScript strict and avoid unnecessary `any`.
- Never expose secrets or commit `.env` files or local environment variants.
- Separate business content/data from presentation when practical.
- Update `PROJECT_CONTEXT.md` when significant architecture, scope, feature, or project-status decisions change.

## Astro

- Prefer Astro components for static and content-oriented UI and static rendering where possible.
- Add client-side JavaScript only when interaction requires it.
- Do not add Vue until a feature genuinely benefits from it. If added, use focused interactive islands rather than automatically rewriting the site as a client-side SPA.
- Keep future `/galerij` and `/reserveren` requirements in mind without implementing them prematurely.

## Reservation backend

- Keep database access server-only; never expose credentials through `PUBLIC_` variables.
- Use parameterized queries and keep validation/service logic reusable outside HTTP routes.
- Public APIs must not expose reservation records or internal database errors; new requests start as `pending`.
- Public reservation UI must describe submissions as requests awaiting Turuncu confirmation, never as confirmed bookings.
- Keep migrations non-destructive unless explicitly authorized otherwise; never reset unrelated data.
- Do not log reservation payloads or unnecessary personal data.
- Admin reservation data requires server-side authentication; authenticated mutations require CSRF and same-origin checks.
- Never log or commit admin credentials/session secrets. Validate status transitions and check the expected current status.
- Reservation cleanup must remain manual and dry-run by default, with an explicit cutoff and no PII in logs. An automatic retention rule requires owner approval.

## Styling

- Use plain CSS for now and reusable CSS variables for colors, spacing, typography, and other design tokens.
- Avoid arbitrary duplicated styling; mobile responsiveness is required.
- Preserve the recognizable Turuncu visual identity. Current placeholder tokens are provisional, not approved brand specifications.

## Content

- Website-facing content is primarily Dutch.
- Do not invent prices, opening hours, menu items, addresses, claims, or business details.
- If real business information has not been provided or verified, use clearly temporary placeholders or defer it.
- The existing live website is reference material, not automatically authoritative or current.

## Code comments

- Write useful comments inside project code in Dutch.
- Avoid obvious or redundant comments.

## Verification

Before considering a coding task complete:

- Run relevant checks, including `npm run check` for Astro/TypeScript changes.
- Run `npm run build` and resolve errors introduced by the change.
- Inspect `git diff` and `git status`, including new files.
- Ensure generated output, caches, secrets, and unrelated files are excluded.

## Git workflow

- Work in meaningful checkpoints; do not commit every tiny edit.
- At the end of a clearly scoped completed task, commit and push without additional confirmation unless there is a safety or problem reason not to.
- Use concise English conventional-style messages, such as `chore: initialize Astro project`, `feat: add gallery page`, `fix: correct mobile navigation`, or `docs: update project context`.
- Do not rewrite Git history or force-push unless explicitly instructed.
