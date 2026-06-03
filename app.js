const STORAGE_KEY = "tiktok_live_tool_state_v1";
const MAX_CHAT_ITEMS = 200;
const MAX_GIFT_ITEMS = 120;
const MAX_SESSION_ITEMS = 300;
const MAX_JOKI_ITEMS = 200;
const WHEEL_COLORS = [
  "#ffb703",
  "#0f9d92",
  "#ff6b35",
  "#ffd166",
  "#2ec4b6",
  "#ff9f1c",
  "#8ecae6",
  "#fb5607"
];

const DEFAULT_SPIN_POOLS = [
  {
    id: "pool-mutasi",
    name: "BR Random Mutasi",
    items: [
      { id: "golden", label: "Golden", weight: 45 },
      { id: "diamond", label: "Diamond", weight: 30 },
      { id: "plasma", label: "Plasma", weight: 18 },
      { id: "radioactive", label: "Radio Active", weight: 7 }
    ]
  }
];

const DEFAULT_GIFT_RULES = [
  {
    id: "rule-rose-spin-mutasi",
    matchType: "name",
    matchValue: "rose",
    mode: "spin",
    poolId: "pool-mutasi",
    unitCount: 1,
    action: "1c br random mutasi",
    locked: true
  },
  {
    id: "rule-rose-kick-celestial",
    matchType: "name",
    matchValue: "rose",
    mode: "direct",
    rewardAction: "1x kick celestial mutasi",
    unitCount: 3,
    action: "3c kick celestial mutasi",
    locked: true
  },
  {
    id: "rule-heartme-br-celestial",
    matchType: "name",
    matchValue: "heart me",
    mode: "direct",
    rewardAction: "1 br celestial + og",
    unitCount: 1,
    action: "1 br celestial + og",
    locked: true
  },
  {
    id: "rule-fingerheart-max-br",
    matchType: "name",
    matchValue: "finger heart",
    mode: "direct",
    rewardAction: "Max in br kamu + bonus br mutasi",
    unitCount: 1,
    action: "Max in br kamu + bonus br mutasi",
    locked: true
  },
  {
    id: "rule-doughnut-meowl-bacon",
    matchType: "name",
    matchValue: "doughnut",
    mode: "direct",
    rewardAction: "Meowl bacon max + bonus",
    unitCount: 1,
    action: "Meowl bacon max + bonus",
    locked: true
  },
  {
    id: "rule-default",
    matchType: "any",
    matchValue: "*",
    mode: "direct",
    rewardAction: "Belum diatur",
    action: "Belum diatur",
    locked: true
  }
];

const POPULAR_GIFTS = [
  { name: "Heart Me", id: "heartme", value: "heart me" },
  { name: "Rose", id: "rose", value: "rose" },
  { name: "Finger Heart", id: "fingerheart", value: "finger heart" },
  { name: "Super Popular", id: "superpopular", value: "super popular" },
  { name: "Doughnut", id: "doughnut", value: "doughnut" },
  { name: "Panda", id: "panda", value: "panda" },
  { name: "Corgi", id: "corgi", value: "corgi" },
  { name: "Butterfly", id: "butterfly", value: "butterfly" },
  { name: "Galaxy", id: "galaxy", value: "galaxy" },
  { name: "Kpop", id: "kpop", value: "kpop" },
  { name: "Sunflower", id: "sunflower", value: "sunflower" },
  { name: "Ramen", id: "ramen", value: "ramen" },
  { name: "Orange", id: "orange", value: "orange" },
  { name: "Fireworks", id: "fireworks", value: "fireworks" },
  { name: "Gift Box", id: "giftbox", value: "gift box" },
  { name: "Cheer Me Up", id: "cheer", value: "cheer me up" },
  { name: "GG", id: "gg", value: "gg" }
];

const state = {
  sessionNumbers: [],
  winners: [],
  jokiQueue: [],
  giftRules: [],
  spinPools: [],
  giftProgress: {},
  lastSpinEvent: null,
  settings: {
    autoAddFromChat: false,
    removeAfterSpin: true,
    numberMin: 1,
    numberMax: 200
  },
  nextNumber: 1,
  lastUsername: "",
  backendUrl: ""
};

let connection = null;
let activeBackendUrl = null;
let currentRotation = 0;
let spinning = false;
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;
let sessionUserMap = new Map();
let sessionNumberMap = new Map();
let editingEntryId = null;
let jokiSearchQuery = "";

const el = {};

class TikTokIOConnection {
  constructor(backendUrl) {
    this.backendUrl = backendUrl;
    this.socket = null;
    this.uniqueId = null;
    this.options = null;
  }

  _createSocket() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.socket = io(this.backendUrl, {
      transports: ["polling"],
      upgrade: true,
      reconnection: false,
      timeout: 20000,
      forceNew: true,
      multiplex: false
    });
    this.socket.on("connect", () => {
      if (this.uniqueId) {
        this.socket.emit("setUniqueId", this.uniqueId, this.options || {});
      }
    });
    this.socket.on("tiktokDisconnected", (errMsg) => {
      if (errMsg && errMsg.includes("LIVE has ended")) {
        this.uniqueId = null;
      }
    });
  }

  connect(uniqueId, options) {
    this.uniqueId = uniqueId;
    this.options = options || {};

    this._createSocket();

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        this.socket.off("tiktokConnected", onConnected);
        this.socket.off("tiktokDisconnected", onDisconnected);
        this.socket.off("connect_error", onConnectError);
        clearTimeout(timeoutId);
      };

      const onConnected = (state) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(state);
      };

      const onDisconnected = (errMsg) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(errMsg);
      };

      const onConnectError = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err && err.message ? err.message : "Backend tidak bisa dihubungi");
      };

      this.socket.once("tiktokConnected", onConnected);
      this.socket.once("tiktokDisconnected", onDisconnected);
      this.socket.once("connect_error", onConnectError);

      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject("Connection Timeout - pastikan backend berjalan dan URL benar");
      }, 20000);

      this.socket.emit("setUniqueId", this.uniqueId, this.options);
    });
  }

  disconnect() {
    this.uniqueId = null;
    if (this.socket) {
      this.socket.emit("disconnect_tiktok");
    }
  }

  destroy() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(eventName, handler) {
    if (this.socket) {
      this.socket.on(eventName, handler);
    }
  }
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function generateId(prefix) {
  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}-${seed}` : seed;
}

function rebuildSessionIndexes() {
  sessionUserMap = new Map();
  sessionNumberMap = new Map();
  state.sessionNumbers.forEach((entry) => {
    if (entry && typeof entry.number === "number" && entry.userKey) {
      sessionUserMap.set(entry.userKey, entry.number);
      sessionNumberMap.set(entry.number, entry);
    }
  });
}

function extractNumber(comment) {
  const match = String(comment || "").match(/\b(\d{1,4})\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const JOKI_STATUS_LABEL = {
  pending: "Menunggu",
  inProgress: "Proses",
  awaitingDelivery: "Belum Dikirim",
  done: "Selesai"
};

const JOKI_STATUS_ORDER = ["pending", "inProgress", "awaitingDelivery", "done"];

let toastTimer = null;
let chatFollowEnabled = false;
let giftFollowEnabled = false;
let confirmCallback = null;
function showToast(message, type) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast show" + (type ? " " + type : "");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 2200);
}

function showConfirm(title, message, onConfirm, okLabel) {
  $("confirmTitle").textContent = title;
  $("confirmMessage").textContent = message;
  $("confirmOkBtn").textContent = okLabel || "Ya, Lanjut";
  $("confirmModal").style.display = "flex";
  confirmCallback = onConfirm;
}

function closeConfirm() {
  $("confirmModal").style.display = "none";
  confirmCallback = null;
}

function getRawDisplayName(msg) {
  if (!msg) return "unknown";
  return (msg.displayName || msg.nickname || msg.uniqueId || "unknown").trim();
}

function getDisplayLabel(msg) {
  const raw = getRawDisplayName(msg);
  const uniqueId = msg && msg.uniqueId ? msg.uniqueId.trim() : "";
  if (uniqueId && raw && raw.toLowerCase() !== uniqueId.toLowerCase()) {
    const label = raw.startsWith("@") ? raw : raw;
    return `${label} (@${uniqueId})`;
  }
  return raw.startsWith("@") ? raw : `@${raw}`;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setJokiStatus(id, status) {
  const entry = state.jokiQueue.find((item) => item.id === id);
  if (!entry) return;
  entry.status = status;
  saveState();
  renderJokiQueue();
}

function cycleJokiStatus(id) {
  const entry = state.jokiQueue.find((item) => item.id === id);
  if (!entry) return;
  const idx = JOKI_STATUS_ORDER.indexOf(entry.status);
  const nextIdx = idx === -1 ? 0 : (idx + 1) % JOKI_STATUS_ORDER.length;
  entry.status = JOKI_STATUS_ORDER[nextIdx];
  saveState();
  renderJokiQueue();
}

function getJokiStatusClass(status) {
  if (JOKI_STATUS_ORDER.includes(status)) return status;
  return "pending";
}

function saveState() {
  const payload = {
    sessionNumbers: state.sessionNumbers,
    winners: state.winners,
    jokiQueue: state.jokiQueue,
    giftRules: state.giftRules,
    spinPools: state.spinPools,
    giftProgress: state.giftProgress,
    lastSpinEvent: state.lastSpinEvent,
    settings: state.settings,
    nextNumber: state.nextNumber,
    lastUsername: state.lastUsername,
    backendUrl: state.backendUrl
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state.sessionNumbers = Array.isArray(parsed.sessionNumbers) ? parsed.sessionNumbers : [];
    state.winners = Array.isArray(parsed.winners) ? parsed.winners : [];
    state.jokiQueue = Array.isArray(parsed.jokiQueue) ? parsed.jokiQueue : [];
    state.spinPools = Array.isArray(parsed.spinPools) && parsed.spinPools.length
      ? parsed.spinPools
      : DEFAULT_SPIN_POOLS.map((pool) => ({ ...pool, items: pool.items.map((item) => ({ ...item })) }));
    state.giftProgress = parsed.giftProgress && typeof parsed.giftProgress === "object" ? parsed.giftProgress : {};
    state.lastSpinEvent = parsed.lastSpinEvent || null;
    
    // Migrate old whitelist data to jokiQueue
    if (Array.isArray(parsed.whitelist) && parsed.whitelist.length > 0) {
      const migratedEntries = parsed.whitelist.map((item) => ({
        id: generateId("joki"),
        action: "Manual",
        user: item.name || item.key,
        username: item.username || null,
        giftName: "-",
        diamondCount: 0,
        qty: 1,
        time: item.addedAt || Date.now(),
        status: "pending",
        source: "migrated"
      }));
      state.jokiQueue = [...migratedEntries, ...state.jokiQueue];
    }
    
    let migratedGiftManualEntries = false;
    state.jokiQueue = state.jokiQueue.map((entry) => {
      const normalized = { ...entry, status: entry.status || "pending" };
      normalized.notes = typeof entry.notes === "string" ? entry.notes : "";
      normalized.tiktokId = entry.tiktokId || null;
      normalized.giftQty = Number(entry.giftQty) || Number(entry.qty) || 1;
      if (entry.source === "gift" && entry.username && !normalized.tiktokId) {
        normalized.tiktokId = entry.username;
        normalized.username = null;
      }
      if (entry.source !== "gift" && !normalized.tiktokId) {
        normalized.tiktokId = null;
      }
      if (normalized.source === "gift" && (!normalized.action || /^manual$/i.test(String(normalized.action || "").trim()))) {
        const giftKey = normalizeKey(normalized.giftName);
        if (giftKey.includes("gg")) {
          const rewardQty = Math.floor((Number(normalized.giftQty) || 1) / 3);
          if (rewardQty > 0) {
            normalized.action = "1x kick celestial mutasi";
            normalized.qty = rewardQty;
            normalized.rewardMode = "direct";
            normalized.unmatched = false;
            normalized.ruleId = "rule-gg-kick-celestial";
            normalized.unitCount = 3;
          } else {
            normalized.action = "Belum diatur";
            normalized.unmatched = true;
          }
        } else {
          normalized.action = "Belum diatur";
          normalized.unmatched = true;
        }
        migratedGiftManualEntries = true;
      }
      if (normalized.status === "classDone") {
        normalized.status = "inProgress";
      }
      if (JOKI_STATUS_ORDER.indexOf(normalized.status) === -1) {
        normalized.status = "pending";
      }
      return normalized;
    });
    state.giftRules = Array.isArray(parsed.giftRules) && parsed.giftRules.length
      ? parsed.giftRules
      : DEFAULT_GIFT_RULES.map((rule) => ({ ...rule }));

    const OLD_DEFAULT_RULE_IDS = [
      "rule-diamond-1",
      "rule-name-orange",
      "rule-diamond-5",
      "rule-diamond-10",
      "rule-name-doughnut",
      "rule-diamond-30",
      "rule-name-heartme",
      "rule-name-rose",
      "rule-equiv-1",
      "rule-name-fingerheart",
      "rule-equiv-5",
      "rule-name-superpopular",
      "rule-equiv-9",
      "rule-equiv-30"
    ];
    const hasOldDefault = state.giftRules.some((r) => OLD_DEFAULT_RULE_IDS.includes(r.id));
    if (hasOldDefault) {
      state.giftRules = DEFAULT_GIFT_RULES.map((rule) => ({ ...rule }));
    } else {
      const userRuleIds = new Set(state.giftRules.map((r) => r.id));
      const missingDefaults = DEFAULT_GIFT_RULES.filter((r) => !userRuleIds.has(r.id));
      if (missingDefaults.length > 0) {
        state.giftRules = [...state.giftRules, ...missingDefaults];
      }
    }

    const criticalRuleIds = [
      "rule-rose-spin-mutasi",
      "rule-rose-kick-celestial",
      "rule-heartme-br-celestial",
      "rule-fingerheart-max-br",
      "rule-doughnut-meowl-bacon",
      "rule-default"
    ];
    const existingIds = new Set(state.giftRules.map((r) => r.id));
    let rulesInjected = false;
    if (migratedGiftManualEntries) {
      rulesInjected = true;
    }
    criticalRuleIds.forEach((id) => {
      if (!existingIds.has(id)) {
        const def = DEFAULT_GIFT_RULES.find((r) => r.id === id);
        if (def) {
          state.giftRules.push({ ...def });
          rulesInjected = true;
        }
      }
    });
    if (existingIds.has("rule-default")) {
      const defRule = state.giftRules.find((r) => r.id === "rule-default");
      if (defRule && !defRule.locked) {
        defRule.locked = true;
        rulesInjected = true;
      }
    }

    const defaultRule = state.giftRules.find((r) => r.id === "rule-default");
    const defaultActions = new Set([defaultRule ? defaultRule.action : "Belum diatur", "1x kick"]);
    const existingPoolIds = new Set(state.spinPools.map((pool) => pool.id));
    DEFAULT_SPIN_POOLS.forEach((pool) => {
      if (!existingPoolIds.has(pool.id)) {
        state.spinPools.push({ ...pool, items: pool.items.map((item) => ({ ...item })) });
        rulesInjected = true;
      }
    });
    state.jokiQueue = state.jokiQueue.map((entry) => {
      const normalized = { ...entry };
      if (normalized.source === "gift") {
        if ((!normalized.giftQty || Number(normalized.giftQty) <= 0) && (Number(normalized.unitCount) || 1) > 1) {
          normalized.giftQty = (Number(normalized.qty) || 1) * (Number(normalized.unitCount) || 1);
          rulesInjected = true;
        }
        if (!normalized.matchKey) {
          normalized.matchKey = normalized.unmatched
            ? `${normalized.giftName || "gift"}|${Number(normalized.diamondCount) || 0}`
            : (normalized.action || `${normalized.giftName || "gift"}|${Number(normalized.diamondCount) || 0}`);
        }
        if (!normalized.consolidateKey) {
          normalized.consolidateKey = normalized.matchKey;
        }
        if (!normalized.unmatched && defaultActions.has(normalized.action)) {
          normalized.unmatched = true;
          normalized.matchKey = `${normalized.giftName || "gift"}|${Number(normalized.diamondCount) || 0}`;
          normalized.consolidateKey = normalized.matchKey;
          rulesInjected = true;
        }
        if ((Number(normalized.qty) || 1) > 1 && (Number(normalized.diamondCount) || 0) > 0) {
          const looksLikeSingleEvent = !normalized.lastAddedAt || normalized.lastAddedAt === normalized.time;
          if (looksLikeSingleEvent) {
            normalized.diamondCount = (Number(normalized.diamondCount) || 0) * (Number(normalized.qty) || 1);
            rulesInjected = true;
          }
        }
      }
      return normalized;
    });

    if (rulesInjected) saveState();
    state.settings = Object.assign(state.settings, parsed.settings || {});
    state.nextNumber = typeof parsed.nextNumber === "number" ? parsed.nextNumber : state.nextNumber;
    state.lastUsername = parsed.lastUsername || "";
    state.backendUrl = parsed.backendUrl || "";
  } catch (err) {
    console.warn("Failed to parse saved state", err);
    state.giftRules = DEFAULT_GIFT_RULES.map((rule) => ({ ...rule }));
  }
}

function updateCounts() {
  el.winnerCount.textContent = `${state.winners.length} pemenang`;
  el.sessionCount.textContent = `${state.sessionNumbers.length} angka`;
  const activeJoki = state.jokiQueue.filter((e) => e.status !== "done").length;
  const totalJoki = state.jokiQueue.length;
  el.jokiCount.textContent = activeJoki === totalJoki
    ? `${totalJoki} dalam antrean`
    : `${activeJoki} aktif • ${totalJoki - activeJoki} selesai`;
}

function setStatus(message, type) {
  el.statusText.textContent = message;
  if (type === "error") {
    el.statusText.style.color = "#b45309";
  } else {
    el.statusText.style.color = "";
  }
}

function setConnectionState(stateName) {
  if (stateName === "connected") {
    el.connectBtn.disabled = true;
    el.disconnectBtn.disabled = false;
  } else if (stateName === "connecting") {
    el.connectBtn.disabled = true;
    el.disconnectBtn.disabled = true;
  } else {
    el.connectBtn.disabled = false;
    el.disconnectBtn.disabled = true;
  }
}

function resolveBackendUrl() {
  const custom = el.backendInput.value.trim();
  if (custom) return custom;
  return "https://live.aksocialboost.my.id";
}

function ensureConnection() {
  const backendUrl = resolveBackendUrl();
  if (connection && backendUrl === activeBackendUrl) return;

  if (connection) {
    connection.destroy();
  }

  connection = new TikTokIOConnection(backendUrl);
  activeBackendUrl = backendUrl;
  attachConnectionHandlers(connection);
}

function attachConnectionHandlers(conn) {
  conn.on("chat", (msg) => {
    const sessionEntry = tryRegisterChatNumber(msg);
    addChatItem(msg, sessionEntry);
  });

  conn.on("gift", (msg) => {
    addGiftItem(msg);
    processGiftRules(msg);
    maybeNotifyGiftBackground(msg);
  });

  conn.on("roomUser", (msg) => {
    if (typeof msg.viewerCount === "number") {
      viewerCount = msg.viewerCount;
      updateStats();
    }
  });

  conn.on("like", (msg) => {
    if (typeof msg.totalLikeCount === "number") {
      likeCount = msg.totalLikeCount;
      updateStats();
    }
  });

  conn.on("tiktokDisconnected", (errMsg) => {
    if (errMsg) {
      setStatus(errMsg, "error");
    }
    setConnectionState("idle");
  });

  conn.on("streamEnd", () => {
    setStatus("LIVE selesai. Menunggu reconnect...", "error");
    setConnectionState("idle");
  });
}

function updateStats() {
  el.roomStats.textContent = `Viewers: ${viewerCount.toLocaleString("id-ID")} | Likes: ${likeCount.toLocaleString("id-ID")} | Coins: ${diamondsCount.toLocaleString("id-ID")} 🪙`;
}

function normalizeNumberRange() {
  let min = Number(el.numberMin.value) || 1;
  let max = Number(el.numberMax.value) || 200;

  if (min > max) {
    const temp = min;
    min = max;
    max = temp;
  }

  state.settings.numberMin = min;
  state.settings.numberMax = max;
  el.numberMin.value = min;
  el.numberMax.value = max;

  saveState();
}

function connectLive() {
  const username = el.usernameInput.value.trim().replace(/^@/, "");
  if (!username) {
    showToast("Masukkan username TikTok terlebih dahulu.", "error");
    return;
  }

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  ensureConnection();

  setStatus("Connecting...");
  setConnectionState("connecting");

  state.lastUsername = username;
  state.backendUrl = el.backendInput.value.trim();
  saveState();

  connection
    .connect(username, {})
    .then(() => {
      setStatus("Connected");
      setConnectionState("connected");
      state._wasConnectedBeforeHide = true;
      viewerCount = 0;
      likeCount = 0;
      diamondsCount = 0;
      updateStats();
      tryRequestWakeLock();
    })
    .catch((errMsg) => {
      setStatus(String(errMsg || "Gagal connect"), "error");
      setConnectionState("idle");
    });
}

function disconnectLive() {
  if (connection) {
    connection.disconnect();
  }
  setStatus("Disconnected", "error");
  setConnectionState("idle");
  releaseWakeLock();
}

let wakeLock = null;
async function tryRequestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (err) {
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (el.bgIndicator) el.bgIndicator.style.display = "inline-flex";
    tryRequestWakeLock();
  } else {
    if (el.bgIndicator) el.bgIndicator.style.display = "none";
    if (state.lastUsername && el.statusText && el.statusText.textContent !== "Connected") {
      const wasConnected = state._wasConnectedBeforeHide;
      if (!wasConnected) {
        setStatus("Tab aktif — reconnecting...", "error");
        connectLive();
      }
    }
  }
});

window.addEventListener("focus", () => {
  try {
    if (state.lastUsername && connection && connection.isConnected === false) {
      setStatus("Tab aktif — reconnecting...", "error");
      connectLive();
    }
  } catch (err) {
  }
});

function maybeNotifyGiftBackground(msg) {
  if (!document.hidden) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const user = (msg && msg.uniqueId) ? `@${msg.uniqueId}` : "Seseorang";
  const gift = msg && msg.giftName ? msg.giftName : "gift";
  const total = msg && msg.diamondCount ? ` • ${msg.diamondCount}🪙` : "";
  try {
    new Notification(`Gift dari ${user}`, {
      body: `mengirim ${gift}${total}`,
      tag: "tiktok-gift",
      silent: false
    });
  } catch (e) {
  }
}

function tryRegisterChatNumber(msg) {
  const number = extractNumber(msg.comment);
  if (!number) return null;

  const min = Number(state.settings.numberMin) || 1;
  const max = Number(state.settings.numberMax) || 9999;
  if (number < min || number > max) return null;

  const userKey = normalizeKey(msg.uniqueId);
  if (!userKey) return null;

  if (sessionUserMap.has(userKey)) return null;
  if (sessionNumberMap.has(number)) return null;

  const entry = {
    number,
    userKey,
    name: getDisplayLabel(msg),
    comment: msg.comment || "",
    time: Date.now()
  };

  state.sessionNumbers.push(entry);
  if (state.sessionNumbers.length > MAX_SESSION_ITEMS) {
    const removed = state.sessionNumbers.shift();
    if (removed) {
      sessionUserMap.delete(removed.userKey);
      sessionNumberMap.delete(removed.number);
    }
  }

  sessionUserMap.set(userKey, number);
  sessionNumberMap.set(number, entry);

  saveState();
  renderSessionNumbers();
  drawWheel();

  return entry;
}

function addChatItem(msg, sessionEntry) {
  const item = document.createElement("div");
  item.className = "list-item";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  const img = document.createElement("img");
  img.src = msg.profilePictureUrl || "";
  img.alt = "";
  avatar.appendChild(img);

  const content = document.createElement("div");
  content.className = "item-content";

  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = getDisplayLabel(msg);

  const rawDisplayName = getRawDisplayName(msg);
  if (msg.uniqueId && rawDisplayName.toLowerCase() !== msg.uniqueId.toLowerCase()) {
    const subtitle = document.createElement("div");
    subtitle.className = "item-sub";
    subtitle.textContent = `@${msg.uniqueId}`;
    content.appendChild(subtitle);
  }

  const text = document.createElement("div");
  text.className = "item-text";
  text.textContent = msg.comment || "";

  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = formatTime(Date.now());

  content.appendChild(title);
  content.appendChild(text);
  content.appendChild(meta);

  const addBtn = document.createElement("button");
  addBtn.className = "ghost small";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", () => addToWhitelistFromUser(msg));

  item.appendChild(avatar);
  item.appendChild(content);

  if (sessionEntry) {
    const numberBadge = document.createElement("div");
    numberBadge.className = "pill";
    numberBadge.textContent = `#${sessionEntry.number}`;
    item.appendChild(numberBadge);
  }

  item.appendChild(addBtn);

  el.chatList.appendChild(item);
  appendWithAutoScroll(el.chatList, chatFollowEnabled);
  trimList(el.chatList, MAX_CHAT_ITEMS);
}

function addGiftItem(msg) {
  const item = document.createElement("div");
  item.className = "list-item gift-item";

  const content = document.createElement("div");
  content.className = "item-content";

  const title = document.createElement("div");
  title.className = "item-title";
  const giftName = msg.giftName || "gift";
  title.textContent = giftName;

  const text = document.createElement("div");
  text.className = "item-text";
  const parts = [];
  parts.push(getDisplayLabel(msg));
  if (msg.repeatCount) parts.push(`x${msg.repeatCount}`);
  if (msg.diamondCount) parts.push(`${msg.diamondCount}🪙`);
  text.textContent = parts.join(" • ");

  content.appendChild(title);
  content.appendChild(text);

  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = formatTime(Date.now());

  item.appendChild(content);
  item.appendChild(meta);

  el.giftList.appendChild(item);
  appendWithAutoScroll(el.giftList, giftFollowEnabled);
  trimList(el.giftList, MAX_GIFT_ITEMS);

  const pendingStreak = msg.giftType === 1 && !msg.repeatEnd;
  if (!pendingStreak && msg.diamondCount) {
    diamondsCount += msg.diamondCount * (msg.repeatCount || 1);
    updateStats();
  }
}

function renderSessionNumbers() {
  el.sessionList.innerHTML = "";

  state.sessionNumbers
    .slice()
    .sort((a, b) => a.number - b.number)
    .forEach((entry) => {
      const row = document.createElement("div");
      row.className = "list-item";

      const pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = `#${entry.number}`;

      const content = document.createElement("div");
      content.className = "item-content";

      const title = document.createElement("div");
      title.className = "item-title";
      title.textContent = entry.name;

      const text = document.createElement("div");
      text.className = "item-text";
      text.textContent = entry.comment;

      const meta = document.createElement("div");
      meta.className = "item-meta";
      meta.textContent = formatTime(entry.time);

      content.appendChild(title);
      content.appendChild(text);
      content.appendChild(meta);

      row.appendChild(pill);
      row.appendChild(content);

      el.sessionList.appendChild(row);
    });

  updateCounts();
}

function resetSessionNumbers() {
  state.sessionNumbers = [];
  sessionUserMap.clear();
  sessionNumberMap.clear();
  saveState();
  renderSessionNumbers();
  drawWheel();
  el.winnerDisplay.textContent = "Belum ada pemenang";
}

function removeSessionNumber(number) {
  state.sessionNumbers = state.sessionNumbers.filter((entry) => entry.number !== number);
  rebuildSessionIndexes();
  saveState();
  renderSessionNumbers();
  drawWheel();
}

function getSpinPool(poolId) {
  return state.spinPools.find((pool) => pool.id === poolId) || DEFAULT_SPIN_POOLS.find((pool) => pool.id === poolId) || null;
}

function rollWeightedPool(poolId) {
  const pool = getSpinPool(poolId);
  if (!pool || !Array.isArray(pool.items) || !pool.items.length) return null;

  const totalWeight = pool.items.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  if (totalWeight <= 0) return pool.items[0] || null;

  let roll = Math.random() * totalWeight;
  for (const item of pool.items) {
    roll -= Math.max(0, Number(item.weight) || 0);
    if (roll <= 0) return item;
  }
  return pool.items[pool.items.length - 1] || null;
}

function summarizeSpinResults(spinResults, poolId) {
  if (!spinResults || typeof spinResults !== "object") return "Spin mutasi";
  const pool = getSpinPool(poolId);
  const order = pool && Array.isArray(pool.items) ? pool.items.map((item) => item.label) : Object.keys(spinResults);
  const parts = [];

  order.forEach((label) => {
    const qty = Number(spinResults[label]) || 0;
    if (qty > 0) {
      parts.push(qty > 1 ? `${label} x${qty}` : label);
    }
  });

  return parts.length ? parts.join(", ") : "Spin mutasi";
}

function addSpinResultCounts(target, added) {
  const result = { ...(target || {}) };
  Object.entries(added || {}).forEach(([label, qty]) => {
    result[label] = (Number(result[label]) || 0) + (Number(qty) || 0);
  });
  return result;
}

function getGiftProgressKey(uniqueId, ruleId) {
  return `${uniqueId || "unknown"}::${ruleId}`;
}

function processGiftRules(msg) {
  const pendingStreak = msg.giftType === 1 && !msg.repeatEnd;
  if (pendingStreak) return;

  const giftName = normalizeKey(msg.giftName);
  const diamondCount = Number(msg.diamondCount || 0);
  const repeatCount = Math.max(1, Number(msg.repeatCount) || 1);
  const userLabel = msg.uniqueId ? `@${msg.uniqueId}` : (msg.nickname || "viewer");

  const checkRule = (rule) => {
    if (rule.matchType === "diamond") {
      return Number(rule.matchValue) === diamondCount;
    }
    if (rule.matchType === "name") {
      return giftName.includes(normalizeKey(rule.matchValue));
    }
    if (rule.matchType === "any") {
      return true;
    }
    return false;
  };

  const fireDirectRule = (rule, rewardQty, options) => {
    if (rewardQty <= 0) return;
    addJokiQueueEntry({
      action: rule.rewardAction || rule.action,
      consolidateKey: (options && options.consolidateKey) || (rule.id || rule.action || `${msg.giftName || "gift"}|${diamondCount}`),
      user: getDisplayLabel(msg),
      username: null,
      tiktokId: msg.uniqueId || null,
      giftName: msg.giftName || "gift",
      diamondCount,
      qty: rewardQty,
      giftQty: (options && options.giftQty) || rewardQty,
      source: "gift",
      unmatched: !!(options && options.unmatched),
      rewardMode: "direct",
      ruleId: rule.id || null,
      unitCount: Number(rule.unitCount) || 1
    });
  };

  const fireSpinRule = (rule, spinQty) => {
    if (spinQty <= 0) return;
    const spinResults = {};
    const rollSequence = [];
    for (let i = 0; i < spinQty; i += 1) {
      const rolled = rollWeightedPool(rule.poolId);
      const label = rolled ? rolled.label : "Mutasi";
      spinResults[label] = (spinResults[label] || 0) + 1;
      rollSequence.push(label);
    }

    state.lastSpinEvent = {
      id: generateId("spinEvent"),
      time: Date.now(),
      user: getDisplayLabel(msg),
      tiktokId: msg.uniqueId || null,
      giftName: msg.giftName || "gift",
      giftQty: spinQty,
      diamondCount: diamondCount * spinQty,
      spinResults,
      rollSequence,
      finalLabel: summarizeSpinResults(spinResults, rule.poolId),
      poolId: rule.poolId || null
    };

    addJokiQueueEntry({
      action: summarizeSpinResults(spinResults, rule.poolId),
      consolidateKey: rule.id || `spin:${rule.poolId || giftName}`,
      user: getDisplayLabel(msg),
      username: null,
      tiktokId: msg.uniqueId || null,
      giftName: msg.giftName || "gift",
      diamondCount,
      qty: spinQty,
      source: "gift",
      rewardMode: "spin",
      spinResults,
      poolId: rule.poolId || null,
      ruleId: rule.id || null,
      unitCount: Number(rule.unitCount) || 1
    });
  };

  const processRule = (rule, options) => {
    if ((rule.mode || "direct") === "spin") {
      fireSpinRule(rule, repeatCount);
      return true;
    }

    const unitCount = Math.max(1, Number(rule.unitCount) || 1);
    if (unitCount <= 1) {
      fireDirectRule(rule, repeatCount, { ...(options || {}), giftQty: repeatCount });
      return true;
    }

    const progressKey = getGiftProgressKey(msg.uniqueId || userLabel, rule.id || rule.action || giftName);
    const previousProgress = Number(state.giftProgress[progressKey] || 0);
    const totalUnits = previousProgress + repeatCount;
    const rewardQty = Math.floor(totalUnits / unitCount);
    const remainder = totalUnits % unitCount;

    state.giftProgress[progressKey] = remainder;
    if (rewardQty > 0) {
      fireDirectRule(rule, rewardQty, { ...(options || {}), giftQty: rewardQty * unitCount });
      saveState();
    } else {
      saveState();
      showToast(`${msg.giftName || "Gift"} dari ${userLabel}: progress ${totalUnits}/${unitCount}`, "success");
    }
    return true;
  };

  const nameRules = state.giftRules.filter((r) => r.matchType === "name");
  const matchingNameRules = nameRules.filter((r) => checkRule(r));

  if (giftName.includes("rose")) {
    const roseDirectRule = matchingNameRules.find((r) => r.id === "rule-rose-kick-celestial");
    const roseSpinRule = matchingNameRules.find((r) => r.id === "rule-rose-spin-mutasi");
    if (roseDirectRule || roseSpinRule) {
      const directQty = roseDirectRule ? Math.floor(repeatCount / 3) : 0;
      const spinQty = roseSpinRule ? (repeatCount % 3) : 0;

      if (directQty > 0) {
        fireDirectRule(roseDirectRule, directQty, { giftQty: directQty * 3 });
      }
      if (spinQty > 0) {
        fireSpinRule(roseSpinRule, spinQty);
      }
      if (directQty > 0 || spinQty > 0) {
        return;
      }
    }
  }

  for (const rule of matchingNameRules) {
    if (rule.id === "rule-rose-kick-celestial" || rule.id === "rule-rose-spin-mutasi") {
      continue;
    }
    if (checkRule(rule)) {
      processRule(rule);
      return;
    }
  }

  const diamondRules = state.giftRules.filter((r) => r.matchType === "diamond");
  for (const rule of diamondRules) {
    if (checkRule(rule)) {
      processRule(rule);
      return;
    }
  }

  const anyRule = state.giftRules.find((r) => r.matchType === "any");
  if (anyRule) {
    processRule(anyRule, { unmatched: true, consolidateKey: `${msg.giftName || "gift"}|${diamondCount}` });
    showToast(
      `ℹ ${msg.giftName || "Gift"} dari ${userLabel} belum ada rule spesifik.`,
      "success"
    );
    return;
  }

  showToast(
    `⚠ ${msg.giftName || "Gift"} dari ${userLabel} belum ada rule. Tambahkan rule atau edit rule default.`,
    "error"
  );
  if (window.console && console.warn) {
    console.warn(`[GiftRule] No match for gift="${msg.giftName}" (${diamondCount} coin) from @${msg.uniqueId || "?"}`);
  }
}

function addJokiQueueEntry(entry) {
  const addedQty = Math.max(1, Number(entry.qty) || 1);
  const addedGiftQty = Math.max(1, Number(entry.giftQty) || addedQty);
  const addedCoinsTotal = (Number(entry.diamondCount) || 0) * addedGiftQty;
  const matchKey = entry.unmatched
    ? `${entry.giftName || "gift"}|${Number(entry.diamondCount) || 0}`
    : (entry.action || `${entry.giftName || "gift"}|${Number(entry.diamondCount) || 0}`);
  const consolidateKey = entry.consolidateKey || matchKey;

  if (entry.source === "gift" && entry.tiktokId && entry.action) {
    const existing = state.jokiQueue.find((item) =>
      item.source === "gift" &&
      item.tiktokId === entry.tiktokId &&
      (item.consolidateKey || item.matchKey || item.action) === consolidateKey &&
      item.status === "pending"
    );
    if (existing) {
      existing.qty = (Number(existing.qty) || 1) + addedQty;
      existing.giftQty = (Number(existing.giftQty) || Number(existing.qty) || 1) + addedGiftQty;
      existing.diamondCount = (Number(existing.diamondCount) || 0) + addedCoinsTotal;
      if (entry.rewardMode === "spin") {
        existing.spinResults = addSpinResultCounts(existing.spinResults, entry.spinResults);
        existing.action = summarizeSpinResults(existing.spinResults, entry.poolId || existing.poolId);
        existing.lastSpinAt = Date.now();
      }
      existing.lastAddedAt = Date.now();
      saveState();
      renderJokiQueue();
      showToast(`${entry.user} nambah +${addedQty} (total: ${existing.qty})`, "success");
      return;
    }
  }

  state.jokiQueue.push({
    id: generateId("joki"),
    action: entry.action,
    matchKey,
    consolidateKey,
    user: entry.user,
    username: entry.username || null,
    tiktokId: entry.tiktokId || null,
    giftName: entry.giftName || "-",
    diamondCount: addedCoinsTotal,
    qty: addedQty,
    giftQty: addedGiftQty,
    time: Date.now(),
    status: entry.status || "pending",
    source: entry.source || "unknown",
    notes: entry.notes || "",
    unmatched: !!entry.unmatched,
    rewardMode: entry.rewardMode || "direct",
    spinResults: entry.spinResults || null,
    poolId: entry.poolId || null,
    ruleId: entry.ruleId || null,
    unitCount: entry.unitCount || 1,
    lastSpinAt: entry.rewardMode === "spin" ? Date.now() : null
  });

  if (state.jokiQueue.length > MAX_JOKI_ITEMS) {
    state.jokiQueue.shift();
  }

  saveState();
  renderJokiQueue();
}

function renderJokiQueue() {
  el.jokiList.innerHTML = "";

  if (state.jokiQueue.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Antrean kosong. Tambah manual atau aktifkan gift rule.";
    el.jokiList.appendChild(empty);
    updateCounts();
    return;
  }

  const search = normalizeKey(jokiSearchQuery);
  const sortedAll = state.jokiQueue
    .slice()
    .sort((a, b) => (a.time || 0) - (b.time || 0));
  const queueNumberById = new Map(sortedAll.map((entry, index) => [entry.id, index + 1]));
  const sorted = sortedAll
    .filter((entry) => {
      if (!search) return true;
      const haystack = [
        entry.user,
        entry.tiktokId,
        entry.username,
        entry.giftName,
        entry.action,
        entry.notes,
        getJokiBadgeText(entry)
      ].map((x) => normalizeKey(x)).join(" ");
      return haystack.includes(search);
    });

  if (!sorted.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Tidak ada antrean yang cocok dengan pencarian.";
    el.jokiList.appendChild(empty);
    updateCounts();
    return;
  }

  sorted.forEach((entry) => {
    const row = document.createElement("div");
    const statusKey = entry.status || "pending";
    row.className = `list-item joki-card status-${getJokiStatusClass(statusKey)}`;
    row.dataset.entryId = entry.id;
    const tooltipParts = [`Masuk: ${formatTime(entry.time)}`];
    if (entry.lastAddedAt && entry.lastAddedAt !== entry.time) {
      tooltipParts.push(`Update: ${formatTime(entry.lastAddedAt)}`);
    }
    if (entry.tiktokId) {
      tooltipParts.push(`@${entry.tiktokId}`);
    }
    row.title = tooltipParts.join(" • ");

    const header = document.createElement("div");
    header.className = "joki-header";

    const queueNo = document.createElement("span");
    queueNo.className = "joki-queue-no";
    queueNo.textContent = `#${String(queueNumberById.get(entry.id) || 0).padStart(2, "0")}`;
    header.appendChild(queueNo);

    const statusBadge = document.createElement("span");
    statusBadge.className = `joki-status ${getJokiStatusClass(statusKey)}`;
    statusBadge.textContent = JOKI_STATUS_LABEL[statusKey] || JOKI_STATUS_LABEL.pending;
    header.appendChild(statusBadge);

    const body = document.createElement("div");
    body.className = "joki-body";

    const displayName = document.createElement("span");
    displayName.className = "joki-display-name";
    displayName.textContent = entry.user;
    body.appendChild(displayName);

    if (entry.tiktokId && !String(entry.user || "").includes(`@${entry.tiktokId}`)) {
      const tiktokIdEl = document.createElement("span");
      tiktokIdEl.className = "joki-tiktok-id";
      tiktokIdEl.textContent = `@${entry.tiktokId}`;
      body.appendChild(tiktokIdEl);
    }

    const actionBadge = document.createElement("span");
    actionBadge.className = "joki-action-chip";
    actionBadge.textContent = getJokiBadgeText(entry);
    actionBadge.title = "Klik untuk edit keterangan antrean";
    actionBadge.addEventListener("click", () => startEditActionInline(entry.id, actionBadge));
    body.appendChild(actionBadge);

    if (entry.giftName && entry.giftName !== "-") {
      const giftEl = document.createElement("span");
      giftEl.className = "joki-gift";
      const giftQty = Number(entry.giftQty) || Number(entry.qty) || 1;
      const qtyText = giftQty > 1 ? ` x${giftQty}` : "";
      const diamondLabel = entry.diamondCount ? ` (${entry.diamondCount}🪙)` : "";
      giftEl.textContent = `${entry.giftName}${qtyText}${diamondLabel}`;
      body.appendChild(giftEl);
    }

    if (entry.username) {
      const robloxValue = document.createElement("span");
      robloxValue.className = "joki-roblox-value";
      robloxValue.textContent = entry.username;
      robloxValue.title = "Roblox — Klik untuk edit";
      robloxValue.addEventListener("click", () => startEditRobloxInline(entry.id, robloxValue));
      body.appendChild(robloxValue);
    } else {
      const addRobloxBtn = document.createElement("span");
      addRobloxBtn.className = "joki-roblox-value joki-roblox-empty";
      addRobloxBtn.textContent = "+ Roblox";
      addRobloxBtn.addEventListener("click", () => startEditRobloxInline(entry.id, addRobloxBtn));
      body.appendChild(addRobloxBtn);
    }

    const actionsWrap = document.createElement("div");
    actionsWrap.className = "joki-actions";

    const statusBtn = document.createElement("button");
    if (statusKey === "done") {
      statusBtn.className = "ghost small";
      statusBtn.textContent = "Buka";
    } else if (statusKey === "awaitingDelivery") {
      statusBtn.className = "primary-action";
      statusBtn.textContent = "Tutup";
    } else if (statusKey === "inProgress") {
      statusBtn.className = "primary-action";
      statusBtn.textContent = "Kirim";
    } else {
      statusBtn.className = "primary-action";
      statusBtn.textContent = "Proses";
    }
    statusBtn.addEventListener("click", () => cycleJokiStatus(entry.id));

    const removeBtn = document.createElement("button");
    removeBtn.className = "ghost small danger-action";
    removeBtn.textContent = "✕";
    removeBtn.title = "Hapus dari antrean";
    removeBtn.addEventListener("click", () => {
      showConfirm(
        "Hapus Entri Ini?",
        `Hapus ${entry.user} dari antrean?`,
        () => removeJokiEntry(entry.id),
        "Ya, Hapus"
      );
    });

    actionsWrap.appendChild(statusBtn);
    actionsWrap.appendChild(removeBtn);

    row.appendChild(header);
    row.appendChild(body);
    row.appendChild(actionsWrap);

    el.jokiList.appendChild(row);
  });

  updateCounts();
}

function formatActionDisplay(action, qty) {
  if (!action) return "";
  const matchResult = action.match(/^(\s*)(\d+)\s*x\s+/i);
  if (matchResult) {
    return `${matchResult[1]}${qty || 1}x ${action.substring(matchResult[0].length)}`;
  }
  if (qty && qty > 1) {
    return `${qty}x ${action}`;
  }
  return action;
}

function getJokiBadgeText(entry) {
  if (entry.rewardMode === "spin" && entry.spinResults) {
    return summarizeSpinResults(entry.spinResults, entry.poolId);
  }
  if (entry.unmatched) {
    return entry.giftName && entry.giftName !== "-" ? `${entry.giftName} belum diatur` : "Belum diatur";
  }
  if (entry.action && String(entry.action).trim()) {
    return formatActionDisplay(entry.action, entry.qty);
  }
  if (entry.giftName && entry.giftName !== "-") {
    const giftQty = Number(entry.giftQty) || Number(entry.qty) || 1;
    const qtyText = giftQty > 1 ? ` x${giftQty}` : "";
    return `${entry.giftName}${qtyText}`;
  }
  return entry.source === "manual" ? "Manual" : "Antrean";
}

function copyToClipboard(text, successMsg) {
  const onSuccess = () => showToast(successMsg || `Disalin: ${text}`, "success");
  const onError = () => {
    if (fallbackCopy(text)) {
      onSuccess();
    } else {
      showToast("Gagal menyalin — coba salin manual", "error");
    }
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(onError);
  } else {
    if (fallbackCopy(text)) {
      onSuccess();
    } else {
      onError();
    }
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  ta.style.pointerEvents = "none";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (e) {
    success = false;
  }
  document.body.removeChild(ta);
  return success;
}

function clearJokiQueue() {
  if (state.jokiQueue.length === 0) {
    showToast("Antrean sudah kosong", "error");
    return;
  }
  showConfirm(
    "Hapus Semua Antrean?",
    `Yakin ingin menghapus ${state.jokiQueue.length} entri dari antrean?`,
    () => {
      state.jokiQueue = [];
      saveState();
      renderJokiQueue();
      showToast("Antrean berhasil dikosongkan", "success");
    },
    "Ya, Hapus"
  );
}

function copyJokiQueueToClipboard() {
  if (state.jokiQueue.length === 0) {
    showToast("Antrean kosong, tidak ada yang disalin", "error");
    return;
  }

  const lines = ["No\tWaktu\tUser\tAkun\tStatus"];
  const sorted = state.jokiQueue
    .slice()
    .sort((a, b) => (a.time || 0) - (b.time || 0));
  sorted.forEach((entry, index) => {
    const waktu = new Date(entry.time).toLocaleString("id-ID");
    const akun = entry.username || "-";
    const status = JOKI_STATUS_LABEL[entry.status] || entry.status;
    lines.push(`${index + 1}\t${waktu}\t${entry.user}\t${akun}\t${status}`);
  });

  const text = lines.join("\n");
  copyToClipboard(text, `Disalin: ${sorted.length} entri ke clipboard`);
}

function openExportModal() {
  if (state.jokiQueue.length === 0) {
    showToast("Antrean kosong, tidak ada yang di-export", "error");
    return;
  }
  el.exportModal.style.display = "flex";
}

function closeExportModal() {
  el.exportModal.style.display = "none";
}

function filterJokiQueue(filter) {
  if (filter === "pending") {
    return state.jokiQueue.filter((e) => e.status === "pending");
  }
  if (filter === "inProgress") {
    return state.jokiQueue.filter((e) => e.status === "inProgress");
  }
  if (filter === "awaitingDelivery") {
    return state.jokiQueue.filter((e) => e.status === "awaitingDelivery");
  }
  if (filter === "done") {
    return state.jokiQueue.filter((e) => e.status === "done");
  }
  if (filter === "active") {
    return state.jokiQueue.filter((e) => e.status === "pending" || e.status === "inProgress" || e.status === "awaitingDelivery");
  }
  return state.jokiQueue.slice();
}

function buildExportTxt(entries, filter) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const filterLabel = {
    all: "SEMUA",
    active: "AKTIF (Menunggu + Proses + Belum Dikirim)",
    pending: "MENUNGGU",
    inProgress: "PROSES",
    awaitingDelivery: "BELUM DIKIRIM",
    done: "SELESAI"
  }[filter] || filter.toUpperCase();

  const lines = [];
  lines.push("============================================");
  lines.push("  ANTREAN JOKI - EXPORT");
  lines.push("============================================");
  lines.push(`Tanggal   : ${dateStr}`);
  lines.push(`Waktu     : ${timeStr}`);
  lines.push(`Filter    : ${filterLabel}`);
  lines.push(`Total     : ${entries.length} entri`);
  lines.push("============================================");
  lines.push("");

  const sorted = entries.slice().sort((a, b) => (a.time || 0) - (b.time || 0));
  sorted.forEach((entry, index) => {
    const no = String(index + 1).padStart(3, "0");
    const status = JOKI_STATUS_LABEL[entry.status] || entry.status;
    const waktu = new Date(entry.time).toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const userLine = entry.tiktokId ? `${entry.user} (@${entry.tiktokId})` : entry.user;
    const giftLine = entry.giftName && entry.giftName !== "-"
      ? `${entry.giftName}${entry.diamondCount ? " (" + entry.diamondCount + "🪙)" : ""}`
      : "-";
    const robloxLine = entry.username ? entry.username : "(belum diisi)";

    lines.push(`#${no}  [${status.toUpperCase()}]`);
    lines.push(`User      : ${userLine}`);
    lines.push(`Gift      : ${giftLine}`);
    lines.push(`Roblox    : ${robloxLine}`);
    lines.push(`Masuk     : ${waktu}`);
    if (entry.notes && entry.notes.trim()) {
      lines.push(`Catatan   : ${entry.notes.trim()}`);
    }
    lines.push("");
  });

  lines.push("============================================");
  lines.push(`Di-export dari TikTok LIVE Control Deck`);
  lines.push("============================================");

  return lines.join("\n");
}

function buildExportJson(entries, filter) {
  const now = new Date().toISOString();
  const safeEntries = entries.map((e) => {
    const copy = { ...e };
    delete copy.action;
    return copy;
  });
  return JSON.stringify({
    exportedAt: now,
    filter,
    count: safeEntries.length,
    entries: safeEntries
  }, null, 2);
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function performExport() {
  const formatRadio = document.querySelector('input[name="exportFormat"]:checked');
  const filterRadio = document.querySelector('input[name="exportFilter"]:checked');
  const format = formatRadio ? formatRadio.value : "txt";
  const filter = filterRadio ? filterRadio.value : "all";

  const entries = filterJokiQueue(filter);
  if (entries.length === 0) {
    showToast("Tidak ada entri untuk filter ini", "error");
    return;
  }

  const now = new Date();
  const filenameDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filterSlug = filter === "all" ? "semua" : filter.toLowerCase();

  if (format === "txt") {
    const text = buildExportTxt(entries, filter);
    const filename = `antrean-joki_${filterSlug}_${filenameDate}.txt`;
    downloadFile(text, filename, "text/plain;charset=utf-8");
    showToast(`Export TXT: ${entries.length} entri → ${filename}`, "success");
  } else {
    const json = buildExportJson(entries, filter);
    const filename = `antrean-joki_${filterSlug}_${filenameDate}.json`;
    downloadFile(json, filename, "application/json;charset=utf-8");
    showToast(`Export JSON: ${entries.length} entri → ${filename}`, "success");
  }

  closeExportModal();
}

function openImportModal() {
  el.importModal.style.display = "flex";
}

function closeImportModal() {
  el.importModal.style.display = "none";
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      let entries;
      if (Array.isArray(data)) {
        entries = data;
      } else if (data && Array.isArray(data.entries)) {
        entries = data.entries;
      } else {
        showToast("File JSON tidak valid: harus array atau {entries: [...]}", "error");
        return;
      }

      const modeRadio = document.querySelector('input[name="importMode"]:checked');
      const mode = modeRadio ? modeRadio.value : "merge";

      if (mode === "replace") {
        state.jokiQueue = entries.map(normalizeImportedEntry);
      } else {
        const existingIds = new Set(state.jokiQueue.map((e) => e.id));
        const newOnes = entries
          .map(normalizeImportedEntry)
          .filter((e) => !existingIds.has(e.id));
        state.jokiQueue = [...state.jokiQueue, ...newOnes];
      }

      saveState();
      renderJokiQueue();
      closeImportModal();
      showToast(`Import berhasil: ${entries.length} entri diproses (mode: ${mode})`, "success");
    } catch (err) {
      showToast("Gagal parse JSON: " + err.message, "error");
    }
  };
  reader.onerror = () => {
    showToast("Gagal baca file", "error");
  };
  reader.readAsText(file);
}

function normalizeImportedEntry(entry) {
  return {
    id: entry.id || generateId("joki"),
    action: entry.action || "Manual",
    matchKey: entry.matchKey || entry.action || `${entry.giftName || "gift"}|${Number(entry.diamondCount) || 0}`,
    consolidateKey: entry.consolidateKey || entry.matchKey || entry.action || `${entry.giftName || "gift"}|${Number(entry.diamondCount) || 0}`,
    user: entry.user || "Unknown",
    username: entry.username || null,
    tiktokId: entry.tiktokId || null,
    giftName: entry.giftName || "-",
    diamondCount: Number(entry.diamondCount) || 0,
    qty: Number(entry.qty) || 1,
    giftQty: Number(entry.giftQty) || Number(entry.qty) || 1,
    time: Number(entry.time) || Date.now(),
    status: entry.status || "pending",
    source: entry.source || "imported",
    notes: entry.notes || "",
    unmatched: !!entry.unmatched,
    rewardMode: entry.rewardMode || "direct",
    spinResults: entry.spinResults || null,
    poolId: entry.poolId || null,
    ruleId: entry.ruleId || null,
    unitCount: entry.unitCount || 1
  };
}

function renderGiftRules() {
  el.ruleList.innerHTML = "";

  state.giftRules.forEach((rule) => {
    const row = document.createElement("div");
    row.className = "list-item";

    const tag = document.createElement("div");
    tag.className = "rule-tag";
    const modeLabel = rule.mode === "spin" ? "Spin" : (rule.matchType === "any" ? "Default" : "Direct");
    tag.textContent = modeLabel;

    const content = document.createElement("div");
    content.className = "item-content";

    const title = document.createElement("div");
    title.className = "item-title";
    title.textContent = rule.mode === "spin"
      ? `Spin: ${(getSpinPool(rule.poolId) || {}).name || rule.poolId || "Mutasi"}`
      : (rule.rewardAction || rule.action);

    const meta = document.createElement("div");
    meta.className = "item-sub";

    if (rule.matchType === "diamond") {
      meta.textContent = `Trigger: ${rule.matchValue} coin`;
    } else if (rule.matchType === "any") {
      meta.textContent = "Catch-all untuk gift yang belum ada rule spesifik. Bisa diedit.";
    } else {
      const giftDisplay = POPULAR_GIFTS.find(g => g.value === rule.matchValue);
      const giftName = giftDisplay ? giftDisplay.name : rule.matchValue;
      meta.textContent = `Gift: ${giftName}${rule.unitCount && Number(rule.unitCount) > 1 ? ` x${rule.unitCount}` : ""}`;
    }

    content.appendChild(title);
    content.appendChild(meta);

    if (rule.locked) {
      const lockTag = document.createElement("span");
      lockTag.className = "rule-locked";
      lockTag.textContent = "🔒 Default";
      lockTag.title = "Rule ini tidak bisa dihapus, hanya bisa diedit aksinya";
      row.appendChild(tag);
      row.appendChild(content);
      row.appendChild(lockTag);
    } else {
      const removeBtn = document.createElement("button");
      removeBtn.className = "ghost small";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeGiftRule(rule.id));

      row.appendChild(tag);
      row.appendChild(content);
      row.appendChild(removeBtn);
    }

    el.ruleList.appendChild(row);
  });
}

function addGiftRuleFromForm() {
  const type = el.ruleType.value;
  const action = el.ruleAction.value.trim();

  if (!action) {
    showToast("Aksi / Joki Type wajib diisi.", "error");
    return;
  }

  let matchValue;
  if (type === "diamond") {
    const parsed = Number(el.ruleDiamondValue.value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast("Jumlah coin harus angka positif.", "error");
      return;
    }
    matchValue = parsed;
  } else {
    if (!el.ruleGiftValue.value) {
      showToast("Pilih gift terlebih dahulu.", "error");
      return;
    }
    matchValue = el.ruleGiftValue.value;
  }

  state.giftRules.push({
    id: generateId("rule"),
    matchType: type,
    matchValue,
    action,
    rewardAction: action,
    mode: "direct",
    unitCount: 1
  });

  el.ruleDiamondValue.value = "";
  el.ruleGiftValue.value = "";
  el.ruleAction.value = "";

  saveState();
  renderGiftRules();
}

function populateGiftSelector() {
  const selector = el.ruleGiftValue;
  POPULAR_GIFTS.forEach((gift) => {
    const option = document.createElement("option");
    option.value = gift.value;
    option.textContent = gift.name;
    selector.appendChild(option);
  });
}

function updateGiftSelector() {
  const type = el.ruleType.value;
  if (type === "diamond") {
    el.diamondField.style.display = "block";
    el.giftField.style.display = "none";
  } else {
    el.diamondField.style.display = "none";
    el.giftField.style.display = "block";
  }
}

window.updateGiftSelector = updateGiftSelector;

function removeGiftRule(ruleId) {
  state.giftRules = state.giftRules.filter((rule) => rule.id !== ruleId);
  saveState();
  renderGiftRules();
}

function resetGiftRulesToDefault() {
  showConfirm(
    "Reset Gift Rules ke Default?",
    "Semua rules akan dikembalikan ke default. Rules custom yang Anda buat akan hilang.",
    () => {
      state.giftRules = DEFAULT_GIFT_RULES.map((rule) => ({ ...rule }));
      state.spinPools = DEFAULT_SPIN_POOLS.map((pool) => ({ ...pool, items: pool.items.map((item) => ({ ...item })) }));
      state.giftProgress = {};
      saveState();
      renderGiftRules();
      showToast("Gift rules dikembalikan ke default", "success");
    },
    "Ya, Reset"
  );
}

function trimList(listEl, maxItems) {
  while (listEl.children.length > maxItems) {
    listEl.removeChild(listEl.firstChild);
  }
}

function appendWithAutoScroll(listEl, followEnabled) {
  if (!followEnabled) return;
  const distanceFromBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight;
  if (distanceFromBottom < 60) {
    listEl.scrollTop = listEl.scrollHeight;
  }
}

function toggleChatFollow() {
  chatFollowEnabled = !chatFollowEnabled;
  el.chatFollowBtn.textContent = `Follow: ${chatFollowEnabled ? "On" : "Off"}`;
  el.chatFollowBtn.classList.toggle("chat-follow-active", chatFollowEnabled);
  if (chatFollowEnabled) {
    el.chatList.scrollTop = el.chatList.scrollHeight;
  }
  showToast(`Chat follow ${chatFollowEnabled ? "aktif" : "nonaktif"}`, chatFollowEnabled ? "success" : "error");
}

function toggleGiftFollow() {
  giftFollowEnabled = !giftFollowEnabled;
  el.giftFollowBtn.textContent = `Follow: ${giftFollowEnabled ? "On" : "Off"}`;
  el.giftFollowBtn.classList.toggle("chat-follow-active", giftFollowEnabled);
  if (giftFollowEnabled) {
    el.giftList.scrollTop = el.giftList.scrollHeight;
  }
  showToast(`Gift follow ${giftFollowEnabled ? "aktif" : "nonaktif"}`, giftFollowEnabled ? "success" : "error");
}

function addToWhitelistFromUser(msg) {
  const uniqueId = msg.uniqueId || "";
  if (!uniqueId) return;

  addManualJokiEntry({
    name: getDisplayLabel(msg),
    username: uniqueId,
    source: "chat"
  });
}

function addManualJokiEntry({ name, username, action, source }) {
  if (!name) {
    showToast("Nama peserta wajib diisi.", "error");
    return;
  }

  state.jokiQueue.push({
    id: generateId("joki"),
    action: action || "Manual",
    user: name,
    username: username || null,
    tiktokId: null,
    giftName: "-",
    diamondCount: 0,
    qty: 1,
    time: Date.now(),
    status: "pending",
    source: source || "manual",
    notes: ""
  });

  if (state.jokiQueue.length > MAX_JOKI_ITEMS) {
    state.jokiQueue.shift();
  }

  saveState();
  renderJokiQueue();
}

function removeFromWhitelist(key) {
  const id = key;
  state.jokiQueue = state.jokiQueue.filter((item) => item.id !== id);
  saveState();
  renderJokiQueue();
}

function removeJokiEntry(id) {
  state.jokiQueue = state.jokiQueue.filter((item) => item.id !== id);
  saveState();
  renderJokiQueue();
}

function updateJokiUsername(id, newUsername) {
  const entry = state.jokiQueue.find((item) => item.id === id);
  if (entry) {
    entry.username = newUsername || null;
    saveState();
    renderJokiQueue();
  }
}

function updateJokiAction(id, newAction) {
  const entry = state.jokiQueue.find((item) => item.id === id);
  if (!entry) return;

  const cleaned = String(newAction || "").trim();
  if (!cleaned) {
    renderJokiQueue();
    return;
  }

  entry.action = cleaned;
  entry.unmatched = false;
  entry.matchKey = cleaned;
  if (entry.rewardMode === "spin") {
    entry.rewardMode = "direct";
    entry.spinResults = null;
    entry.poolId = null;
  }
  saveState();
  renderJokiQueue();
}

function startEditRobloxInline(entryId, targetEl) {
  const entry = state.jokiQueue.find((e) => e.id === entryId);
  if (!entry || !targetEl) return;

  const body = targetEl.closest(".joki-body");
  if (!body || body.querySelector(".joki-roblox-input")) return;

  const original = targetEl;
  const originalText = entry.username || "";

  const input = document.createElement("input");
  input.type = "text";
  input.value = originalText;
  input.placeholder = "username Roblox";
  input.className = "joki-roblox-input";
  input.style.cssText = "font-size:0.72rem;font-weight:700;color:#08574f;background:#fff;border:1.5px solid rgba(15,157,146,0.5);border-radius:4px;padding:1px 5px;outline:none;width:100px;flex:0 0 auto;";
  input.autocomplete = "off";
  input.spellcheck = false;

  const saveBtn = document.createElement("button");
  saveBtn.className = "joki-roblox-save";
  saveBtn.textContent = "✓";
  saveBtn.title = "Simpan (Enter)";
  saveBtn.type = "button";
  saveBtn.style.cssText = "font-size:0.7rem;padding:1px 5px;border-radius:4px;background:var(--accent-2);color:#fff;border:none;cursor:pointer;flex:0 0 auto;";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "joki-roblox-cancel";
  cancelBtn.textContent = "✕";
  cancelBtn.title = "Batal (Esc)";
  cancelBtn.type = "button";
  cancelBtn.style.cssText = "font-size:0.7rem;padding:1px 5px;border-radius:4px;background:transparent;color:var(--muted);border:1px solid var(--border);cursor:pointer;flex:0 0 auto;";

  original.replaceWith(input);
  input.insertAdjacentElement("afterend", saveBtn);
  saveBtn.insertAdjacentElement("afterend", cancelBtn);

  setTimeout(() => {
    input.focus();
    input.select();
  }, 10);

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    updateJokiUsername(entryId, input.value.trim());
  };
  const cancel = () => {
    if (done) return;
    done = true;
    renderJokiQueue();
  };

  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    commit();
  });
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    cancel();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  });
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (!done && document.body.contains(input)) commit();
    }, 120);
  });
}

function startEditActionInline(entryId, targetEl) {
  const entry = state.jokiQueue.find((e) => e.id === entryId);
  if (!entry || !targetEl) return;

  const body = targetEl.closest(".joki-body");
  if (!body || body.querySelector(".joki-action-input")) return;

  const originalText = entry.unmatched ? "" : (entry.action || "");

  const input = document.createElement("input");
  input.type = "text";
  input.value = originalText;
  input.placeholder = "keterangan antrean";
  input.className = "joki-action-input";
  input.style.cssText = "font-size:0.7rem;font-weight:600;color:#183404;background:#fff;border:1.5px solid rgba(143,198,79,0.5);border-radius:4px;padding:2px 5px;outline:none;width:120px;flex:0 0 auto;";
  input.autocomplete = "off";
  input.spellcheck = false;

  const saveBtn = document.createElement("button");
  saveBtn.className = "joki-action-save";
  saveBtn.textContent = "✓";
  saveBtn.type = "button";
  saveBtn.title = "Simpan (Enter)";
  saveBtn.style.cssText = "font-size:0.7rem;padding:2px 5px;border-radius:4px;background:#8fc64f;color:#183404;border:none;cursor:pointer;flex:0 0 auto;";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "joki-action-cancel";
  cancelBtn.textContent = "✕";
  cancelBtn.type = "button";
  cancelBtn.title = "Batal (Esc)";
  cancelBtn.style.cssText = "font-size:0.7rem;padding:2px 5px;border-radius:4px;background:transparent;color:var(--muted);border:1px solid var(--border);cursor:pointer;flex:0 0 auto;";

  targetEl.replaceWith(input);
  input.insertAdjacentElement("afterend", saveBtn);
  saveBtn.insertAdjacentElement("afterend", cancelBtn);

  setTimeout(() => {
    input.focus();
    input.select();
  }, 10);

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    updateJokiAction(entryId, input.value);
  };
  const cancel = () => {
    if (done) return;
    done = true;
    renderJokiQueue();
  };

  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    commit();
  });
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    cancel();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  });
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (!done && document.body.contains(input)) commit();
    }, 120);
  });
}



function renderWinners() {
  el.winnerList.innerHTML = "";

  state.winners.forEach((winner) => {
    const row = document.createElement("div");
    row.className = "list-item";

    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = `#${winner.number}`;

    const content = document.createElement("div");
    content.className = "item-content";

    const title = document.createElement("div");
    title.className = "item-title";
    title.textContent = winner.name;

    const text = document.createElement("div");
    text.className = "item-text";
    text.textContent = winner.comment || "";

    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = formatTime(winner.time);

    content.appendChild(title);
    if (winner.comment) {
      content.appendChild(text);
    }
    content.appendChild(meta);

    row.appendChild(pill);
    row.appendChild(content);

    el.winnerList.appendChild(row);
  });

  updateCounts();
}

function addWinner(entry) {
  state.winners.unshift({
    name: entry.name,
    number: entry.number,
    comment: entry.comment || "",
    time: Date.now()
  });

  if (state.winners.length > 200) {
    state.winners.pop();
  }

  saveState();
  renderWinners();
}

function clearChat() {
  el.chatList.innerHTML = "";
  resetSessionNumbers();
}

function clearGifts() {
  el.giftList.innerHTML = "";
}

function clearWhitelist() {
  showConfirm(
    "Hapus Semua Whitelist?",
    "Whitelist lama akan dihapus.",
    () => {
      state.whitelist = [];
      state.nextNumber = 1;
      saveState();
      renderWhitelist();
      drawWheel();
    },
    "Ya, Hapus"
  );
}

function clearWinners() {
  if (state.winners.length === 0) {
    showToast("Belum ada winners", "error");
    return;
  }
  showConfirm(
    "Hapus Semua Winners?",
    `Riwayat ${state.winners.length} pemenang akan dihapus.`,
    () => {
      state.winners = [];
      saveState();
      renderWinners();
      showToast("Winners dihapus", "success");
    },
    "Ya, Hapus"
  );
}

function resizeWheel() {
  const canvas = el.wheel;
  const rect = canvas.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = size * dpr;
  canvas.height = size * dpr;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawWheel() {
  const canvas = el.wheel;
  const ctx = canvas.getContext("2d");
  const size = canvas.width / (window.devicePixelRatio || 1);
  const radius = size / 2 - 6;
  const center = size / 2;

  ctx.clearRect(0, 0, size, size);

  const entries = state.sessionNumbers.slice().sort((a, b) => a.number - b.number);

  if (entries.length === 0) {
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff1dc";
    ctx.fill();
    ctx.fillStyle = "#6d6154";
    ctx.font = "14px Space Grotesk";
    ctx.textAlign = "center";
    ctx.fillText("Sesi kosong", center, center);
    return;
  }

  const angle = (Math.PI * 2) / entries.length;

  entries.forEach((entry, index) => {
    const start = -Math.PI / 2 + index * angle;
    const end = start + angle;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[index % WHEEL_COLORS.length];
    ctx.fill();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(start + angle / 2);
    ctx.fillStyle = "#1b1b1b";
    ctx.font = entries.length > 18 ? "11px Space Grotesk" : "13px Space Grotesk";
    ctx.textAlign = "right";
    ctx.fillText(`#${entry.number}`, radius - 12, 4);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(center, center, 16, 0, Math.PI * 2);
  ctx.fillStyle = "#fffaf3";
  ctx.fill();
}

function spinWheel() {
  if (spinning) return;
  if (state.sessionNumbers.length === 0) {
    showToast("Sesi angka masih kosong.", "error");
    return;
  }

  spinning = true;
  el.spinBtn.disabled = true;

  const entries = state.sessionNumbers.slice().sort((a, b) => a.number - b.number);
  const index = Math.floor(Math.random() * entries.length);
  const angleDeg = 360 / entries.length;

  const targetNormalized = (360 - (index * angleDeg + angleDeg / 2)) % 360;
  const currentNormalized = ((currentRotation % 360) + 360) % 360;
  let delta = targetNormalized - currentNormalized;
  if (delta < 0) delta += 360;

  const extraSpins = 4 + Math.floor(Math.random() * 3);
  const targetRotation = currentRotation + extraSpins * 360 + delta;

  el.wheel.style.transform = `rotate(${targetRotation}deg)`;
  currentRotation = targetRotation;

  setTimeout(() => {
    const winner = entries[index];
    const commentText = winner.comment ? ` - ${winner.comment}` : "";
    el.winnerDisplay.textContent = `Pemenang: ${winner.name} (#${winner.number})${commentText}`;
    addWinner(winner);

    if (state.settings.removeAfterSpin) {
      removeSessionNumber(winner.number);
    }

    spinning = false;
    el.spinBtn.disabled = false;
  }, 4300);
}

function bindEvents() {
  el.connectBtn.addEventListener("click", connectLive);
  el.disconnectBtn.addEventListener("click", disconnectLive);
  el.clearChatBtn.addEventListener("click", clearChat);
  el.clearGiftsBtn.addEventListener("click", clearGifts);
  el.chatFollowBtn.addEventListener("click", toggleChatFollow);
  el.giftFollowBtn.addEventListener("click", toggleGiftFollow);
  el.confirmOkBtn.addEventListener("click", () => {
    const cb = confirmCallback;
    closeConfirm();
    if (cb) cb();
  });
  el.confirmCancelBtn.addEventListener("click", closeConfirm);
  el.confirmModal.addEventListener("click", (e) => {
    if (e.target === el.confirmModal) closeConfirm();
  });
  el.resetSessionBtn.addEventListener("click", () => {
    if (state.sessionNumbers.length === 0) {
      showToast("Sesi angka sudah kosong", "error");
      return;
    }
    showConfirm(
      "Reset Sesi Angka?",
      `Sesi berisi ${state.sessionNumbers.length} angka akan dihapus.`,
      () => {
        resetSessionNumbers();
        showToast("Sesi angka direset", "success");
      },
      "Ya, Reset"
    );
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.confirmModal.style.display === "flex") {
      closeConfirm();
    }
  });

  el.removeAfterSpin.addEventListener("change", (event) => {
    state.settings.removeAfterSpin = event.target.checked;
    saveState();
  });

  el.numberMin.addEventListener("change", (event) => {
    normalizeNumberRange();
  });

  el.numberMax.addEventListener("change", (event) => {
    normalizeNumberRange();
  });

  el.clearWinnersBtn.addEventListener("click", clearWinners);
  el.clearJokiBtn.addEventListener("click", clearJokiQueue);
  el.exportJokiBtn.addEventListener("click", openExportModal);
  el.importJokiBtn.addEventListener("click", openImportModal);
  el.importOkBtn.addEventListener("click", () => {
    el.importJokiInput.click();
  });
  el.importJokiInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    handleImportFile(file);
    e.target.value = "";
  });
  el.importCancelBtn.addEventListener("click", closeImportModal);
  el.importModal.addEventListener("click", (e) => {
    if (e.target === el.importModal) closeImportModal();
  });
  el.exportOkBtn.addEventListener("click", performExport);
  el.exportCancelBtn.addEventListener("click", closeExportModal);
  el.exportModal.addEventListener("click", (e) => {
    if (e.target === el.exportModal) closeExportModal();
  });
  el.copyJokiBtn.addEventListener("click", copyJokiQueueToClipboard);
  el.jokiSearchInput.addEventListener("input", (event) => {
    jokiSearchQuery = event.target.value || "";
    renderJokiQueue();
  });
  el.exportRulesBtn.addEventListener("click", () => {
    if (state.giftRules.length === 0) {
      showToast("Belum ada gift rule", "error");
      return;
    }
    downloadJSON(state.giftRules, `gift-rules-${new Date().toISOString().slice(0, 10)}.json`);
    showToast(`Export berhasil: ${state.giftRules.length} rule`, "success");
  });
  el.resetRulesBtn.addEventListener("click", resetGiftRulesToDefault);
  el.exportWinnersBtn.addEventListener("click", () => downloadJSON(state.winners, "winners.json"));
  el.addRuleBtn.addEventListener("click", addGiftRuleFromForm);
  el.spinBtn.addEventListener("click", spinWheel);

  window.addEventListener("resize", () => {
    resizeWheel();
    drawWheel();
  });
}

function init() {
  el.confirmModal = $("confirmModal");
  el.confirmTitle = $("confirmTitle");
  el.confirmMessage = $("confirmMessage");
  el.confirmOkBtn = $("confirmOkBtn");
  el.confirmCancelBtn = $("confirmCancelBtn");
  el.toast = $("toast");
  el.usernameInput = $("usernameInput");
  el.backendInput = $("backendInput");
  el.connectBtn = $("connectBtn");
  el.disconnectBtn = $("disconnectBtn");
  el.statusText = $("statusText");
  el.roomStats = $("roomStats");
  el.bgIndicator = $("bgIndicator");
  el.chatList = $("chatList");
  el.giftList = $("giftList");
  el.clearChatBtn = $("clearChatBtn");
  el.clearGiftsBtn = $("clearGiftsBtn");
  el.chatFollowBtn = $("chatFollowBtn");
  el.giftFollowBtn = $("giftFollowBtn");
  el.resetSessionBtn = $("resetSessionBtn");
  el.sessionList = $("sessionList");
  el.sessionCount = $("sessionCount");
  el.removeAfterSpin = $("removeAfterSpin");
  el.numberMin = $("numberMin");
  el.numberMax = $("numberMax");
  el.jokiList = $("jokiList");
  el.jokiSearchInput = $("jokiSearchInput");
  el.jokiCount = $("jokiCount");
  el.clearJokiBtn = $("clearJokiBtn");
  el.copyJokiBtn = $("copyJokiBtn");
  el.exportJokiBtn = $("exportJokiBtn");
  el.importJokiBtn = $("importJokiBtn");
  el.importJokiInput = $("importJokiInput");
  el.importModal = $("importModal");
  el.importOkBtn = $("importOkBtn");
  el.importCancelBtn = $("importCancelBtn");
  el.exportModal = $("exportModal");
  el.exportOkBtn = $("exportOkBtn");
  el.exportCancelBtn = $("exportCancelBtn");
  el.winnerList = $("winnerList");
  el.winnerCount = $("winnerCount");
  el.winnerDisplay = $("winnerDisplay");
  el.clearWinnersBtn = $("clearWinnersBtn");
  el.ruleType = $("ruleType");
  el.ruleDiamondValue = $("ruleDiamondValue");
  el.ruleGiftValue = $("ruleGiftValue");
  el.diamondField = $("diamondField");
  el.giftField = $("giftField");
  el.ruleAction = $("ruleAction");
  el.addRuleBtn = $("addRuleBtn");
  el.ruleList = $("ruleList");
  el.exportRulesBtn = $("exportRulesBtn");
  el.resetRulesBtn = $("resetRulesBtn");
  el.exportWinnersBtn = $("exportWinnersBtn");
  el.spinBtn = $("spinBtn");
  el.wheel = $("wheel");

  loadState();
  if (!state.giftRules.length) {
    state.giftRules = DEFAULT_GIFT_RULES.map((rule) => ({ ...rule }));
  }
  if (!state.spinPools.length) {
    state.spinPools = DEFAULT_SPIN_POOLS.map((pool) => ({ ...pool, items: pool.items.map((item) => ({ ...item })) }));
  }
  rebuildSessionIndexes();

  el.usernameInput.value = state.lastUsername || "";
  el.backendInput.value = state.backendUrl || "";
  el.removeAfterSpin.checked = !!state.settings.removeAfterSpin;
  el.numberMin.value = state.settings.numberMin;
  el.numberMax.value = state.settings.numberMax;
  normalizeNumberRange();

  populateGiftSelector();
  bindEvents();
  renderSessionNumbers();
  renderWinners();
  renderJokiQueue();
  renderGiftRules();
  resizeWheel();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(drawWheel);
  } else {
    drawWheel();
  }
}

document.addEventListener("DOMContentLoaded", init);
