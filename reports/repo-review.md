# Repository review — kanlerxz87-cyber/KalshiDash2

Reviewed at base commit `6081bb7ed1a93aa588d2a7ccebdce4250bd43a4c` (branch `main`).
Commit: https://github.com/kanlerxz87-cyber/KalshiDash2/commit/6081bb7ed1a93aa588d2a7ccebdce4250bd43a4c

| # | Area | Finding | Evidence | Source |
|---|------|---------|----------|--------|
| F1 | Content | Only `README.md` existed (13 bytes: `# KalshiDash2`). No code, tests, CI or LICENSE. | `git ls-tree` at 6081bb7 | https://github.com/kanlerxz87-cyber/KalshiDash2/tree/6081bb7ed1a93aa588d2a7ccebdce4250bd43a4c |
| F2 | Hosting | GitHub Pages was enabled with the legacy build from `main` `/`, which would publish the repo root and not a `site/` folder. Switched to the Actions workflow build at release. | Pages API response at build time | https://docs.github.com/en/pages |
| F3 | Process | The task asked for `session-…` branches. The session is assigned one branch (`arena/64d89c6c-kalshidash2`); all work stays there. | COORDINATION.md | ../COORDINATION.md |
| F4 | Process | Branch history was rewritten once (force-push of this branch only) to drop a ~40 MB bot data commit and an early probe output. `main` was not touched. | git log on the branch | ../COORDINATION.md |
| F5 | Hygiene | `.gitignore` was absent. Added to exclude generated `site/data/*.json`. | repo tree | — |
| F6 | Access | The Kalshi host was not reachable from the build sandbox. Public data was collected from GitHub Actions runners, which could reach it. | Probe run results (since removed) | https://docs.kalshi.com/getting_started/demo_env |

Not verified in this review: the Developer Agreement (https://kalshi.com/developer-agreement) and the fee schedule linked from the API spec. Both need a human read.
