## Family Tree Web App

Stack: Next.js App Router, Tailwind CSS, Supabase (SSR + Browser client).

### Getting started

1. Copy the provided Supabase env vars into a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://knqbdesytcdyzuxclnoy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtucWJkZXN5dGNkeXp1eGNsbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMTkxNjEsImV4cCI6MjA2OTY5NTE2MX0.z9dGc6cn3MXAUagOY8bJm9-XKgqgiZS8bk81dz70uf8
```

2. Install and run:

```
pnpm i
pnpm dev
```

### Database tables

- `people(id, first_name, last_name, preferred_name, gender, birth_date, birth_place, death_date, death_place, status, phone, facebook, photo)`
- `marriages(id, partner_a, partner_b)`
- `parent_child(id, parent_id, child_id)`

### UI

- SVG-based tree with pan (drag) and zoom (scroll)
- Gender color coding (blue male, red female)
- Status text color (green living, slate deceased)
- Photo avatar if `photo` URL present
- Dashed red line for marriages; curved arrow for parent-child
- Sidebar search to center on a person


