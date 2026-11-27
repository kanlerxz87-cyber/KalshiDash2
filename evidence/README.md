# evidence/ — evidence shipped with the site

These files travel with the published site so that any claim on
<https://kanlerxz87-cyber.github.io/KalshiDash2/> can be re-checked from the same
origin, without trusting a build log.

| File | What it records |
| --- | --- |
| `evidence-cors-taxonomy.md` | Raw demo-API capture: CORS headers per endpoint, event-category counts, series matches for the five topics, auth-route probes. Captured 2026-11-20 11:08–11:10 UTC by GitHub Actions. |
| `evidence-routes-settled.md` | Raw demo-API capture: the deprecated order route's `410` response, top markets by volume, price grids, settled-market `result` distribution. Captured 2026-11-20 11:08 UTC. |
| `live-2026-11-22-8f3c331c.md` | Raw demo-API capture: historical cutoff, archived markets, archived candlesticks, and series endpoint responses. Captured 2026-11-22 UTC. |
| `auth-sign-test.mjs` | Deterministic self-test of the documented signing rules. No network, no credentials — generates a local RSA key pair and asserts the six rules the site depends on. |

## Running the signing self-test

```bash
node evidence/auth-sign-test.mjs
```

Expected output: `6/6 checks passed`. The checks are:

1. a private key imported as `spki` is rejected (the mistake the previous site made);
2. the same key imported as `pkcs8` succeeds;
3. a signature verifies against `timestamp + METHOD + /trade-api/v2/portfolio/balance`;
4. that signature does **not** verify against the suffix-only path;
5. the query string is excluded from the pre-sign text;
6. Ed25519 sign/verify works when the runtime exposes it.

## Why capture ran in CI

The build sandbox used to assemble this site cannot open TLS connections to Kalshi
hosts (`SSL_ERROR_SYSCALL`). GitHub-hosted runners can, so the captures were taken
there and committed. The workflow that produced them is
`.github/workflows/verify-facts.yml` on the session branch.
