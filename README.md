Family Tree
===========

Private family tree app built with Next.js + Tailwind. This repo contains no private data.

Quick start
- Node 18+
- Install: `npm i`
- Dev: `npm run dev` (http://localhost:3000)

Data sources
- Supabase (preferred): set env below
- JSON fallback (for local testing without Supabase): create `data/sample.json` as `{ people: [], marriages: [], parent_child: [] }`

Env (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_ANON_KEY"`
- Optional: `USE_JSON_FALLBACK=true`

Editing
- Toggle Edit mode from sidebar
- Saves write to Supabase `people`, `marriages`, `parent_child`
- Creating a person can also create marriage and parent-child rows

Security
- robots blocked (public/robots.txt)
- simple password gate before entering the site

Build
- Dev: `npm run dev`
- SSR build: `npm run build && npm start`
- Static export (GitHub Pages):
  - ensure `output: 'export'` in `next.config.mjs` (already set)
  - `npm run predeploy && npm run deploy`

