# Solvex Status

The public status page at **status.solvex.work**.

- `services.json` — what is checked.
- `check.mjs` — checks every service once and updates `data/status.json` (rules in `lib.mjs`, tests in `test/`).
- `site/` — the static page that renders `status.json`.
- `.github/workflows/status.yml` — runs every ten minutes on GitHub Actions, keeps the history on the `data` branch and publishes `site/` to GitHub Pages.

Runs outside Azure on purpose: if our cloud has a problem, this page still tells people.

Local: `node --test test/*.test.mjs && node check.mjs && cp data/status.json site/status.json`, then serve `site/`.
