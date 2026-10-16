# ROCK UC FOODS: tested starter (Phase 1-2 + refund policy)

Money = bigint kobo only. Policy wording lives in `src/policy/content.ts` (bump `POLICY_VERSION` on any change).

```bash
npm install
npm run typecheck     # tsc, must be clean
npm test              # vitest, includes SQL migrations in in-memory Postgres (PGlite)
npm run menu:dryrun -- path/to/ROCK_UC_FOODS_Menu_Template.xlsx   # validates a menu file, writes nothing
```

Apply `supabase/migrations/*.sql` in order. `0002` needs an `orders(id uuid)` table (ordering phase).
Open items for the owner are in section 17.8 of the playbook.
