import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const STORE_NAME = "spear-line";
const SCORES_KEY = "leaderboard/scores";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default async function handler() {
  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const scores = await store.get(SCORES_KEY, { type: "json", consistency: "strong" });
    return json({
      scores: Array.isArray(scores) ? scores.slice(0, 10) : []
    });
  } catch (error) {
    console.error("leaderboard read failed", error);
    return json({ error: "Could not load leaderboard" }, 500);
  }
}

export const config: Config = {
  path: "/api/leaderboard",
  preferStatic: true
};
