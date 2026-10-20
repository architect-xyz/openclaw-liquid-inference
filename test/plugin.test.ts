import assert from "node:assert/strict";
import { test } from "node:test";

import plugin from "../index.ts";

type Registered = {
  id: string;
  envVars?: string[];
  auth: Array<{ id: string; kind: string; starterModel?: string }>;
  catalog?: { run: (ctx: unknown) => Promise<unknown> };
  resolveDynamicModel?: (ctx: unknown) => unknown;
  normalizeResolvedModel?: (ctx: unknown) => unknown;
};

function registerWith(pluginConfig?: Record<string, unknown>): Registered {
  let registered: Registered | undefined;
  const api = {
    pluginConfig,
    registerProvider: (provider: Registered) => {
      registered = provider;
    },
  };
  plugin.register(api as never);
  assert.ok(registered, "registerProvider was not called");
  return registered;
}

test("the plugin registers the liquid provider with API-key auth", () => {
  const provider = registerWith();
  assert.equal(provider.id, "liquid");
  assert.deepEqual(provider.envVars, ["LIQUID_API_KEY"]);
  assert.deepEqual(
    provider.auth.map((a) => [a.id, a.kind, a.starterModel]),
    [["api-key", "api_key", "liquid/liquid.auto"]],
  );
});

test("the catalog is absent without a key", async () => {
  const provider = registerWith();
  const result = await provider.catalog!.run({
    resolveProviderApiKey: () => ({ apiKey: undefined }),
  });
  assert.equal(result, null);
});

test("the catalog carries the key, the headers and the configured cap", async () => {
  const provider = registerWith({ capUsd: 0.5 });
  const result = (await provider.catalog!.run({
    resolveProviderApiKey: () => ({ apiKey: "test-key" }),
  })) as {
    provider: {
      apiKey: string;
      headers: Record<string, string>;
      models: Array<{ id: string; headers: Record<string, string> }>;
    };
  };
  const expected = { "X-Title": "OpenClaw", "x-liquid-cap-usd": "0.5" };
  assert.equal(result.provider.apiKey, "test-key");
  assert.deepEqual(result.provider.headers, expected);
  assert.deepEqual(
    result.provider.models.map((m) => [m.id, m.headers]),
    [["liquid.auto", expected]],
  );
});

test("any exchange name resolves as a liquid model on the configured exchange", () => {
  const provider = registerWith({ baseUrl: "http://localhost:8080/v1" });
  const resolved = provider.resolveDynamicModel!({ provider: "liquid", modelId: "kimi-k3" }) as {
    id: string;
    provider: string;
    api: string;
    baseUrl: string;
    headers: Record<string, string>;
  };
  assert.equal(resolved.id, "kimi-k3");
  assert.equal(resolved.provider, "liquid");
  assert.equal(resolved.api, "openai-completions");
  assert.equal(resolved.baseUrl, "http://localhost:8080/v1");
  assert.equal(resolved.headers["X-Title"], "OpenClaw");
});

test("a resolved model gets the headers back, and keeps a header set on the model", () => {
  const provider = registerWith({ capUsd: 0.5 });
  const resolved = provider.normalizeResolvedModel!({
    provider: "liquid",
    modelId: "liquid.auto",
    model: { id: "liquid.auto", headers: { "x-liquid-cap-usd": "0.02" } },
  }) as { id: string; headers: Record<string, string> };
  assert.equal(resolved.id, "liquid.auto");
  assert.deepEqual(resolved.headers, { "X-Title": "OpenClaw", "x-liquid-cap-usd": "0.02" });
});
