# Proposal: GCrawlAI as a Cloudflare Web Search API provider

**Status:** Proposal for Cloudflare product-team review; **not** an implemented native provider.

## Request

Please consider onboarding **GCrawlAI** as an additional provider for the Cloudflare Web Search API, alongside the currently supported providers. We are seeking guidance on the provider onboarding process, technical review, and commercial/compliance requirements before proposing any documentation changes.

## Demonstrated integration

- Public adapter source: https://github.com/gcrawlai/gcrawlai-cloudflare-search
- Deployed independent Cloudflare Worker bridge: https://gcrawlai-cloudflare-search.gcrawlai.workers.dev
- GCrawlAI search API: `POST https://gcrawlai.com/gc/api/v1/search`
- GCrawlAI product: https://gcrawlai.com

The independently deployed Worker accepts authenticated POST requests, forwards a query to GCrawlAI using an upstream API key, and maps the returned `results[].link` to `results[].url`, preserving title and description. A live user test returned three normalized results for `coffee shop` with `limit: 3`. This is a functional proof of an adapter, **not** evidence that Cloudflare's native `provider: "gcrawlai"` is supported.

### Sample independent Worker request (illustrative; requires a valid proxy token)

```http
POST https://gcrawlai-cloudflare-search.gcrawlai.workers.dev
Authorization: Bearer <PROXY_AUTH_TOKEN>
Content-Type: application/json

{"query":"coffee shop","limit":3,"pagination":1,"geo":"IN","uule":""}
```

Normalized response shape:

```json
{
  "query": "coffee shop",
  "results": [
    {
      "url": "https://roasterycoffee.co.in",
      "title": "Roastery Coffee House",
      "description": "..."
    }
  ],
  "count": 1
}
```

This sample is shortened for illustration, not a benchmark.

## Native integration requested

1. Cloudflare evaluates GCrawlAI as an upstream Web Search provider.
2. Cloudflare confirms the required native provider contract, including request schema, normalized response, timeout/error handling, authentication, billing and BYOK, and gateway observability.
3. GCrawlAI supplies technical integration assistance, test credentials via a secure channel, and compliance evidence.
4. Only after Cloudflare implements and approves the provider should `gcrawlai` be added to the documented provider enum and providers page.

## GCrawlAI API details observed

Upstream request:
```json
{"query":"coffee shop","pagination":1,"geo":"IN","uule":""}
```

Upstream response contains `results` objects with `link`, `title`, `description`, and other metadata. The independent Worker applies `limit` locally because the observed live upstream endpoint rejects a `limit` field with HTTP 422.

## Review items and evidence still required

- Verified-bot requirements, crawler identity, robots.txt handling, and website-owner controls: **documentation/evidence to be supplied**.
- Source attribution and redirect-link handling: source links are returned, but some observed results used Google `/goto` redirect URLs; direct destination resolution/attribution needs review.
- Privacy, data retention, regional handling, and terms of service: **to be supplied**.
- Pricing, billing model, quotas, reliability, latency distribution, and SLA: **to be supplied**.
- Provider-scale load testing and compatibility with Cloudflare AI Gateway's native Web Search API: **not yet validated**.
- Secure distribution of test credentials; no API keys in issues or public docs.

## Questions for Cloudflare

- Is there a formal intake process or contact for new Web Search API provider partnerships?
- What are the required technical, compliance, billing, and legal gates?
- Can the team share a provider contract or a preferred integration/testing approach?
- Would a short technical walkthrough of the working Worker bridge be useful?

## References

- Cloudflare Web Search API: https://developers.cloudflare.com/web-search/
- Providers: https://developers.cloudflare.com/web-search/providers/
- GCrawlAI bridge: https://github.com/gcrawlai/gcrawlai-cloudflare-search

**Contact:** Please respond through the repository's GitHub issue/discussion channel to arrange an appropriate private technical contact. Do not post credentials publicly.
