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

const DEFAULTS = { baseUrl: DEFAULT_BASE_URL, capUsd: DEFAULT_CAP_USD, headers: {} };

test("an absent config takes the production exchange and a $1 cap", () => {
  assert.deepEqual(readConfig(undefined), DEFAULTS);
  assert.deepEqual(readConfig({}), DEFAULTS);
});

test("the config sets the cap, the exchange URL and extra headers", () => {
  assert.deepEqual(
    readConfig({
      capUsd: 0.25,
      baseUrl: "http://localhost:8080/v1 ",
      headers: { "x-liquid-pin-offer": "offer-1", bad: 1 },
    }),
    { baseUrl: "http://localhost:8080/v1", capUsd: 0.25, headers: { "x-liquid-pin-offer": "offer-1" } },
  );
});

test("an extra header with a default's name replaces it", () => {
  const config = readConfig({ capUsd: 0.25, headers: { "x-liquid-cap-usd": "0.02" } });
  assert.equal(headers(config)["x-liquid-cap-usd"], "0.02");
  assert.equal(headers(config)["X-Title"], "OpenClaw");
});

test("a cap that is not a positive number takes the default", () => {
  for (const capUsd of [0, -1, Number.NaN, "0.25", null]) {
    assert.equal(readConfig({ capUsd }).capUsd, DEFAULT_CAP_USD, String(capUsd));
  }
});

test("every request carries the client label and the cap", () => {
  assert.deepEqual(headers({ baseUrl: DEFAULT_BASE_URL, capUsd: 0.25, headers: {} }), {
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

test("a model keeps its name, carries the headers and stays within the output limit that offers accept", () => {
  const m = model("kimi-k3", { ...DEFAULTS, capUsd: 0.25 });
  assert.equal(m.id, "kimi-k3");
  assert.equal(m.name, "kimi-k3");
  assert.equal(m.maxTokens, 8192);
  assert.deepEqual(m.input, ["text"]);
  assert.equal(m.headers["x-liquid-cap-usd"], "0.25");
});
