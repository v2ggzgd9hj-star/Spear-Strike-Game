import { createGame } from "./game.js";
import { createLeaderboardApi } from "./leaderboard.js";
import { createUI } from "./ui.js";

const dom = {
  app: document.getElementById("app"),
  canvas: document.getElementById("gameCanvas"),
  scoreText: document.getElementById("scoreText"),
  bestText: document.getElementById("bestText"),
  finalScore: document.getElementById("finalScore"),
  finalBest: document.getElementById("finalBest"),
  finalMedal: document.getElementById("finalMedal"),
  hintText: document.getElementById("hintText"),
  centerCall: document.getElementById("centerCall"),
  smallCall: document.getElementById("smallCall"),
  operationText: document.getElementById("operationText"),
  resultOperationText: document.getElementById("resultOperationText"),
  startOverlay: document.getElementById("startOverlay"),
  gameOverOverlay: document.getElementById("gameOverOverlay"),
  gameOverBody: document.getElementById("gameOverBody"),
  nameInput: document.getElementById("nameInput"),
  saveScoreBtn: document.getElementById("saveScoreBtn"),
  skipBtn: document.getElementById("skipBtn"),
  leaderboardStatus: document.getElementById("leaderboardStatus"),
  leaderboardList: document.getElementById("leaderboardList"),
  leaderboardScroll: document.getElementById("leaderboardScroll")
};

dom.gameOverCard = dom.gameOverOverlay.querySelector(".card");

const ctx = dom.canvas.getContext("2d", { alpha: true });
const leaderboardApi = createLeaderboardApi();
const ui = createUI(dom, leaderboardApi);
const game = createGame({
  app: dom.app,
  canvas: dom.canvas,
  ctx,
  leaderboardApi,
  ui
});

let lastTapMs = 0;

function normalizePress(event) {
  if (ui.shouldAllowNativeInteraction(event.target)) {
    return;
  }

  if (event.cancelable) {
    event.preventDefault();
  }
  if (event.type === "mousedown" && "ontouchstart" in window) {
    return;
  }

  const now = performance.now();
  if (now - lastTapMs < 45) {
    return;
  }
  lastTapMs = now;
  game.handleTap();
}

function bindFastInput(target) {
  target.addEventListener("pointerdown", normalizePress, { passive: false });
  target.addEventListener("touchstart", normalizePress, { passive: false });
  target.addEventListener("mousedown", normalizePress, { passive: false });
  target.addEventListener("click", normalizePress, { passive: false });
}

bindFastInput(dom.canvas);
bindFastInput(dom.startOverlay);

document.body.addEventListener(
  "touchmove",
  (event) => {
    if (!game.isPlaying()) {
      return;
    }
    if (ui.shouldAllowNativeInteraction(event.target)) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
  },
  { passive: false }
);

["pointerdown", "touchstart", "mousedown", "click"].forEach((eventName) => {
  dom.nameInput.addEventListener(eventName, (event) => {
    event.stopPropagation();
  });

  dom.saveScoreBtn.addEventListener(eventName, (event) => {
    event.stopPropagation();
  });

  dom.skipBtn.addEventListener(eventName, (event) => {
    event.stopPropagation();
  });

  dom.gameOverCard.addEventListener(eventName, (event) => {
    event.stopPropagation();
  });
});

dom.saveScoreBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  await ui.submitLeaderboardScore();
});

dom.skipBtn.addEventListener("click", (event) => {
  event.preventDefault();
  if (!ui.isLeaderboardBusy()) {
    game.startGame();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.target === dom.nameInput && event.code === "Enter") {
    event.preventDefault();
    ui.submitLeaderboardScore();
    return;
  }

  if (
    (event.code === "Space" || event.code === "Enter") &&
    event.target !== dom.nameInput
  ) {
    event.preventDefault();
    game.handleTap();
  }
});

window.addEventListener("resize", game.resizeCanvas);

game.init();
