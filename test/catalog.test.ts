import assert from "node:assert/strict";
import { test } from "node:test";

import { discoverModels, mapModels } from "../src/catalog.ts";
import { DEFAULT_BASE_URL, DEFAULT_CAP_USD } from "../src/provider.ts";

const CONFIG = { baseUrl: DEFAULT_BASE_URL, capUsd: 0.25, headers: {} };

const DATA = [
  { id: "kimi-k3", match_type: "exact", max_input_tokens: 262144, liquid_supported_parameters: ["text"] },
  { id: "liquid.auto", match_type: "router", max_input_tokens: 10000000, liquid_supported_parameters: ["input.image"] },
  { id: "gemini-3.5-flash", match_type: "exact", max_input_tokens: 1048576, liquid_supported_parameters: ["input.image", "text"] },
  { object: "model" },
];

test("routers come first, exact models follow by name, each with its window and inputs", () => {
  const models = mapModels(DATA, CONFIG);
  assert.deepEqual(
    models.map((m) => [m.id, m.contextWindow, m.input, m.maxTokens]),
    [
      ["liquid.auto", 128_000, ["text", "image"], 8192],
      ["gemini-3.5-flash", 1_048_576, ["text", "image"], 8192],
      ["kimi-k3", 262_144, ["text"], 8192],
    ],
  );
  assert.equal(models[0]!.headers["x-liquid-cap-usd"], "0.25");
});

test("a response that is not a list maps to nothing", () => {
  assert.deepEqual(mapModels({ data: [] }, CONFIG), []);
});

test("the exchange's list replaces the static catalog", async () => {
  const fetchFn = (async () => Response.json({ data: DATA })) as unknown as typeof fetch;
  const models = await discoverModels(CONFIG, fetchFn);
  assert.deepEqual(
    models.map((m) => m.id),
    ["liquid.auto", "gemini-3.5-flash", "kimi-k3"],
  );
});

test("a failed fetch, a refusal and an empty list each leave liquid.auto", async () => {
  const cases: Array<typeof fetch> = [
    (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch,
    (async () => new Response("no", { status: 503 })) as unknown as typeof fetch,
    (async () => Response.json({ data: [] })) as unknown as typeof fetch,
  ];
  for (const fetchFn of cases) {
    const models = await discoverModels({ ...CONFIG, capUsd: DEFAULT_CAP_USD }, fetchFn);
    assert.deepEqual(
      models.map((m) => m.id),
      ["liquid.auto"],
    );
  }
});
