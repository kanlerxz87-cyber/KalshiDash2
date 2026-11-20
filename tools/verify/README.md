# tools/verify

Temporary, auditable verification harness. Each script here captures **reproducible
facts** from the official Kalshi demo API so that claims on the site can cite an
observed response instead of an assumption.

Run: GitHub Actions workflow `.github/workflows/verify-facts.yml` (the sandbox that
builds this repo cannot open TLS connections to Kalshi hosts; GitHub-hosted runners can).

Triggered by push to this directory.
