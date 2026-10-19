export const PROVIDER = "liquid";
export const API_KEY_ENV = "LIQUID_API_KEY";
export const DEFAULT_BASE_URL = "https://router.inference.ai.exchange/v1";
export const DEFAULT_CAP_USD = 1;
export const DEFAULT_MODEL = "liquid.auto";
export const DEFAULT_MODEL_REF = `${PROVIDER}/${DEFAULT_MODEL}`;
export const API = "openai-completions";

// OpenClaw compacts a session before it outgrows contextWindow. liquid.auto
// buys a different model on each request, so the window is the smallest one
// in common use, not the exchange's upper bound.
export const CONTEXT_WINDOW = 128_000;
// Most offers register an output limit of 8192 tokens. A larger limit makes
// the exchange refuse the request with output_bound_unsupported.
export const MAX_TOKENS = 8192;

export type LiquidConfig = {
  baseUrl: string;
  capUsd: number;
  /** Extra request headers. One with the name of a default header replaces it. */
  headers: Record<string, string>;
};

export type LiquidModel = {
  id: string;
  name: string;
  reasoning: boolean;
  input: ["text"];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
};

export type LiquidProvider = {
  baseUrl: string;
  api: typeof API;
  headers: Record<string, string>;
  models: LiquidModel[];
};

/** Reads the plugin's config block. A missing or invalid value takes the default. */
export function readConfig(pluginConfig: Record<string, unknown> | undefined): LiquidConfig {
  const baseUrl = pluginConfig?.baseUrl;
  const capUsd = pluginConfig?.capUsd;
  const extra = pluginConfig?.headers;
  const headers: Record<string, string> = {};
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    for (const [name, value] of Object.entries(extra)) {
      if (typeof value === "string") headers[name] = value;
    }
  }
  return {
    baseUrl: typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : DEFAULT_BASE_URL,
    capUsd: typeof capUsd === "number" && Number.isFinite(capUsd) && capUsd > 0 ? capUsd : DEFAULT_CAP_USD,
    headers,
  };
}

/** The headers on every model request: the client label on receipts, the cap, and the extras. */
export function headers(config: LiquidConfig): Record<string, string> {
  return { "X-Title": "OpenClaw", "x-liquid-cap-usd": String(config.capUsd), ...config.headers };
}

// The exchange charges what each request costs, so OpenClaw's own cost
// estimate stays at zero. The receipt holds the charge.
export function model(id: string): LiquidModel {
  return {
    id,
    name: id,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: CONTEXT_WINDOW,
    maxTokens: MAX_TOKENS,
  };
}

export function buildProvider(config: LiquidConfig): LiquidProvider {
  return {
    baseUrl: config.baseUrl,
    api: API,
    headers: headers(config),
    models: [model(DEFAULT_MODEL)],
  };
}
