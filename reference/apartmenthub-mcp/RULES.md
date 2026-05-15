# ApartmentHub Ground Rules

These rules are enforced for all team members working on the ApartmentHub project.

## Database
1. **Never** drop, truncate, or delete database tables
2. **Always** create new migration files — never modify existing ones
3. SQL queries via the MCP server are **read-only by default**

## Git & Deployment
4. **Never** push directly to `main` — use Beta branch + PRs
5. **Never** modify Edge Functions in production without testing locally first

## Security
6. **Never** expose service role keys or secrets in client-side code
7. **Never** commit `.env` files or credentials to the repository

## Conventions
8. All routes must support both `/nl/` and `/en/` paths
9. Supabase client should be imported from `src/lib/supabase.js`
10. Business logic goes in `src/services/`, not in components
