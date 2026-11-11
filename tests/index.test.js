import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest, normalizeResults } from "../src/index.js";

const env = {
  GCRAWLAI_API_KEY: "test-upstream-key",
  PROXY_AUTH_TOKEN: "test-client-token",
  GCRAWLAI_SEARCH_URL: "https://example.com/api/v1/search"
};
const request = (body, headers = { authorization: "Bearer test-client-token" }) =>
  new Request("https://example.workers.dev", {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });

test("maps GCrawlAI source fields to normalized search results", () => {
  const values = normalizeResults({
    results: [
      { position: 1, url: "https://example.org/a", title: "A", description: "Snippet A" },
      { position: 2, url: "javascript:alert(1)", title: "Unsafe" },
      { position: 3, url: "https://example.org/b", title: "B" }
    ]
  }, 10);
  assert.deepEqual(values, [
    { url: "https://example.org/a", title: "A", description: "Snippet A" },
    { url: "https://example.org/b", title: "B", description: "" }
  ]);
});

test("sends authenticated GCrawlAI request and maps response", async () => {
  let captured;
  const result = await handleRequest(request({ query: "agents", limit: 3, geo: "us" }), env, async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({
      results: [{ url: "https://example.org", title: "Example", description: "Summary", position: 1 }]
    }), { status: 200 });
  });
  assert.equal(result.status, 200);
  assert.equal(captured.url, env.GCRAWLAI_SEARCH_URL);
  assert.equal(captured.init.headers["x-api-key"], env.GCRAWLAI_API_KEY);
  assert.deepEqual(JSON.parse(captured.init.body), { query: "agents", limit: 3, geo: "US" });
  assert.deepEqual(await result.json(), {
    query: "agents", count: 1,
    results: [{ url: "https://example.org", title: "Example", description: "Summary" }]
  });
});

test("rejects requests missing proxy authorization", async () => {
  const result = await handleRequest(request({ query: "test" }, { authorization: "Bearer wrong" }), env);
  assert.equal(result.status, 401);
});

test("validates query, limit, geo, and JSON", async () => {
  for (const body of [
    { query: "" }, { query: "q", limit: 0 },
    { query: "q", limit: 101 }, { query: "q", geo: "world" },
    "{bad json"
  ]) {
    const result = await handleRequest(request(body), env);
    assert.equal(result.status, 400);
  }
});

test("does not expose upstream response or secrets on errors", async () => {
  const result = await handleRequest(request({ query: "test" }), env,
    async () => new Response("private upstream details", { status: 500 }));
  assert.deepEqual(await result.json(), { error: "upstream_error", upstream_status: 500 });
});

test("rejects missing or malformed upstream result arrays", async () => {
  const result = await handleRequest(request({ query: "test" }), env,
    async () => new Response(JSON.stringify({ hello: "world" }), { status: 200 }));
  assert.equal(result.status, 502);
});
