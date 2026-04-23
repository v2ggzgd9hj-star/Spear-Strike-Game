export const STORAGE_KEY = "spearLineBestV12a";
export const PLAYER_NAME_KEY = "spearLinePlayerName";
export const LEADERBOARD_VERSION = "season-2";

export const W = 360;
export const H = 640;
export const SPAWN_Y = -88;
export const SAME_LANE_GAP_START = 0.26;
export const SAME_LANE_GAP_FLOOR = 0.18;
export const CROSS_LANE_GAP_START = 0.40;
export const CROSS_LANE_GAP_FLOOR = 0.28;
export const DOUBLE_STRIKE_SWITCH_GAP_START = 0.60;
export const DOUBLE_STRIKE_SWITCH_GAP_FLOOR = 0.48;
export const MAX_LOOKAHEAD = 2.55;

export const LANE_CENTERS = [W * 0.25, W * 0.75];

export const OPERATION_NAMES = [
  "Operation Cold Spear",
  "Operation Green Line",
  "Operation Dark Route",
  "Operation Iron Signal",
  "Operation Silent Gate"
];

export const PHASE_DEFS = [
  {
    key: "contact",
    name: "Phase One",
    banner: "Contact",
    threshold: 0,
    baseInterval: 0.96,
    altProb: 0.9,
    accent: "rgba(183,242,166,0.14)",
    mix: { standard: 0.92, fast: 0.08, heavy: 0, double: 0 },
    speedMul: 1
  },
  {
    key: "pressure",
    name: "Phase Two",
    banner: "Pressure",
    threshold: 9,
    baseInterval: 0.82,
    altProb: 0.72,
    accent: "rgba(198,255,191,0.18)",
    mix: { standard: 0.48, fast: 0.36, heavy: 0.16, double: 0 },
    speedMul: 1.03
  },
  {
    key: "compression",
    name: "Phase Three",
    banner: "Compression",
    threshold: 17,
    baseInterval: 0.72,
    altProb: 0.6,
    accent: "rgba(220,255,195,0.22)",
    mix: { standard: 0.24, fast: 0.28, heavy: 0.3, double: 0.18 },
    speedMul: 1.07
  },
  {
    key: "overrun",
    name: "Phase Four",
    banner: "Overrun",
    threshold: 27,
    baseInterval: 0.64,
    altProb: 0.52,
    accent: "rgba(232,255,210,0.26)",
    mix: { standard: 0.14, fast: 0.26, heavy: 0.24, double: 0.36 },
    speedMul: 1.12
  }
];

export const THREAT_DEFS = {
  standard: {
    kind: "standard",
    warn: 0.32,
    speed: 270,
    w: 54,
    h: 78,
    color1: "#2d4b31",
    color2: "#446649",
    glow: 0.2,
    warningWidth: 42,
    nearMissBonus: 6
  },
  fast: {
    kind: "fast",
    warn: 0.23,
    speed: 342,
    w: 46,
    h: 70,
    color1: "#4d7250",
    color2: "#6a946c",
    glow: 0.28,
    warningWidth: 36,
    nearMissBonus: 8
  },
  heavy: {
    kind: "heavy",
    warn: 0.42,
    speed: 224,
    w: 66,
    h: 94,
    color1: "#203625",
    color2: "#38553b",
    glow: 0.18,
    warningWidth: 48,
    nearMissBonus: 5
  }
};
