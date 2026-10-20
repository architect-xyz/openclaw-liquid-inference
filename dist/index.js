// index.ts
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "openclaw/plugin-sdk/provider-auth";

// src/provider.ts
var PROVIDER = "liquid";
var API_KEY_ENV = "LIQUID_API_KEY";
var DEFAULT_BASE_URL = "https://router.inference.ai.exchange/v1";
var DEFAULT_CAP_USD = 1;
var DEFAULT_MODEL = "liquid.auto";
var DEFAULT_MODEL_REF = `${PROVIDER}/${DEFAULT_MODEL}`;
var API = "openai-completions";
var CONTEXT_WINDOW = 128e3;
var MAX_TOKENS = 8192;
function readConfig(pluginConfig) {
  const baseUrl = pluginConfig?.baseUrl;
  const capUsd = pluginConfig?.capUsd;
  const extra = pluginConfig?.headers;
  const headers2 = {};
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    for (const [name, value] of Object.entries(extra)) {
      if (typeof value === "string") headers2[name] = value;
    }
  }
  return {
    baseUrl: typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : DEFAULT_BASE_URL,
    capUsd: typeof capUsd === "number" && Number.isFinite(capUsd) && capUsd > 0 ? capUsd : DEFAULT_CAP_USD,
    headers: headers2
  };
}
function headers(config) {
  return { "X-Title": "OpenClaw", "x-liquid-cap-usd": String(config.capUsd), ...config.headers };
}
function model(id, config) {
  return {
    id,
    name: id,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: CONTEXT_WINDOW,
    maxTokens: MAX_TOKENS,
    headers: headers(config),
    // The exchange sends the usage in the stream when asked, and OpenClaw
    // asks only with this flag. Without it, OpenClaw estimates the context.
    compat: { supportsUsageInStreaming: true }
  };
}
function buildProvider(config) {
  return {
    baseUrl: config.baseUrl,
    api: API,
    headers: headers(config),
    models: [model(DEFAULT_MODEL, config)]
  };
}

// src/catalog.ts
var DISCOVERY_TIMEOUT_MS = 5e3;
function isExchangeModel(value) {
  return typeof value === "object" && value !== null && typeof value.id === "string";
}
function positive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function mapModels(data, config) {
  if (!Array.isArray(data)) return [];
  const entries = data.filter(isExchangeModel);
  const routers = entries.filter((e) => e.match_type === "router");
  const exact = entries.filter((e) => e.match_type !== "router").sort((a, b) => a.id.localeCompare(b.id));
  return [...routers, ...exact].map((e) => ({
    ...model(e.id, config),
    // A router buys a different model on each request, so it keeps the
    // window in common use. An exact model has its own.
    contextWindow: e.match_type === "router" ? CONTEXT_WINDOW : positive(e.max_input_tokens) ?? CONTEXT_WINDOW,
    input: e.liquid_supported_parameters?.includes("input.image") ? ["text", "image"] : ["text"]
  }));
}
async function discoverModels(config, fetchFn = fetch) {
  const fallback = [model(DEFAULT_MODEL, config)];
  try {
    const response = await fetchFn(`${config.baseUrl}/models`, {
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS)
    });
    if (!response.ok) return fallback;
    const body = await response.json();
    const models = mapModels(body.data, config);
    return models.length > 0 ? models : fallback;
  } catch {
    return fallback;
  }
}

// index.ts
var index_default = definePluginEntry({
  id: PROVIDER,
  name: "Liquid Inference",
  description: "Liquid Inference model provider",
  register(api) {
    const config = readConfig(api.pluginConfig);
    api.registerProvider({
      id: PROVIDER,
      label: "Liquid Inference",
      docsPath: "https://inference.ai.exchange/docs/connect-openclaw",
      envVars: [API_KEY_ENV],
      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER,
          methodId: "api-key",
          label: "Liquid Inference API key",
          hint: "A buyer key with the spend scope, from https://inference.ai.exchange",
          optionKey: "liquidApiKey",
          flagName: "--liquid-api-key",
          envVar: API_KEY_ENV,
          promptMessage: "Enter your Liquid Inference API key",
          defaultModel: DEFAULT_MODEL_REF,
          // Onboarding offers liquid.auto only when no primary model is set.
          preserveExistingPrimary: true
        })
      ],
      catalog: {
        order: "simple",
        run: async (ctx) => {
          const apiKey = ctx.resolveProviderApiKey(PROVIDER).apiKey;
          if (!apiKey) {
            return null;
          }
          return { provider: { ...buildProvider(config), models: await discoverModels(config), apiKey } };
        }
      },
      // Any name on the exchange works as liquid/<name>: an exact model, a
      // router model or a preset. The exchange resolves it on each request.
      resolveDynamicModel: (ctx) => ({
        ...model(ctx.modelId, config),
        provider: PROVIDER,
        api: API,
        baseUrl: config.baseUrl
      }),
      // The gateway's model registry keeps a catalog model's headers apart
      // from the model, and the request takes them from the model. This puts
      // them back. A header set on the model in the config wins.
      normalizeResolvedModel: (ctx) => ({
        ...ctx.model,
        headers: { ...headers(config), ...ctx.model.headers }
      })
    });
  }
});
export {
  index_default as default
};
