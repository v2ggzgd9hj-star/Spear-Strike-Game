import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const STORE_NAME = "spear-line";
const SCORES_KEY = "leaderboard/scores";
const DEFAULT_VERSION = "season-2";
const MAX_SCORES = 20;

type ScoreEntry = {
  name?: string;
  score?: number;
  medal?: string;
  version?: string;
  runId?: string;
  runTimeSeconds?: number;
  phaseIndex?: number;
  danger?: number;
  at?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function sanitizeVersion(value: unknown) {
  return String(value || DEFAULT_VERSION)
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 32) || DEFAULT_VERSION;
}

function sortScores(scores: ScoreEntry[]) {
  return [...scores].sort((a, b) => {
    if (Number(b.score || 0) !== Number(a.score || 0)) {
      return Number(b.score || 0) - Number(a.score || 0);
    }
    return String(a.at || "").localeCompare(String(b.at || ""));
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const version = sanitizeVersion(url.searchParams.get("version"));

  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const scores = await store.get(SCORES_KEY, { type: "json", consistency: "strong" });
    const filtered = Array.isArray(scores)
      ? scores.filter((entry: ScoreEntry) => (entry?.version || "legacy") === version)
      : [];

    console.info("leaderboard.read", {
      version,
      count: filtered.length
    });

    return json({
      ok: true,
      version,
      scores: sortScores(filtered).slice(0, MAX_SCORES)
    });
  } catch (error) {
    console.error("leaderboard.read_failed", {
      version,
      error: error instanceof Error ? error.message : String(error)
    });
    return json({ error: "Could not load leaderboard" }, 500);
  }
}

export const config: Config = {
  path: "/api/leaderboard",
  preferStatic: true
};
