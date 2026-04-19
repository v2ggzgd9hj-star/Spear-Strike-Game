Spear Line with Netlify leaderboard

What is included
- index.html: the game
- netlify/functions/leaderboard.mts: reads the shared leaderboard
- netlify/functions/submit-score.mts: saves a score
- netlify.toml: Netlify config
- package.json: dependencies for Functions + Blobs

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
