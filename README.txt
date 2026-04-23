Spear Line with Netlify leaderboard

What is included
- index.html: the game
- app.js: generated classic browser bundle for direct-open play on PC
- styles.css: extracted UI styles
- shared/run-result.js: shared run medal and score plausibility rules
- src/main.js: browser entrypoint and DOM wiring
- src/config.js: shared gameplay and leaderboard constants
- src/game.js: gameplay, spawning, collisions, and rendering
- src/ui.js: HUD, overlays, and leaderboard panel behavior
- src/leaderboard.js: local storage helpers and leaderboard API calls
- netlify/functions/leaderboard.mts: reads the shared leaderboard
- netlify/functions/submit-score.mts: saves a score
- netlify.toml: Netlify config
- package.json: dependencies for Functions + Blobs

Local workflow
- Frontend-only smoke test: you can open `index.html` directly on PC for the local game-only version, or serve the repo root with any simple static server.
- After editing files under `shared/` or `src/`, run `npm run build:app` to regenerate `app.js`.
- Full leaderboard test: run the site with Netlify local dev so `/api/leaderboard` and `/api/submit-score` are available.

Deploy the right way
1. Put this folder in a GitHub repository.
2. In Netlify, create a new site from that repo.
3. Netlify will install dependencies, build, and deploy the site.
4. Open the live site once so the Functions and Blobs-backed leaderboard are available.
5. Share the URL in Signal.

Important
- Use Git-backed deploys or Netlify CLI for this version.
- Do not use simple drag-and-drop for the leaderboard build.
- This leaderboard is friends-grade, not cheat-proof.
