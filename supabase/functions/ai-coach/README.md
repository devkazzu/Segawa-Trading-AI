# ai-coach Edge Function

Proxies chat/report requests to any OpenAI-compatible provider while keeping the
API key server-side.

## Secrets

```bash
supabase secrets set OPENAI_API_KEY=sk-...        # required for provider=openai
# optional overrides
supabase secrets set AI_PROVIDER=openai AI_BASE_URL=https://api.openai.com/v1 AI_MODEL=gpt-4o-mini
# alternative providers
supabase secrets set GROQ_API_KEY=... OPENROUTER_API_KEY=... TOGETHER_API_KEY=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically by the Supabase runtime.

## Deploy

```bash
supabase functions deploy ai-coach --no-verify-jwt=false
```

## Behaviour

| Check | Limit |
|---|---|
| Authentication | required (JWT) |
| Messages per request | 16 |
| Characters per message | 6 000 |
| Trading context size | 60 000 chars |
| Requests per user per hour | 30 |

Token usage is recorded in `public.ai_usage` for audit and rate limiting.
Returns `503 missing_provider_key` when no secret is configured — the client
then falls back to the local statistical engine instead of failing.
