import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildProvider,
  DEFAULT_BASE_URL,
  DEFAULT_CAP_USD,
  headers,
  model,
  readConfig,
} from "../src/provider.ts";

test("an absent config takes the production exchange and a $1 cap", () => {
  assert.deepEqual(readConfig(undefined), { baseUrl: DEFAULT_BASE_URL, capUsd: DEFAULT_CAP_USD });
  assert.deepEqual(readConfig({}), { baseUrl: DEFAULT_BASE_URL, capUsd: DEFAULT_CAP_USD });
});

test("the config sets the cap and the exchange URL", () => {
  assert.deepEqual(readConfig({ capUsd: 0.25, baseUrl: "http://localhost:8080/v1 " }), {
    baseUrl: "http://localhost:8080/v1",
    capUsd: 0.25,
  });
});

test("a cap that is not a positive number takes the default", () => {
  for (const capUsd of [0, -1, Number.NaN, "0.25", null]) {
    assert.equal(readConfig({ capUsd }).capUsd, DEFAULT_CAP_USD, String(capUsd));
  }
});

test("every request carries the client label and the cap", () => {
  assert.deepEqual(headers({ baseUrl: DEFAULT_BASE_URL, capUsd: 0.25 }), {
    "X-Title": "OpenClaw",
    "x-liquid-cap-usd": "0.25",
  });
});

test("the catalog starts with liquid.auto on the Chat Completions transport", () => {
  const provider = buildProvider(readConfig(undefined));
  assert.equal(provider.baseUrl, DEFAULT_BASE_URL);
  assert.equal(provider.api, "openai-completions");
  assert.equal(provider.headers["x-liquid-cap-usd"], "1");
  assert.deepEqual(
    provider.models.map((m) => [m.id, m.contextWindow, m.maxTokens]),
    [["liquid.auto", 128_000, 8192]],
  );
});

test("a model keeps its name and stays within the output limit that offers accept", () => {
  const m = model("kimi-k3");
  assert.equal(m.id, "kimi-k3");
  assert.equal(m.name, "kimi-k3");
  assert.equal(m.maxTokens, 8192);
  assert.deepEqual(m.input, ["text"]);
});
