# GCrawlAI search bridge for Cloudflare Workers

**Status: standalone community integration proposal, not a native Cloudflare Web Search API provider.** This code does not make `provider: "gcrawlai"` valid in Cloudflare's Web Search API. That identifier and official provider listing require Cloudflare product-team onboarding.

## Grounded upstream contract

Read directly from GCrawlAI's public application source:
- [Search route](https://github.com/GramosoftAI/GcrawlAI/blob/main/api/routes/gcrawl_routes/search_routes.py): `SearchRequest` has `query: string`, `limit: integer 1..100`, optional `geo: string`. `SearchResponse` has `query`, `limit`, `count`, and `results`, each containing optional `position`, `url`, `title`, `description`.
- [Route registration](https://github.com/GramosoftAI/GcrawlAI/blob/main/api/api.py): FastAPI mounts `search_router` under `/api/v1`; the router itself uses `/search`.
- The source supports `X-API-Key` and bearer authorization. This implementation uses the `X-API-Key` header.
- The public domain's deployment may use a reverse-proxy prefix, so the bridge defaults to `https://gcrawlai.com/gc/api/v1/search` and allows an explicit `GCRAWLAI_SEARCH_URL` override. **Confirm live endpoint and API key with an authenticated smoke test before deploying.**

## Deploy

The directory is intentionally isolated from the Cloudflare documentation site's build. In this directory, install the Cloudflare Workers CLI (or use an existing installation), then run:

```sh
npx wrangler deploy
npx wrangler secret put GCRAWLAI_API_KEY
npx wrangler secret put PROXY_AUTH_TOKEN
```

The `PROXY_AUTH_TOKEN` secret protects the public Worker endpoint from anonymous use. Do not commit API keys, tokens, or production credentials. Configure `GCRAWLAI_SEARCH_URL` in `wrangler.toml` if your deployed upstream path differs.

Call your deployed Worker (not Cloudflare's native Web Search endpoint):

```sh
curl -X POST https://YOUR-WORKER.workers.dev/ \
  -H "Authorization: Bearer YOUR_PROXY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"latest AI research","limit":5,"geo":"US"}'
```

Response shape:

```json
{
  "query": "latest AI research",
  "count": 1,
  "results": [
    { "title": "Example title", "url": "https://example.org", "description": "Example snippet" }
  ]
}
```

Run tests: `npm test`.

## Native provider onboarding checklist

1. Confirm source attribution, bot identification, robots.txt compliance, and all required Cloudflare verified bot standards with actual crawler behavior, not marketing language.
2. Obtain Cloudflare's provider onboarding process; the closed documentation-only PRs [#34601](https://github.com/cloudflare/cloudflare-docs/pull/34601) and [#34603](https://github.com/cloudflare/cloudflare-docs/pull/34603) do **not** approve native support.
3. Document latency, uptime, request limits, abuse prevention, error semantics, supported locales/regions, and whether search output is independently indexed or sourced from third parties.
4. Establish confirmed data-retention policy, security controls, DPA if needed, API billing/list price per request, and BYOK/AI Gateway billing behavior.
5. Provide sample authenticated API requests and sanitized JSON responses, plus integration and reliability tests.
6. Only after Cloudflare formally accepts and enables the provider should its official providers documentation and schema be updated.

## Limitations

- The Worker is an external adapter, not a native provider and not integrated with Cloudflare AI Gateway billing.
- The default `limit` is 10, with allowed range 1..10. This is a bridge policy, not GCrawlAI's max of 100.
- Only standard web URLs are returned. There is no page fetching, answer synthesis, built-in caching, or retry to avoid accidental charges.
- Error messages intentionally do not expose upstream response bodies.
- No live authenticated search was executed during preparation; unit tests are mocked.
