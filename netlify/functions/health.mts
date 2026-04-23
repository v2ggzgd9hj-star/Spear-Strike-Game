import type { Config } from "@netlify/functions";

const DEFAULT_VERSION = "season-2";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default async function handler() {
  return json({
    ok: true,
    leaderboardVersion: DEFAULT_VERSION,
    context: process.env.CONTEXT || "unknown",
    deployId: process.env.DEPLOY_ID || null,
    commitRef: process.env.COMMIT_REF || null,
    now: new Date().toISOString()
  });
}

export const config: Config = {
  path: "/api/health",
  preferStatic: true
};
