import {
  LEADERBOARD_VERSION,
  PLAYER_NAME_KEY,
  STORAGE_KEY
} from "./config.js";

export function createLeaderboardApi({
  fetchImpl = window.fetch.bind(window),
  storage = window.localStorage
} = {}) {
  function makeRunId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `run-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function getBest() {
    return Number(storage.getItem(STORAGE_KEY) || 0);
  }

  function setBest(best) {
    storage.setItem(STORAGE_KEY, String(best));
  }

  function getPlayerName() {
    return storage.getItem(PLAYER_NAME_KEY) || "";
  }

  function setPlayerName(name) {
    storage.setItem(PLAYER_NAME_KEY, name);
  }

  function sanitizePlayerName(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\u0000-\u001F\u007F<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
  }

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function leaderboardErrorMessage(error, fallback) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }

  async function fetchJsonWithRetry(url, options = {}, config = {}) {
    const {
      timeoutMs = 5000,
      retries = 1,
      retryDelayMs = 220
    } = config;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(url, {
          ...options,
          signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const error = new Error(payload.error || "Request failed");
          error.status = response.status;
          throw error;
        }

        return payload;
      } catch (error) {
        const aborted = error && error.name === "AbortError";
        const status = typeof error?.status === "number" ? error.status : 0;
        const shouldRetry =
          attempt < retries && (aborted || status >= 500 || status === 0);

        if (shouldRetry) {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }

        if (aborted) {
          throw new Error("Request timed out");
        }

        if (error instanceof Error) {
          throw error;
        }

        throw new Error(String(error));
      } finally {
        window.clearTimeout(timer);
      }
    }

    throw new Error("Request failed");
  }

  async function fetchScores() {
    return fetchJsonWithRetry(
      `/api/leaderboard?version=${encodeURIComponent(LEADERBOARD_VERSION)}`,
      {
        headers: { Accept: "application/json" }
      },
      {
        timeoutMs: 4500,
        retries: 1,
        retryDelayMs: 240
      }
    );
  }

  async function submitScore({
    name,
    score,
    runId,
    runTimeSeconds,
    phaseIndex,
    danger
  }) {
    return fetchJsonWithRetry(
      "/api/submit-score",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          name,
          score,
          version: LEADERBOARD_VERSION,
          runId,
          runTimeSeconds,
          phaseIndex,
          danger
        })
      },
      {
        timeoutMs: 6000,
        retries: 1,
        retryDelayMs: 300
      }
    );
  }

  return {
    fetchScores,
    getBest,
    getPlayerName,
    leaderboardErrorMessage,
    makeRunId,
    sanitizePlayerName,
    setBest,
    setPlayerName,
    submitScore
  };
}
