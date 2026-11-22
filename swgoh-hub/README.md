# SWGOH Hub

Your own swgoh.gg-style site, built from your live game data.

## Start it
Double-click **Start SWGOH Hub.command**, or run:

    python3 serve.py

It opens http://localhost:8811. Press **Sync now** to pull fresh data. Docker Desktop and the
`swgoh-comlink` container start automatically if they aren't running.

## Phone / cloud copy
GitHub Actions (`.github/workflows/sync.yml`) syncs every 4 hours and publishes the site to GitHub Pages.
Your data is encrypted with your password before it leaves the build, so the page shows only a
password box until you unlock it (once per device). The repo itself holds no personal data.
It needs two repository secrets (Settings > Secrets and variables > Actions):
- `HUB_ALLY` - your ally code
- `HUB_PASSWORD` - the site password (to change it, set it again; each device asks once more)

Sync now: tap **Sync now** in the site, then **Run workflow** on GitHub. New data shows ~3 minutes later.
GitHub pauses scheduled runs after 60 days with no commits; re-enable them on the Actions tab.

## Files
- `ally.txt` - your ally code for local syncs (not published).
- `goals.json` - your goal teams and targets (R7 = Relic 7, 7* = 7 stars). Edit, then sync.
- `build.py` - downloads data through comlink and writes `site/data.js`. `--offline` rebuilds from cache.
- `serve.py` - local web server with the Sync button.
- `site/` - the web app. `cache/history/` keeps your last 60 syncs for the GP chart and "since last sync".

## First-time setup on a new Mac
    docker run -d --name swgoh-comlink --restart unless-stopped -e APP_NAME=yourAppName \
      -p 127.0.0.1:3000:3000 ghcr.io/swgoh-utils/swgoh-comlink:latest
