import {
  CROSS_LANE_GAP_FLOOR,
  CROSS_LANE_GAP_START,
  DOUBLE_STRIKE_SWITCH_GAP_FLOOR,
  DOUBLE_STRIKE_SWITCH_GAP_START,
  H,
  LANE_CENTERS,
  MAX_LOOKAHEAD,
  OPERATION_NAMES,
  PHASE_DEFS,
  SAME_LANE_GAP_FLOOR,
  SAME_LANE_GAP_START,
  SPAWN_Y,
  THREAT_DEFS,
  W
} from "./config.js";
import { getRunMedal } from "../shared/run-result.js";

export function createGame({ app, canvas, ctx, ui, leaderboardApi }) {
  let dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  let state = "idle";
  let score = 0;
  let best = leaderboardApi.getBest();
  let lastTime = 0;
  let gameTime = 0;
  let phaseClock = 0;
  let danger = 0;
  let spawnTimer = 0;
  let flashTimer = 0;
  let shakeTimer = 0;
  let phaseFlashTimer = 0;
  let phaseIndex = 0;
  let lastSpawnLane = 1;
  let deathTimer = 0;
  let deathFreezeTimer = 0;
  let deathImpactTimer = 0;
  let deathImpact = null;
  let deathObstacle = null;
  let lastRunSummary = null;

  let obstacles = [];
  let warnings = [];
  let stars = [];
  let switchBursts = [];
  let trail = [];

  const player = {
    lane: 0,
    x: LANE_CENTERS[0],
    y: H - 90,
    w: 62,
    h: 30,
    glow: 0,
    lastSwitchAt: -999
  };

  function syncHud() {
    ui.syncHud(score, best);
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  function showCall(text, duration = 1.05) {
    ui.showCall(text, duration);
  }

  function showSmallCall(text, duration = 0.7) {
    ui.showSmallCall(text, duration);
  }

  function hideCalls() {
    ui.hideCalls();
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < 36; i += 1) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: Math.random() * 2 + 0.6,
        v: Math.random() * 22 + 11,
        a: Math.random() * 0.23 + 0.08
      });
    }
  }

  function chooseOperation() {
    const operation =
      OPERATION_NAMES[Math.floor(Math.random() * OPERATION_NAMES.length)];
    ui.setOperation(operation);
  }

  function resizeCanvas() {
    const rect = app.getBoundingClientRect();
    dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function currentPhase() {
    let selected = PHASE_DEFS[0];
    for (const phase of PHASE_DEFS) {
      if (phaseClock >= phase.threshold) {
        selected = phase;
      }
    }
    return selected;
  }

  function currentDanger() {
    return Math.log1p(Math.max(0, gameTime) * 0.95);
  }

  function currentSpawnInterval() {
    const phase = currentPhase();
    const drop = Math.min(0.32, danger * 0.078);
    return Math.max(0.38, phase.baseInterval - drop);
  }

  function currentSpeedBonus(timeOverride = gameTime) {
    const projectedDanger = Math.log1p(Math.max(0, timeOverride) * 0.88);
    return projectedDanger * 34;
  }

  function resetRun() {
    score = 0;
    gameTime = 0;
    phaseClock = 0;
    danger = 0;
    spawnTimer = -0.1;
    flashTimer = 0;
    shakeTimer = 0;
    phaseFlashTimer = 0;
    phaseIndex = 0;
    lastSpawnLane = 1;
    obstacles = [];
    warnings = [];
    switchBursts = [];
    trail = [];
    player.lane = 0;
    player.x = LANE_CENTERS[0];
    player.glow = 0;
    player.lastSwitchAt = -999;
    hideCalls();
    ui.resetForRun();
    deathTimer = 0;
    deathFreezeTimer = 0;
    deathImpactTimer = 0;
    deathImpact = null;
    deathObstacle = null;
    lastRunSummary = null;
    syncHud();
  }

  function startGame() {
    chooseOperation();
    resetRun();
    state = "playing";
    ui.hideOverlaysForGameplay();
    ui.setHint("Tap anywhere to shift lane");
    showCall("Phase One \u2022 Contact", 1.2);
    phaseFlashTimer = 0.35;
  }

  function startDeathSequence(obstacle) {
    if (state !== "playing") {
      return;
    }

    state = "dying";
    deathTimer = 0.24;
    deathFreezeTimer = 0.11;
    deathImpactTimer = 0.26;
    deathObstacle = obstacle;
    deathImpact = {
      x: (player.x + obstacle.x) * 0.5,
      y: player.y - 2
    };
    flashTimer = 0.3;
    shakeTimer = 0.14;
    player.glow = 0.34;
    ui.setHint("Line broken");
    vibrate([18, 12, 34]);
  }

  function endGame() {
    state = "gameOver";
    flashTimer = 0.24;
    shakeTimer = 0.18;

    const final = Math.floor(score);
    if (final > best) {
      best = final;
      leaderboardApi.setBest(best);
    }

    const reachedPhaseIndex = PHASE_DEFS.indexOf(currentPhase());
    lastRunSummary = {
      runId: leaderboardApi.makeRunId(),
      runTimeSeconds: Number(phaseClock.toFixed(2)),
      phaseIndex: reachedPhaseIndex,
      danger: Number(danger.toFixed(2))
    };
    const medal = getRunMedal(
      lastRunSummary.runTimeSeconds,
      reachedPhaseIndex,
      lastRunSummary.danger
    );

    syncHud();
    showCall("Line Broken", 1.2);
    ui.showGameOver({ score: final, best, medal, runSummary: lastRunSummary });
    vibrate([30, 20, 30]);
  }

  function queueSwitchEffects(fromX, toX) {
    switchBursts.push({ x: toX, y: player.y + 3, r: 10, a: 0.65 });
    trail.push({ x: fromX, y: player.y, a: 0.24 });
  }

  function handleTap() {
    if (state === "idle") {
      startGame();
      return;
    }
    if (state !== "playing") {
      return;
    }

    const oldX = player.x;
    player.lane = player.lane === 0 ? 1 : 0;
    player.x = LANE_CENTERS[player.lane];
    player.glow = 0.16;
    player.lastSwitchAt = gameTime;
    queueSwitchEffects(oldX, player.x);
    vibrate(10);
  }

  function pickLane() {
    const phase = currentPhase();
    const alternate = Math.random() < phase.altProb;
    if (alternate) {
      lastSpawnLane = lastSpawnLane === 0 ? 1 : 0;
    } else {
      lastSpawnLane = Math.random() < 0.5 ? 0 : 1;
    }
    return lastSpawnLane;
  }

  function chooseThreatKind() {
    const phase = currentPhase();
    const roll = Math.random();
    let sum = 0;
    for (const key of ["standard", "fast", "heavy", "double"]) {
      sum += phase.mix[key];
      if (roll <= sum) {
        return key;
      }
    }
    return "standard";
  }

  function estimateThreatSpeed(kind, delay = 0) {
    const def = THREAT_DEFS[kind];
    const projectedTime = gameTime + THREAT_DEFS[kind].warn + delay;
    return def.speed * currentPhase().speedMul + currentSpeedBonus(projectedTime);
  }

  function estimateArrivalTime(kind, delay = 0) {
    const speed = estimateThreatSpeed(kind, delay);
    const travelTime = (player.y - SPAWN_Y) / speed;
    return gameTime + THREAT_DEFS[kind].warn + delay + travelTime;
  }

  function getBookedArrivals() {
    const arrivals = [];
    for (const warning of warnings) {
      arrivals.push({ time: warning.arrivalTime, lane: warning.lane });
    }
    for (const obstacle of obstacles) {
      if (obstacle.arrivalTime > gameTime - 0.12) {
        arrivals.push({ time: obstacle.arrivalTime, lane: obstacle.lane });
      }
    }
    return arrivals;
  }

  function currentSameLaneGap() {
    return Math.max(
      SAME_LANE_GAP_FLOOR,
      SAME_LANE_GAP_START - danger * 0.03
    );
  }

  function currentCrossLaneGap() {
    return Math.max(
      CROSS_LANE_GAP_FLOOR,
      CROSS_LANE_GAP_START - danger * 0.04
    );
  }

  function currentDoubleStrikeGap() {
    return Math.max(
      DOUBLE_STRIKE_SWITCH_GAP_FLOOR,
      DOUBLE_STRIKE_SWITCH_GAP_START - danger * 0.035
    );
  }

  function requiredArrivalGap(bookedLane, newLane, forcedMinGap = null) {
    if (forcedMinGap !== null) {
      return forcedMinGap;
    }
    return bookedLane === newLane ? currentSameLaneGap() : currentCrossLaneGap();
  }

  function nextSafeArrival(kind, lane, delay = 0, notBefore = null, forcedMinGap = null) {
    let actualDelay = delay;
    let arrivalTime = estimateArrivalTime(kind, actualDelay);

    if (notBefore !== null && arrivalTime < notBefore) {
      actualDelay += notBefore - arrivalTime + 0.01;
      arrivalTime = estimateArrivalTime(kind, actualDelay);
    }

    let guard = 0;
    while (guard < 40) {
      let bumped = false;
      const bookedArrivals = getBookedArrivals().sort((a, b) => a.time - b.time);
      for (const booked of bookedArrivals) {
        const minGap = requiredArrivalGap(booked.lane, lane, forcedMinGap);
        if (Math.abs(booked.time - arrivalTime) < minGap) {
          const targetArrival = booked.time + minGap + 0.01;
          actualDelay += targetArrival - arrivalTime;
          arrivalTime = estimateArrivalTime(kind, actualDelay);
          bumped = true;
          break;
        }
      }
      if (!bumped) {
        break;
      }
      guard += 1;
    }

    if (arrivalTime > gameTime + MAX_LOOKAHEAD) {
      return null;
    }

    return { actualDelay, arrivalTime };
  }

  function scheduleThreat(kind, lane, delay = 0, notBefore = null, forcedMinGap = null) {
    const def = THREAT_DEFS[kind];
    const safeWindow = nextSafeArrival(
      kind,
      lane,
      delay,
      notBefore,
      forcedMinGap
    );
    if (!safeWindow) {
      return null;
    }

    const { actualDelay, arrivalTime } = safeWindow;

    warnings.push({
      kind,
      lane,
      t: def.warn + actualDelay,
      total: def.warn + actualDelay,
      baseWarn: def.warn,
      warningWidth: def.warningWidth,
      arrivalTime
    });

    return { arrivalTime, actualDelay };
  }

  function scheduleWave() {
    const lane = pickLane();
    const kind = chooseThreatKind();
    let success = true;

    if (kind === "double") {
      const firstKind = danger > 2.5 ? "fast" : "standard";
      const first = scheduleThreat(firstKind, lane, 0);
      if (!first) {
        success = false;
      } else {
        const second = scheduleThreat(
          "fast",
          lane === 0 ? 1 : 0,
          0.16,
          first.arrivalTime + currentDoubleStrikeGap(),
          currentCrossLaneGap()
        );
        if (!second) {
          warnings.pop();
          success = false;
        }
      }
    } else {
      success = Boolean(scheduleThreat(kind, lane, 0));
    }

    const interval = currentSpawnInterval();
    if (success) {
      spawnTimer -= interval;
    } else {
      spawnTimer = Math.min(spawnTimer, interval * 0.58);
    }

    return success;
  }

  function spawnObstacle(kind, lane, arrivalTime) {
    const def = THREAT_DEFS[kind];
    const scaleJitter = 0.95 + Math.random() * 0.12;
    obstacles.push({
      kind,
      lane,
      x: LANE_CENTERS[lane],
      y: SPAWN_Y,
      w: def.w * scaleJitter,
      h: def.h * scaleJitter,
      speed: def.speed * currentPhase().speedMul + currentSpeedBonus(),
      rot: (Math.random() - 0.5) * 0.05,
      color1: def.color1,
      color2: def.color2,
      glow: def.glow,
      nearMissBonus: def.nearMissBonus,
      awardedNearMiss: false,
      arrivalTime
    });
  }

  function playerBox() {
    return {
      x: player.x - (player.w - 16) / 2,
      y: player.y - (player.h - 12) / 2,
      w: player.w - 16,
      h: player.h - 12
    };
  }

  function spearBoxes(obstacle) {
    if (obstacle.kind === "heavy") {
      return [
        {
          x: obstacle.x - obstacle.w * 0.15,
          y: obstacle.y - obstacle.h * 0.34,
          w: obstacle.w * 0.3,
          h: obstacle.h * 0.19
        },
        {
          x: obstacle.x - obstacle.w * 0.24,
          y: obstacle.y - obstacle.h * 0.11,
          w: obstacle.w * 0.48,
          h: obstacle.h * 0.32
        },
        {
          x: obstacle.x - obstacle.w * 0.11,
          y: obstacle.y + obstacle.h * 0.17,
          w: obstacle.w * 0.22,
          h: obstacle.h * 0.29
        }
      ];
    }

    return [
      {
        x: obstacle.x - obstacle.w * 0.13,
        y: obstacle.y - obstacle.h * 0.34,
        w: obstacle.w * 0.26,
        h: obstacle.h * 0.18
      },
      {
        x: obstacle.x - obstacle.w * 0.22,
        y: obstacle.y - obstacle.h * 0.1,
        w: obstacle.w * 0.44,
        h: obstacle.h * 0.3
      },
      {
        x: obstacle.x - obstacle.w * 0.1,
        y: obstacle.y + obstacle.h * 0.16,
        w: obstacle.w * 0.2,
        h: obstacle.h * 0.28
      }
    ];
  }

  function hit(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function hitSpear(playerBounds, obstacle) {
    const boxes = spearBoxes(obstacle);
    for (const box of boxes) {
      if (hit(playerBounds, box)) {
        return true;
      }
    }
    return false;
  }

  function update(dt) {
    for (const star of stars) {
      star.y += star.v * dt;
      if (star.y > H + 4) {
        star.y = -4;
        star.x = Math.random() * W;
      }
    }

    for (let i = switchBursts.length - 1; i >= 0; i -= 1) {
      const burst = switchBursts[i];
      burst.r += 170 * dt;
      burst.a -= 1.9 * dt;
      if (burst.a <= 0) {
        switchBursts.splice(i, 1);
      }
    }

    for (let i = trail.length - 1; i >= 0; i -= 1) {
      trail[i].a -= 1.9 * dt;
      if (trail[i].a <= 0) {
        trail.splice(i, 1);
      }
    }

    ui.update(dt);

    if (flashTimer > 0) {
      flashTimer = Math.max(0, flashTimer - dt);
    }
    if (shakeTimer > 0) {
      shakeTimer = Math.max(0, shakeTimer - dt);
    }
    if (phaseFlashTimer > 0) {
      phaseFlashTimer = Math.max(0, phaseFlashTimer - dt);
    }
    if (player.glow > 0) {
      player.glow = Math.max(0, player.glow - dt * 1.3);
    }

    if (state === "dying") {
      if (deathFreezeTimer > 0) {
        deathFreezeTimer = Math.max(0, deathFreezeTimer - dt);
      }
      if (deathImpactTimer > 0) {
        deathImpactTimer = Math.max(0, deathImpactTimer - dt);
      }
      deathTimer -= dt;
      if (deathTimer <= 0) {
        endGame();
      }
      return;
    }

    if (state !== "playing") {
      return;
    }

    gameTime += dt;
    phaseClock += dt;
    danger = currentDanger();

    score += dt * (9 + Math.min(danger * 1.55, 4.2));

    const phase = currentPhase();
    const phaseNow = PHASE_DEFS.indexOf(phase);
    if (phaseNow !== phaseIndex) {
      phaseIndex = phaseNow;
      showCall(`${phase.name} \u2022 ${phase.banner}`, 1.25);
      phaseFlashTimer = 0.34;
      vibrate(18);
    }

    spawnTimer += dt;
    const interval = currentSpawnInterval();
    while (spawnTimer >= interval) {
      if (!scheduleWave()) {
        break;
      }
    }

    for (let i = warnings.length - 1; i >= 0; i -= 1) {
      warnings[i].t -= dt;
      if (warnings[i].t <= 0) {
        spawnObstacle(
          warnings[i].kind,
          warnings[i].lane,
          warnings[i].arrivalTime
        );
        warnings.splice(i, 1);
      }
    }

    const playerBounds = playerBox();

    for (let i = obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = obstacles[i];
      obstacle.y += obstacle.speed * dt;

      if (!obstacle.awardedNearMiss) {
        const switchedAway = obstacle.lane !== player.lane;
        const timelyDodge = gameTime - player.lastSwitchAt <= 0.34;
        const closeVertical = Math.abs(obstacle.y - player.y) < 36;
        if (switchedAway && timelyDodge && closeVertical) {
          obstacle.awardedNearMiss = true;
          score += obstacle.nearMissBonus;
          showSmallCall(`Close Call +${obstacle.nearMissBonus}`);
        }
      }

      if (obstacle.y - obstacle.h > H + 24) {
        obstacles.splice(i, 1);
        continue;
      }

      if (hitSpear(playerBounds, obstacle)) {
        startDeathSequence(obstacle);
        break;
      }
    }

    syncHud();
  }

  function drawRoundedRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, W, H);
    const xShake =
      shakeTimer > 0
        ? Math.sin(performance.now() * 0.08) * 3 * (shakeTimer / 0.18)
        : 0;
    const phase = currentPhase();
    const accentAlpha =
      state === "playing" ? 0.05 + Math.min(0.1, danger * 0.015) : 0.05;

    ctx.save();
    ctx.translate(xShake, 0);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(120, 170, 120, 0.05)");
    grad.addColorStop(0.55, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.14)");
    ctx.fillStyle = grad;
    ctx.fillRect(-6, 0, W + 12, H);

    ctx.fillStyle = `rgba(165, 220, 165, ${accentAlpha})`;
    ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = `rgba(100, 150, 100, ${accentAlpha * 0.72})`;
    ctx.fillRect(W / 2, 0, W / 2, H);

    ctx.fillStyle = phase.accent;
    ctx.fillRect(0, 0, W, 78);

    ctx.strokeStyle = "rgba(235, 255, 235, 0.12)";
    ctx.lineWidth = 2 + Math.min(1.2, danger * 0.16);
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 72);
    ctx.lineTo(W / 2, H - 114);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(160, 255, 160, 0.06)";
    ctx.lineWidth = 1;
    const gridStep =
      phase.key === "contact"
        ? 58
        : phase.key === "pressure"
          ? 54
          : phase.key === "compression"
            ? 50
            : 46;
    for (let y = 92; y < H; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(26, y);
      ctx.lineTo(W - 26, y);
      ctx.stroke();
    }

    for (const star of stars) {
      ctx.fillStyle = `rgba(210,240,210,${star.a})`;
      ctx.fillRect(star.x, star.y, star.s, star.s);
    }

    ctx.restore();
  }

  function drawPlayer() {
    for (const segment of trail) {
      drawRoundedRect(
        segment.x - 28,
        player.y - 13,
        56,
        26,
        10,
        `rgba(183,242,166,${segment.a})`
      );
    }

    const deathProgress = state === "dying" ? 1 - Math.max(0, deathTimer) / 0.24 : 0;
    const deathSquash = state === "dying" ? 1 + deathProgress * 0.18 : 1;
    const deathHeight = state === "dying" ? 1 - deathProgress * 0.22 : 1;
    const deathDrop = state === "dying" ? deathProgress * 10 : 0;
    const deathAlpha =
      state === "dying" ? Math.max(0.18, 1 - deathProgress * 1.05) : 1;

    const width = (player.w + player.glow * 80) * deathSquash;
    const height = (player.h - player.glow * 18) * deathHeight;
    const x = player.x - width / 2;
    const y = player.y - height / 2 + deathDrop;

    ctx.shadowColor = `rgba(183,242,166,${(0.35 + player.glow) * deathAlpha})`;
    ctx.shadowBlur = 18;
    drawRoundedRect(x, y, width, height, 11, `rgba(183,242,166,${deathAlpha})`);
    ctx.shadowBlur = 0;
    drawRoundedRect(
      x + 9,
      y + 5,
      width - 18,
      6,
      3,
      `rgba(255,255,255,${0.18 * deathAlpha})`
    );

    ctx.fillStyle = `rgba(183,242,166,${0.12 * deathAlpha})`;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 30 + deathDrop);
    ctx.lineTo(player.x - 18, player.y - 7 + deathDrop);
    ctx.lineTo(player.x + 18, player.y - 7 + deathDrop);
    ctx.closePath();
    ctx.fill();

    if (state === "dying") {
      ctx.strokeStyle = `rgba(12,20,12,${0.52 + deathProgress * 0.22})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(player.x - 18, player.y - 11 + deathDrop);
      ctx.lineTo(player.x + 17, player.y + 11 + deathDrop);
      ctx.stroke();
    }
  }

  function drawWarningMarker(warning) {
    const x = LANE_CENTERS[warning.lane];
    const y = 64;
    const progress = 1 - Math.max(0, warning.t) / warning.total;
    const pulseSpeed =
      warning.kind === "fast" ? 0.03 : warning.kind === "heavy" ? 0.014 : 0.02;
    const pulse = 0.4 + Math.sin(performance.now() * pulseSpeed + warning.lane) * 0.45;
    const width = warning.warningWidth + pulse * 6;
    const phase = currentPhase();

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = `rgba(210,255,185,${0.12 + progress * 0.14})`;
    ctx.beginPath();
    ctx.moveTo(0, 16 + pulse * 3);
    ctx.lineTo(width * 0.5, 0);
    ctx.lineTo(-width * 0.5, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(210,255,185,${0.56 + progress * 0.3})`;
    ctx.lineWidth = warning.kind === "heavy" ? 2.8 : 2.1;
    ctx.beginPath();
    ctx.moveTo(0, 16 + pulse * 3);
    ctx.lineTo(width * 0.5, 0);
    ctx.lineTo(-width * 0.5, 0);
    ctx.closePath();
    ctx.stroke();

    if (warning.kind === "fast") {
      ctx.strokeStyle = "rgba(210,255,185,0.54)";
      ctx.beginPath();
      ctx.moveTo(-9, 20);
      ctx.lineTo(0, 6);
      ctx.lineTo(9, 20);
      ctx.stroke();
    } else if (warning.kind === "heavy") {
      ctx.fillStyle = "rgba(210,255,185,0.16)";
      ctx.fillRect(-18, 20, 36, 4);
    }

    if (phase.key === "overrun") {
      ctx.strokeStyle = "rgba(230,255,220,0.18)";
      ctx.beginPath();
      ctx.moveTo(-width * 0.42, -6);
      ctx.lineTo(width * 0.42, -6);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSpearLogo(obstacle) {
    const scale = Math.max(0.86, Math.min(1.17, 0.86 + (obstacle.y / H) * 0.24));
    const width = obstacle.w * scale;
    const height = obstacle.h * scale;
    const isKiller = state === "dying" && deathObstacle === obstacle;

    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    ctx.rotate(Math.PI + obstacle.rot);

    ctx.shadowColor = `rgba(183,242,166,${0.12 + obstacle.glow + (isKiller ? 0.18 : 0)})`;
    ctx.shadowBlur = isKiller ? 24 : obstacle.kind === "fast" ? 18 : 14;

    ctx.beginPath();
    ctx.moveTo(0, -height * 0.5);
    ctx.lineTo(width * 0.3, -height * 0.1);
    ctx.lineTo(width * 0.15, -height * 0.1);
    ctx.lineTo(width * 0.15, height * 0.28);
    ctx.lineTo(width * 0.24, height * 0.42);
    ctx.lineTo(0, height * 0.24);
    ctx.lineTo(-width * 0.24, height * 0.42);
    ctx.lineTo(-width * 0.15, height * 0.28);
    ctx.lineTo(-width * 0.15, -height * 0.1);
    ctx.lineTo(-width * 0.3, -height * 0.1);
    ctx.closePath();
    ctx.fillStyle = obstacle.color1;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -height * 0.38);
    ctx.lineTo(width * 0.14, -height * 0.07);
    ctx.lineTo(width * 0.07, -height * 0.07);
    ctx.lineTo(width * 0.07, height * 0.14);
    ctx.lineTo(0, height * 0.08);
    ctx.lineTo(-width * 0.07, height * 0.14);
    ctx.lineTo(-width * 0.07, -height * 0.07);
    ctx.lineTo(-width * 0.14, -height * 0.07);
    ctx.closePath();
    ctx.fillStyle = obstacle.color2;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -height * 0.28);
    ctx.lineTo(width * 0.03, -height * 0.02);
    ctx.lineTo(0, height * 0.08);
    ctx.lineTo(-width * 0.03, -height * 0.02);
    ctx.closePath();
    ctx.fillStyle = "rgba(210,255,185,0.26)";
    ctx.fill();

    if (obstacle.kind === "fast") {
      ctx.strokeStyle = "rgba(220,255,220,0.22)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-width * 0.22, height * 0.42);
      ctx.lineTo(-width * 0.32, height * 0.6);
      ctx.moveTo(width * 0.22, height * 0.42);
      ctx.lineTo(width * 0.32, height * 0.6);
      ctx.stroke();
    } else if (obstacle.kind === "heavy") {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(-width * 0.18, height * 0.22, width * 0.36, height * 0.08);
    }

    ctx.restore();
  }

  function drawWarnings() {
    for (const warning of warnings) {
      drawWarningMarker(warning);
    }
  }

  function drawObstacles() {
    for (const obstacle of obstacles) {
      drawSpearLogo(obstacle);
    }
  }

  function drawBursts() {
    for (const burst of switchBursts) {
      ctx.strokeStyle = `rgba(183,242,166,${burst.a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, burst.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawIdleGuides() {
    if (state !== "idle") {
      return;
    }
    ctx.fillStyle = "rgba(235,245,235,0.12)";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("lane 1", LANE_CENTERS[0], player.y + 58);
    ctx.fillText("lane 2", LANE_CENTERS[1], player.y + 58);
  }

  function drawPhaseStamp() {
    if (state !== "playing" && state !== "dying") {
      return;
    }
    const phase = currentPhase();
    ctx.fillStyle = "rgba(235,245,235,0.20)";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${phase.name} \u2022 ${phase.banner}`, W / 2, H - 18);
  }

  function drawPhaseFlash() {
    if (phaseFlashTimer <= 0) {
      return;
    }
    const alpha = Math.min(0.22, phaseFlashTimer * 0.48);
    ctx.fillStyle = `rgba(230,255,210,${alpha})`;
    ctx.fillRect(0, 0, W, 96);
  }

  function drawDeathImpact() {
    if (state !== "dying" || !deathImpact) {
      return;
    }

    const progress = 1 - Math.max(0, deathImpactTimer) / 0.26;
    const flashAlpha = Math.max(0, 0.34 - progress * 0.28);
    const ringAlpha = Math.max(0, 0.4 - progress * 0.34);
    const radius = 10 + progress * 34;

    ctx.fillStyle = `rgba(0, 0, 0, ${0.14 + progress * 0.1})`;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = `rgba(224,255,214,${ringAlpha})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(deathImpact.x, deathImpact.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(224,255,214,${flashAlpha})`;
    ctx.beginPath();
    ctx.arc(deathImpact.x, deathImpact.y, 12 + progress * 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(224,255,214,${Math.max(0, flashAlpha * 0.9)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(deathImpact.x - 20 - progress * 8, deathImpact.y - 10);
    ctx.lineTo(deathImpact.x + 18 + progress * 10, deathImpact.y + 10);
    ctx.stroke();
  }

  function drawFlash() {
    if (flashTimer <= 0) {
      return;
    }
    ctx.fillStyle = `rgba(210,255,185,${Math.min(0.26, flashTimer * 1.2)})`;
    ctx.fillRect(0, 0, W, H);
  }

  function render() {
    drawBackground();
    drawWarnings();
    drawObstacles();
    drawBursts();
    drawPlayer();
    drawDeathImpact();
    drawIdleGuides();
    drawPhaseStamp();
    drawPhaseFlash();
    drawFlash();
  }

  function loop(timestamp) {
    if (!lastTime) {
      lastTime = timestamp;
    }
    const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
    lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function init() {
    chooseOperation();
    initStars();
    resizeCanvas();
    syncHud();
    ui.refreshLeaderboard();
    ui.setGameOverUiEnabled(false);
    render();
    requestAnimationFrame(loop);
  }

  function isPlaying() {
    return state === "playing";
  }

  return {
    handleTap,
    init,
    isPlaying,
    resizeCanvas,
    startGame
  };
}
