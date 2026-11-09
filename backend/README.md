# backend/

The server-side of Segawa TradeAI is implemented on Supabase and lives in [`../supabase`](../supabase):

```
supabase/
├── migrations/
│   ├── 20240101000000_init.sql      # tables, indexes, triggers, new-user bootstrap
│   └── 20240101000100_rls.sql       # Row Level Security + storage policies
└── functions/
    ├── _shared/cors.ts              # CORS + JSON helpers
    ├── ai-coach/index.ts            # authenticated, rate-limited AI proxy
    └── delete-account/index.ts      # self-service account + data deletion
```

There is deliberately **no separate Node server**: authentication, persistence, storage and the AI proxy
are all Supabase primitives, which removes a deploy target and an entire class of credential handling.

## Deploy

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy ai-coach delete-account
supabase secrets set OPENAI_API_KEY=sk-...
```

See [../docs/DATABASE.md](../docs/DATABASE.md) and [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Why no broker integration

Segawa is a manual journal: trade entry is the product. Adding broker APIs would introduce credential
custody, regional restrictions and execution risk without improving the analytics. The architecture keeps
that door open — `lib/db.ts` is the only persistence boundary.
