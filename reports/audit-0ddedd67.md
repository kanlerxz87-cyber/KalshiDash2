# Independent current-state audit — 2026-11-27

Scope: deployment status and a subset of local tests and official documentation, not a line-by-line re-verification of the entire repository or live authenticated trading. The checked-out base was `db9123261625c948ceb9fe89232bc92fbd5a7d68`.

| Check | Result | Source / reproducibility |
|---|---|---|
| Published Pages configuration | GitHub API reported `built`, source `main:/`, with latest build at the base commit and no build error. This does not prove the live data feeds work for every user. | [GitHub Pages](https://kanlerxz87-cyber.github.io/KalshiDash2/); [Pages deployment run](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/46070530114) |
| Local internal links | 36 HTML pages passed `python3 tools/check_site_links.py`. This does not check external URLs or data correctness. | [Checker](../tools/check_site_links.py) |
| Local unit tests | `node --test tests/*.test.mjs`: 266 passed; `python3 -m unittest discover -s tools`: 55 passed; `python3 -m unittest discover -s tests`: 28 run, 4 skipped. Tests are not proof of authenticated integration. | [Test directory](../tests/), [tool tests](../tools/) |
| Demo WebSocket and authentication | Official documentation lists both requested demo WebSocket hosts and requires authenticated handshake headers even for public channels. The site uses polling by default; streaming through the optional relay requires credentials. | [Kalshi WebSocket quick start](https://docs.kalshi.com/getting_started/quick_start_websockets); [README](../README.md) |
| Order endpoint | The official V2 reference lists the demo REST host and authenticated order endpoint. No credentials were available and no account balance, trade, fill, or order was verified or executed during this audit. | [Kalshi Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2); [Flagged for Review](../flagged.html#F1) |

## Limitations and handoff

- A static GitHub Pages site cannot keep monitoring when the browser and optional relay are closed; polling can miss intermediate price moves. Consult the [Flagged for Review page](../flagged.html) for existing limitations and unverified items.
- The ranking is a labeled proxy, not a verified ranking by actual dollars traded; the high-ROI watch is a rule-based screen, not proof of positive returns. See the [README](../README.md) and [summary](../summary.html).
- Official links attached to price jumps are not independently established causal explanations. Do not treat timing as proof of causality.
- `flagged.html#NF1` has a historical narrative that can be misread as a current contradiction despite its mitigation notice. It was not edited because that file is in open PR [#141](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/141); the existing coordination handoff remains.
- Shell outbound access is restricted; live Kalshi API and authenticated order execution were not tested here. The four skipped Python tests and the broader live site should be checked in their appropriate environment.
