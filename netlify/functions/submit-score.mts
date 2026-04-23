import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { getRunMedal, isPlausibleScore } from "../../shared/run-result.js";

const STORE_NAME = "spear-line";
const SCORES_KEY = "leaderboard/scores";
const DEFAULT_VERSION = "season-2";
const MAX_NAME_LENGTH = 16;
const MAX_SCORE = 100000;
const MAX_ACTIVE_SCORES = 20;
const MAX_RETRIES = 6;

type ScoreEntry = {
  name: string;
  score: number;
  medal: string;
  version: string;
  runId: string;
  runTimeSeconds: number;
  phaseIndex: number;
  danger: number;
  at: string;
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

function sanitizeRunId(value: unknown) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._:-]/g, "")
    .slice(0, 80);
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeScore(value: unknown) {
  const score = normalizeNumber(value);
  if (score === null) return null;
  const rounded = Math.floor(score);
  if (rounded < 0 || rounded > MAX_SCORE) return null;
  return rounded;
}

function normalizeRunTime(value: unknown) {
  const seconds = normalizeNumber(value);
  if (seconds === null) return null;
  if (seconds < 0 || seconds > 600) return null;
  return Number(seconds.toFixed(2));
}

function normalizePhaseIndex(value: unknown) {
  const phase = normalizeNumber(value);
  if (phase === null) return null;
  const rounded = Math.floor(phase);
  if (rounded < 0 || rounded > 3) return null;
  return rounded;
}

function normalizeDanger(value: unknown) {
  const runDanger = normalizeNumber(value);
  if (runDanger === null) return null;
  if (runDanger < 0 || runDanger > 500) return null;
  return Number(runDanger.toFixed(2));
}

function sortScores(scores: ScoreEntry[]) {
  return [...scores].sort((a, b) => {
    if (Number(b.score || 0) !== Number(a.score || 0)) {
      return Number(b.score || 0) - Number(a.score || 0);
    }
    return String(a.at || "").localeCompare(String(b.at || ""));
  });
}

function mergeVersionScores(existingScores: ScoreEntry[], entry: ScoreEntry) {
  const next = Array.isArray(existingScores) ? [...existingScores] : [];
  const existingRun = next.find((item) => item?.runId === entry.runId);
  if (existingRun) {
    return {
      scores: sortScores(next).slice(0, MAX_ACTIVE_SCORES),
      duplicate: true
    };
  }

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

  return {
    scores: sortScores(next).slice(0, MAX_ACTIVE_SCORES),
    duplicate: false
  };
}

async function writeWithRetry(
  store: ReturnType<typeof getStore>,
  entry: ScoreEntry,
  version: string
) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const current = await store.getWithMetadata(SCORES_KEY, {
      type: "json",
      consistency: "strong"
    });

    const currentList =
      current && Array.isArray(current.data) ? (current.data as ScoreEntry[]) : [];
    const activeScores = currentList.filter(
      (item) => (item?.version || "legacy") === version
    );
    const legacyScores = currentList.filter(
      (item) => (item?.version || "legacy") !== version
    );
    const merged = mergeVersionScores(activeScores, entry);

    if (merged.duplicate) {
      console.info("score.duplicate", {
        version,
        runId: entry.runId,
        attempt
      });
      return { scores: merged.scores, duplicate: true };
    }

    const nextScores = [...merged.scores, ...legacyScores];

    if (current === null) {
      const result = await store.setJSON(SCORES_KEY, nextScores, { onlyIfNew: true });
      if (result.modified) {
        console.info("score.write", {
          version,
          runId: entry.runId,
          attempt,
          created: true,
          duplicate: false
        });
        return { scores: merged.scores, duplicate: false };
      }
    } else {
      const result = await store.setJSON(SCORES_KEY, nextScores, {
        onlyIfMatch: current.etag
      });
      if (result.modified) {
        console.info("score.write", {
          version,
          runId: entry.runId,
          attempt,
          duplicate: false
        });
        return { scores: merged.scores, duplicate: false };
      }
    }

    console.warn("score.write_conflict", {
      version,
      runId: entry.runId,
      attempt
    });
  }

  throw new Error("Leaderboard write conflict");
}

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();

    const name = sanitizeName(body?.name);
    const score = normalizeScore(body?.score);
    const version = sanitizeVersion(body?.version);
    const runId = sanitizeRunId(body?.runId);
    const runTimeSeconds = normalizeRunTime(body?.runTimeSeconds);
    const phaseIndex = normalizePhaseIndex(body?.phaseIndex);
    const danger = normalizeDanger(body?.danger);

    if (!name) {
      return json({ error: "Name required" }, 400);
    }
    if (!runId) {
      return json({ error: "Run ID required" }, 400);
    }
    if (score === null) {
      return json({ error: "Invalid score" }, 400);
    }
    if (runTimeSeconds === null || phaseIndex === null || danger === null) {
      return json({ error: "Invalid run data" }, 400);
    }
    if (!isPlausibleScore(score, runTimeSeconds, danger)) {
      return json({ error: "Score looks invalid for this run" }, 400);
    }

    const medal = getRunMedal(runTimeSeconds, phaseIndex, danger);
    const entry: ScoreEntry = {
      name,
      score,
      medal,
      version,
      runId,
      runTimeSeconds,
      phaseIndex,
      danger,
      at: new Date().toISOString()
    };

    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const result = await writeWithRetry(store, entry, version);

    return json({
      ok: true,
      version,
      duplicate: result.duplicate,
      saved: entry,
      scores: result.scores
    });
  } catch (error) {
    console.error("score.submit_failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return json({ error: "Could not save score" }, 500);
  }
}

export const config: Config = {
  path: "/api/submit-score",
  preferStatic: true
};
