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
function model(id) {
  return {
    id,
    name: id,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: CONTEXT_WINDOW,
    maxTokens: MAX_TOKENS
  };
}
function buildProvider(config) {
  return {
    baseUrl: config.baseUrl,
    api: API,
    headers: headers(config),
    models: [model(DEFAULT_MODEL)]
  };
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
      docsPath: "/providers/liquid-inference",
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
          return { provider: { ...buildProvider(config), apiKey } };
        }
      },
      // Any name on the exchange works as liquid/<name>: an exact model, a
      // router model or a preset. The exchange resolves it on each request.
      resolveDynamicModel: (ctx) => ({
        ...model(ctx.modelId),
        provider: PROVIDER,
        api: API,
        baseUrl: config.baseUrl,
        headers: headers(config)
      })
    });
  }
});
export {
  index_default as default
};
