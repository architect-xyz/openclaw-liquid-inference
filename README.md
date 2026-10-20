# Liquid Inference for OpenClaw

Adds [Liquid Inference](https://inference.ai.exchange) to
[OpenClaw](https://openclaw.ai) as the model provider `liquid`. The exchange
auctions each model request, fixes a price cap before the first token and
charges for the tokens used.

## Requirements

- OpenClaw 2026.10.5 or later, on Node 24.16 or later.
- A Liquid Inference buyer key with the `spend` scope. See
  [API keys](https://inference.ai.exchange/docs/keys).

## Install

```bash
openclaw plugins install clawhub:@architect-xyz/openclaw-liquid-inference --accept-capabilities
printf '%s\n' "$LIQUID_API_KEY" | openclaw models auth paste-api-key --provider liquid --agent main
openclaw config set agents.defaults.model.primary "liquid/liquid.auto"
```

`--accept-capabilities` accepts what the plugin declares: a model provider.
The second command saves the key in OpenClaw's credential store, so a gateway
that runs as a service does not need the environment variable. `openclaw
onboard` also offers Liquid Inference as a provider and asks for the key.

The plugin keeps your other providers and fallbacks. It sets
`liquid/liquid.auto` as the primary model only when no primary model is set.

## Cap

Every request carries `x-liquid-cap-usd`. The exchange refuses an offer that
cannot fit the cap, and a refused request costs nothing. The default cap is 1
USD. To change it:

```bash
openclaw config set plugins.entries.liquid.config.capUsd 0.25 --strict-json
```

A task sends several requests, so the cap does not limit the total charge of
a task. Set a spend limit on the key to limit total spend.

OpenClaw's own cost estimate for this provider stays at zero. The receipt in
the console shows the charge of each request, labelled OpenClaw.

## Models

`liquid/liquid.auto` lets the exchange choose a model for each request. Any
other name on the exchange works as `liquid/<name>`: an exact model such as
`liquid/kimi-k3`, or a preset that you saved in the console. The exchange
resolves the name on each request. To list the names:

```bash
curl https://router.inference.ai.exchange/v1/models
```

Each model is registered with a context window of 128,000 tokens and an
output limit of 8,192 tokens. Most offers accept no larger output limit.

## Configuration

| Key                                        | Default                                     | Purpose                                 |
| ------------------------------------------ | ------------------------------------------- | --------------------------------------- |
| `plugins.entries.liquid.config.capUsd`     | `1`                                         | The most that one request may cost.     |
| `plugins.entries.liquid.config.baseUrl`    | `https://router.inference.ai.exchange/v1`   | The exchange's OpenAI-compatible endpoint. |
| `plugins.entries.liquid.config.headers`    | `{}`                                        | Extra headers on every request.         |

Every request also carries `X-Title: OpenClaw`, which labels the client on
receipts. An extra header with the name of a default header replaces it. See
[Purchasing rules](https://inference.ai.exchange/docs/rules) for the headers
the exchange reads.

## Refusals

| Response | Cause                                                            |
| -------- | ---------------------------------------------------------------- |
| `401`    | The saved key is wrong or expired. Save it again.               |
| `402`    | The balance or the key's spend limit does not cover the request. |
| `400`    | `eligibility.excluded` in the body names the rule each offer did not meet. |

OpenClaw retries `429` and `503`. A `402` disables the key for a short
window; adding credit does not end the window.

A newer OpenClaw refuses `openclaw config set` while a gateway runs. Run
`openclaw gateway stop` first, then start the gateway again. See
[the OpenClaw guide](https://inference.ai.exchange/docs/connect-openclaw) for
fallbacks, retries and troubleshooting.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

OpenClaw loads `dist/index.js`, a single file built from `index.ts`. It is
committed, because OpenClaw installs a plugin without running its scripts.
CI refuses a change that leaves `dist` stale.

To install a checkout into a throwaway profile:

```bash
openclaw --profile liquid-dev plugins install --link . --force
```

To test the packaged install:

```bash
npm pack --pack-destination /tmp
openclaw plugins install npm-pack:/tmp/architect-xyz-openclaw-liquid-inference-0.1.1.tgz --force
openclaw plugins inspect liquid --runtime --json
```

## Release

Set the version in `package.json`, commit, and push a tag `v<version>`. The
tag run checks the build. Then publish the tag from the Actions tab: run the
release workflow with `ref` set to the tag and `dry_run` off. ClawHub trusts
the dispatched workflow directly, so no secret is needed. With `dry_run` on,
the run previews the publish without an upload.
