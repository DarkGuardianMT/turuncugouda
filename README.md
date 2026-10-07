# turuncugouda

The new website for Turuncu Café en Bakkerij in Gouda. This project is under
active development; the homepage now has a responsive visual foundation with
real Turuncu branding and photography. The gallery has an initial photo grid;
reservations and verified business content remain in development.

## Stack and prerequisites

- Astro 7 with static output
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
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Preview the built site locally |
| `npm run astro -- --help` | Show Astro CLI help |

Run `npm run build` before `npm run preview`. Preview is a local verification
server, not a production server.

## Structure

- `src/pages/`: `/`, `/galerij`, and `/reserveren`
- `src/components/`: shared branding, header, footer, section wrapper, and photo grid
- `src/assets/`: supplied logo, real photos, and menu reference images
- `src/layouts/`: reusable document layout
- `src/styles/`: global plain CSS and provisional design tokens
- `src/data/`: local content separated from presentation
- `public/`: static assets copied without transformation (currently empty)

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for scope and architecture decisions
and [AGENTS.md](AGENTS.md) for engineering guidance. Dependency versions are locked
in `package-lock.json`.

## Deployment direction

Hostinger is the intended target, ideally connected to GitHub. The current build
produces static files in `dist/`; the hosting plan and delivery workflow still
need confirmation. No deployment or CI workflow has been configured.
