function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createUI(dom, leaderboardApi) {
  let messageTimer = 0;
  let smallMessageTimer = 0;
  let leaderboardBusy = false;
  let lastFinalScore = 0;
  let lastFinalMedal = "-";
  let lastRunSummary = null;

  function setOperation(name) {
    dom.operationText.textContent = name;
    dom.resultOperationText.textContent = name;
  }

  function syncHud(score, best) {
    dom.scoreText.textContent = Math.floor(score);
    dom.bestText.textContent = Math.floor(best);
  }

  function setHint(text) {
    dom.hintText.textContent = text;
  }

  function showCall(text, duration = 1.05) {
    dom.centerCall.textContent = text;
    dom.centerCall.classList.add("show");
    messageTimer = duration;
  }

  function showSmallCall(text, duration = 0.7) {
    dom.smallCall.textContent = text;
    dom.smallCall.classList.add("show");
    smallMessageTimer = duration;
  }

  function hideCalls() {
    messageTimer = 0;
    smallMessageTimer = 0;
    dom.centerCall.classList.remove("show");
    dom.smallCall.classList.remove("show");
  }

  function update(dt) {
    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) {
        dom.centerCall.classList.remove("show");
      }
    }

    if (smallMessageTimer > 0) {
      smallMessageTimer -= dt;
      if (smallMessageTimer <= 0) {
        dom.smallCall.classList.remove("show");
      }
    }
  }

  function setLeaderboardStatus(text) {
    dom.leaderboardStatus.textContent = text;
  }

  function setLeaderboardBusy(isBusy) {
    leaderboardBusy = isBusy;
    dom.saveScoreBtn.disabled = isBusy;
    dom.skipBtn.disabled = isBusy;
  }

  function resetLeaderboardScroll() {
    dom.gameOverBody.scrollTop = 0;
  }

  function setLeaderboardListInteractive(isInteractive) {
    dom.gameOverCard.classList.toggle("isLocked", !isInteractive);
    dom.gameOverBody.classList.toggle("isLocked", !isInteractive);
    dom.leaderboardScroll.classList.toggle("isLocked", !isInteractive);
    if (!isInteractive) {
      resetLeaderboardScroll();
    }
  }

  function setGameOverUiEnabled(enabled) {
    dom.nameInput.disabled = !enabled;
    dom.saveScoreBtn.disabled = !enabled;
    dom.skipBtn.disabled = !enabled;

    dom.nameInput.tabIndex = enabled ? 0 : -1;
    dom.saveScoreBtn.tabIndex = enabled ? 0 : -1;
    dom.skipBtn.tabIndex = enabled ? 0 : -1;

    setLeaderboardListInteractive(enabled);

    if (!enabled) {
      dom.nameInput.blur();
      if (
        document.activeElement &&
        typeof document.activeElement.blur === "function"
      ) {
        document.activeElement.blur();
      }
    }
  }

  function renderLeaderboard(scores) {
    if (!Array.isArray(scores) || scores.length === 0) {
      dom.leaderboardList.innerHTML =
        '<li class="leaderboardEmpty">No current-season scores yet. Be the first.</li>';
      return;
    }

    dom.leaderboardList.innerHTML = scores
      .slice(0, 20)
      .map((entry, index) => {
        const safeName = escapeHtml(entry.name || "Unknown");
        const safeScore = Number(entry.score || 0);
        return `
          <li class="leaderboardEntry">
            <span class="leaderboardRank">#${index + 1}</span>
            <span class="leaderboardName">${safeName}</span>
            <span class="leaderboardScore">${safeScore}</span>
          </li>
        `;
      })
      .join("");
  }

  async function refreshLeaderboard(message = "Loading leaderboard\u2026") {
    setLeaderboardStatus(message);
    try {
      const payload = await leaderboardApi.fetchScores();
      renderLeaderboard(payload.scores || []);
      setLeaderboardStatus("Top 20 \u2022 Current season");
    } catch {
      renderLeaderboard([]);
      setLeaderboardStatus("Leaderboard offline");
    }
  }

  async function submitLeaderboardScore() {
    if (leaderboardBusy) {
      return false;
    }

    const name = leaderboardApi.sanitizePlayerName(dom.nameInput.value);
    if (!name) {
      setLeaderboardStatus("Enter a name or tap Skip.");
      dom.nameInput.focus();
      return false;
    }

    if (!lastRunSummary?.runId) {
      setLeaderboardStatus("No run data to save.");
      return false;
    }

    leaderboardApi.setPlayerName(name);
    setLeaderboardBusy(true);
    setLeaderboardStatus("Saving score\u2026");

    try {
      const payload = await leaderboardApi.submitScore({
        name,
        score: lastFinalScore,
        runId: lastRunSummary.runId,
        runTimeSeconds: lastRunSummary.runTimeSeconds,
        phaseIndex: lastRunSummary.phaseIndex,
        danger: lastRunSummary.danger
      });

      renderLeaderboard(payload.scores || []);
      lastFinalMedal = payload.saved?.medal || lastFinalMedal;
      dom.finalMedal.textContent = lastFinalMedal;
      setLeaderboardStatus(
        payload.duplicate
          ? "Score already saved"
          : "Score saved \u2022 Current season"
      );
      dom.saveScoreBtn.textContent = "Saved";
      return true;
    } catch (error) {
      setLeaderboardStatus(
        `${leaderboardApi.leaderboardErrorMessage(
          error,
          "Could not save score"
        )} \u2022 You can retry or tap Play again.`
      );
      return false;
    } finally {
      setLeaderboardBusy(false);
    }
  }

  function resetForRun() {
    dom.saveScoreBtn.textContent = "Save score";
    dom.nameInput.value = leaderboardApi.getPlayerName();
    setLeaderboardStatus("Loading leaderboard\u2026");
    dom.leaderboardList.innerHTML = "";
    setLeaderboardBusy(false);
    setGameOverUiEnabled(false);
    lastRunSummary = null;
    lastFinalScore = 0;
    lastFinalMedal = "-";
    hideCalls();
  }

  function hideOverlaysForGameplay() {
    dom.startOverlay.classList.add("hidden");
    dom.gameOverOverlay.classList.add("hidden");
  }

  function showGameOver({ score, best, medal, runSummary }) {
    lastFinalScore = score;
    lastFinalMedal = medal;
    lastRunSummary = runSummary;
    dom.finalScore.textContent = score;
    dom.finalBest.textContent = best;
    dom.finalMedal.textContent = medal;
    dom.gameOverOverlay.classList.remove("hidden");
    setGameOverUiEnabled(true);
    resetLeaderboardScroll();
    setHint("Save score or skip to continue");
    refreshLeaderboard();
  }

  function shouldAllowNativeInteraction(target) {
    if (dom.gameOverOverlay.classList.contains("hidden")) {
      return false;
    }

    return Boolean(target && target.closest && dom.gameOverCard.contains(target));
  }

  function isLeaderboardBusy() {
    return leaderboardBusy;
  }

  return {
    hideCalls,
    hideOverlaysForGameplay,
    isLeaderboardBusy,
    refreshLeaderboard,
    resetForRun,
    setGameOverUiEnabled,
    setHint,
    setOperation,
    shouldAllowNativeInteraction,
    showCall,
    showGameOver,
    showSmallCall,
    submitLeaderboardScore,
    syncHud,
    update
  };
}
