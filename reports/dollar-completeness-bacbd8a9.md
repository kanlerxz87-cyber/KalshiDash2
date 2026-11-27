# Integration review — 2026-11-27

The repository already publishes the dashboard from `main:/`. This review focused on trade-page completeness and historical probe citations; it is not a fresh line-by-line certification of the entire repository.

| Finding | Verification | Official source |
|---|---|---|
| A missing `trades` array could display as $0; a missing/non-string `cursor` could make an incomplete walk appear finished. | The response schema requires both fields. Malformed first or later pages now suppress the value. Explicit empty responses still produce zero. Fixture tests only; not a claim that Kalshi returned malformed data. | [Get Trades](https://docs.kalshi.com/api-reference/market/get-trades#response-trades) |
| The scheduled probe refresh broke the citation test because the website quotes a November 24 capture, not the current rolling output. | The pinned file is byte-for-byte the artifact at commit `738d82207fca87c243010e041d6d7c8dfa3a80e5`. The check now compares the published counts to that artifact. These are observations of a single response, not catalogue sizes. | [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) |

No authenticated account access or trading was attempted. The tracked-dollar panel remains a budgeted sample; the site's proxy and simulated ROI are not exchange-wide turnover or a validated forecast. Chart news and settlement-source links are context, not proof of price-move causality.
