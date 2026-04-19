import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const STORE_NAME = "spear-line";
const SCORES_KEY = "leaderboard/scores";
const MAX_NAME_LENGTH = 16;
const MAX_SCORE = 100000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function sanitizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  const rounded = Math.floor(score);
  if (rounded < 0 || rounded > MAX_SCORE) return null;
  return rounded;
}

function sortScores(scores) {
  return [...scores].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.at.localeCompare(b.at);
  });
}

function mergeScore(existingScores, entry) {
  const next = Array.isArray(existingScores) ? [...existingScores] : [];
  const key = entry.name.toLocaleLowerCase();

  const existingIndex = next.findIndex(
    (item) => String(item.name || "").toLocaleLowerCase() == key
  );

  if (existingIndex >= 0) {
    const current = next[existingIndex];
    if (entry.score > Number(current.score || 0)) {
      next[existingIndex] = { ...current, ...entry };
    }
  } else {
    next.push(entry);
  }

  return sortScores(next).slice(0, 20);
}

async function writeWithRetry(store, entry) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await store.getWithMetadata(SCORES_KEY, {
      type: "json",
      consistency: "strong"
    });

    const currentScores = current && Array.isArray(current.data) ? current.data : [];
    const nextScores = mergeScore(currentScores, entry);
    await store.setJSON(SCORES_KEY, nextScores);
    return nextScores;
  }

  throw new Error("Leaderboard write conflict");
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const name = sanitizeName(body?.name);
    const score = normalizeScore(body?.score);
    const medal = sanitizeName(body?.medal).slice(0, 12) || "-";

    if (!name) {
      return json({ error: "Name required" }, 400);
    }

    if (score === null) {
      return json({ error: "Invalid score" }, 400);
    }

    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const entry = {
      name,
      score,
      medal,
      at: new Date().toISOString()
    };

    const scores = await writeWithRetry(store, entry);

    return json({
      ok: true,
      saved: entry,
      scores: scores.slice(0, 10)
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
