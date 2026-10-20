import { CONTEXT_WINDOW, DEFAULT_MODEL, model, type LiquidConfig, type LiquidModel } from "./provider.ts";

// A slow exchange must not hold up the gateway's start.
export const DISCOVERY_TIMEOUT_MS = 5000;

type ExchangeModel = {
  id: string;
  match_type?: string;
  max_input_tokens?: number;
  liquid_supported_parameters?: string[];
};

function isExchangeModel(value: unknown): value is ExchangeModel {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string";
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Maps the exchange's model list. Router models come first, so liquid.auto stays the first choice. */
export function mapModels(data: unknown, config: LiquidConfig): LiquidModel[] {
  if (!Array.isArray(data)) return [];
  const entries = data.filter(isExchangeModel);
  const routers = entries.filter((e) => e.match_type === "router");
  const exact = entries
    .filter((e) => e.match_type !== "router")
    .sort((a, b) => a.id.localeCompare(b.id));
  return [...routers, ...exact].map((e) => ({
    ...model(e.id, config),
    // A router buys a different model on each request, so it keeps the
    // window in common use. An exact model has its own.
    contextWindow: e.match_type === "router" ? CONTEXT_WINDOW : (positive(e.max_input_tokens) ?? CONTEXT_WINDOW),
    input: e.liquid_supported_parameters?.includes("input.image") ? ["text", "image"] : ["text"],
  }));
}

/** Lists the exchange's models. When the list cannot be read, the list is liquid.auto alone. */
export async function discoverModels(
  config: LiquidConfig,
  fetchFn: typeof fetch = fetch,
): Promise<LiquidModel[]> {
  const fallback = [model(DEFAULT_MODEL, config)];
  try {
    const response = await fetchFn(`${config.baseUrl}/models`, {
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    if (!response.ok) return fallback;
    const body = (await response.json()) as { data?: unknown };
    const models = mapModels(body.data, config);
    return models.length > 0 ? models : fallback;
  } catch {
    return fallback;
  }
}
