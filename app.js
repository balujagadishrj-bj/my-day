/* My Day: phone-first personal dashboard.
   Runs in two modes:
     local  - served by dashboard_server.py on the PC (plain data, saves straight to SQLite)
     remote - GitHub Pages (encrypted snapshot; phone entries go to the repo's inbox folder) */
"use strict";

/* ================================================================== utils */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const todayISO = () => iso(new Date());
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmtDate = (s, long) => { const d = parseISO(s); return long ? `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const relDay = (s) => { const n = daysBetween(todayISO(), s); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : n < 0 ? `${-n} days ago` : n < 7 ? DAYS_LONG[parseISO(s).getDay()] : fmtDate(s); };
const toMin = (t) => { if (!t) return null; const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
const fmtClock = (t) => { const m = typeof t === "number" ? t : toMin(t); if (m == null) return "–"; let h = Math.floor(m / 60) % 24; const mm = Math.round(m % 60); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}:${pad(mm)} ${ap}`; };
const fmtHM = (min) => { if (min == null || isNaN(min)) return "–"; min = Math.round(min); const h = Math.floor(Math.abs(min) / 60), m = Math.abs(min) % 60; return h ? `${h}h ${pad(m)}m` : `${m}m`; };
const fmtN = (n, d = 0) => (n == null || isNaN(n)) ? "–" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const inr = (n, d = 0) => (n == null || isNaN(n)) ? "–" : (n < 0 ? "−₹" : "₹") + Math.abs(Number(n)).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const compactINR = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₹${Math.round(n)}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
const avg = (a) => a.length ? sum(a) / a.length : null;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowLocalISO = () => { const d = new Date(); return `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
function sinceText(stamp) {
  if (!stamp) return "never";
  const t = new Date(String(stamp).replace(" ", "T"));
  if (isNaN(t)) return stamp;
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : `${d} days ago`;
}
const ageHours = (stamp) => { if (!stamp) return 1e9; const t = new Date(String(stamp).replace(" ", "T")); return isNaN(t) ? 1e9 : (Date.now() - t) / 3600000; };

const store = {
  get(k, f = null) { try { const v = localStorage.getItem("myday:" + k); return v == null ? f : JSON.parse(v); } catch { return f; } },
  set(k, v) { try { localStorage.setItem("myday:" + k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem("myday:" + k); } catch { /* ignore */ } },
};

/* ================================================================== icons */
const ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  tasks: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  health: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  money: '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.6"/><path d="M6 10v5M18 10v5"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  steps: '<path d="M8 16c-2 0-3-1.5-3-4s1-5 3-5 2.5 2 2.5 4-.5 5-2.5 5zM16 20c-2 0-2.5-3-2.5-5s.5-4 2.5-4 3 2.5 3 5-1 4-3 4z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v13H5a2 2 0 0 1-2-2V5"/><circle cx="16" cy="14" r="1.3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};
const icon = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

/* ================================================================== state */
let DATA = null;
const MODE = { kind: null, key: null, keyinfo: null };
const STATE = {
  page: store.get("page", "today"),
  healthRange: 30,
  moneyCycle: 0,
  workCycle: 0,
  txQuery: "",
  txCat: "",
  taskWhen: "today",
  taskPrio: 0,
};
const IDX = {};
const TT = { open: [], done: [], projects: [], source: "snapshot", loading: false, error: "" };

/* ================================================================== crypto */
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64e = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
async function streamBytes(u8, transform) { const s = new Blob([u8]).stream().pipeThrough(transform); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function deriveRaw(pass, info) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64d(info.salt), iterations: info.iterations }, base, 256);
  return new Uint8Array(bits);
}
const aesKey = (raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
async function decryptJSON(key, blob) {
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(blob.iv) }, key, b64d(blob.ct)));
  const bytes = blob.gz ? await streamBytes(pt, new DecompressionStream("gzip")) : pt;
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function encryptJSON(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await streamBytes(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream("gzip"));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return { v: 1, gz: true, iv: b64e(iv), ct: b64e(ct) };
}

/* ================================================================== loading */
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function detectLocal() {
  if (!/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return null;
  try { return await fetchJSON("/api/local-secrets", { cache: "no-store" }); } catch { return null; }
}
async function loadKeyinfo() {
  MODE.keyinfo = await fetchJSON(`keyinfo.json?t=${Date.now()}`, { cache: "no-store" });
  return MODE.keyinfo;
}
async function unlockWith(pass) {
  const info = MODE.keyinfo || await loadKeyinfo();
  const raw = await deriveRaw(pass, info);
  const key = await aesKey(raw);
  await decryptJSON(key, info.check); // throws on a wrong passphrase
  store.set("key", { raw: b64e(raw), salt: info.salt });
  MODE.key = key;
}
async function loadSnapshot() {
  let blob;
  try {
    blob = await fetchJSON(`data/snapshot.json?t=${Date.now()}`, { cache: "no-store" });
  } catch (e) {
    const cached = store.get("snapcache");
    if (!cached) throw e;
    blob = cached;
    toast("Offline: showing the last copy on this phone.");
  }
  const data = await decryptJSON(MODE.key, blob);
  try { store.set("snapcache", blob); } catch { /* ignore */ }
  return data;
}
async function loadData() {
  if (MODE.kind === "local") {
    DATA = await fetchJSON("/api/data", { cache: "no-store" });
    DATA.secrets = { gemini_api_key: MODE.local.gemini_api_key, ticktick_token: MODE.local.ticktick_token };
    DATA.published_at = DATA.generated_at;
  } else {
    DATA = await loadSnapshot();
    reconcilePending();
  }
  DATA._loadedAt = new Date().toISOString();
  index();
  TT.open = DATA.tasks?.open || []; TT.done = DATA.tasks?.done || []; TT.projects = DATA.tasks?.projects || []; TT.source = "snapshot";
}

/* ================================================================== secrets */
const secret = (name) => (store.get("dev:" + name) || "").trim() || (DATA?.secrets?.[name] || "").trim();
const geminiKey = () => secret("gemini_api_key");
const ttToken = () => secret("ticktick_token");
const ghToken = () => (store.get("dev:github_token") || "").trim();
const ghRepo = () => store.get("dev:github_repo") || MODE.keyinfo?.repo || "";

/* ================================================================== domain */
const NON_SPEND = new Set(["transfer", "savings", "investment", "self transfer"]);
const S = () => DATA.settings || {};
function index() {
  IDX.att = {}; (DATA.attendance || []).forEach((a) => { IDX.att[a.date] = a; });
  IDX.health = {}; (DATA.health?.daily || []).forEach((h) => { IDX.health[h.date] = h; });
  IDX.checkin = {}; (DATA.checkins || []).forEach((c) => { IDX.checkin[c.date] = c; });
  IDX.cal = {}; (DATA.calendar || []).forEach((c) => { (IDX.cal[c.date] = IDX.cal[c.date] || {})[c.item_type] = c; });
  const att = DATA.attendance || [];
  IDX.attLatest = att.length ? att[att.length - 1].date : null;
  IDX.fuel = [...(DATA.petrol || [])].sort((a, b) => (a.fill_date + pad(a.id)).localeCompare(b.fill_date + pad(b.id)));
}
function cycleBounds(offset = 0, ref = todayISO()) {
  const d = parseISO(ref);
  let y = d.getFullYear(), m = d.getMonth();
  if (d.getDate() < 21) m -= 1;
  m += offset;
  return { start: iso(new Date(y, m, 21)), end: iso(new Date(y, m + 1, 20)) };
}
const inRange = (s, a, b) => s >= a && s <= b;
function cleanLabel(t) {
  if (!t) return t;
  const m = String(t).match(/holiday\s*\((.*)\)/i);
  const inner = m ? m[1] : String(t);
  return inner.toLowerCase().replace(/(^|[\s/(\\-])([a-z])/g, (x, p, c) => p + c.toUpperCase()).trim() || t;
}
function dayInfo(d) {
  const a = IDX.att[d], cal = IDX.cal[d] || {}, official = DATA.holidays?.[d];
  const text = [a?.status, a?.leave, a?.comment].filter(Boolean).join(" ").toLowerCase();
  const info = { date: d, att: a, cal, type: "none", label: "" };
  if (a && a.in) { info.type = "work"; info.label = "Present"; }
  else if (/holiday/.test(text)) { info.type = "holiday"; info.label = cleanLabel(a.leave) || "Holiday"; }
  else if (a && /leave|absent/.test(text)) { info.type = "leave"; info.label = cal.planned_cl ? "Casual leave" : cleanLabel(a.leave) || a.status || "Leave"; }
  else if (cal.holiday) { info.type = "holiday"; info.label = cal.holiday.title || "Holiday"; }
  else if (official) { info.type = "holiday"; info.label = official; }
  else if (cal.planned_cl) { info.type = "planned"; info.label = "Planned CL"; }
  else if (parseISO(d).getDay() === 0) { info.type = "holiday"; info.label = "Sunday"; }
  else if (d > todayISO()) { info.type = "future"; }
  return info;
}
function cycleWork(c) {
  const rows = (DATA.attendance || []).filter((a) => inRange(a.date, c.start, c.end));
  const used = sum(rows, (a) => a.variance);
  const limit = Number(S().variance_limit_minutes || 180);
  const present = rows.filter((a) => a.in);
  const ins = present.map((a) => toMin(a.in)).filter((x) => x != null);
  return { rows, used, limit, left: limit - used, present: present.length, avgIn: ins.length ? avg(ins) : null, leave: cycleLeave(c) };
}
function cycleLeave(c) {
  const t = todayISO(), taken = new Set(), planned = [];
  (DATA.attendance || []).forEach((a) => { if (inRange(a.date, c.start, c.end) && /casual|\bcl\b/i.test(`${a.leave || ""} ${a.comment || ""} ${a.status || ""}`)) taken.add(a.date); });
  (DATA.calendar || []).filter((x) => x.item_type === "planned_cl" && inRange(x.date, c.start, c.end)).forEach((x) => {
    const a = IDX.att[x.date];
    if (a && a.in) return;
    if (x.date < t || (x.date === t && a)) taken.add(x.date); else planned.push(x.date);
  });
  return { taken: [...taken].sort(), planned: planned.sort(), total: taken.size + planned.length, limit: Number(S().casual_leave_limit || 1) };
}
const isSpend = (e) => e.type === "Debit" && !NON_SPEND.has(String(e.category || "").toLowerCase());
function cycleMoney(c) {
  const rows = (DATA.expenses || []).filter((e) => inRange(e.date, c.start, c.end));
  const spendRows = rows.filter(isSpend);
  const spent = sum(spendRows, (e) => e.amount);
  const budget = Number(S().monthly_budget || 0);
  const t = todayISO();
  const daysLeft = t > c.end ? 0 : daysBetween(t < c.start ? c.start : t, c.end) + 1;
  const byCat = {};
  spendRows.forEach((e) => { const k = e.category || "Uncategorised"; byCat[k] = (byCat[k] || 0) + Number(e.amount || 0); });
  return { rows, spendRows, spent, budget, left: budget - spent, daysLeft, byCat, safeDaily: daysLeft ? Math.max(budget - spent, 0) / daysLeft : 0,
    income: sum(rows.filter((e) => e.type === "Credit" && !NON_SPEND.has(String(e.category || "").toLowerCase())), (e) => e.amount) };
}
function petrolStats() {
  const fills = IDX.fuel, legs = [];
  for (let i = 1; i < fills.length; i++) {
    const p = fills[i - 1], c = fills[i], km = Number(c.odometer_km) - Number(p.odometer_km);
    if (c.odometer_km && p.odometer_km && km > 0 && Number(c.liters) > 0)
      legs.push({ date: c.fill_date, km, liters: Number(c.liters), amount: Number(c.amount || 0), kmpl: km / Number(c.liters), days: Math.max(1, daysBetween(p.fill_date, c.fill_date)) });
  }
  const last = fills[fills.length - 1];
  const tKm = sum(legs, (l) => l.km), tL = sum(legs, (l) => l.liters), tRs = sum(legs, (l) => l.amount);
  const interval = legs.length ? sum(legs, (l) => l.days) / legs.length : null;
  return { fills, legs, last, latestKmpl: legs.length ? legs[legs.length - 1].kmpl : null, avgKmpl: tL ? tKm / tL : null,
    rsPerKm: tKm ? tRs / tKm : null, kmPerDay: legs.length ? tKm / sum(legs, (l) => l.days) : null,
    daysSince: last ? daysBetween(last.fill_date, todayISO()) : null, nextFill: last && interval ? addDays(last.fill_date, Math.round(interval)) : null };
}
function streak(test, fromISO) {
  let n = 0;
  for (let d = fromISO; n < 400; d = addDays(d, -1)) { if (test(d)) n++; else break; }
  return n;
}
function healthStreaks() {
  const s = S(), latest = (DATA.health?.daily || []).slice(-1)[0]?.date;
  if (!latest) return { steps: 0, sleep: 0 };
  const startS = (IDX.health[todayISO()]?.steps || 0) >= s.steps_goal ? todayISO() : addDays(todayISO(), -1);
  return {
    steps: streak((d) => (IDX.health[d]?.steps || 0) >= s.steps_goal, startS),
    sleep: streak((d) => (IDX.health[d]?.sleep || 0) >= s.sleep_goal_hours * 60, todayISO() in IDX.health && IDX.health[todayISO()].sleep ? todayISO() : addDays(todayISO(), -1)),
  };
}
function sleepFor(d) {
  // main session that ended on date d (local time)
  const sessions = (DATA.health?.sleep_sessions || []).map((x) => ({ ...x, s: new Date(x.start), e: new Date(x.end) })).filter((x) => !isNaN(x.s) && !isNaN(x.e));
  const ended = sessions.filter((x) => iso(x.e) === d).sort((a, b) => (b.asleep || 0) - (a.asleep || 0));
  return ended[0] || null;
}
function upcoming(limit = 4) {
  const t = todayISO(), out = [];
  Object.entries(DATA.holidays || {}).forEach(([d, n]) => { if (d >= t) out.push({ d, what: n, kind: "Holiday" }); });
  (DATA.calendar || []).forEach((c) => {
    if (c.date < t) return;
    if (c.item_type === "holiday") out.push({ d: c.date, what: c.title || "Holiday", kind: "Holiday" });
    if (c.item_type === "planned_cl") out.push({ d: c.date, what: "Planned casual leave", kind: "Leave" });
    if (c.item_type === "note") out.push({ d: c.date, what: c.details || c.title || "Note", kind: "Note" });
  });
  return out.sort((a, b) => a.d.localeCompare(b.d)).slice(0, limit);
}
function categories() {
  const set = new Set(["Food", "Groceries", "Dining", "Travel", "Fuel", "Bills", "Shopping", "Health", "Education", "Family", "Misc", "Transfer", "Savings"]);
  (DATA.expenses || []).forEach((e) => e.category && set.add(e.category));
  return [...set].sort((a, b) => a.localeCompare(b));
}

/* ================================================================== TickTick */
const TT_API = "https://api.ticktick.com/open/v1";
const ttDate = (s) => { if (!s) return null; const d = new Date(String(s).replace(/([+-]\d\d)(\d\d)$/, "$1:$2")); return isNaN(d) ? null : d; };
const taskDay = (t) => { const d = ttDate(t.due || t.dueDate || t.start || t.startDate); return d ? iso(d) : null; };
const normTask = (t, list) => ({ id: t.id, projectId: t.projectId, list: list ?? t.list ?? "", title: t.title || "", content: t.content || t.desc || "",
  due: t.due || t.dueDate || null, start: t.start || t.startDate || null, allDay: t.allDay ?? !!t.isAllDay, priority: t.priority || 0,
  status: t.status || 0, completedTime: t.completedTime || null, tags: t.tags || [] });
async function tt(method, path, body) {
  const res = await fetch(TT_API + path, { method, headers: { Authorization: `Bearer ${ttToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 || res.status === 403) throw new Error("TickTick refused the token. Make a new one in TickTick: Settings > Account > API Token.");
  if (!res.ok) throw new Error(`TickTick error ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
async function ttRefresh(quiet = true) {
  if (!ttToken() || TT.loading) return;
  TT.loading = true; TT.error = "";
  try {
    const projects = (await tt("GET", "/project")) || [];
    const lists = [{ id: "inbox", name: "Inbox" }, ...projects.filter((p) => !p.closed)];
    const results = await Promise.all(lists.map((p) => tt("GET", `/project/${p.id}/data`).then((d) => ({ p, d })).catch(() => ({ p, d: null }))));
    const open = [];
    let inboxId = null;
    results.forEach(({ p, d }) => (d?.tasks || []).forEach((t) => { if (p.id === "inbox") inboxId = t.projectId; open.push(normTask(t, p.name)); }));
    const end = new Date(), start = new Date(Date.now() - 30 * 86400000);
    const f = (d) => d.toISOString().replace("Z", "+0000");
    let done = [];
    try { done = ((await tt("POST", "/task/completed", { startDate: f(start), endDate: f(end) })) || []).map((t) => normTask(t)); } catch { /* history is optional */ }
    const names = Object.fromEntries(lists.map((p) => [p.id, p.name]));
    if (inboxId) names[inboxId] = "Inbox";
    done.forEach((t) => { t.list = names[t.projectId] || t.list; });
    TT.open = open; TT.done = done; TT.projects = [{ id: inboxId || "inbox", name: "Inbox" }, ...projects.filter((p) => !p.closed).map((p) => ({ id: p.id, name: p.name, color: p.color }))];
    TT.source = "live"; TT.at = new Date();
    store.set("ttcache", { open, done, projects: TT.projects, at: Date.now() });
  } catch (e) {
    TT.error = e.message;
    if (!quiet) toast(e.message, "error");
  } finally { TT.loading = false; render(); }
}
async function ttComplete(id) {
  const t = TT.open.find((x) => x.id === id);
  if (!t) return;
  if (!ttToken()) return toast("Add your TickTick token in Settings to tick tasks off here.", "error");
  TT.open = TT.open.filter((x) => x.id !== id);
  TT.done.unshift({ ...t, status: 2, completedTime: new Date().toISOString() });
  render();
  try { await tt("POST", `/project/${t.projectId}/task/${t.id}/complete`); toast(`Done: ${t.title}`); }
  catch (e) { TT.open.push(t); TT.done = TT.done.filter((x) => x.id !== id); render(); toast(e.message, "error"); }
}
function tzOffset() { const m = -new Date().getTimezoneOffset(); return `${m >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(m) / 60))}${pad(Math.abs(m) % 60)}`; }
async function ttCreate({ title, day, priority = 0, projectId }) {
  if (!title.trim()) return false;
  if (!ttToken()) { toast("Add your TickTick token in Settings to add tasks.", "error"); return false; }
  const body = { title: title.trim(), priority: Number(priority) || 0 };
  if (projectId && projectId !== "inbox") body.projectId = projectId;
  if (day) Object.assign(body, { dueDate: `${day}T00:00:00${tzOffset()}`, startDate: `${day}T00:00:00${tzOffset()}`, isAllDay: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  try {
    const t = await tt("POST", "/task", body);
    TT.open.push(normTask(t, (TT.projects.find((p) => p.id === t.projectId) || {}).name || "Inbox"));
    toast("Added to TickTick");
    render();
    return true;
  } catch (e) { toast(e.message, "error"); return false; }
}
function taskGroups() {
  const t = todayISO(), wk = addDays(t, 7);
  const g = { overdue: [], today: [], week: [], later: [], none: [] };
  TT.open.forEach((x) => {
    const d = taskDay(x);
    if (!d) g.none.push(x); else if (d < t) g.overdue.push(x); else if (d === t) g.today.push(x); else if (d <= wk) g.week.push(x); else g.later.push(x);
  });
  const order = (a, b) => (taskDay(a) || "9").localeCompare(taskDay(b) || "9") || (b.priority - a.priority);
  Object.values(g).forEach((arr) => arr.sort(order));
  return g;
}
function taskContext() {
  const g = taskGroups(), pr = { 5: "high", 3: "medium", 1: "low" };
  const b = (x) => ({ title: x.title, list: x.list, due: taskDay(x), priority: pr[x.priority] || "none" });
  const wkAgo = addDays(todayISO(), -7);
  return { connected: !!(TT.open.length || TT.done.length), open_total: TT.open.length, overdue: g.overdue.slice(0, 15).map(b), due_today: g.today.slice(0, 15).map(b),
    next_7_days: g.week.slice(0, 15).map(b), no_date_count: g.none.length,
    completed_last_7_days: TT.done.filter((x) => x.completedTime && iso(ttDate(x.completedTime) || new Date(0)) >= wkAgo).length };
}

/* ================================================================== Gemini */
const PERSONA = "You are a warm, sharp personal coach inside the user's private daily dashboard. You see their office attendance (MyPunch, a 21st-to-20th pay cycle with a monthly variance allowance in minutes for late arrival / early leaving), Fitbit steps and sleep, FinArt bank expenses (INR), petrol fills for their two-wheeler, their daily check-ins and their TickTick to-do list. Be specific: quote their actual numbers. Be encouraging but honest. Never invent data that is not in the context. Amounts are Indian Rupees, write them like Rs 1,250. Use UK English.";
function aiContext() {
  const ctx = { ...(DATA.ai_context || {}) };
  ctx.tasks_ticktick = taskContext();
  ctx.now_local = nowLocalISO();
  ctx.snapshot_built_at = DATA.published_at || DATA.generated_at;
  const c = IDX.checkin[todayISO()];
  if (c) ctx.check_in_today = { mood: c.mood, energy: c.energy, intention: c.intention, priorities: c.priorities, win: c.win };
  return ctx;
}
async function gemini(prompt, { history = [], maxTokens = 1500, temperature = 0.7 } = {}) {
  const key = geminiKey();
  if (!key) throw new Error("Add your Gemini API key in Settings first.");
  const models = [...new Set([S().gemini_model || "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"])];
  const contents = history.slice(-8).map((h) => ({ role: h.role === "me" ? "user" : "model", parts: [{ text: h.text }] }));
  contents.push({ role: "user", parts: [{ text: prompt }] });
  let last = "";
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: PERSONA }] }, contents, generationConfig: { temperature, maxOutputTokens: maxTokens } }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { last = j.error?.message || res.status; if (res.status === 400 && /API key/i.test(last)) break; continue; }
      const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
      if (text) return text;
      last = "empty answer";
    } catch (e) { last = e.message; }
  }
  throw new Error(`Gemini did not answer (${last}).`);
}
const ctxJSON = () => JSON.stringify(aiContext());
async function makeBriefing() {
  const d = todayISO();
  const text = await gemini(`Give me my morning briefing for ${DAYS_LONG[new Date().getDay()]} ${d}.\n\nDATA (JSON):\n${ctxJSON()}\n\nRules: max 110 words, Markdown. Start with one short energising line (no greeting cliches, no heading). Then exactly 4 bullets: work (variance or leave or time to leave office), body (steps or sleep), money or petrol, and tasks (the TickTick task that matters most today). Each bullet has a concrete number and a tiny action for today. If I wrote priorities or an intention today, connect to them.`, { maxTokens: 800, temperature: 0.8 });
  store.set("briefing", { date: d, md: text, at: Date.now() });
  return text;
}
function briefing() {
  const mine = store.get("briefing");
  if (mine && mine.date === todayISO()) return { md: mine.md, source: "phone", at: mine.at };
  if (DATA.ai?.briefing_date === todayISO() && DATA.ai.briefing_md) return { md: DATA.ai.briefing_md, source: "pc", at: DATA.ai.briefing_at };
  return null;
}
function md(src) {
  let s = esc(String(src || "")).replace(/\r/g, "");
  s = s.replace(/^\s*\*\*Header\/Opening Line:\*\*\s*/i, "");
  const lines = s.split("\n");
  let out = "", inList = false;
  const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>").replace(/`(.+?)`/g, "<code>$1</code>");
  for (let raw of lines) {
    const l = raw.trim();
    if (/^[-*•]\s+/.test(l)) { if (!inList) { out += "<ul>"; inList = true; } out += `<li>${inline(l.replace(/^[-*•]\s+/, ""))}</li>`; continue; }
    if (inList) { out += "</ul>"; inList = false; }
    if (!l) continue;
    if (/^#{1,4}\s/.test(l)) out += `<h3>${inline(l.replace(/^#+\s*/, ""))}</h3>`;
    else if (/^&gt;\s?/.test(l)) out += `<blockquote>${inline(l.replace(/^&gt;\s?(\[!\w+\]\s*)?/, ""))}</blockquote>`;
    else out += `<p>${inline(l)}</p>`;
  }
  if (inList) out += "</ul>";
  return `<div class="md">${out}</div>`;
}

/* ================================================================== writes */
async function localApi(path, body) {
  const res = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({ ok: false, error: `Unexpected reply (${res.status})` }));
  if (!res.ok || j.ok === false) throw new Error(j.error || res.statusText);
  return j;
}
function applyLocal(route, p, entryId) {
  const tag = { _pending: true, _pid: entryId };
  if (route === "/api/checkin") {
    let c = (DATA.checkins = DATA.checkins || []).find((x) => x.date === p.date);
    if (!c) { c = { date: p.date }; DATA.checkins.push(c); }
    Object.keys(p).forEach((k) => { if (k !== "date") c[k] = p[k]; });
  } else if (route === "/api/transaction") {
    const list = (DATA.expenses = DATA.expenses || []);
    if (p.action === "delete") DATA.expenses = list.filter((e) => String(e.id) !== String(p.id));
    else if (p.action === "patch") { const e = list.find((x) => String(x.id) === String(p.id)); if (e) Object.assign(e, { category: p.category ?? e.category, notes: p.notes ?? e.notes }, { _edited: true }); }
    else list.unshift({ id: "p-" + entryId, date: p.expense_date, amount: Number(p.amount), category: p.category, description: p.description, type: p.type || "Debit", account: p.account || "Cash", notes: p.notes || "", source_file: "Phone", ...tag });
    DATA.expenses.sort((a, b) => b.date.localeCompare(a.date));
  } else if (route === "/api/petrol-fill") {
    (DATA.petrol = DATA.petrol || []).push({ id: 1e9 + (DATA.petrol.length), fill_date: p.fill_date, odometer_km: Number(p.odometer_km) || null, liters: Number(p.liters) || null, amount: Number(p.amount) || null, note: p.note || "", ...tag });
  } else if (route === "/api/calendar-item") {
    DATA.calendar = (DATA.calendar || []).filter((x) => !(x.date === p.date && x.item_type === p.item_type));
    if (p.enabled) DATA.calendar.push({ date: p.date, item_type: p.item_type, title: p.title || "", details: p.details || "", ...tag });
  }
  index();
}
async function sendToInbox(entry) {
  const repo = ghRepo(), token = ghToken();
  if (!repo || !token) throw new Error("no-token");
  const blob = await encryptJSON(MODE.key, entry);
  const name = `${entry.created_at.replace(/[:T]/g, "-")}-${entry.id}.json`;
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/inbox/${name}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Phone: ${entry.route.replace("/api/", "")}`, content: btoa(JSON.stringify(blob)) }),
  });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(`GitHub said ${res.status}: ${j.message || ""}`.trim()); }
}
async function submit(route, payload, okMsg = "Saved") {
  if (MODE.kind === "local") {
    try { await localApi(route, payload); toast(okMsg); await reload(); return true; }
    catch (e) { toast(e.message, "error"); return false; }
  }
  const entry = { id: uid(), route, payload, created_at: nowLocalISO(), sent: false };
  const pending = store.get("pending", []);
  pending.push(entry); store.set("pending", pending);
  applyLocal(route, payload, entry.id);
  render();
  try {
    await sendToInbox(entry);
    entry.sent = true; store.set("pending", pending);
    toast(`${okMsg}. It reaches the PC at the next sync.`);
  } catch (e) {
    toast(e.message === "no-token" ? `${okMsg} on this phone. Add GitHub write access in Settings to send it to the PC.` : `Saved on this phone, sending failed: ${e.message}`, e.message === "no-token" ? "" : "error");
  }
  render();
  return true;
}
function reconcilePending() {
  const pub = DATA.published_at || "";
  let pending = store.get("pending", []);
  pending = pending.filter((p) => !(p.sent && p.created_at <= pub));
  store.set("pending", pending);
  pending.forEach((p) => applyLocal(p.route, p.payload, p.id));
}
async function retryPending() {
  const pending = store.get("pending", []);
  let ok = 0;
  for (const p of pending.filter((x) => !x.sent)) {
    try { await sendToInbox(p); p.sent = true; ok++; } catch (e) { toast(e.message === "no-token" ? "Add a GitHub token first." : e.message, "error"); break; }
  }
  store.set("pending", pending);
  if (ok) toast(`Sent ${ok} entr${ok === 1 ? "y" : "ies"} to the PC inbox`);
  render();
}

/* ================================================================== charts */
const CHARTS = {};
let chartSeq = 0;
function chart(spec) { const id = "c" + (++chartSeq); CHARTS[id] = spec; return `<div class="chart" data-chart="${id}" style="height:${spec.height || 180}px"></div>`; }
function niceMax(v) { if (!v || v <= 0) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return ([1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((x) => n <= x) || 10) * p; }
function drawCharts() {
  $$("[data-chart]").forEach((el) => {
    const spec = CHARTS[el.dataset.chart];
    if (!spec) return;
    const w = el.clientWidth || 320, h = spec.height || 180;
    el.innerHTML = spec.type === "line" ? lineSVG(spec, w, h) : barSVG(spec, w, h);
  });
}
function yAxis(max, w, h, m, fmt) {
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, y = m.t + (h - m.t - m.b) * (1 - i / 4);
    g += `<line class="gridline" x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}"/>`;
    if (i % 2 === 0) g += `<text class="axis" x="${m.l - 6}" y="${y + 4}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  return g;
}
function xLabels(data, x, h, m, w) {
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor((w - m.l) / 58))));
  return data.map((d, i) => (i % every === 0 || i === data.length - 1) && d.xl !== false
    ? `<text class="axis" x="${x(i)}" y="${h - 4}" text-anchor="middle">${esc(d.xl ?? d.label)}</text>` : "").join("");
}
function barSVG(spec, w, h) {
  const m = { t: 14, r: 8, b: 22, l: 40 }, data = spec.data;
  const max = Math.max(spec.minMax || 0, niceMax(Math.max(spec.goal || 0, ...data.map((d) => d.v || 0)) * 1.05));
  const iw = w - m.l - m.r, ih = h - m.t - m.b, step = iw / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(28, step - 2));
  const x = (i) => m.l + step * i + step / 2, y = (v) => m.t + ih * (1 - v / max);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(spec.label || "")}">`;
  s += yAxis(max, w, h, m, spec.yfmt || ((v) => fmtN(v)));
  data.forEach((d, i) => {
    const v = d.v || 0, top = y(v), bh = Math.max(0, m.t + ih - top), r = Math.min(4, bw / 2, bh);
    const x0 = x(i) - bw / 2, base = m.t + ih;
    if (bh > 0) s += `<path d="M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${base} Z" fill="${spec.color}" ${d.dim ? 'class="dim"' : ""}/>`;
    s += `<rect class="hit" x="${m.l + step * i}" y="${m.t}" width="${step}" height="${ih}" data-tip="${esc(d.tip || "")}"/>`;
  });
  if (spec.goal) {
    const gy = y(spec.goal);
    s += `<line class="goal" x1="${m.l}" x2="${w - m.r}" y1="${gy}" y2="${gy}"/><text class="goal-l" x="${w - m.r}" y="${gy - 5}" text-anchor="end">${esc(spec.goalLabel || "Goal")}</text>`;
  }
  s += xLabels(data, x, h, m, w);
  return s + "</svg>";
}
function lineSVG(spec, w, h) {
  const m = { t: 16, r: 10, b: 22, l: 44 }, n = spec.x.length;
  const all = spec.series.flatMap((se) => se.values.filter((v) => v != null));
  const lo = spec.min != null ? spec.min : 0;
  const hi = spec.max != null ? spec.max : niceMax(Math.max(...all, spec.ref || 0) * 1.05);
  const iw = w - m.l - m.r, ih = h - m.t - m.b;
  const x = (i) => m.l + (n <= 1 ? iw / 2 : (iw * i) / (n - 1)), y = (v) => m.t + ih * (1 - (v - lo) / (hi - lo || 1));
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(spec.label || "")}">`;
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) / 4) * i, yy = y(v);
    s += `<line class="gridline" x1="${m.l}" x2="${w - m.r}" y1="${yy}" y2="${yy}"/>`;
    if (i % 2 === 0) s += `<text class="axis" x="${m.l - 6}" y="${yy + 4}" text-anchor="end">${esc((spec.yfmt || fmtN)(v))}</text>`;
  }
  if (spec.ref != null) { const ry = y(spec.ref); s += `<line class="goal" x1="${m.l}" x2="${w - m.r}" y1="${ry}" y2="${ry}"/><text class="goal-l" x="${w - m.r}" y="${ry - 5}" text-anchor="end">${esc(spec.refLabel || "")}</text>`; }
  spec.series.forEach((se) => {
    let d = "", pen = false;
    se.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${se.dash ? 'stroke-dasharray="5 5"' : ""}/>`;
    if (se.dots) se.values.forEach((v, i) => { if (v != null) s += `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/>`; });
    if (se.endLabel) { let li = -1; se.values.forEach((v, i) => { if (v != null) li = i; }); if (li >= 0) s += `<text class="axis" x="${Math.min(x(li) + 6, w - 4)}" y="${y(se.values[li]) - 8}" text-anchor="${x(li) > w - 70 ? "end" : "start"}" style="font-weight:700;fill:var(--ink-2)">${esc(se.endLabel)}</text>`; }
  });
  const step = iw / Math.max(1, n - 1);
  spec.x.forEach((xv, i) => { s += `<rect class="hit" x="${x(i) - step / 2}" y="${m.t}" width="${step}" height="${ih}" data-tip="${esc(spec.tip(i))}"/>`; });
  s += xLabels(spec.x.map((l) => ({ label: l })), x, h, m, w);
  return s + "</svg>";
}
function showTip(target, ev) {
  const tip = $("#tooltip"), html = target.getAttribute("data-tip");
  if (!html) return hideTip();
  tip.innerHTML = html; tip.hidden = false;
  const r = tip.getBoundingClientRect();
  const px = ev.clientX ?? target.getBoundingClientRect().left, py = ev.clientY ?? target.getBoundingClientRect().top;
  tip.style.left = clamp(px - r.width / 2, 8, innerWidth - r.width - 8) + "px";
  tip.style.top = Math.max(8, py - r.height - 14) + "px";
}
const hideTip = () => { $("#tooltip").hidden = true; };

/* ================================================================== shared bits */
function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`; el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), kind === "error" ? 6000 : 3200);
}
const pill = (tone, ic, text) => `<span class="pill ${tone}">${icon(ic)}${esc(text)}</span>`;
function taskRow(t) {
  const d = taskDay(t), late = d && d < todayISO();
  const pr = { 5: "High", 3: "Medium", 1: "Low" }[t.priority];
  return `<div class="task p${t.priority}">
    <button class="check" role="checkbox" aria-checked="false" aria-label="Complete ${esc(t.title)}" data-act="tt-done" data-id="${esc(t.id)}">${icon("check")}</button>
    <div class="t"><b>${esc(t.title)}</b><div class="meta">${d ? `<span class="${late ? "late" : ""}">${late ? "Overdue · " : ""}${esc(relDay(d))}</span>` : ""}${t.list ? `<span>${esc(t.list)}</span>` : ""}</div></div>
    ${pr ? `<span class="flag" style="color:var(--pc)">${pr}</span>` : "<span></span>"}
  </div>`;
}
function freshness() {
  const stamp = DATA.published_at || DATA.generated_at, h = ageHours(stamp);
  const cls = h < 6 ? "" : h < 30 ? "stale" : "old";
  return `<span class="fresh ${cls}"><i></i>${MODE.kind === "local" ? "On this PC" : "Updated"} ${esc(sinceText(stamp))}</span>`;
}

/* ================================================================== pages */
const PAGES = [
  { id: "today", name: "Today", ic: "today" },
  { id: "tasks", name: "Tasks", ic: "tasks" },
  { id: "work", name: "Work", ic: "work" },
  { id: "health", name: "Health", ic: "health" },
  { id: "money", name: "Money", ic: "money" },
];
function greeting() { const h = new Date().getHours(); return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }

function officeLine() {
  const s = S(), t = todayISO(), a = IDX.att[t], info = dayInfo(t);
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), end = toMin(s.shift_end || "17:00");
  const cw = cycleWork(cycleBounds(0));
  if (a && a.in && !a.out) {
    const left = end - nowMin;
    return left > 0 ? `In at <b>${fmtClock(a.in)}</b>. Leave at <b>${fmtClock(end)}</b>, ${fmtHM(left)} to go.` : `In at <b>${fmtClock(a.in)}</b>. It's past ${fmtClock(end)}, you can leave without using variance.`;
  }
  if (a && a.in && a.out) return `Worked <b>${fmtClock(a.in)} to ${fmtClock(a.out)}</b>. ${a.variance ? `${a.variance} min variance today.` : "No variance used today."}`;
  if (info.type === "holiday") return `Day off: <b>${esc(info.label)}</b>.`;
  if (info.type === "planned") return "<b>Planned casual leave</b> today.";
  if (info.type === "leave") return `<b>${esc(info.label)}</b> today.`;
  if (nowMin < toMin(s.shift_start || "09:00")) return `Office starts at <b>${fmtClock(s.shift_start || "09:00")}</b>. ${cw.left} min of variance left this cycle.`;
  return IDX.attLatest && IDX.attLatest < t ? `No punch yet. MyPunch data ends ${esc(fmtDate(IDX.attLatest))}, sync on the PC.` : "No punch-in recorded yet today.";
}
function dayStrip() {
  const s = S(), t = todayISO(), a = IDX.att[t];
  const pct = (min) => clamp((min / 1440) * 100, 0, 100);
  const dayStart = parseISO(t).getTime();
  const toDayMin = (d) => (d.getTime() - dayStart) / 60000;
  let segs = "", key = [];
  const sl = sleepFor(t);
  if (sl) {
    const a0 = clamp(toDayMin(sl.s), 0, 1440), a1 = clamp(toDayMin(sl.e), 0, 1440);
    if (a1 > a0) { segs += `<div class="seg sleep" style="left:${pct(a0)}%;width:${pct(a1) - pct(a0)}%" data-tip="${esc(`<b>Sleep</b><br>${fmtClock(sl.s.getHours() * 60 + sl.s.getMinutes())} to ${fmtClock(sl.e.getHours() * 60 + sl.e.getMinutes())}<br>${fmtHM(sl.asleep)} asleep`)}"></div>`; key.push(`<span><i style="background:var(--s-sleep)"></i>Sleep ${fmtHM(sl.asleep)}</span>`); }
  }
  const ss = toMin(s.shift_start || "09:00"), se = toMin(s.shift_end || "17:00");
  segs += `<div class="seg shift" style="left:${pct(ss)}%;width:${pct(se) - pct(ss)}%"></div>`;
  key.push(`<span><i style="border:2px dashed var(--ink-3);width:12px;height:12px"></i>Office ${fmtClock(ss)} to ${fmtClock(se)}</span>`);
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  if (a && a.in) {
    const i0 = toMin(a.in), i1 = a.out ? toMin(a.out) : nowMin;
    if (i1 > i0) segs += `<div class="seg work ${a.out ? "" : "open"}" style="left:${pct(i0)}%;width:${pct(i1) - pct(i0)}%" data-tip="${esc(`<b>At work</b><br>In ${fmtClock(i0)}${a.out ? `, out ${fmtClock(i1)}` : ", still in"}<br>${fmtHM(i1 - i0)}`)}"></div>`;
    key.push(`<span><i style="background:var(--accent)"></i>${a.out ? "Worked" : "At work"} ${fmtHM(i1 - i0)}</span>`);
  }
  segs += `<div class="now" style="left:${pct(nowMin)}%" title="Now"></div>`;
  const axis = [0, 6, 12, 18, 24].map((hh) => `<span style="left:${clamp((hh / 24) * 100, 3, 97)}%">${hh === 0 || hh === 24 ? "12am" : hh === 12 ? "12pm" : hh > 12 ? `${hh - 12}pm` : `${hh}am`}</span>`).join("");
  return `<div class="daystrip" aria-label="Your day so far"><div class="strip">${segs}</div><div class="strip-axis">${axis}</div><div class="strip-key">${key.join("")}</div></div>`;
}

function renderToday() {
  const s = S(), t = todayISO(), h = IDX.health[t] || {};
  const name = DATA.profile?.display_name || "";
  const cw = cycleWork(cycleBounds(0)), cm = cycleMoney(cycleBounds(0));
  const spentToday = sum(cm.spendRows.filter((e) => e.date === t), (e) => e.amount);
  const stepsPct = clamp(((h.steps || 0) / (s.steps_goal || 8000)) * 100, 0, 100);
  const sleepPct = clamp(((h.sleep || 0) / ((s.sleep_goal_hours || 8) * 60)) * 100, 0, 100);
  const varPct = clamp((cw.used / (cw.limit || 1)) * 100, 0, 100);
  const g = taskGroups(), due = [...g.overdue, ...g.today];
  const c = IDX.checkin[t] || {};
  const br = briefing();
  const evening = new Date().getHours() >= 17;
  const hasHealthToday = h.steps != null;
  const latestH = (DATA.health?.daily || []).slice(-1)[0];

  return `<div class="page">
    <div class="hero">
      <div><p class="hi">${greeting()}${name ? `, ${esc(name)}` : ""}</p><p class="big">${esc(fmtDate(t, true))}</p></div>
      <p class="status">${officeLine()}</p>
      ${dayStrip()}
    </div>

    <div class="vitals">
      <button class="vital" data-go="health">
        <span class="lab">${icon("steps")}Steps${hasHealthToday ? "" : ` · ${esc(latestH ? relDay(latestH.date) : "no data")}`}</span>
        <span class="val">${fmtN(hasHealthToday ? h.steps : latestH?.steps)}<small> / ${fmtN(s.steps_goal)}</small></span>
        <div class="meter" style="--c:var(--s-steps)"><i style="width:${hasHealthToday ? stepsPct : 0}%"></i></div>
      </button>
      <button class="vital" data-go="health">
        <span class="lab">${icon("moon")}Sleep last night</span>
        <span class="val">${h.sleep ? fmtHM(h.sleep) : "–"}</span>
        <div class="meter" style="--c:var(--s-sleep)"><i style="width:${sleepPct}%"></i></div>
      </button>
      <button class="vital" data-go="money">
        <span class="lab">${icon("wallet")}Spent today</span>
        <span class="val">${inr(spentToday)}</span>
        <span class="sub">${cm.left > 0 ? `${inr(cm.safeDaily)} a day keeps you on budget` : `Over budget by ${inr(-cm.left)}`}</span>
      </button>
      <button class="vital" data-go="work">
        <span class="lab">${icon("clock")}Variance left</span>
        <span class="val">${fmtN(Math.max(cw.left, 0))}<small> min</small></span>
        <div class="meter" style="--c:${varPct > 85 ? "var(--bad)" : varPct > 60 ? "var(--warn)" : "var(--good)"}"><i style="width:${varPct}%"></i></div>
      </button>
    </div>

    <section class="card">
      <div class="card-h"><h2>Due today</h2><button class="link" data-go="tasks">All tasks</button></div>
      ${ttToken() || TT.open.length ? (due.length ? `<div class="tasks">${due.slice(0, 7).map(taskRow).join("")}</div>${due.length > 7 ? `<p class="muted">${due.length - 7} more on the Tasks tab</p>` : ""}` : `<p class="soft">Nothing due today${g.week.length ? `. Next: ${esc(g.week[0].title)} (${esc(relDay(taskDay(g.week[0])))})` : ""}.</p>`)
      : `<div class="empty">Connect TickTick to see today's tasks here.<button class="btn sm" data-act="settings">Add TickTick token</button></div>`}
      ${ttToken() ? `<form class="quickadd" data-form="quick-task"><input type="text" name="title" placeholder="Add a task for today" aria-label="New task for today" autocomplete="off"><button class="btn primary" aria-label="Add task">${icon("plus")}</button></form>` : ""}
    </section>

    ${checkinCard(c, evening)}

    <section class="card">
      <div class="card-h"><h2>Briefing</h2>${geminiKey() ? `<button class="link" data-act="briefing">${br ? "Write a new one" : "Write it"}</button>` : ""}</div>
      ${br ? md(br.md) : geminiKey() ? `<p class="soft">Gemini writes a short plan for the day from your numbers.</p><button class="btn primary" data-act="briefing">${icon("spark")}Write today's briefing</button>` : `<div class="empty">Add a Gemini API key in Settings to get a daily briefing and the coach.<button class="btn sm" data-act="settings">Open Settings</button></div>`}
    </section>

    ${upcoming().length ? `<section class="card"><div class="card-h"><h2>Coming up</h2></div><div class="list">${upcoming().map((u) => `<div class="li"><div class="a"><b>${esc(u.what)}</b><span>${esc(u.kind)}</span></div><div class="z">${esc(relDay(u.d))}<small>${esc(fmtDate(u.d))}</small></div></div>`).join("")}</div></section>` : ""}
  </div>`;
}
const MOODS = [{ v: 1, e: "😫", t: "Rough" }, { v: 2, e: "😕", t: "Low" }, { v: 3, e: "😐", t: "Okay" }, { v: 4, e: "🙂", t: "Good" }, { v: 5, e: "😄", t: "Great" }];
const ENERGY = [{ v: 1, e: "🪫", t: "Empty" }, { v: 2, e: "🥱", t: "Low" }, { v: 3, e: "🙂", t: "Steady" }, { v: 4, e: "⚡", t: "High" }, { v: 5, e: "🚀", t: "Peak" }];
function checkinCard(c, evening) {
  const prios = [...(c.priorities || [])];
  while (prios.length < 3) prios.push({ text: "", done: false });
  const faces = (arr, field) => `<div class="faces" role="group" aria-label="${field}">${arr.map((m) => `<button type="button" class="face" aria-pressed="${Number(c[field]) === m.v}" data-act="ci-rate" data-field="${field}" data-v="${m.v}"><span>${m.e}</span>${m.t}</button>`).join("")}</div>`;
  return `<section class="card">
    <div class="card-h"><h2>${evening ? "Evening check-in" : "Check-in"}</h2>${c.updated_at || c._pending ? `<span class="muted" style="font-size:.8rem">${c._pending ? "saved on phone" : "saved"}</span>` : ""}</div>
    <form data-form="checkin" class="page" style="gap:12px;padding:0">
      <label class="f">Mood${faces(MOODS, "mood")}</label>
      <label class="f">Energy${faces(ENERGY, "energy")}</label>
      <label class="f">Intention for today<input type="text" name="intention" value="${esc(c.intention || "")}" placeholder="One line: what would make today good?"></label>
      <div class="f" style="display:grid;gap:6px;font-size:.85rem;color:var(--ink-2)">Top 3 priorities
        ${prios.slice(0, 3).map((p, i) => `<div class="prio"><button type="button" class="check" role="checkbox" aria-checked="${!!p.done}" aria-label="Priority ${i + 1} done" data-act="ci-prio" data-i="${i}">${icon("check")}</button><input type="text" name="p${i}" value="${esc(p.text || "")}" placeholder="Priority ${i + 1}"></div>`).join("")}
      </div>
      ${evening || c.win ? `<label class="f">Win of the day<input type="text" name="win" value="${esc(c.win || "")}" placeholder="Something that went right"></label>` : ""}
      <button class="btn primary">Save check-in</button>
    </form>
  </section>`;
}

function renderTasks() {
  const g = taskGroups();
  const t = todayISO();
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
  const doneBy = {};
  TT.done.forEach((x) => { const d = ttDate(x.completedTime); if (d) { const k = iso(d); doneBy[k] = (doneBy[k] || 0) + 1; } });
  const when = STATE.taskWhen;
  const section = (title, arr, open = true) => arr.length ? `<div class="group-h">${esc(title)} <span class="n">${arr.length}</span></div><div class="tasks">${arr.slice(0, open ? 50 : 0).map(taskRow).join("")}</div>` : "";
  if (!ttToken() && !TT.open.length) {
    return `<div class="page"><div class="page-h"><h1>Tasks</h1></div><section class="card"><div class="empty">
      <b>Connect TickTick</b>
      <p>In the TickTick web app open your avatar &gt; Settings &gt; Account &gt; API Token, create a token and paste it in Settings here${MODE.kind === "local" ? " (it is saved on the PC and goes to the phone, encrypted)" : ""}.</p>
      <button class="btn primary" data-act="settings">Open Settings</button></div></section></div>`;
  }
  return `<div class="page">
    <div class="page-h"><h1>Tasks</h1><p class="muted">${TT.loading ? "Refreshing from TickTick…" : TT.source === "live" ? `Live from TickTick${TT.error ? "" : ""}` : `From the PC sync ${esc(sinceText(DATA.tasks?.synced_at))}`}${TT.error ? ` · ${esc(TT.error)}` : ""}</p></div>
    <section class="card">
      <form data-form="task" class="page" style="gap:10px;padding:0">
        <input type="text" name="title" placeholder="What needs doing?" aria-label="Task title" autocomplete="off">
        <div class="chips" role="group" aria-label="When">
          ${[["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "Next week"], ["none", "No date"]].map(([v, l]) => `<button type="button" class="chip" aria-pressed="${when === v}" data-act="task-when" data-v="${v}">${l}</button>`).join("")}
        </div>
        <div class="row2">
          <select name="priority" aria-label="Priority"><option value="0">No priority</option><option value="1">Low</option><option value="3">Medium</option><option value="5">High</option></select>
          <select name="projectId" aria-label="List">${(TT.projects.length ? TT.projects : [{ id: "inbox", name: "Inbox" }]).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select>
        </div>
        <button class="btn primary">${icon("plus")}Add to TickTick</button>
      </form>
    </section>
    <section class="card">
      <div class="card-h"><h2>Open</h2><button class="link" data-act="tt-refresh">${icon("sync", "")} Refresh</button></div>
      ${TT.open.length ? section("Overdue", g.overdue) + section("Today", g.today) + section("Next 7 days", g.week) + section("Later", g.later) + section("No date", g.none) : `<p class="soft">No open tasks. Enjoy it.</p>`}
    </section>
    <section class="card">
      <div class="card-h"><h2>Done in the last 14 days</h2><span class="num">${sum(days, (d) => doneBy[d] || 0)}</span></div>
      ${chart({ type: "bar", height: 150, color: "var(--accent)", label: "Tasks completed per day", minMax: 4, yfmt: (v) => fmtN(v), data: days.map((d) => ({ label: d, xl: String(parseISO(d).getDate()), v: doneBy[d] || 0, tip: `<b>${fmtDate(d, true)}</b><br>${doneBy[d] || 0} done` })) })}
    </section>
  </div>`;
}

function renderWork() {
  const c = cycleBounds(STATE.workCycle), cw = cycleWork(c), s = S();
  const t = todayISO();
  const len = daysBetween(c.start, c.end) + 1, dayN = clamp(daysBetween(c.start, t) + 1, 0, len);
  const varTone = cw.left < 0 ? "bad" : cw.used / cw.limit > 0.7 ? "warn" : "good";
  const first = parseISO(c.start), lead = (first.getDay() + 6) % 7;
  let cells = Array.from({ length: lead }, () => `<button class="out" tabindex="-1" aria-hidden="true"></button>`).join("");
  for (let d = c.start; d <= c.end; d = addDays(d, 1)) {
    const info = dayInfo(d), a = info.att;
    let cls = info.type === "work" ? "work" : info.type === "holiday" ? "off" : info.type === "leave" ? "leave" : info.type === "planned" ? "planned" : "";
    if (a && a.variance) cls += " var";
    if (d === t) cls += " today";
    const mark = info.type === "work" ? (a.variance ? `+${a.variance}m` : fmtClock(a.in).replace(" am", "").replace(" pm", "")) : info.type === "holiday" ? "off" : info.type === "leave" ? "leave" : info.type === "planned" ? "CL" : "";
    cells += `<button class="${cls}" data-act="day" data-d="${d}" aria-label="${esc(fmtDate(d, true))}: ${esc(info.label || "no record")}"><span class="d">${parseISO(d).getDate()}</span><span class="m">${esc(mark)}</span>${IDX.cal[d]?.note ? '<span class="note"></span>' : ""}</button>`;
  }
  const workDays = cw.rows.filter((a) => a.in);
  const ss = toMin(s.shift_start || "09:00");
  return `<div class="page">
    <div class="page-h"><h1>Work</h1>
      <div class="btnrow" style="align-items:center"><button class="btn sm ghost" data-act="wc" data-v="-1" aria-label="Previous cycle">‹</button><span class="soft">${esc(fmtDate(c.start))} to ${esc(fmtDate(c.end))}${STATE.workCycle === 0 ? ` · day ${dayN} of ${len}` : ""}</span><button class="btn sm ghost" data-act="wc" data-v="1" aria-label="Next cycle" ${STATE.workCycle >= 0 ? "disabled" : ""}>›</button></div>
    </div>
    <section class="card">
      <div class="card-h"><h2>Variance</h2>${pill(varTone, varTone === "good" ? "ok" : "alert", varTone === "good" ? "On track" : varTone === "warn" ? "Getting close" : "Over the limit")}</div>
      <p><span class="num" style="font-size:2rem;font-weight:800">${fmtN(cw.used)}</span> <span class="soft">of ${fmtN(cw.limit)} min used</span></p>
      <div class="meter" style="height:10px;--c:var(--${varTone === "good" ? "good" : varTone})"><i style="width:${clamp((cw.used / cw.limit) * 100, 0, 100)}%"></i></div>
      <div class="stats">
        <div class="stat"><span class="k">Days present</span><span class="v">${cw.present}</span></div>
        <div class="stat"><span class="k">Avg arrival</span><span class="v">${cw.avgIn != null ? fmtClock(cw.avgIn) : "–"}</span></div>
        <div class="stat"><span class="k">Casual leave</span><span class="v">${cw.leave.total} / ${cw.leave.limit}</span></div>
      </div>
    </section>
    <section class="card">
      <div class="card-h"><h2>Cycle calendar</h2></div>
      <div class="cal">${["M", "T", "W", "T", "F", "S", "S"].map((x) => `<span class="dow">${x}</span>`).join("")}${cells}</div>
      <div class="strip-key"><span><i style="background:color-mix(in srgb,var(--accent) 40%,var(--surface-2))"></i>Worked (arrival or variance)</span><span><i style="border:1px solid var(--line)"></i>Off</span><span><i style="border:2px dashed var(--s-sleep)"></i>Planned CL</span><span><i style="background:color-mix(in srgb,var(--bad) 35%,var(--surface-2))"></i>Leave</span></div>
      <p class="muted" style="font-size:.85rem">Tap a day to mark a holiday, plan leave, add a note or log petrol.</p>
    </section>
    ${workDays.length > 1 ? `<section class="card"><div class="card-h"><h2>Arrival time</h2></div>
      ${chart({ type: "line", height: 170, label: "Arrival time per working day", x: workDays.map((a) => String(parseISO(a.date).getDate())), min: Math.min(ss - 30, ...workDays.map((a) => toMin(a.in))) , max: Math.max(ss + 45, ...workDays.map((a) => toMin(a.in) + 5)),
        yfmt: (v) => fmtClock(v), ref: ss, refLabel: `Shift ${fmtClock(ss)}`, series: [{ values: workDays.map((a) => toMin(a.in)), color: "var(--accent)", dots: true }],
        tip: (i) => `<b>${fmtDate(workDays[i].date, true)}</b><br>In ${fmtClock(workDays[i].in)}${workDays[i].out ? `, out ${fmtClock(workDays[i].out)}` : ""}${workDays[i].variance ? `<br>${workDays[i].variance} min variance` : ""}` })}
    </section>` : ""}
    <section class="card"><div class="card-h"><h2>Recent punches</h2></div>
      <div class="list">${(DATA.attendance || []).filter((a) => a.in).slice(-6).reverse().map((a) => `<div class="li"><div class="a"><b>${esc(fmtDate(a.date, true))}</b><span>${a.variance ? `${a.variance} min variance` : "No variance"}</span></div><div class="z">${fmtClock(a.in)}<small>${a.out ? `to ${fmtClock(a.out)}` : "still in"}</small></div></div>`).join("")}</div>
    </section>
  </div>`;
}

function renderHealth() {
  const s = S(), r = STATE.healthRange, t = todayISO();
  const days = Array.from({ length: r }, (_, i) => addDays(t, i - r + 1));
  const rows = days.map((d) => ({ d, h: IDX.health[d] || {} }));
  const withSteps = rows.filter((x) => x.h.steps > 0), withSleep = rows.filter((x) => x.h.sleep > 0);
  const st = healthStreaks();
  const hit = withSteps.filter((x) => x.h.steps >= s.steps_goal).length;
  const rhr = rows.filter((x) => x.h.rhr > 0);
  const lbl = (d) => r <= 7 ? DAYS[parseISO(d).getDay()] : String(parseISO(d).getDate());
  const ex = (DATA.health?.exercises || []).slice(0, 6);
  const moodRows = (DATA.checkins || []).filter((c) => c.mood && c.energy).slice(-14);
  return `<div class="page">
    <div class="page-h"><h1>Health</h1>
      <div class="seg-ctl" role="group" aria-label="Range">${[7, 30, 90].map((v) => `<button aria-pressed="${r === v}" data-act="hr" data-v="${v}">${v} days</button>`).join("")}</div>
    </div>
    <div class="stats">
      <div class="stat"><span class="k">Avg steps</span><span class="v">${fmtN(avg(withSteps.map((x) => x.h.steps)))}</span></div>
      <div class="stat"><span class="k">Avg sleep</span><span class="v">${withSleep.length ? fmtHM(avg(withSleep.map((x) => x.h.sleep))) : "–"}</span></div>
      <div class="stat"><span class="k">Resting HR</span><span class="v">${rhr.length ? fmtN(rhr[rhr.length - 1].h.rhr) : "–"}</span></div>
    </div>
    <section class="card">
      <div class="card-h"><h2>Steps</h2><span class="soft" style="font-size:.85rem">goal hit ${hit} of ${withSteps.length} days · streak ${st.steps}</span></div>
      ${chart({ type: "bar", height: 190, color: "var(--s-steps)", goal: s.steps_goal, goalLabel: `Goal ${fmtN(s.steps_goal)}`, label: "Steps per day", yfmt: (v) => v >= 1000 ? `${Math.round(v / 1000)}k` : fmtN(v),
        data: rows.map((x) => ({ label: x.d, xl: lbl(x.d), v: x.h.steps || 0, tip: `<b>${fmtDate(x.d, true)}</b><br>${x.h.steps ? `${fmtN(x.h.steps)} steps${x.h.km ? `, ${fmtN(x.h.km, 1)} km` : ""}` : "No data"}` })) })}
    </section>
    <section class="card">
      <div class="card-h"><h2>Sleep</h2><span class="soft" style="font-size:.85rem">streak ${st.sleep} nights at ${s.sleep_goal_hours} h</span></div>
      ${chart({ type: "bar", height: 190, color: "var(--s-sleep)", goal: s.sleep_goal_hours, goalLabel: `Goal ${s.sleep_goal_hours} h`, label: "Hours asleep per night", yfmt: (v) => `${fmtN(v, v % 1 ? 1 : 0)}h`,
        data: rows.map((x) => ({ label: x.d, xl: lbl(x.d), v: (x.h.sleep || 0) / 60, tip: `<b>${fmtDate(x.d, true)}</b><br>${x.h.sleep ? `${fmtHM(x.h.sleep)} asleep` : "No data"}` })) })}
    </section>
    ${moodRows.length > 2 ? `<section class="card"><div class="card-h"><h2>Mood and energy</h2></div>
      <div class="legend"><span><i style="background:var(--accent)"></i>Mood</span><span><i style="background:var(--s-steps)"></i>Energy</span></div>
      ${chart({ type: "line", height: 150, min: 1, max: 5, label: "Mood and energy from check-ins", x: moodRows.map((c) => fmtDate(c.date)), yfmt: (v) => fmtN(v), series: [{ values: moodRows.map((c) => c.mood || null), color: "var(--accent)", dots: true, endLabel: "Mood" }, { values: moodRows.map((c) => c.energy || null), color: "var(--s-steps)", dots: true, endLabel: "Energy" }], tip: (i) => `<b>${fmtDate(moodRows[i].date, true)}</b><br>Mood ${moodRows[i].mood || "–"} / 5<br>Energy ${moodRows[i].energy || "–"} / 5` })}
    </section>` : ""}
    ${ex.length ? `<section class="card"><div class="card-h"><h2>Recent workouts</h2></div><div class="list">${ex.map((e) => `<div class="li"><div class="a"><b>${esc(e.activity_type || "Workout")}</b><span>${esc(relDay(e.date))}</span></div><div class="z">${fmtHM(e.duration_minutes)}<small>${e.distance_meters ? `${fmtN(e.distance_meters / 1000, 1)} km` : e.steps ? `${fmtN(e.steps)} steps` : ""}</small></div></div>`).join("")}</div></section>` : ""}
    <p class="muted" style="font-size:.8rem;padding:0 4px">Google Health synced ${esc(sinceText(DATA.sync?.health))}.</p>
  </div>`;
}

function renderMoney() {
  const c = cycleBounds(STATE.moneyCycle), cm = cycleMoney(c), t = todayISO();
  const days = []; for (let d = c.start; d <= c.end; d = addDays(d, 1)) days.push(d);
  let run = 0;
  const cum = days.map((d) => { if (d > t) return null; run += sum(cm.spendRows.filter((e) => e.date === d), (e) => e.amount); return run; });
  const pace = days.map((_, i) => (cm.budget * (i + 1)) / days.length);
  const idxToday = days.indexOf(t), expected = idxToday >= 0 ? pace[idxToday] : cm.budget;
  const ahead = cm.spent - expected;
  const tone = cm.left < 0 ? "bad" : ahead > cm.budget * 0.05 ? "warn" : "good";
  const cats = Object.entries(cm.byCat).sort((a, b) => b[1] - a[1]);
  const top = cats[0]?.[1] || 1;
  const q = STATE.txQuery.toLowerCase();
  const tx = cm.rows.filter((e) => (!STATE.txCat || (e.category || "Uncategorised") === STATE.txCat) && (!q || `${e.description} ${e.category} ${e.notes} ${e.account}`.toLowerCase().includes(q)));
  const ps = petrolStats();
  return `<div class="page">
    <div class="page-h"><h1>Money</h1>
      <div class="btnrow" style="align-items:center"><button class="btn sm ghost" data-act="mc" data-v="-1" aria-label="Previous cycle">‹</button><span class="soft">${esc(fmtDate(c.start))} to ${esc(fmtDate(c.end))}</span><button class="btn sm ghost" data-act="mc" data-v="1" aria-label="Next cycle" ${STATE.moneyCycle >= 0 ? "disabled" : ""}>›</button></div>
    </div>
    <section class="card">
      <div class="card-h"><h2>Budget</h2>${pill(tone, tone === "good" ? "ok" : "alert", tone === "good" ? "Within pace" : tone === "warn" ? `${inr(ahead)} ahead of pace` : "Over budget")}</div>
      <p><span class="num" style="font-size:2rem;font-weight:800">${inr(cm.spent)}</span> <span class="soft">of ${inr(cm.budget)}</span></p>
      <div class="stats">
        <div class="stat"><span class="k">Left</span><span class="v">${inr(cm.left)}</span></div>
        <div class="stat"><span class="k">Per day left</span><span class="v">${STATE.moneyCycle === 0 ? inr(cm.safeDaily) : "–"}</span></div>
        <div class="stat"><span class="k">Money in</span><span class="v">${compactINR(cm.income)}</span></div>
      </div>
      <div class="legend"><span><i style="background:var(--s-spend)"></i>Spent so far</span><span><i class="dash"></i>Even pace to ${compactINR(cm.budget)}</span></div>
      ${chart({ type: "line", height: 180, label: "Cumulative spending against an even budget pace", x: days.map((d) => String(parseISO(d).getDate())), yfmt: compactINR,
        series: [{ values: pace, color: "var(--s-budget)", dash: true }, { values: cum, color: "var(--s-spend)", endLabel: compactINR(cm.spent) }],
        tip: (i) => `<b>${fmtDate(days[i], true)}</b><br>${cum[i] != null ? `Spent ${inr(cum[i])}<br>` : ""}Pace ${inr(pace[i])}` })}
      <p class="muted" style="font-size:.8rem">Transfers and savings are not counted as spending. FinArt synced ${esc(sinceText(DATA.sync?.finart))}.</p>
    </section>
    <section class="card">
      <div class="card-h"><h2>Where it went</h2></div>
      ${cats.length ? cats.slice(0, 8).map(([k, v]) => `<button class="hbar" style="background:none;border:0;padding:4px 0;text-align:left" data-act="cat" data-v="${esc(k)}"><span class="nm">${esc(k)}</span><span class="bar"><i style="width:${(v / top) * 100}%"></i></span><span class="vv">${inr(v)}</span></button>`).join("") : `<p class="soft">No spending yet this cycle.</p>`}
    </section>
    <section class="card">
      <div class="card-h"><h2>Transactions</h2><button class="link" data-act="expense">${icon("plus")} Add</button></div>
      <input type="search" placeholder="Search merchant, category, note" value="${esc(STATE.txQuery)}" data-input="txq" aria-label="Search transactions">
      ${STATE.txCat ? `<div class="chips"><button class="chip" aria-pressed="true" data-act="cat" data-v="">${esc(STATE.txCat)} ✕</button></div>` : ""}
      <div class="list">${tx.slice(0, STATE.txAll ? 300 : 15).map((e) => `<button class="li ${e._pending ? "pending" : ""}" data-act="tx" data-id="${esc(e.id)}"><div class="a"><b>${esc(e.description || "Transaction")}</b><span>${esc(e.category || "Uncategorised")} · ${esc(relDay(e.date))}${e.notes ? ` · ${esc(e.notes)}` : ""}</span></div><div class="z" style="${e.type === "Credit" ? "color:var(--good)" : ""}">${e.type === "Credit" ? "+" : ""}${inr(e.amount)}<small>${esc(e.account || "")}</small></div></button>`).join("") || `<p class="soft">No transactions match.</p>`}</div>
      ${tx.length > 15 && !STATE.txAll ? `<button class="btn ghost" data-act="tx-all">Show all ${tx.length}</button>` : ""}
    </section>
    <section class="card">
      <div class="card-h"><h2>Petrol</h2><button class="link" data-act="petrol">${icon("plus")} Log fill</button></div>
      <div class="stats">
        <div class="stat"><span class="k">Last fill</span><span class="v">${ps.last ? esc(relDay(ps.last.fill_date)) : "–"}</span></div>
        <div class="stat"><span class="k">Mileage</span><span class="v">${ps.latestKmpl ? `${fmtN(ps.latestKmpl, 1)}<small class="muted"> km/l</small>` : "–"}</span></div>
        <div class="stat"><span class="k">Cost per km</span><span class="v">${ps.rsPerKm ? inr(ps.rsPerKm, 2) : "–"}</span></div>
      </div>
      ${ps.nextFill ? `<p class="soft">Next fill likely around <b>${esc(fmtDate(ps.nextFill, true))}</b>${ps.avgKmpl ? `. Average ${fmtN(ps.avgKmpl, 1)} km/l over ${ps.legs.length} fills` : ""}${ps.kmPerDay ? `, about ${fmtN(ps.kmPerDay, 0)} km a day` : ""}.</p>` : ""}
      <div class="list">${ps.fills.slice(-4).reverse().map((f) => `<div class="li ${f._pending ? "pending" : ""}"><div class="a"><b>${esc(fmtDate(f.fill_date, true))}</b><span>${f.liters ? `${fmtN(f.liters, 2)} l` : ""}${f.odometer_km ? ` · ${fmtN(f.odometer_km)} km` : ""}${f.note ? ` · ${esc(f.note)}` : ""}</span></div><div class="z">${inr(f.amount)}</div></div>`).join("")}</div>
    </section>
  </div>`;
}

/* ================================================================== sheets */
function openSheet(html, { tall = false, onClose } = {}) {
  const root = $("#sheet-root");
  root.innerHTML = `<div class="scrim" data-act="close-scrim"><div class="sheet ${tall ? "tall" : ""}" role="dialog" aria-modal="true">${html}</div></div>`;
  root._onClose = onClose;
  document.body.style.overflow = "hidden";
  setTimeout(() => { const f = $(".sheet input, .sheet textarea, .sheet select", root); if (f && !("ontouchstart" in window)) f.focus(); }, 60);
}
function closeSheet() { const root = $("#sheet-root"); root.innerHTML = ""; document.body.style.overflow = ""; if (root._onClose) root._onClose(); root._onClose = null; }
const sheetHead = (title) => `<div class="grab"></div><div class="sheet-h"><h2>${esc(title)}</h2><button class="iconbtn" data-act="close" aria-label="Close">${icon("x")}</button></div>`;

function expenseSheet() {
  openSheet(`${sheetHead("Add a transaction")}
    <form data-form="expense" class="page" style="padding:0;gap:12px">
      <div class="row2"><label class="f">Amount (₹)<input type="number" name="amount" inputmode="decimal" step="0.01" min="0" required></label><label class="f">Date<input type="date" name="expense_date" value="${todayISO()}" required></label></div>
      <label class="f">What was it?<input type="text" name="description" placeholder="Merchant or note" required></label>
      <div class="row2"><label class="f">Category<select name="category">${categories().map((c) => `<option ${c === "Misc" ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label class="f">Type<select name="type"><option>Debit</option><option>Credit</option></select></label></div>
      <label class="f">Paid from<input type="text" name="account" value="Cash"></label>
      <button class="btn primary">Save transaction</button>
    </form>`);
}
function txSheet(id) {
  const e = (DATA.expenses || []).find((x) => String(x.id) === String(id));
  if (!e) return;
  const canEdit = !e._pending;
  openSheet(`${sheetHead(e.description || "Transaction")}
    <dl class="kv"><dt>Amount</dt><dd class="num">${e.type === "Credit" ? "+" : ""}${inr(e.amount, 2)}</dd><dt>Date</dt><dd>${esc(fmtDate(e.date, true))}</dd><dt>Account</dt><dd>${esc(e.account || "–")}</dd><dt>Source</dt><dd>${esc(e.source_file === "finart_web_sync" ? "FinArt" : e.source_file || "–")}</dd></dl>
    ${canEdit ? `<form data-form="tx-patch" data-id="${esc(e.id)}" class="page" style="padding:0;gap:12px">
      <label class="f">Category<select name="category">${categories().map((c) => `<option ${c === e.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label class="f">Note<input type="text" name="notes" value="${esc(e.notes || "")}"></label>
      <button class="btn primary">Save changes</button>
    </form>` : `<p class="soft">This entry is still on its way to the PC. You can edit it after the next sync.</p>`}`);
}
function petrolSheet(date = todayISO()) {
  const last = IDX.fuel[IDX.fuel.length - 1];
  openSheet(`${sheetHead("Log a petrol fill")}
    <form data-form="petrol" class="page" style="padding:0;gap:12px">
      <div class="row2"><label class="f">Date<input type="date" name="fill_date" value="${date}" required></label><label class="f">Odometer (km)<input type="number" name="odometer_km" inputmode="numeric" placeholder="${last?.odometer_km ? `last ${fmtN(last.odometer_km)}` : ""}"></label></div>
      <div class="row2"><label class="f">Litres<input type="number" name="liters" inputmode="decimal" step="0.01"></label><label class="f">Amount (₹)<input type="number" name="amount" inputmode="decimal" step="0.01"></label></div>
      <label class="f">Pump or note<input type="text" name="note" value="${esc(last?.note || "")}"></label>
      <button class="btn primary">Save fill</button>
    </form>`);
}
function daySheet(d) {
  const info = dayInfo(d), cal = IDX.cal[d] || {}, a = info.att;
  openSheet(`${sheetHead(fmtDate(d, true))}
    <p class="soft">${a && a.in ? `In ${fmtClock(a.in)}${a.out ? `, out ${fmtClock(a.out)}` : ""}${a.variance ? `, ${a.variance} min variance` : ""}.` : esc(info.label || (d > todayISO() ? "Upcoming day." : "No punch recorded."))}</p>
    <div class="btnrow">
      <button class="btn ${cal.holiday ? "primary" : "ghost"}" data-act="cal-toggle" data-d="${d}" data-t="holiday">${cal.holiday ? "Holiday marked" : "Mark as holiday"}</button>
      <button class="btn ${cal.planned_cl ? "primary" : "ghost"}" data-act="cal-toggle" data-d="${d}" data-t="planned_cl">${cal.planned_cl ? "CL planned" : "Plan casual leave"}</button>
    </div>
    <form data-form="note" data-d="${d}" class="page" style="padding:0;gap:10px">
      <label class="f">Note for this day<input type="text" name="details" value="${esc(cal.note?.details || "")}" placeholder="Exam duty, meeting, travel…"></label>
      <div class="btnrow"><button class="btn primary">Save note</button>${cal.note ? `<button type="button" class="btn danger" data-act="note-del" data-d="${d}">Remove note</button>` : ""}<button type="button" class="btn ghost" data-act="petrol" data-d="${d}">${icon("fuel")}Log petrol</button></div>
    </form>`);
}

/* coach */
const CHAT_IDEAS = ["How am I doing this cycle?", "What should I focus on today?", "Can I afford a ₹3,000 purchase this week?", "Why is my sleep short lately?", "Plan my evening around my tasks"];
function chatHTML() {
  const chat = store.get("chat", []);
  return chat.length ? chat.map((m) => `<div class="bubble ${m.role}">${m.role === "ai" ? md(m.text) : esc(m.text)}</div>`).join("")
    : `<div class="empty"><b>Ask about your own numbers</b><p>The coach sees your attendance, steps, sleep, spending, petrol, check-ins and TickTick tasks${DATA.ai_context ? "" : " (open the phone version once a sync has run)"}.</p><div class="chips">${CHAT_IDEAS.map((q) => `<button class="chip" data-act="ask" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>`;
}
function coachSheet() {
  openSheet(`${sheetHead("Coach")}
    <div class="chat" id="chat">${chatHTML()}</div>
    <div style="display:grid;gap:8px">
      <form class="composer" data-form="ask"><input type="text" name="q" placeholder="Ask Gemini about your day" autocomplete="off" aria-label="Question"><button class="btn primary" aria-label="Send">${icon("send")}</button></form>
      <div class="btnrow"><button class="btn sm ghost" data-act="review">${icon("spark")}Weekly review</button>${store.get("chat", []).length ? `<button class="btn sm ghost" data-act="chat-clear">Clear chat</button>` : ""}</div>
    </div>`, { tall: true });
  const box = $("#chat"); box.scrollTop = box.scrollHeight;
}
async function ask(q) {
  q = (q || "").trim();
  if (!q) return;
  if (!geminiKey()) { toast("Add your Gemini API key in Settings first.", "error"); return; }
  const chat = store.get("chat", []);
  const history = chat.slice(-8);
  chat.push({ role: "me", text: q }); store.set("chat", chat.slice(-40));
  const box = $("#chat");
  if (box) { box.innerHTML = chatHTML() + `<div class="bubble ai"><span class="typing"><i></i><i></i><i></i></span></div>`; box.scrollTop = box.scrollHeight; }
  try {
    const text = await gemini(`My current dashboard data (JSON):\n${ctxJSON()}\n\nQuestion: ${q}\n\nAnswer concisely in Markdown (under 200 words unless I ask for detail).`, { history });
    chat.push({ role: "ai", text });
  } catch (e) { chat.push({ role: "ai", text: `**Could not answer:** ${e.message}` }); }
  store.set("chat", chat.slice(-40));
  const b2 = $("#chat"); if (b2) { b2.innerHTML = chatHTML(); b2.scrollTop = b2.scrollHeight; }
}
async function weeklyReview() {
  const chat = store.get("chat", []);
  chat.push({ role: "me", text: "Write my weekly review." }); store.set("chat", chat);
  const box = $("#chat"); if (box) { box.innerHTML = chatHTML() + `<div class="bubble ai"><span class="typing"><i></i><i></i><i></i></span></div>`; box.scrollTop = box.scrollHeight; }
  try {
    const text = await gemini(`Write my weekly review from this dashboard data.\n\nDATA (JSON):\n${ctxJSON()}\n\nFormat (Markdown, 300-400 words): ## Headline (one sentence), ## Work and attendance, ## Health, ## Money this cycle, ## Tasks, ## Next 7 days: 3 concrete actions. Bullets, bold key numbers. If data is stale say so briefly.`, { maxTokens: 3000 });
    chat.push({ role: "ai", text });
  } catch (e) { chat.push({ role: "ai", text: `**Could not write the review:** ${e.message}` }); }
  store.set("chat", chat.slice(-40));
  const b2 = $("#chat"); if (b2) { b2.innerHTML = chatHTML(); b2.scrollTop = b2.scrollHeight; }
}

/* settings */
function settingsSheet() {
  const local = MODE.kind === "local";
  const pending = store.get("pending", []);
  const src = DATA.sync || {};
  const theme = store.get("theme", "auto");
  const fromSnap = (n) => (DATA.secrets?.[n] ? (local ? "saved on the PC" : "from the PC, encrypted") : "not set");
  const row = (name, at) => `<dt>${name}</dt><dd>${esc(sinceText(at))}</dd>`;
  openSheet(`${sheetHead("Settings")}
    ${local ? `<section class="card"><div class="card-h"><h2>This PC</h2></div>
      <p class="soft">Syncing runs here. After each sync the phone copy is encrypted and uploaded${MODE.local?.phone_configured ? "" : " once you run 'Setup Phone Dashboard.bat'"}.</p>
      <div class="btnrow"><button class="btn primary" data-act="sync-all">${icon("sync")}Sync everything</button>${MODE.local?.phone_configured ? `<button class="btn ghost" data-act="publish">Update phone now</button>` : ""}<a class="btn ghost" href="/classic">Classic view</a></div>
      <p class="muted" id="syncmsg" style="font-size:.85rem"></p></section>` : ""}
    <section class="card"><div class="card-h"><h2>Data</h2></div>
      <dl class="kv">${row("Snapshot", DATA.published_at || DATA.generated_at)}${row("MyPunch", src.mypunch)}${row("Google Health", src.health)}${row("FinArt", src.finart)}${row("TickTick", src.ticktick)}${row("Timeline", src.timeline)}</dl>
    </section>
    ${!local ? `<section class="card"><div class="card-h"><h2>Send entries to the PC</h2></div>
      <p class="soft">Needs a GitHub fine-grained token for ${esc(ghRepo() || "your dashboard repo")} with <b>Contents: Read and write</b>. It stays on this phone.</p>
      <form data-form="gh" class="page" style="padding:0;gap:10px">
        <input type="password" name="token" placeholder="${ghToken() ? "Token saved. Paste a new one to replace it" : "github_pat_…"}" autocomplete="off" aria-label="GitHub token">
        <div class="btnrow"><button class="btn primary">Save token</button>${ghToken() ? `<button type="button" class="btn danger" data-act="gh-clear">Remove</button>` : ""}</div>
      </form>
      ${pending.length ? `<div class="list">${pending.map((p) => `<div class="li"><div class="a"><b>${esc(p.route.replace("/api/", ""))}</b><span>${esc(p.created_at.replace("T", " ").slice(0, 16))}</span></div><div class="z" style="font-size:.85rem">${p.sent ? "sent, waiting for PC" : "not sent yet"}</div></div>`).join("")}</div>${pending.some((p) => !p.sent) ? `<button class="btn ghost" data-act="retry">Send now</button>` : ""}` : `<p class="muted" style="font-size:.85rem">Nothing waiting.</p>`}
    </section>` : ""}
    <section class="card"><div class="card-h"><h2>Keys</h2></div>
      <form data-form="keys" class="page" style="padding:0;gap:10px">
        <label class="f">Gemini API key <span class="muted">(${geminiKey() ? (store.get("dev:gemini_api_key") ? "set on this device" : fromSnap("gemini_api_key")) : "not set"})</span><input type="password" name="gemini_api_key" placeholder="Paste to ${geminiKey() ? "replace" : "add"}" autocomplete="off"></label>
        <label class="f">TickTick API token <span class="muted">(${ttToken() ? (store.get("dev:ticktick_token") ? "set on this device" : fromSnap("ticktick_token")) : "not set"})</span><input type="password" name="ticktick_token" placeholder="TickTick > Settings > Account > API Token" autocomplete="off"></label>
        <button class="btn primary">Save keys</button>
        <p class="muted" style="font-size:.82rem">${local ? "Saved in the PC database, then included in the encrypted phone snapshot (unless you said no during setup)." : "Saved only on this phone and used instead of the PC's copy."}</p>
      </form>
    </section>
    <section class="card"><div class="card-h"><h2>Look</h2></div>
      <div class="seg-ctl" role="group" aria-label="Theme">${[["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => `<button aria-pressed="${theme === v}" data-act="theme" data-v="${v}">${l}</button>`).join("")}</div>
    </section>
    ${!local ? `<button class="btn danger" data-act="lock">${icon("lock")}Lock this phone</button>` : ""}
  `, { tall: false });
}

/* ================================================================== render */
function render() {
  if (!DATA) return;
  const page = PAGES.some((p) => p.id === STATE.page) ? STATE.page : "today";
  const views = { today: renderToday, tasks: renderTasks, work: renderWork, health: renderHealth, money: renderMoney };
  const overdue = taskGroups().overdue.length;
  const pendingUnsent = store.get("pending", []).filter((p) => !p.sent).length;
  const scrollY = window.scrollY;
  const keepFocus = document.activeElement?.dataset?.input;
  for (const k in CHARTS) delete CHARTS[k];
  $("#app").innerHTML = `<div class="shell">
    <header class="topbar">
      <div class="title"><b>My Day</b>${freshness()}</div>
      <button class="iconbtn" data-act="settings" aria-label="Settings">${icon("gear")}${pendingUnsent ? '<span class="dot"></span>' : ""}</button>
      <button class="iconbtn ai" data-act="coach" aria-label="Open the coach">${icon("spark")}</button>
    </header>
    ${ageHours(DATA.published_at || DATA.generated_at) > 30 && MODE.kind !== "local" ? `<div class="banner">${icon("alert")}<span>This snapshot is ${esc(sinceText(DATA.published_at))}. The PC needs to run a sync to refresh it.</span></div>` : ""}
    <main id="main">${views[page]()}</main>
  </div>
  <nav class="tabs" aria-label="Sections"><div class="in">${PAGES.map((p) => `<button data-go="${p.id}" ${p.id === page ? 'aria-current="page"' : ""}><span class="ic-wrap">${icon(p.ic)}${p.id === "tasks" && overdue ? `<span class="badge">${overdue}</span>` : ""}</span>${p.name}</button>`).join("")}</div></nav>`;
  drawCharts();
  if (keepFocus) { const el = $(`[data-input="${keepFocus}"]`); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
  window.scrollTo(0, scrollY);
}
function go(page) { STATE.page = page; store.set("page", page); window.scrollTo(0, 0); render(); }

/* ================================================================== events */
document.addEventListener("click", async (ev) => {
  const goBtn = ev.target.closest("[data-go]");
  if (goBtn) { closeSheet(); return go(goBtn.dataset.go); }
  const el = ev.target.closest("[data-act]");
  if (ev.target.closest("[data-tip]") && !el) { showTip(ev.target.closest("[data-tip]"), ev); return; }
  if (!el) { hideTip(); return; }
  const act = el.dataset.act, v = el.dataset.v;
  if (act === "close-scrim") { if (ev.target === el) closeSheet(); return; }
  switch (act) {
    case "close": closeSheet(); break;
    case "settings": settingsSheet(); break;
    case "coach": coachSheet(); break;
    case "tt-done": el.setAttribute("aria-checked", "true"); setTimeout(() => ttComplete(el.dataset.id), 220); break;
    case "tt-refresh": ttRefresh(false); render(); break;
    case "task-when": STATE.taskWhen = v; $$('[data-act="task-when"]').forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v)); break;
    case "hr": STATE.healthRange = Number(v); render(); break;
    case "wc": STATE.workCycle = Math.min(0, STATE.workCycle + Number(v)); render(); break;
    case "mc": STATE.moneyCycle = Math.min(0, STATE.moneyCycle + Number(v)); render(); break;
    case "tx-all": STATE.txAll = true; render(); break;
    case "cat": STATE.txCat = v || ""; render(); break;
    case "expense": expenseSheet(); break;
    case "tx": txSheet(el.dataset.id); break;
    case "petrol": petrolSheet(el.dataset.d || todayISO()); break;
    case "day": daySheet(el.dataset.d); break;
    case "cal-toggle": {
      const d = el.dataset.d, type = el.dataset.t, on = !(IDX.cal[d] || {})[type];
      closeSheet();
      await submit("/api/calendar-item", { date: d, item_type: type, enabled: on, title: type === "holiday" ? "Holiday" : "Planned CL" }, on ? (type === "holiday" ? "Holiday marked" : "Leave planned") : "Removed");
      break;
    }
    case "note-del": closeSheet(); await submit("/api/calendar-item", { date: el.dataset.d, item_type: "note", enabled: false }, "Note removed"); break;
    case "ci-rate": {
      const field = el.dataset.field, val = Number(v);
      $$(`[data-act="ci-rate"][data-field="${field}"]`).forEach((b) => b.setAttribute("aria-pressed", b === el));
      el.closest("form").dataset[field] = val;
      break;
    }
    case "ci-prio": el.setAttribute("aria-checked", el.getAttribute("aria-checked") !== "true"); break;
    case "briefing":
      if (!geminiKey()) { settingsSheet(); break; }
      el.disabled = true; el.textContent = "Writing…";
      try { await makeBriefing(); } catch (e) { toast(e.message, "error"); }
      render(); break;
    case "ask": ask(el.dataset.q); break;
    case "review": weeklyReview(); break;
    case "chat-clear": store.del("chat"); coachSheet(); break;
    case "theme": store.set("theme", v); applyTheme(); $$('[data-act="theme"]').forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v)); break;
    case "gh-clear": store.del("dev:github_token"); settingsSheet(); toast("GitHub token removed from this phone"); break;
    case "retry": await retryPending(); settingsSheet(); break;
    case "lock": store.del("key"); store.del("snapcache"); store.del("ttcache"); location.reload(); break;
    case "sync-all": await localSync("/api/sync/all"); break;
    case "publish": await localSync("/api/sync/publish"); break;
  }
});
document.addEventListener("pointerover", (ev) => { const t = ev.target.closest?.("[data-tip]"); if (t && ev.pointerType === "mouse") showTip(t, ev); });
document.addEventListener("pointermove", (ev) => { const t = ev.target.closest?.("[data-tip]"); if (t && ev.pointerType === "mouse") showTip(t, ev); else if (ev.pointerType === "mouse") hideTip(); });
document.addEventListener("scroll", hideTip, { passive: true });
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { if ($("#sheet-root").innerHTML) closeSheet(); hideTip(); } });
document.addEventListener("input", (ev) => {
  if (ev.target.dataset.input === "txq") { STATE.txQuery = ev.target.value; clearTimeout(window._txq); window._txq = setTimeout(render, 220); }
});
document.addEventListener("submit", async (ev) => {
  const f = ev.target.closest("form[data-form]");
  if (!f) return;
  ev.preventDefault();
  const fd = Object.fromEntries(new FormData(f).entries());
  const kind = f.dataset.form;
  const btn = f.querySelector("button:not([type=button])");
  if (btn) btn.disabled = true;
  try {
    if (kind === "quick-task") { if (await ttCreate({ title: fd.title || "", day: todayISO() })) f.reset(); }
    else if (kind === "task") {
      const w = STATE.taskWhen, day = w === "today" ? todayISO() : w === "tomorrow" ? addDays(todayISO(), 1) : w === "week" ? addDays(todayISO(), 7) : null;
      if (await ttCreate({ title: fd.title || "", day, priority: fd.priority, projectId: fd.projectId })) f.reset();
    } else if (kind === "checkin") {
      const t = todayISO(), cur = IDX.checkin[t] || {};
      const checks = $$('[data-act="ci-prio"]', f).map((b) => b.getAttribute("aria-checked") === "true");
      const payload = { date: t, intention: fd.intention || "", priorities: [0, 1, 2].map((i) => ({ text: fd["p" + i] || "", done: checks[i] })).filter((p) => p.text.trim()) };
      payload.mood = f.dataset.mood ? Number(f.dataset.mood) : cur.mood ?? null;
      payload.energy = f.dataset.energy ? Number(f.dataset.energy) : cur.energy ?? null;
      if ("win" in fd) payload.win = fd.win;
      await submit("/api/checkin", payload, "Check-in saved");
    } else if (kind === "expense") {
      if (!(Number(fd.amount) > 0)) throw new Error("Enter an amount above zero.");
      closeSheet(); await submit("/api/transaction", fd, "Transaction saved");
    } else if (kind === "tx-patch") {
      closeSheet(); await submit("/api/transaction", { action: "patch", id: Number(f.dataset.id), category: fd.category, notes: fd.notes }, "Transaction updated");
    } else if (kind === "petrol") {
      if (!fd.odometer_km && !fd.liters && !fd.amount) throw new Error("Add at least the litres or the amount.");
      closeSheet(); await submit("/api/petrol-fill", fd, "Petrol fill saved");
    } else if (kind === "note") {
      closeSheet(); await submit("/api/calendar-item", { date: f.dataset.d, item_type: "note", enabled: !!(fd.details || "").trim(), title: "Note", details: fd.details }, "Note saved");
    } else if (kind === "ask") { const q = fd.q; f.reset(); await ask(q); }
    else if (kind === "gh") {
      const token = (fd.token || "").trim();
      if (!token) throw new Error("Paste the token first.");
      const r = await fetch(`https://api.github.com/repos/${ghRepo()}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
      if (!r.ok) throw new Error(`GitHub did not accept that token for ${ghRepo()} (${r.status}).`);
      const j = await r.json();
      if (j.permissions && !j.permissions.push) throw new Error("That token can read the repo but not write. Give it Contents: Read and write.");
      store.set("dev:github_token", token); toast("GitHub write access saved"); await retryPending(); settingsSheet();
    } else if (kind === "keys") {
      const g = (fd.gemini_api_key || "").trim(), t = (fd.ticktick_token || "").trim();
      if (!g && !t) throw new Error("Paste a key first.");
      if (MODE.kind === "local") {
        await localApi("/api/settings", { ...(g ? { gemini_api_key: g } : {}), ...(t ? { ticktick_token: t } : {}) });
        MODE.local = await detectLocal();
        if (DATA.secrets) { if (g) DATA.secrets.gemini_api_key = g; if (t) DATA.secrets.ticktick_token = t; }
      } else { if (g) store.set("dev:gemini_api_key", g); if (t) store.set("dev:ticktick_token", t); }
      toast("Keys saved"); closeSheet(); if (t) ttRefresh(false); render();
    }
  } catch (e) { toast(e.message, "error"); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
});

async function localSync(path) {
  const msg = () => $("#syncmsg");
  try {
    await localApi(path, {});
    if (msg()) msg().textContent = "Started…";
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await localApi("/api/sync/status");
      const busy = Object.entries(st.sources).filter(([, s]) => ["syncing", "queued", "login"].includes(s.state));
      if (msg()) msg().textContent = busy.length ? busy.map(([n, s]) => `${n}: ${s.message || s.state}`).join(" · ") : "Finished.";
      if (!busy.length) break;
    }
    await reload(); toast("Sync finished");
  } catch (e) { toast(e.message, "error"); }
}

/* ================================================================== theme + boot */
function applyTheme() {
  const t = store.get("theme", "auto");
  if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t;
}
function lockScreen(err = "") {
  $("#app").innerHTML = `<div class="lock">
    <div class="dayline" aria-hidden="true"></div>
    <h1>My Day</h1>
    <p class="soft">Your attendance, health, money and tasks, encrypted. Type your passphrase to open them on this device.</p>
    <form id="unlock"><input type="password" name="p" placeholder="Passphrase" autocomplete="current-password" aria-label="Passphrase" required>
      <button class="btn primary">${icon("lock")}Unlock</button><p class="err" role="alert">${esc(err)}</p></form>
    <p class="muted" style="font-size:.82rem">The key stays on this device until you lock it in Settings.</p>
  </div>`;
  $("#unlock").addEventListener("submit", async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const b = ev.target.querySelector("button"); b.disabled = true; b.textContent = "Unlocking…";
    try { await unlockWith(ev.target.p.value); await start(); }
    catch (e) { lockScreen(e.name === "OperationError" ? "That passphrase didn't open it. Try again." : `Couldn't open: ${e.message}`); }
  }, { capture: true });
}
async function reload() { await loadData(); render(); }
async function start() {
  await loadData();
  const cached = store.get("ttcache");
  if (cached && cached.at > Date.parse(DATA.tasks?.synced_at || 0)) { TT.open = cached.open; TT.done = cached.done; TT.projects = cached.projects; TT.source = "live"; }
  render();
  if (ttToken()) ttRefresh();
  if (geminiKey() && !briefing() && new Date().getHours() >= 5 && S().auto_briefing !== "0") makeBriefing().then(render).catch(() => {});
}
async function boot() {
  applyTheme();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  window.addEventListener("resize", () => { clearTimeout(window._rz); window._rz = setTimeout(drawCharts, 150); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && DATA && ageHours(DATA._loadedAt) > 0.25) reload().catch(() => {}); });
  try {
    const local = await detectLocal();
    if (local) { MODE.kind = "local"; MODE.local = local; await start(); return; }
    MODE.kind = "remote";
    await loadKeyinfo();
    const saved = store.get("key");
    if (saved && saved.salt === MODE.keyinfo.salt) {
      MODE.key = await aesKey(b64d(saved.raw));
      try { await start(); return; } catch (e) { if (e.name !== "OperationError") throw e; store.del("key"); }
    }
    lockScreen();
  } catch (e) {
    $("#app").innerHTML = `<div class="lock"><h1>My Day</h1><div class="banner">${icon("alert")}<span>Couldn't load the dashboard: ${esc(e.message)}. If this is the first run, publish from the PC first.</span></div><button class="btn" onclick="location.reload()">Try again</button></div>`;
  }
}
boot();
