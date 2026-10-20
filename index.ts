import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "openclaw/plugin-sdk/provider-auth";

import { discoverModels } from "./src/catalog.ts";
import {
  API,
  API_KEY_ENV,
  buildProvider,
  DEFAULT_MODEL_REF,
  headers,
  model,
  PROVIDER,
  readConfig,
} from "./src/provider.ts";

export default definePluginEntry({
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
          preserveExistingPrimary: true,
        }),
      ],

      catalog: {
        order: "simple",
        run: async (ctx) => {
          const apiKey = ctx.resolveProviderApiKey(PROVIDER).apiKey;
          if (!apiKey) {
            return null;
          }
          return { provider: { ...buildProvider(config), models: await discoverModels(config), apiKey } };
        },
      },

      // Any name on the exchange works as liquid/<name>: an exact model, a
      // router model or a preset. The exchange resolves it on each request.
      resolveDynamicModel: (ctx) => ({
        ...model(ctx.modelId, config),
        provider: PROVIDER,
        api: API,
        baseUrl: config.baseUrl,
      }),

      // The gateway's model registry keeps a catalog model's headers apart
      // from the model, and the request takes them from the model. This puts
      // them back. A header set on the model in the config wins.
      normalizeResolvedModel: (ctx) => ({
        ...ctx.model,
        headers: { ...headers(config), ...ctx.model.headers },
      }),
    });
  },
});
