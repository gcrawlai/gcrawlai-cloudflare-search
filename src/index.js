/**
 * GCrawlAI web-search proxy for Cloudflare Workers.
 *
 * This is an independently deployable bridge, NOT a native Cloudflare Web Search
 * provider. Only Cloudflare can enable provider: "gcrawlai" in its Web Search API.
 *
 * GCrawlAI API contract grounded in:
 * https://github.com/GramosoftAI/GcrawlAI/blob/main/api/routes/gcrawl_routes/search_routes.py
 */
const DEFAULT_ENDPOINT = "https://gcrawlai.com/gc/api/v1/search";

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export function normalizeResults(payload, limit) {
  if (!payload || !Array.isArray(payload.results)) {
    throw new Error("Unexpected GCrawlAI search response: results must be an array");
  }
  return payload.results
    .filter((result) => result && typeof result.url === "string" &&
      /^https?:\/\//i.test(result.url) && result.url.length > 0)
    .slice(0, limit)
    .map((result) => ({
      url: result.url,
      title: typeof result.title === "string" ? result.title : "",
      description: typeof result.description === "string" ? result.description : ""
    }));
}

export async function handleRequest(request, env, fetchImpl = fetch) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!env?.GCRAWLAI_API_KEY || !env?.PROXY_AUTH_TOKEN) {
    return json({ error: "server_not_configured" }, 503);
  }
  const presented = request.headers.get("authorization");
  if (presented !== `Bearer ${env.PROXY_AUTH_TOKEN}`) {
    return json({ error: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const query = body?.query;
  const limit = body?.limit ?? 10;
  const geo = body?.geo;

  if (typeof query !== "string" || query.trim().length < 1 || query.length > 1024) {
    return json({ error: "invalid_query" }, 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    return json({ error: "invalid_limit", message: "Limit must be an integer from 1 to 10" }, 400);
  }
  if (geo !== undefined && (typeof geo !== "string" || !/^[A-Za-z]{2}$/.test(geo))) {
    return json({ error: "invalid_geo" }, 400);
  }

  const endpoint = env.GCRAWLAI_SEARCH_URL || DEFAULT_ENDPOINT;
  let parsedEndpoint;
  try {
    parsedEndpoint = new URL(endpoint);
    if (parsedEndpoint.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    return json({ error: "invalid_upstream_endpoint" }, 503);
  }

  let upstream;
  try {
    upstream = await fetchImpl(parsedEndpoint.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.GCRAWLAI_API_KEY
      },
      body: JSON.stringify({
        query: query.trim(),
        limit,
        ...(geo ? { geo: geo.toUpperCase() } : {})
      }),
      signal: AbortSignal.timeout(25000)
    });
  } catch {
    return json({ error: "upstream_unavailable" }, 502);
  }

  if (!upstream.ok) {
    return json({
      error: upstream.status === 429 ? "rate_limited" : "upstream_error",
      upstream_status: upstream.status
    }, upstream.status === 429 ? 429 : 502);
  }

  try {
    const payload = await upstream.json();
    const results = normalizeResults(payload, limit);
    return json({ query: query.trim(), results, count: results.length });
  } catch {
    return json({ error: "invalid_upstream_response" }, 502);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
