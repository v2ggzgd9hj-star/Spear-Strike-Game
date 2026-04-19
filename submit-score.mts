import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const STORE_NAME = "spear-line";
const SCORES_KEY = "leaderboard/scores";
const DEFAULT_VERSION = "season-2";
const MAX_NAME_LENGTH = 16;
const MAX_SCORE = 100000;
const MAX_ACTIVE_SCORES = 20;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function sanitizeName(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

function sanitizeVersion(value: unknown) {
  return String(value || DEFAULT_VERSION)
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 32) || DEFAULT_VERSION;
}

function normalizeScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  const rounded = Math.floor(score);
  if (rounded < 0 || rounded > MAX_SCORE) return null;
  return rounded;
}

function sortScores(scores: Array<{ score?: number; at?: string }>) {
  return [...scores].sort((a, b) => {
    if (Number(b.score || 0) !== Number(a.score || 0)) {
      return Number(b.score || 0) - Number(a.score || 0);
    }
    return String(a.at || "").localeCompare(String(b.at || ""));
  });
}

function mergeVersionScores(existingScores: any[], entry: any) {
  const next = Array.isArray(existingScores) ? [...existingScores] : [];
  const key = entry.name.toLocaleLowerCase();

  const existingIndex = next.findIndex(
    (item) => String(item?.name || "").toLocaleLowerCase() === key
  );

  if (existingIndex >= 0) {
    const current = next[existingIndex];
    if (entry.score > Number(current?.score || 0)) {
      next[existingIndex] = { ...current, ...entry };
    }
  } else {
    next.push(entry);
  }

  return sortScores(next).slice(0, MAX_ACTIVE_SCORES);
}

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const name = sanitizeName(body?.name);
    const score = normalizeScore(body?.score);
    const medal = sanitizeName(body?.medal).slice(0, 12) || "-";
    const version = sanitizeVersion(body?.version);

    if (!name) {
      return json({ error: "Name required" }, 400);
    }

    if (score === null) {
      return json({ error: "Invalid score" }, 400);
    }

    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const allScores = await store.get(SCORES_KEY, { type: "json", consistency: "strong" });
    const currentList = Array.isArray(allScores) ? allScores : [];

    const activeScores = currentList.filter((entry: any) => (entry?.version || "legacy") === version);
    const legacyScores = currentList.filter((entry: any) => (entry?.version || "legacy") !== version);

    const entry = {
      name,
      score,
      medal,
      version,
      at: new Date().toISOString()
    };

    const mergedActive = mergeVersionScores(activeScores, entry);
    const nextScores = [...mergedActive, ...legacyScores];

    await store.setJSON(SCORES_KEY, nextScores);

    return json({
      ok: true,
      version,
      saved: entry,
      scores: mergedActive
    });
  } catch (error) {
    console.error("score submit failed", error);
    return json({ error: "Could not save score" }, 500);
  }
}

export const config: Config = {
  path: "/api/submit-score",
  preferStatic: true
};
