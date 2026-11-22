/* SWGOH Hub front end. Reads window.HUB (written by build.py) and talks to serve.py for syncing. */
(function () {
"use strict";
var H = window.HUB;
var IMG = "https://game-assets.swgoh.gg/textures/";
var SLOT = ["", "Square", "Arrow", "Diamond", "Triangle", "Circle", "Cross"];
var CUM = [0, 10, 25, 50, 80, 145, 230, 330];
var I = {
  home: '<path d="M3 11 12 4l9 7v9H4z"/><path d="M9 20v-6h6v6"/>',
  roster: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 5"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  farm: '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  mods: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/>',
  ships: '<path d="M3 7h18l-2 12H5z"/><path d="M8 7a4 4 0 0 1 8 0"/>',
  guild: '<path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>',
  compare: '<path d="M7 4v16M17 4v16"/><path d="M3 8h8M13 16h8"/>',
  plan: '<path d="M5 19 19 5"/><path d="M9 5h10v10"/><path d="M5 13v6h6"/>',
  era: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  counters: '<path d="M4 20 20 4M14 4h6v6M4 4l6 6M14 14l6 6"/>',
  crystals: '<path d="M12 2 5 9l7 13 7-13z"/><path d="M5 9h14"/>',
  guide: '<path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h6M8 12h6"/>'
};
var VIEWS = [["home", "Today"], ["plan", "Fast plan"], ["roster", "Roster"], ["goals", "Goals"], ["farm", "Farming"], ["gear", "Gear"], ["mods", "Mods"],
  ["ships", "Shipments"], ["era", "Era"], ["guild", "Guild"], ["compare", "Compare"], ["counters", "Counters"], ["crystals", "Crystals"], ["guide", "Guide"]];

// ---------------------------------------------------------------- helpers
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function fmt(n) { n = +n || 0; var a = Math.abs(n); return a >= 1e6 ? (n / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2) + "M" : a >= 1e3 ? Math.round(n / 1e3) + "k" : String(n); }
function ago(t) { var s = Date.now() / 1000 - t; return s < 90 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) === 1 ? "1 day ago" : Math.round(s / 86400) + " days ago"; }
function icon(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + I[k] + "</svg>"; }
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

if (!H) { initSync(); return; }
var U = H.units, R = H.roster, G = H.gear;

function isGL(id) { return (U[id].tags || []).indexOf("Galactic Legend") >= 0; }
function lvl(r) { return r ? (r.relic != null ? "R" + r.relic : "G" + r.gear) : ""; }
function tierCls(r) { if (!r) return ""; var g = r.gear; return g >= 13 ? "t13" : g >= 12 ? "t12" : g >= 7 ? "t7" : g >= 4 ? "t4" : g >= 2 ? "t2" : ""; }
function side(u) { return u.align === "Light" ? "L" : u.align === "Dark" ? "D" : "N"; }
function stars(n) { var s = ""; for (var i = 0; i < 7; i++) s += i < n ? "★" : "<s>★</s>"; return '<span class="stars" aria-label="' + n + ' stars">' + s + "</span>"; }
function asR(a) { return a ? { stars: a[0], gear: a[1], relic: a[1] >= 13 ? a[2] : null } : null; }
function lvlA(id, a) { if (!a) return "—"; return U[id].ship ? a[0] + "★" : a[1] >= 13 ? "R" + a[2] : "G" + a[1]; }
function scoreA(a) { return a ? a[0] * 100 + a[1] * 10 + (a[1] >= 13 ? a[2] * 12 : 0) : -1; }
function por(id, o) {
  o = o || {}; var u = U[id] || {}, r = o.as !== undefined ? asR(o.as) : R[id];
  var cls = "por " + (o.size || "") + (u.ship ? " ship" : "") + " " + side(u) + " " + (u.ship ? (r ? "t" + Math.min(12, r.stars * 2) : "") : tierCls(r)) + (r ? "" : " miss");
  var bd = o.badge !== undefined ? o.badge : r ? (u.ship ? r.stars + "★" : lvl(r)) : "—";
  var rel = r && r.relic != null && o.badge === undefined && !u.ship;
  return '<span class="' + cls + '"><img loading="lazy" src="' + IMG + esc(u.thumb) + '.png" alt="">' + (bd ? '<span class="bd' + (rel ? " rel " + side(u) : "") + '">' + esc(bd) + "</span>" : "") + "</span>";
}
function uc(id, extra) { return '<a class="uc" href="#unit-' + esc(id) + '">' + por(id) + '<span class="nm">' + esc(U[id].name) + "</span>" + (extra || "") + "</a>"; }
function mini(id, sub) { return '<a class="mini" href="#unit-' + esc(id) + '">' + por(id, { size: "sm" }) + "<span><b>" + esc(U[id].name) + '</b><span class="tiny muted">' + (sub || "") + "</span></span></a>"; }
function farmChips(list) {
  return (list || []).map(function (f) { var ev = /^Event|^Guild/.test(f); return '<span class="chip' + (/Hard/.test(f) ? " hard" : "") + (ev ? " ev" : "") + '">' + esc(ev ? f.replace("Event: Scheduled", "Events only") : f) + "</span>"; }).join("") ||
    '<span class="tiny muted">Not on a farm node: events, stores or marquee.</span>';
}
function bar(p) { return '<div class="bar' + (p >= 1 ? " done" : "") + '" role="img" aria-label="' + Math.round(p * 100) + ' percent"><i style="width:' + Math.round(Math.min(1, p) * 100) + '%"></i></div>'; }
function ring(p) {
  var r = 60, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, p));
  return '<div class="ring"><svg viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="' + r + '" fill="none" stroke="var(--panel2)" stroke-width="12"/>' +
    (f > 0 ? '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + (f >= 1 ? "var(--good)" : "var(--gold)") + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (c * f).toFixed(1) + " " + c.toFixed(1) + '"/>' : "") +
    '</svg><div class="c"><div><b>' + Math.round(f * 100) + '%</b><div class="tiny muted">complete</div></div></div></div>';
}
function goalUnits() { var s = {}; H.goals.forEach(function (g) { g.rows.forEach(function (r) { s[r.id] = 1; }); }); return s; }
function farmable(id) { return U[id].farm.some(function (l) { return !/^Event|^Guild/.test(l); }); }
function modSpeed(m) { var s = 0; m.sec.forEach(function (x) { if (x[0] === "Speed") s += x[1]; }); return s + (m.prim === "Speed" ? m.pv : 0); }
function sparkline(hist) {
  if (!hist || hist.length < 2) return '<p class="tiny muted">Your GP chart fills in after a few syncs.</p>';
  var w = 400, h = 84, xs = hist.map(function (p) { return p.t; }), ys = hist.map(function (p) { return p.gp; });
  var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
  if (y1 === y0) { y0 -= 1; y1 += 1; }
  var pts = hist.map(function (p) { return [((p.t - x0) / (x1 - x0 || 1)) * (w - 8) + 4, h - 8 - ((p.gp - y0) / (y1 - y0)) * (h - 20)]; });
  var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
  var last = pts[pts.length - 1];
  return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" role="img" aria-label="Galactic Power over your last ' + hist.length + ' syncs"><path d="' + d + " L" + last[0] + " " + h + " L" + pts[0][0] + " " + h + 'Z" fill="var(--cyan)" opacity=".12"/><path d="' + d + '" fill="none" stroke="var(--cyan)" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="var(--gold)"/></svg>';
}

// ---------------------------------------------------------------- timers (game time = UTC + account offset)
var OFF = (H.resetOffsetMin || 0) * 60000;
var TDEF = { daily: "00:00", squad: "18:00", fleet: "19:00", ship: "00:00,06:00,12:00,18:00" };
function tset() { var s = store("hub-timers") || {}; var o = {}; for (var k in TDEF) o[k] = s[k] || TDEF[k]; return o; }
function nextAt(hhmm) {
  var now = Date.now(), best = Infinity;
  String(hhmm).split(",").forEach(function (t) {
    var p = t.trim().split(":"); if (p.length < 2) return;
    var g = new Date(now + OFF); g.setUTCHours(+p[0], +p[1], 0, 0);
    var at = g.getTime() - OFF; if (at <= now) at += 86400000; best = Math.min(best, at);
  });
  return best;
}
function left(ms) { var s = Math.max(0, Math.round((ms - Date.now()) / 1000)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h + "h " + (m < 10 ? "0" : "") + m + "m"; }
function timersHTML() {
  var t = tset(), list = [["Shipments refresh", t.ship], ["Daily reset", t.daily], ["Fleet Arena payout", t.fleet], ["Squad Arena payout", t.squad]];
  return '<div class="timers">' + list.map(function (x) { var at = nextAt(x[1]); var soon = at - Date.now() < 3600000;
    return '<div class="timer' + (soon ? " soon" : "") + '"><span class="tiny muted">' + x[0] + '</span><b data-at="' + at + '">' + left(at) + '</b><span class="tiny muted">at ' + new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + "</span></div>"; }).join("") + "</div>";
}
setInterval(function () { document.querySelectorAll("[data-at]").forEach(function (el) { el.textContent = left(+el.getAttribute("data-at")); }); }, 30000);

// ---------------------------------------------------------------- game visuals
var BOSS_ART = { TERENTATEK: "tex.coliseum_event_terentatek", PIRATEATST: "tex.coliseum_event_atst_pirate", KRAYTDRAGON: "tex.coliseum_event_kraytdragon", DRYAX: "tex.coliseum_event_dryax" };
var CAMP = { "Light Side": "Light Side Battles", "Dark Side": "Dark Side Battles", "Cantina": "Cantina Battles", "Fleet": "Fleet Battles" };
function modIcon(slot, cls) {
  var p = { 1: '<rect x="4" y="4" width="16" height="16" rx="2"/>', 2: '<path d="M12 3 21 12h-5v9H8v-9H3z"/>', 3: '<path d="M12 2 22 12 12 22 2 12z"/>',
    4: '<path d="M12 3 22 20H2z"/>', 5: '<circle cx="12" cy="12" r="9"/>', 6: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>' }[slot];
  return '<svg class="mshape ' + (cls || "") + '" viewBox="0 0 24 24" fill="' + (cls === "ok" ? "currentColor" : "none") + '" fill-opacity=".25" stroke="currentColor" stroke-width="2" role="img" aria-label="' + SLOT[slot] + (cls === "empty" ? " empty" : "") + '">' + p + "</svg>";
}
function nodePath(f) {
  var m = /^(Light Side|Dark Side|Cantina|Fleet) (\d+)-([A-Z])( Hard)?/.exec(f || "");
  if (!m) return esc(f || "");
  return "Battles<i>›</i>" + CAMP[m[1]] + "<i>›</i>Chapter " + m[2] + "<i>›</i>Node " + m[3] + (m[4] ? "<i>·</i>Hard" : "");
}
function gameDay() { return new Date(Date.now() + OFF).toISOString().slice(0, 10); }
function unitShard(x) {
  var have = CUM[x.stars] || 0, need = CUM[x.to] || 1;
  return '<div class="stack" style="gap:6px">' + mini(x.id, stars(x.stars) + " → " + x.to + "★") + '<div class="shardbar">' + bar(have / need) + "<span class=\"muted\">" + x.shards + " shards to go</span></div></div>";
}
function missionHTML() {
  var day = gameDay(), done = store("hub-done") || {}; if (done.day !== day) done = { day: day, ids: {} };
  var steps = [], e = eraNow(), CT = H.coliseumTeams, gu = goalUnits(), now = Date.now() / 1000, t = tset();
  if (e) steps.push({ id: "claim", t: "Claim your free Era tokens", where: "Inbox<i>›</i>Claim all<i>·</i>Store<i>›</i>free Loaned Unit Era Level calendar",
    vis: (e.icon ? '<img class="eraicon" src="' + IMG + esc(e.icon) + '.png" alt="">' : "") + '<span class="small">Each token raises <b>all</b> loaned units by 1. You are at <b>Loaned Level ' + (H.era.loanedLevel || 0) + "</b>.</span>" });
  var col = e && e.coliseum, today = col && col.schedule.filter(function (s) { return s[0] <= now && now < s[1]; })[0];
  if (today) {
    var b = col.bosses[today[2]], bt = CT && CT.bosses && CT.bosses[b.id];
    steps.push({ id: "coliseum", t: "Fight today's Coliseum boss: " + b.name, where: "Era<i>›</i>Coliseum<i>›</i>highest tier you can clear",
      vis: '<div class="bossart" style="flex:1 1 100%;background-image:url(' + IMG + (BOSS_ART[b.id] || "") + '.png)"><b>' + esc(b.name) + '</b><span class="chip hard">Ends in <span data-at="' + today[1] * 1000 + '">' + left(today[1] * 1000) + "</span></span></div>" +
        (bt ? '<div class="minis">' + bt.teams[0].units.map(function (id) { return mini(id, e.units.indexOf(id) >= 0 ? "Era unit · EL " + (H.era.mine[id] || 0) : "Loaned"); }).join("") + '</div><span class="tiny muted">' + esc(bt.tip) + "</span>" : "") });
  }
  var f = H.farm.filter(function (x) { return farmable(x.id); });
  var hard = f.filter(function (x) { return U[x.id].farm.some(function (l) { return /Hard/.test(l); }); });
  if (hard.length) steps.push({ id: "energy", t: "Spend energy on " + U[hard[0].id].name + " shards", where: nodePath(U[hard[0].id].farm.filter(function (l) { return /Hard/.test(l); })[0]) + "<i>·</i>5 attempts, then refresh",
    vis: hard.slice(0, 2).map(unitShard).join("") });
  var cf = f.filter(function (x) { return U[x.id].farm.some(function (l) { return /^Cantina/.test(l); }); })[0];
  steps.push({ id: "cantina", t: cf ? "Cantina energy: " + U[cf.id].name : "Cantina energy: Signal Data", where: cf ? nodePath(U[cf.id].farm.filter(function (l) { return /^Cantina/.test(l); })[0]) : "Battles<i>›</i>Cantina Battles<i>›</i>Chapter 9<i>›</i>Node F",
    vis: cf ? unitShard(cf) : '<span class="small">Signal Data for relic upgrades.</span>' });
  var nomods = Object.keys(R).filter(function (i) { return !U[i].ship && gu[i] && R[i].mods.length < 6 && R[i].gear >= 8; });
  if (nomods.length) steps.push({ id: "mods", t: "Fill empty mod slots", where: "Characters<i>›</i>pick the unit<i>›</i>Mods<i>›</i>fill red slots with Speed mods",
    vis: nomods.slice(0, 5).map(function (i) { return '<div class="stack" style="gap:6px">' + mini(i, R[i].mods.length + "/6 mods") + '<div style="display:flex;gap:4px">' + [1, 2, 3, 4, 5, 6].map(function (s) { return modIcon(s, R[i].mods.some(function (m) { return m.slot === s; }) ? "ok" : "empty"); }).join("") + "</div></div>"; }).join("") });
  steps.push({ id: "fleet", t: "Fleet Arena battles", where: "Fleet Arena<i>·</i>payout in <span data-at=\"" + nextAt(t.fleet) + "\">" + left(nextAt(t.fleet)) + "</span>",
    vis: '<div class="kpi"><b>#' + ((H.arena && H.arena.fleet) || "–") + '</b><span>your rank · the top 50 earn crystals daily</span></div>' });
  var raid = H.guild && H.guild.raids[0];
  steps.push({ id: "guild", t: "Guild activities", where: "Guild<i>›</i>Activities<i>·</i>600 raid tickets",
    vis: '<span class="small">' + (raid && !raid.mine ? "You scored <b class=\"no\">0</b> in the last raid (" + esc(raid.name) + "). Join the next one as soon as it launches." : "Join every raid when it launches.") + "</span>" });
  steps.push({ id: "ships", t: "Check Mod Shipments", where: "Store<i>›</i>Shipments<i>·</i>refresh in <span data-at=\"" + nextAt(t.ship) + "\">" + left(nextAt(t.ship)) + "</span>",
    vis: '<div style="display:flex;gap:4px">' + [1, 2, 3, 4, 5, 6].map(function (s) { return modIcon(s, "ok"); }).join("") + '</div><a class="link" href="#ships">Is it worth buying? Use the checker →</a>' });
  var n = steps.filter(function (s) { return done.ids[s.id]; }).length;
  setTimeout(function () {
    document.querySelectorAll(".tick").forEach(function (btn) { btn.addEventListener("click", function () {
      var d = store("hub-done") || {}; if (d.day !== day) d = { day: day, ids: {} };
      d.ids[btn.dataset.id] = !d.ids[btn.dataset.id]; store("hub-done", d); route();
    }); });
  });
  return '<section class="mission"><div class="sechead"><div><span class="eyebrow">Today\'s mission · resets each day</span><h2>' + (n === steps.length ? "All done for today" : n + " of " + steps.length + " done") + "</h2></div></div>" + bar(n / steps.length) +
    steps.map(function (s, i) { var d = !!done.ids[s.id];
      return '<div class="mstep' + (d ? " done" : "") + '"><div class="num">' + (d ? "✓" : i + 1) + '</div><div style="min-width:0"><h3>' + esc(s.t) + '</h3><div class="where">' + s.where + '</div><div class="vis">' + s.vis + '</div></div><button class="tick" type="button" data-id="' + s.id + '" aria-pressed="' + d + '">' + (d ? "Done ✓" : "Mark done") + "</button></div>";
    }).join("") + "</section>";
}

// ---------------------------------------------------------------- views
var V = {};

V.home = function () {
  var p = H.player, ids = Object.keys(R), chars = ids.filter(function (i) { return !U[i].ship; });
  var gls = ids.filter(isGL), relics = chars.filter(function (i) { return R[i].relic != null; });
  var gu = goalUnits(), ch = H.changes || { items: [] }, hist = H.history || [];
  var nomods = chars.filter(function (i) { return gu[i] && R[i].mods.length < 6 && R[i].gear >= 8; });
  var nextGoal = H.goals.filter(function (g) { return !g.owned; }).sort(function (a, b) { return b.progress - a.progress; })[0];
  var f = H.farm.filter(function (x) { return farmable(x.id); }).slice(0, 4);
  var ev = H.farm.filter(function (x) { return !farmable(x.id); });
  var raid = H.guild && H.guild.raids[0];
  var h = '<section class="hero"><div class="stack"><span class="eyebrow">' + esc(p.guild || "No guild") + " · ally code " + esc(String(p.ally).replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3")) + "</span><h1>" + esc(p.name) + '</h1><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="gp">' + fmt(p.gp) + '</span><span class="muted">Galactic Power</span>' +
    (ch.gp ? '<span class="delta' + (ch.gp < 0 ? " neg" : "") + '">' + (ch.gp > 0 ? "+" : "") + fmt(ch.gp) + " since last sync</span>" : "") + '</div><span class="tiny muted">Synced ' + ago(H.generated) + "</span></div><div>" + sparkline(hist) + "</div></section>";
  h += missionHTML();
  h += '<div class="kpis"><div class="kpi"><b>' + gls.length + '</b><span>Galactic Legends</span></div><div class="kpi"><b>' + relics.length + '</b><span>relic characters</span></div><div class="kpi"><b>' + chars.filter(function (i) { return R[i].stars === 7; }).length + '</b><span>7★ characters</span></div>' +
    (H.arena ? '<div class="kpi"><b>#' + (H.arena.squad || "–") + '</b><span>Squad Arena</span></div><div class="kpi"><b>#' + (H.arena.fleet || "–") + "</b><span>Fleet Arena" + (H.arena.fleet && H.arena.fleet <= 50 ? " · paying crystals" : " · top 50 pays") + "</span></div>" : "") + "</div>";
  h += '<section class="stack"><div class="sechead"><h2>Timers</h2><a class="link" href="#ships">Edit times →</a></div>' + timersHTML() + "</section>";
  h += '<section class="panel stack"><div class="sechead"><h2>Since last sync</h2><span class="tiny muted">' + (ch.since ? "compared with " + new Date(ch.since * 1000).toLocaleString() : "first sync: changes show from the next one") + "</span></div>";
  if (ch.items && ch.items.length) h += '<div class="chg">' + ch.items.slice(0, 24).map(function (c) { return mini(c.id, c.kind === "unlocked" ? '<span class="to">Unlocked ' + esc(c.to) + "</span>" : esc(c.from) + ' → <span class="to">' + esc(c.to) + "</span>"); }).join("") + "</div>";
  else if (ch.since) h += '<p class="muted small">No stars, gear or relics gained yet. Sync again after you play.</p>';
  var gd = Object.keys(ch.goals || {}).filter(function (k) { return ch.goals[k]; });
  if (gd.length) h += '<p class="small">' + gd.map(function (k) { return esc(k) + ' <span class="yes">+' + Math.round(ch.goals[k] * 100) + "%</span>"; }).join(" · ") + "</p>";
  h += "</section>";
  h += '<section class="stack"><h2>More detail</h2><div class="cards">';
  h += '<div class="panel card stack"><h3><span class="n">1</span>Spend energy here</h3><p class="tiny muted">Shards your goals need. Gold = Hard node.</p>' + f.map(function (x) { return "<div>" + mini(x.id, x.stars + "★ → " + x.to + "★ · " + x.shards + " shards") + "<div>" + farmChips(U[x.id].farm) + "</div></div>"; }).join("") +
    (ev.length ? '<p class="tiny muted">Events or marquee only: ' + ev.map(function (x) { return esc(U[x.id].name); }).join(", ") + ".</p>" : "") + '<a class="link" href="#farm">Full farming list →</a></div>';
  if (nomods.length) h += '<div class="panel card stack"><h3><span class="n">2</span>Equip mods</h3><p class="tiny muted">Goal characters with empty mod slots. Free power right now.</p><div class="minis">' + nomods.map(function (i) { return mini(i, R[i].mods.length + "/6 mods"); }).join("") + "</div></div>";
  if (nextGoal) h += '<div class="panel card stack"><h3><span class="n">3</span>Closest goal</h3><b>' + esc(nextGoal.name) + "</b>" + bar(nextGoal.progress) + '<span class="tiny muted">' + Math.round(nextGoal.progress * 100) + "% · " + nextGoal.done + " of " + nextGoal.rows.length + ' met</span><div class="minis">' + nextGoal.rows.filter(function (r) { return r.progress < 1; }).sort(function (a, b) { return b.progress - a.progress; }).slice(0, 4).map(function (r) { return mini(r.id, "needs " + r.target); }).join("") + '</div><a class="link" href="#goals">All goals →</a></div>';
  if (raid) h += '<div class="panel card stack"><h3><span class="n">4</span>Guild raid</h3><p class="small">Last raid <b>' + esc(raid.name) + "</b>: you scored <b>" + fmt(raid.mine) + "</b>" + (raid.rank ? " (rank " + raid.rank + " of " + raid.players + ")" : "") + ". Top player: " + fmt(raid.top) + '.</p><p class="tiny muted">Use every raid attempt: rewards scale with your score.</p><a class="link" href="#guild">Guild page →</a></div>';
  h += '<div class="panel card stack"><h3><span class="n">5</span>Daily checklist</h3><ul class="clean small"><li>Spend all energy: normal, Cantina, fleet, mod</li><li>Fleet Arena battles before payout</li><li>Conquest and Episode track when live</li><li>Galactic Challenges and Assault Battles</li><li>Guild activities: 600 raid tickets</li><li>Check Mod Shipments after each refresh</li></ul></div>';
  return h + "</div></section>";
};

function seg(g, opts, cur) { return '<div class="seg" role="group">' + opts.map(function (o) { return '<button type="button" data-g="' + g + '" data-v="' + o[0] + '" class="' + (cur === o[0] ? "on" : "") + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</div>"; }

V.roster = function () {
  var st = store("hub-roster") || { k: "c", o: "own", s: "lvl", a: "all" };
  var h = '<div class="sechead"><div><span class="eyebrow">Collection</span><h1>Roster</h1><p class="muted">Ring colour = gear tier, like in game. Tap a unit for kit, gear and mods.</p></div></div>';
  h += '<div class="filters"><input id="q" type="search" placeholder="Search name or faction (e.g. Sith, Bounty Hunter)" aria-label="Search">' +
    seg("k", [["c", "Characters"], ["s", "Ships"]], st.k) + seg("a", [["all", "Both sides"], ["Light", "Light"], ["Dark", "Dark"]], st.a) +
    seg("o", [["own", "Owned"], ["all", "All"], ["miss", "Missing"]], st.o) + seg("s", [["lvl", "Power"], ["stars", "Stars"], ["name", "A–Z"]], st.s) + '</div><p class="tiny muted" id="cnt"></p><div class="grid" id="rg"></div>';
  setTimeout(function () {
    document.querySelectorAll(".seg button").forEach(function (b) { b.addEventListener("click", function () { st[b.dataset.g] = b.dataset.v; store("hub-roster", st); b.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); draw(); }); });
    $("q").addEventListener("input", draw); draw();
  });
  function draw() {
    var q = $("q").value.toLowerCase();
    var ids = Object.keys(U).filter(function (i) { var u = U[i]; if ((st.k === "s") !== u.ship) return false; if (st.o === "own" && !R[i]) return false; if (st.o === "miss" && R[i]) return false; if (st.a !== "all" && u.align !== st.a) return false;
      return !q || u.name.toLowerCase().indexOf(q) >= 0 || u.tags.join(" ").toLowerCase().indexOf(q) >= 0; });
    function sc(i) { var r = R[i]; return r ? r.stars * 100 + r.gear * 10 + (r.relic || 0) * 12 + (isGL(i) ? 500 : 0) : -1; }
    ids.sort(function (a, b) { return st.s === "name" ? U[a].name.localeCompare(U[b].name) : st.s === "stars" ? ((R[b] ? R[b].stars : 0) - (R[a] ? R[a].stars : 0)) || sc(b) - sc(a) : sc(b) - sc(a); });
    $("cnt").textContent = ids.length + " units";
    $("rg").innerHTML = ids.map(function (i) { return uc(i, R[i] ? stars(R[i].stars) : ""); }).join("") || '<p class="muted">Nothing matches.</p>';
  }
  return h;
};

V.unit = function (id) {
  var u = U[id]; if (!u) return "<p>Unknown unit.</p>"; var r = R[id];
  var leftShards = 330 - CUM[r ? r.stars : 0];
  var h = '<a class="link" href="#roster">← Roster</a><section class="uhero">' + por(id, { size: "lg" }) + '<div class="stack" style="gap:6px"><span class="eyebrow">' + esc(u.align) + " side" + (isGL(id) ? " · Galactic Legend" : "") + "</span><h1>" + esc(u.name) + "</h1>" +
    (r ? "<div>" + stars(r.stars) + ' <span class="muted small">Level ' + r.lvl + (u.ship ? "" : " · " + lvl(r)) + "</span></div>" : '<span class="muted">Not unlocked yet</span>') +
    "<div>" + u.tags.map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("") + "</div></div></section>";
  h += '<div class="panel stack"><h3>Where to farm shards</h3><div>' + farmChips(u.farm) + "</div>" + (leftShards > 0 ? '<span class="tiny muted">' + leftShards + " shards to 7★, minus any you already hold.</span>" : "") + "</div>";
  h += '<div class="two"><div class="panel"><h3>Abilities</h3>' + u.skills.map(function (s) {
    var t = r && r.sk[s.id] ? r.sk[s.id] : 0, z = s.zeta.length && t >= s.zeta[0], o = s.omi.length && t >= s.omi[0];
    return '<div class="skill"><b>' + esc(s.name) + '</b> <span class="chip">' + esc(s.type) + "</span>" + (s.zeta.length ? '<span class="chip' + (z ? " hard" : "") + '">' + (z ? "Zeta ✓" : "Zeta available") + "</span>" : "") + (s.omi.length ? '<span class="chip' + (o ? " hard" : "") + '">' + (o ? "Omicron ✓" : "Omicron available") + "</span>" : "") +
      '<div class="tiny muted">Level ' + (t || "–") + " / " + s.max + "</div><p>" + esc(s.desc) + "</p></div>";
  }).join("") + '</div><div class="stack">';
  if (!u.ship) {
    var gn = r ? r.gear : 1, cur = u.tiers[String(gn)] || [];
    if (gn < 13) h += '<div class="panel stack"><h3>Gear ' + gn + " slots</h3>" + cur.map(function (g, i) { var e = G[g] || {}; var have = r && r.eq.indexOf(i) >= 0;
      return '<div class="mini"><img class="gicon" src="' + IMG + esc(e.icon) + '.png" alt=""><span><b>' + esc(e.name || g) + "</b>" + (have ? '<span class="tiny yes">Equipped</span>' : '<span class="tiny no">Missing</span>') + "</span></div>"; }).join("") + "</div>";
    if (r) h += '<div class="panel stack"><div class="sechead"><h3>Mods</h3><span class="grade g' + r.modGrade + '" title="Mod grade">' + r.modGrade + '</span></div><span class="tiny muted">+' + Math.round(r.modSpeed) + ' Speed from mods</span><div class="modg">' + [1, 2, 3, 4, 5, 6].map(function (sl) {
      var m = r.mods.filter(function (x) { return x.slot === sl; })[0];
      if (!m) return '<div class="mod"><div class="sh no">' + SLOT[sl] + "</div>Empty slot</div>";
      return '<div class="mod"><div class="sh">' + SLOT[sl] + '</div><span class="muted">' + m.dots + "-dot · L" + m.lvl + " · " + esc(m.set) + "</span><br><b>" + esc(m.prim) + " " + m.pv + "</b><br>" + m.sec.map(function (s) { return s[0] === "Speed" ? '<span class="spd">Speed ' + s[1] + "</span>" : esc(s[0]) + " " + s[1]; }).join("<br>") + "</div>";
    }).join("") + "</div></div>";
  }
  return h + '<a class="link" href="https://swgoh.gg/" target="_blank" rel="noopener">Counters and popular mods on swgoh.gg →</a></div></div>';
};

V.goals = function () {
  return '<div><span class="eyebrow">Journeys</span><h1>Goals</h1><p class="muted">From goals.json. Edit that file to change targets, then sync.</p></div>' + H.goals.map(function (g) {
    return '<section class="panel goal">' + ring(g.progress) + '<div><div class="sechead"><div><h2>' + esc(g.name) + (g.owned ? ' <span class="yes">✓ Unlocked</span>' : "") + '</h2><p class="muted small">' + esc(g.note) + " · " + g.done + " of " + g.rows.length + " requirements met</p></div></div>" +
      '<div class="req">' + g.rows.slice().sort(function (a, b) { return a.progress - b.progress; }).map(function (r) { return '<a class="rq' + (r.progress >= 1 ? " ok" : "") + '" href="#unit-' + esc(r.id) + '">' + por(r.id, { size: "sm" }) + '<span style="min-width:0"><b class="small">' + esc(U[r.id].name) + '</b><br><span class="t">needs ' + esc(r.target) + " · " + Math.round(r.progress * 100) + "%</span></span></a>"; }).join("") + "</div></div></section>";
  }).join("");
};


V.gear = function () {
  var h = '<div><span class="eyebrow">Shopping list</span><h1>Gear</h1><p class="muted">Base pieces still needed to gear your goal characters to their targets. Biggest first.</p></div><div class="list">';
  h += H.gearNeed.map(function (e) { var g = G[e.id] || {}; return '<div class="row"><img class="gicon" src="' + IMG + esc(g.icon) + '.png" alt=""><div style="min-width:0"><b>' + esc(g.name || e.id) + '</b><span class="tiny muted">' + Object.keys(e.for).map(function (k) { return esc(k) + ": " + e.for[k]; }).join(" · ") + "</span><div>" + farmChips(g.farm) + '</div></div><div class="big">×' + e.qty + "</div></div>"; }).join("");
  return h + '</div><p class="tiny muted">Relic materials after Gear 13 aren\'t counted.</p>';
};


V.ships = function () {
  var t = tset();
  var h = '<div><span class="eyebrow">Mod store</span><h1>Shipments</h1><p class="muted">Check a mod before you buy it, and see when the store refreshes.</p></div>';
  h += '<section class="stack"><h2>Refresh timers</h2>' + timersHTML() + '<details class="panel"><summary class="small" style="cursor:pointer;font-weight:600">Set times to match your game</summary><p class="tiny muted">Times are in game time (UTC' + (OFF >= 0 ? "+" : "") + (OFF / 3600000) + '), the time zone your account uses. Check the in-game clocks once and set them here.</p>' +
    '<div class="filters"><label class="small">Shipments (comma list) <input id="t_ship" type="search" value="' + esc(t.ship) + '"></label>' +
    '<label class="small">Daily reset <input id="t_daily" type="time" value="' + esc(t.daily) + '"></label><label class="small">Fleet payout <input id="t_fleet" type="time" value="' + esc(t.fleet) + '"></label><label class="small">Squad payout <input id="t_squad" type="time" value="' + esc(t.squad) + '"></label></div></details></section>';
  h += '<section class="panel"><div class="two"><div class="stack"><h2>Is this mod worth buying?</h2>' +
    '<label class="small stack" style="gap:4px">Shape<select id="c_slot">' + [1, 2, 3, 4, 5, 6].map(function (s) { return '<option value="' + s + '"' + (s === 2 ? " selected" : "") + ">" + SLOT[s] + "</option>"; }).join("") + "</select></label>" +
    '<label class="small stack" style="gap:4px">Set<select id="c_set">' + ["Speed", "Offense", "Health", "Defense", "Crit Chance", "Crit Damage", "Potency", "Tenacity"].map(function (s) { return "<option>" + s + "</option>"; }).join("") + "</select></label>" +
    '<label class="small stack" style="gap:4px">Primary stat (big stat at the top)<select id="c_prim">' + ["Speed", "Offense %", "Health %", "Protection %", "Defense %", "Crit Chance", "Crit Damage", "Potency", "Tenacity", "Accuracy", "Crit Avoidance"].map(function (s) { return "<option>" + s + "</option>"; }).join("") + "</select></label>" +
    '<label class="small stack" style="gap:4px">Speed showing in the secondaries (0 if none)<input id="c_spd" type="number" min="0" max="31" value="0" inputmode="numeric"></label><p class="tiny muted">Only buy 5-dot mods. Shipments refresh several times a day, so skipping is fine.</p></div>' +
    '<div class="stack"><div id="c_verdict" class="verdict" aria-live="polite"></div><p id="c_why" class="small muted"></p><div id="c_who" class="list"></div></div></div></section>';
  setTimeout(function () {
    ["ship", "daily", "fleet", "squad"].forEach(function (k) { $("t_" + k).addEventListener("change", function () { var s = tset(); s[k] = this.value; store("hub-timers", s); route(); }); });
    ["c_slot", "c_set", "c_prim", "c_spd"].forEach(function (k) { $(k).addEventListener("input", check); }); check();
  });
  return h;
};
function check() {
  var slot = +$("c_slot").value, set = $("c_set").value, prim = $("c_prim").value, spd = +$("c_spd").value || 0;
  var arrow = slot === 2 && prim === "Speed", est = spd + (arrow ? 30 : 0), v, cls, why;
  if (spd >= 5) { v = "Strong buy"; cls = "yes"; why = "Speed " + spd + " is already showing, and level-ups can roll more into it."; }
  else if (spd > 0) { v = "Buy"; cls = "yes"; why = "It has Speed. Low start, but upgrades can still land on it."; }
  else if (arrow) { v = "Buy"; cls = "yes"; why = "A Speed arrow gives +30 Speed at level 15. Always useful."; }
  else if (set === "Speed" || slot === 2) { v = "Maybe"; cls = ""; why = "No Speed showing yet. Only if you have spare credits."; }
  else { v = "Skip"; cls = "no"; why = "No Speed, not a Speed set or arrow. Save your credits."; }
  $("c_verdict").className = "verdict " + cls; $("c_verdict").textContent = v; $("c_why").textContent = why;
  if (cls === "no") { $("c_who").innerHTML = ""; return; }
  var gu = goalUnits(), cands = Object.keys(R).filter(function (i) { return !U[i].ship && (gu[i] || R[i].relic != null); }).map(function (i) {
    var m = R[i].mods.filter(function (x) { return x.slot === slot; })[0]; return { id: i, cur: m ? modSpeed(m) : -1, m: m, goal: gu[i] ? 1 : 0 };
  }).filter(function (x) { return x.cur < est || !x.m; }).sort(function (a, b) { return (b.goal - a.goal) || a.cur - b.cur; }).slice(0, 8);
  $("c_who").innerHTML = '<span class="tiny muted">Would help most:</span>' + (cands.map(function (x) { return mini(x.id, x.m ? SLOT[slot] + " now +" + x.cur + " speed · " + esc(x.m.set) : "Empty " + SLOT[slot]); }).join("") || '<p class="small muted">None of your key characters would gain Speed from it.</p>');
}

V.guild = function () {
  var g = H.guild; if (!g) return "<h1>Guild</h1><p class='muted'>No guild data.</p>";
  var me = H.player.id, idx = g.members.findIndex(function (m) { return m.id === me; });
  var h = '<div><span class="eyebrow">Guild</span><h1>' + esc(g.name) + '</h1><p class="muted">' + g.count + " members · " + fmt(g.gp) + " GP" + (idx >= 0 ? " · you are #" + (idx + 1) + " by GP" : "") + "</p></div>";
  if (g.message) h += '<div class="panel small"><b>Guild rules:</b> ' + esc(g.message) + "</div>";
  h += '<section class="panel stack"><h2>Raids</h2><div class="tbl"><table><tr><th>Raid</th><th>Ended</th><th>Guild score</th><th>You</th><th>Your rank</th><th>Top player</th></tr>' + g.raids.map(function (r) { return "<tr><td>" + esc(r.name) + "</td><td>" + new Date(r.end * 1000).toLocaleDateString() + "</td><td>" + fmt(r.score) + '</td><td class="' + (r.mine ? "" : "no") + '">' + fmt(r.mine) + "</td><td>" + (r.rank ? r.rank + " / " + r.players : "–") + "</td><td>" + fmt(r.top) + "</td></tr>"; }).join("") +
    '</table></div><ul class="clean small"><li>Officers launch raids. Watch guild chat or Discord for the start.</li><li>Use every attempt with your strongest teams that fit the raid.</li><li>Every week: deploy all units in Territory Battles, and set defence in Territory Wars when asked.</li></ul></section>';
  var hasGl = g.members.some(function (m) { return m.gls.length; });
  if (hasGl) { var cnt = {}; g.members.forEach(function (m) { m.gls.forEach(function (x) { cnt[x] = (cnt[x] || 0) + 1; }); });
    h += '<section class="panel stack"><h2>Galactic Legends in the guild</h2><p class="small muted">How many members own each one. Yours are marked.</p><div class="grid">' + Object.keys(cnt).filter(function (x) { return U[x]; }).sort(function (a, b) { return cnt[b] - cnt[a]; }).map(function (x) { return '<a class="uc" href="#unit-' + esc(x) + '">' + por(x, { badge: cnt[x] + " own" }) + '<span class="nm">' + esc(U[x].name) + (R[x] ? ' <span class="yes">· you</span>' : "") + "</span></a>"; }).join("") + "</div></section>"; }
  h += '<section class="panel stack"><h2>Members</h2><div class="tbl"><table><tr><th>#</th><th>Name</th><th>GP</th><th>Characters</th><th>Ships</th>' + (hasGl ? "<th>GLs</th>" : "") + "<th>Role</th><th>Last on</th></tr>" + g.members.map(function (m, i) { var d = Math.max(0, Math.round((Date.now() / 1000 - m.last) / 86400)); return '<tr class="' + (m.id === me ? "me" : "") + '"><td>' + (i + 1) + "</td><td>" + esc(m.name) + "</td><td>" + fmt(m.gp) + "</td><td>" + fmt(m.cgp) + "</td><td>" + fmt(m.sgp) + "</td>" + (hasGl ? "<td>" + m.gls.length + "</td>" : "") + "<td>" + esc(m.role) + "</td><td>" + (d ? d + "d ago" : "today") + "</td></tr>"; }).join("") + "</table></div></section>";
  return h;
};

V.counters = function () {
  var lead = Object.keys(R).filter(function (i) { return !U[i].ship && R[i].relic != null && (isGL(i) || U[i].roles.indexOf("leader") >= 0); });
  lead.sort(function (a, b) { return (isGL(b) - isGL(a)) || R[b].relic - R[a].relic; });
  var h = '<div><span class="eyebrow">Grand Arena · Territory Wars</span><h1>Counters</h1><p class="muted">Counters shift every few weeks as new characters arrive. Live win rates come from millions of battles on swgoh.gg, so this page pairs that with your strongest teams.</p></div>';
  h += '<section class="panel stack"><h3>Find a counter in 30 seconds</h3><div class="steps"><div class="step"><div><b>Note the enemy leader</b><p>The unit in the leader slot of the team you face.</p></div></div><div class="step"><div><b>Look it up</b><p>Open <a class="link" href="https://swgoh.gg/gac/counters/" target="_blank" rel="noopener">swgoh.gg GAC counters</a> and pick that leader.</p></div></div><div class="step"><div><b>Pick from your leaders below</b><p>Take the highest win-rate counter whose leader you have at a good relic.</p></div></div></div></section>';
  h += '<section class="stack"><h2>Your strongest leaders</h2><p class="small muted">Galactic Legends first, then relic leaders.</p><div class="grid">' + lead.slice(0, 40).map(function (i) { return uc(i); }).join("") + "</div></section>";
  h += '<section class="panel stack"><h3>More worth using on swgoh.gg</h3><ul class="clean small"><li><b>Character pages, Best Mods tab</b>: the sets and primaries top players use.</li><li><b>GAC history</b>: what your next opponent usually puts on defence.</li><li><b>Unit insights</b>: which zetas and omicrons people actually apply.</li><li><b>Guild compare</b>: line your guild up against a Territory Wars opponent.</li><li><b>recruit.swgoh.gg</b>: find a stronger guild when you outgrow yours.</li></ul></section>';
  return h;
};


V.guide = function () {
  return '<div><span class="eyebrow">Playbook</span><h1>Guide</h1><p class="muted">How to farm mods, and the order to build your account in.</p></div>' +
    '<section class="panel stack"><h2>How to farm mods</h2><div class="steps">' +
    '<div class="step"><div><b>Spend Mod Energy in Mod Battles every day</b><p>Play the highest tier you can clear on auto. Each node drops certain shapes and sets: tap a node to see its drops, and pick ones with Speed sets and arrows.</p></div></div>' +
    '<div class="step"><div><b>Check Mod Shipments after every refresh</b><p>Buy 5-dot mods that already show Speed, plus Speed arrows. Use the checker on the Shipments page.</p></div></div>' +
    '<div class="step"><div><b>Level every equipped mod to 15</b><p>The cheapest power in the game. Level-ups at 3, 6, 9 and 12 can roll into Speed.</p></div></div>' +
    '<div class="step"><div><b>Slice only Speed mods</b><p>Take 5-dot mods with a good Speed secondary to gold (5A), then to 6-dot. Materials come from Mod Challenges and Mod Battles.</p></div></div>' +
    '<div class="step"><div><b>Do the daily Mod Challenges</b><p>They pay slicing materials and credits.</p></div></div>' +
    '<div class="step"><div><b>Sell the rest</b><p>Low-dot mods without Speed are only worth credits.</p></div></div></div></section>' +
    '<section class="panel stack"><h2>Best progression strategy</h2><div class="steps">' +
    '<div class="step"><div><b>Chase one Galactic Legend journey at a time</b><p>Finish Jabba, then Leviathan, then Mando &amp; Grogu. One unlock beats gear spread across many teams.</p></div></div>' +
    '<div class="step"><div><b>Farm the slowest thing first</b><p>Shards are the bottleneck. Hard nodes every day, refreshes on your number one farm, all energy in double drop events.</p></div></div>' +
    '<div class="step"><div><b>Gear only goal characters</b><p>Follow the Gear page. Relic each unit only to the level its goal needs.</p></div></div>' +
    '<div class="step"><div><b>Fill mod slots before anything else</b><p>A unit with empty slots plays well below its level.</p></div></div>' +
    '<div class="step"><div><b>Never miss guild rewards</b><p>Raids, Territory Battles and Territory Wars pay zeta, omicron and relic materials you can\'t easily get elsewhere.</p></div></div>' +
    '<div class="step"><div><b>Use Era and Coliseum for Lightspeed Tokens</b><p>Put tokens on low-star units your goals need, so you save the shards too.</p></div></div>' +
    '<div class="step"><div><b>Zetas and omicrons only on units you use</b><p>In Grand Arena, Territory Wars or raids. Unused abilities waste materials.</p></div></div>' +
    '<div class="step"><div><b>Spend crystals on energy, not packs</b><p>Steady daily refreshes beat random pulls. See the Crystals page.</p></div></div></div></section>';
};

// ---------------------------------------------------------------- guild compare
function members() {
  var g = H.guild; if (!g) return [];
  var mem = g.members.filter(function (m) { return m.units; });
  if (!mem.some(function (m) { return m.id === H.player.id; })) {           // fall back to your own roster
    var u = {}; Object.keys(R).forEach(function (i) { var r = R[i]; u[i] = [r.stars, U[i].ship ? 0 : r.gear, r.relic || 0, 0, 0]; });
    mem.push({ id: H.player.id, name: H.player.name, gp: +H.player.gp || 0, cgp: +H.player.cgp || 0, sgp: +H.player.sgp || 0, units: u, gls: Object.keys(u).filter(isGL) });
  }
  return mem.sort(function (a, b) { return b.gp - a.gp; });
}
function stat(m, k) {
  if (m[k] != null) return m[k];
  var ch = Object.keys(m.units).filter(function (i) { return U[i] && !U[i].ship; }).map(function (i) { return m.units[i]; });
  if (k === "seven") return ch.filter(function (a) { return a[0] === 7; }).length;
  if (k[0] === "r") { var n = +k.slice(1); return ch.filter(function (a) { return a[1] >= 13 && a[2] >= n; }).length; }
  return 0;
}
V.compare = function (arg) {
  var mem = members();
  if (mem.length < 2) return '<h1>Compare</h1><p class="muted">Guild rosters are missing. Press Sync now: rosters are fetched during a sync.</p>';
  var st = store("hub-compare") || {};
  var byId = {}; mem.forEach(function (m) { byId[m.id] = m; });
  var A = byId[st.a] || byId[H.player.id];
  var B = byId[arg] || byId[st.b] || mem.filter(function (m) { return m.id !== A.id; })[0];
  st.a = A.id; st.b = B.id; store("hub-compare", st);
  function pick(id, cur) { return '<select id="' + id + '" aria-label="Player">' + mem.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === cur ? " selected" : "") + ">" + esc(m.name) + (m.id === H.player.id ? " (you)" : "") + " · " + fmt(m.gp) + "</option>"; }).join("") + "</select>"; }
  var rows = [["Galactic Power", "gp"], ["Character GP", "cgp"], ["Ship GP", "sgp"], ["Galactic Legends", "glc"], ["Relic 9+", "r9"], ["Relic 7+", "r7"], ["Relic 5+", "r5"], ["7★ characters", "seven"], ["Zetas", "zetas"], ["Omicrons", "omis"]];
  function val(m, k) { return k === "glc" ? (m.gls || []).length : stat(m, k); }
  var h = '<div><span class="eyebrow">Guild</span><h1>Compare rosters</h1><p class="muted">Pick any two guild members. Use it to see what stronger players built first.</p></div>';
  h += '<div class="filters">' + pick("ca", A.id) + '<b class="muted">vs</b>' + pick("cb", B.id) + "</div>";
  h += '<section class="panel stack"><div class="tbl"><table><tr><th>' + esc(A.name) + '</th><th style="width:45%"></th><th style="text-align:right">' + esc(B.name) + "</th></tr>" + rows.map(function (r) {
    var a = val(A, r[1]), b = val(B, r[1]), t = Math.max(1, a + b), pa = Math.round(a / t * 100);
    return '<tr><td class="' + (a > b ? "yes" : "") + '"><b>' + (r[1].indexOf("gp") >= 0 ? fmt(a) : a) + '</b></td><td><div class="tiny muted" style="text-align:center">' + r[0] + '</div><div style="display:flex;height:8px;border-radius:5px;overflow:hidden;background:var(--panel2)"><i style="width:' + pa + '%;background:var(--cyan)"></i><i style="width:' + (100 - pa) + '%;background:var(--gold)"></i></div></td><td style="text-align:right" class="' + (b > a ? "yes" : "") + '"><b>' + (r[1].indexOf("gp") >= 0 ? fmt(b) : b) + "</b></td></tr>";
  }).join("") + "</table></div></section>";
  var gl = {}; (A.gls || []).concat(B.gls || []).forEach(function (x) { gl[x] = 1; });
  h += '<section class="panel stack"><h2>Galactic Legends</h2><div class="grid">' + Object.keys(gl).filter(function (x) { return U[x]; }).map(function (x) {
    var a = A.units[x], b = B.units[x];
    return '<a class="uc" href="#unit-' + esc(x) + '">' + por(x, { as: a || null, badge: a ? undefined : "" }) + '<span class="nm">' + esc(U[x].name) + '</span><span class="tiny ' + (a ? "yes" : "no") + '">' + esc(A.name) + (a ? " ✓" : " ✗") + '</span><span class="tiny ' + (b ? "yes" : "no") + '">' + esc(B.name) + (b ? " ✓" : " ✗") + "</span></a>";
  }).join("") + "</div></section>";
  h += '<section class="stack"><div class="sechead"><h2>Unit by unit</h2>' + seg("cm", [["b", esc(B.name) + " ahead"], ["a", esc(A.name) + " ahead"], ["onlyb", "Only " + esc(B.name)], ["onlya", "Only " + esc(A.name)]], st.mode || "b") + '</div><div id="cmp" class="list"></div></section>';
  var all = mem.filter(function (m) { return m.r7 != null; }).length ? mem : mem;
  h += '<section class="panel stack"><div class="sechead"><h2>Guild table</h2><span class="tiny muted">Tap a column to sort. Tap a name to compare.</span></div><div class="tbl" id="gt"></div></section>';
  h += '<section class="panel stack"><h2>Who has this unit?</h2><p class="small muted">For Territory Wars, raids and borrowing advice: see every member\'s level for one unit.</p><input id="uf" type="search" placeholder="Type a unit name, e.g. Jabba, Leviathan, Bo-Katan" aria-label="Unit"><div id="ufr" class="stack"></div></section>';
  setTimeout(function () {
    $("ca").addEventListener("change", function () { st.a = this.value; store("hub-compare", st); route(); });
    $("cb").addEventListener("change", function () { st.b = this.value; store("hub-compare", st); location.hash = "compare"; route(); });
    document.querySelectorAll('.seg button[data-g="cm"]').forEach(function (b) { b.addEventListener("click", function () { st.mode = b.dataset.v; store("hub-compare", st); b.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); diff(); }); });
    diff(); table("r7"); $("uf").addEventListener("input", finder);
  });
  function diff() {
    var mode = st.mode || "b", ids = {};
    Object.keys(A.units).concat(Object.keys(B.units)).forEach(function (i) { if (U[i]) ids[i] = 1; });
    var list = Object.keys(ids).map(function (i) { var a = A.units[i], b = B.units[i]; return { id: i, a: a, b: b, d: scoreA(b) - scoreA(a) }; }).filter(function (x) {
      return mode === "b" ? x.a && x.b && x.d > 0 : mode === "a" ? x.a && x.b && x.d < 0 : mode === "onlyb" ? x.b && !x.a : x.a && !x.b;
    }).sort(function (x, y) { return mode === "a" || mode === "onlya" ? scoreA(y.a) - scoreA(x.a) : scoreA(y.b) - scoreA(x.b); }).slice(0, 80);
    $("cmp").innerHTML = list.map(function (x) {
      return '<a class="row" href="#unit-' + esc(x.id) + '" style="text-decoration:none">' + por(x.id, { as: x.a || null, size: "sm" }) + '<div style="min-width:0"><b>' + esc(U[x.id].name) + '</b><span class="tiny muted">' + esc(A.name) + " " + lvlA(x.id, x.a) + " · " + esc(B.name) + " " + lvlA(x.id, x.b) + (x.b && x.b[3] ? " · " + x.b[3] + " zeta" : "") + (x.b && x.b[4] ? " · " + x.b[4] + " omicron" : "") + "</span></div>" + por(x.id, { as: x.b || null, size: "sm" }) + "</a>";
    }).join("") || '<p class="muted small">Nothing here.</p>';
  }
  function table(key) {
    var cols = [["name", "Name"], ["gp", "GP"], ["glc", "GLs"], ["r9", "R9+"], ["r7", "R7+"], ["r5", "R5+"], ["zetas", "Zetas"], ["omis", "Omicrons"]];
    var list = mem.slice().sort(function (x, y) { return key === "name" ? x.name.localeCompare(y.name) : val(y, key) - val(x, key); });
    $("gt").innerHTML = "<table><tr><th>#</th>" + cols.map(function (c) { return '<th><button type="button" data-k="' + c[0] + '" style="all:unset;cursor:pointer' + (c[0] === key ? ";color:var(--gold)" : "") + '">' + c[1] + (c[0] === key ? " ▾" : "") + "</button></th>"; }).join("") + "</tr>" +
      list.map(function (m, i) { return '<tr class="' + (m.id === H.player.id ? "me" : "") + '"><td>' + (i + 1) + '</td><td><a class="link" href="#compare-' + esc(m.id) + '">' + esc(m.name) + "</a></td>" + cols.slice(1).map(function (c) { var v = val(m, c[0]); return "<td>" + (c[0] === "gp" ? fmt(v) : v) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>";
    $("gt").querySelectorAll("th button").forEach(function (b) { b.addEventListener("click", function () { table(b.dataset.k); }); });
  }
  function finder() {
    var q = $("uf").value.toLowerCase().trim(); if (q.length < 2) { $("ufr").innerHTML = ""; return; }
    var id = Object.keys(U).filter(function (i) { return U[i].name.toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return U[a].name.length - U[b].name.length; })[0];
    if (!id) { $("ufr").innerHTML = '<p class="small muted">No unit matches.</p>'; return; }
    var own = mem.filter(function (m) { return m.units[id]; }).sort(function (x, y) { return scoreA(y.units[id]) - scoreA(x.units[id]); });
    $("ufr").innerHTML = "<b>" + esc(U[id].name) + '</b><span class="tiny muted">' + own.length + " of " + mem.length + ' members own it</span><div class="minis">' + own.map(function (m) {
      return '<a class="mini" href="#compare-' + esc(m.id) + '">' + por(id, { as: m.units[id], size: "sm" }) + "<span><b>" + esc(m.name) + '</b><span class="tiny muted">' + lvlA(id, m.units[id]) + (m.units[id][3] ? " · " + m.units[id][3] + "z" : "") + (m.units[id][4] ? " · " + m.units[id][4] + "o" : "") + "</span></span></a>";
    }).join("") + "</div>";
  }
  return h;
};

// ---------------------------------------------------------------- era
function eraNow() {
  var E = H.era; if (!E || !E.eras || !E.eras.length) return null;
  var now = Date.now() / 1000;
  return E.eras.filter(function (e) { return e.start <= now && now < e.end; })[0] || E.eras.slice().sort(function (a, b) { return b.end - a.end; })[0];
}
function addCost(tot, cost) { cost.forEach(function (c) { tot[c[0]] = (tot[c[0]] || 0) + c[1]; }); return tot; }
function costHTML(tot) {
  var M = H.era.mats || {};
  return Object.keys(tot).sort(function (a, b) { return a === "ERA_UPGRADE_CURRENCY" ? -1 : b === "ERA_UPGRADE_CURRENCY" ? 1 : a.localeCompare(b); }).map(function (k) {
    var m = M[k];
    return '<span class="chip">' + (m && m.icon ? '<img src="' + IMG + esc(m.icon) + '.png" alt="" style="width:16px;height:16px;border-radius:3px">' : "") + esc(k === "ERA_UPGRADE_CURRENCY" ? "Era upgrade credits" : m ? m.name : k) + " ×" + tot[k].toLocaleString() + "</span>";
  }).join("") || '<span class="tiny muted">Nothing</span>';
}
V.era = function () {
  var e = eraNow(); if (!e) return '<h1>Era</h1><p class="muted">No Era data yet. Press Sync now.</p>';
  var E = H.era, mine = E.mine || {}, now = Date.now() / 1000, L = e.levels;
  var daysLeft = Math.max(0, Math.ceil((e.end - now) / 86400)), span = Math.max(1, e.end - e.start);
  var units = e.units.map(function (id) { return { id: id, lv: mine[id] || 0 }; });
  var total = units.reduce(function (s, u) { return s + u.lv; }, 0);
  var earned = e.totalRewards.filter(function (t) { return t[0] <= total; }).reduce(function (s, t) { return s + t[1]; }, 0);
  var col = e.coliseum, sched = col ? col.schedule : [], today = sched.filter(function (s) { return s[0] <= now && now < s[1]; })[0];
  var nextB = sched.filter(function (s) { return s[0] > now; }).slice(0, 3);
  function bossName(i) { return col && col.bosses[i] ? col.bosses[i].name : "Boss " + (i + 1); }
  function lvInfo(lv) { var l = L[lv - 1]; if (!l) return "Not started"; return l.gear >= 13 ? "R" + l.relic : "G" + l.gear + " · L" + l.lvl; }

  var h = '<section class="hero"><div class="stack">' + (e.icon ? '<img class="eraicon" src="' + IMG + esc(e.icon) + '.png" alt="">' : "") + '<span class="eyebrow">Current Era</span><h1>' + esc(e.name) + '</h1><span class="muted">' + new Date(e.start * 1000).toLocaleDateString() + " → " + new Date(e.end * 1000).toLocaleDateString() + " · <b>" + daysLeft + " days left</b></span>" + bar((now - e.start) / span) + "</div>" +
    '<div class="stack"><span class="eyebrow">Coliseum today</span><h2>' + (today ? esc(bossName(today[2])) : "No boss live") + "</h2>" + (today ? '<span class="tiny muted">Ends in <b data-at="' + today[1] * 1000 + '">' + left(today[1] * 1000) + "</b></span>" : "") +
    '<span class="tiny muted">Next: ' + nextB.map(function (s) { return esc(bossName(s[2])) + " (" + new Date(s[0] * 1000).toLocaleDateString([], { weekday: "short" }) + ")"; }).join(" → ") + "</span></div></section>";

  h += '<div class="kpis"><div class="kpi"><b>' + total + '</b><span>total Era levels</span></div><div class="kpi"><b>' + earned.toLocaleString() + '</b><span>Era Currency from levels so far</span></div><div class="kpi"><b>' + (E.loanedLevel || 0) + '</b><span>loaned unit Era level</span></div><div class="kpi"><b>' + daysLeft + '</b><span>Coliseum days left</span></div></div>';

  h += eraPlanHTML(e);

  // units
  h += '<section class="panel stack"><div class="sechead"><h2>Your Era units</h2><span class="tiny muted">Each Era level raises the unit; big jumps at milestone levels.</span></div><div class="list">' + units.map(function (u) {
    var nextM = L.filter(function (l) { return l.major && l.lv > u.lv; })[0], tot = {};
    if (nextM) for (var k = u.lv + 1; k <= nextM.lv; k++) addCost(tot, L[k - 1].cost);
    var r = R[u.id];
    return '<div class="row">' + por(u.id, { badge: "EL " + u.lv }) + '<div style="min-width:0"><b>' + esc(U[u.id] ? U[u.id].name : u.id) + (e.journey === u.id ? ' <span class="chip hard">Journey unit</span>' : "") + '</b><span class="tiny muted">Era level ' + u.lv + " = " + lvInfo(u.lv) + (r ? " · you own it at " + r.stars + "★" : " · not unlocked") + "</span>" +
      (nextM ? '<div class="tiny">Next milestone <b>EL ' + nextM.lv + "</b> → " + lvInfo(nextM.lv) + '</div><div>' + costHTML(tot) + "</div>" : '<span class="tiny yes">Maxed</span>') + '</div><div class="big">' + u.lv + "<small>of " + L.length + "</small></div></div>";
  }).join("") + "</div>";
  var ms = L.filter(function (l) { return l.major && l.lv >= 100; });
  h += '<p class="tiny muted">Top milestones: ' + ms.map(function (l) { return "EL " + l.lv + " = " + lvInfo(l.lv) + (l.stars ? " (needs " + l.stars + "★)" : ""); }).join(" · ") + "</p></section>";

  // cheapest path to Era Currency from total levels
  var next = e.totalRewards.filter(function (t) { return t[0] > total; }).slice(0, 8);
  var lv = units.map(function (u) { return u.lv; }), cum = {}, cur = total, rowsP = [];
  next.forEach(function (t) {
    while (cur < t[0]) { var i = lv.indexOf(Math.min.apply(0, lv)); if (lv[i] >= L.length) break; lv[i]++; addCost(cum, L[lv[i] - 1].cost); cur++; }
    rowsP.push({ at: t[0], ec: t[1], cost: JSON.parse(JSON.stringify(cum)) });
  });
  h += '<section class="panel stack"><h2>Free Era Currency from levelling</h2><p class="small muted">The game pays Era Currency when your <b>total</b> Era level across all ' + units.length + " units hits these marks. The cheapest way there is to level your lowest unit each time, because early levels cost far less.</p>" +
    '<div class="tbl"><table><tr><th>Total level</th><th>Reward</th><th>Total cost from now (cheapest path)</th></tr>' + rowsP.map(function (p) { return "<tr><td>" + p.at + '</td><td class="yes"><b>+' + p.ec + ' EC</b></td><td style="white-space:normal">' + costHTML(p.cost) + "</td></tr>"; }).join("") + "</table></div></section>";

  // coliseum rewards
  if (col) {
    var b0 = col.bosses[0];
    h += '<section class="panel stack"><h2>Coliseum rewards</h2><div class="two"><div class="stack"><h3>Daily leaderboard</h3><div class="tbl"><table><tr><th>Daily rank</th><th>Era Currency</th><th>Over ' + daysLeft + " days</th></tr>" +
      col.daily.map(function (d) { return "<tr><td>" + d[0] + (d[1] ? "–" + d[1] : "+") + '</td><td><b>' + d[2] + "</b></td><td>" + (d[2] * daysLeft).toLocaleString() + "</td></tr>"; }).join("") + "</table></div></div>" +
      '<div class="stack"><h3>Difficulty milestones (per boss)</h3><div class="tbl"><table><tr><th>Difficulty</th><th>Rewards for all milestones</th></tr>' +
      b0.diffs.map(function (d) { return "<tr><td>" + d.diff.replace("DIFF", "Tier ") + '</td><td style="white-space:normal">' + (d.ec ? '<b class="yes">' + d.ec.toLocaleString() + " EC</b> " : "") + costHTML(d.mats) + "</td></tr>"; }).join("") + '</table></div><p class="tiny muted">Tiers 1–10 pay Era upgrade materials, tiers 11–12 pay Era Currency. There are ' + col.bosses.length + " bosses: " + col.bosses.map(function (b) { return esc(b.name); }).join(", ") + ".</p></div></div></section>";
  }

  // best teams per boss
  var CT = H.coliseumTeams;
  if (col && CT && CT.bosses) {
    var order = [], seen = {};
    (today ? [today] : []).concat(sched.filter(function (s) { return s[0] > now; })).forEach(function (s) { var b = col.bosses[s[2]]; if (b && !seen[b.id]) { seen[b.id] = 1; order.push({ b: b, at: s[0] }); } });
    col.bosses.forEach(function (b) { if (!seen[b.id]) order.push({ b: b, at: 0 }); });
    var edrio = e.units.filter(function (id) { return CT.bosses && JSON.stringify(CT.bosses).indexOf(id) >= 0; });
    h += '<section class="stack"><div class="sechead"><div><span class="eyebrow">Coliseum</span><h2>Best teams for each boss</h2><p class="small muted">Top runs on swgoh.gg for this Era (updated ' + esc(CT.updated) + "). Grey ring = loaned, so everyone can use them.</p></div></div>" +
      '<div class="panel stack"><h3>What actually raises your score</h3><p class="small">In the Coliseum, <b>loaned units fight at your Loaned Era level</b>, not their normal gear. So two numbers decide how far you get:</p><div class="kpis">' +
      edrio.map(function (id) { return '<div class="kpi"><b>EL ' + (mine[id] || 0) + ' <span class="muted" style="font-size:1rem">/ ' + CT.topLevels.era + "</span></b><span>" + esc(U[id] ? U[id].name : id) + " Era level (yours / top players)</span></div>"; }).join("") +
      '<div class="kpi"><b>' + (E.loanedLevel || 0) + ' <span class="muted" style="font-size:1rem">/ ' + esc(CT.topLevels.loaned) + '</span></b><span>Loaned Era level (yours / top players)</span></div></div><p class="small"><b>Put every Era material into ' + edrio.map(function (id) { return esc(U[id] ? U[id].name : id); }).join(", ") + "</b>. It's in every top team on every boss.</p>" +
      '<h3 style="margin-top:6px">How to raise your Loaned Era level</h3><p class="small muted">You can\'t level loaned units with materials or crystals. Each <b>Loaned Unit Era Level Increase token</b> you receive is used automatically and raises <b>all</b> your loaned units by 1. Get every token from:</p><div class="steps">' +
      '<div class="step"><div><b>Your inbox, every day</b><p>EA sends the tokens mainly as daily inbox mail ("Your Loaned Unit Era Level Tokens"). Claim all mail, including old messages; late claims still count.</p></div></div>' +
      '<div class="step"><div><b>The free Loaned Unit Era Level Increase calendar</b><p>Collect the free calendar from the store, then claim it every day. Unclaimed days are lost when it expires.</p></div></div>' +
      '<div class="step"><div><b>Era marquee events to Tier IV</b><p>Reaching Tier IV in a marquee event unlocks a free pack of tokens. Claim it from the store.</p></div></div>' +
      '<div class="step"><div><b>Episode Pass bonus pack</b><p>If you have the Episode Pass, it includes a free pack of tokens. Claim it once.</p></div></div></div></div>' +
      '<div class="cards">' + order.map(function (o) {
        var bt = CT.bosses[o.b.id]; if (!bt) return "";
        var when = today && col.bosses[today[2]].id === o.b.id ? '<span class="chip hard">Live now</span>' : o.at ? '<span class="chip">' + new Date(o.at * 1000).toLocaleDateString([], { weekday: "long" }) + "</span>" : "";
        return '<div class="panel stack"><div class="bossart" style="background-image:url(' + IMG + (BOSS_ART[o.b.id] || "") + '.png)"><b>' + esc(o.b.name) + "</b>" + when + '</div><p class="small muted">' + esc(bt.tip) + "</p>" + bt.teams.map(function (t, i) {
          return '<div class="stack" style="gap:6px;padding-top:8px;border-top:1px solid var(--line)"><div class="sechead"><b class="small">' + (i === 0 ? "Best team" : "Option " + (i + 1)) + '</b><span class="tiny muted">' + esc(t.best) + "</span></div><div class=\"minis\" style=\"gap:10px 14px\">" +
            t.units.map(function (id) { var loan = e.loaned.indexOf(id) >= 0, era = e.units.indexOf(id) >= 0; return '<a class="uc" style="padding:2px;width:76px" href="#unit-' + esc(id) + '">' + por(id, { size: "sm", badge: era ? "EL " + (mine[id] || 0) : loan ? "Loan" : undefined }) + '<span class="nm" style="font-size:.7rem">' + esc(U[id] ? U[id].name : id) + "</span></a>"; }).join("") +
            '</div><span class="tiny muted">' + esc(t.note) + "</span></div>";
        }).join("") + "</div>";
      }).join("") + "</div></section>";
  }

  // projection + crystal check
  var cs = store("hub-era-calc") || {};
  var bands = col ? col.daily : [];
  h += '<section class="panel stack"><h2>Future Era Currency calculator</h2><p class="small muted">Projects how much Era Currency you can earn for free before the Era ends, then checks whether a crystal offer is worth it. Change the numbers to match your game.</p>' +
    '<div class="filters">' +
    '<label class="small stack" style="gap:4px">Your usual daily Coliseum rank<select id="e_band">' + bands.map(function (d, i) { return '<option value="' + i + '"' + (String(cs.band != null ? cs.band : bands.length - 1) === String(i) ? " selected" : "") + ">" + d[0] + (d[1] ? "–" + d[1] : "+") + " (" + d[2] + "/day)</option>"; }).join("") + "</select></label>" +
    '<label class="small stack" style="gap:4px">Highest Coliseum tier you fully clear<select id="e_tier">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (t) { return '<option value="' + t + '"' + (+(cs.tier || 0) === t ? " selected" : "") + ">" + (t ? "Tier " + t : "None yet") + "</option>"; }).join("") + "</select></label>" +
    '<label class="small stack" style="gap:4px">Tier 12 best damage (millions)<input id="e_dmg" type="number" min="0" step="0.5" value="' + (cs.dmg || 0) + '"></label>' +
    '<label class="small stack" style="gap:4px">Total Era level you\'ll reach<input id="e_lv" type="number" min="' + total + '" value="' + (cs.lv || Math.max(total, 70)) + '"></label>' +
    '<label class="small stack" style="gap:4px">Lightspeed Token cost in Era Shipments (EC)<input id="e_tok" type="number" min="1" value="' + (cs.tok || 3500) + '"></label></div>' +
    '<div id="e_out"></div><h3>Is a crystal offer worth it?</h3><div class="filters"><label class="small stack" style="gap:4px">Offer price (crystals)<input id="e_cry" type="number" min="0" value="' + (cs.cry || 0) + '"></label><label class="small stack" style="gap:4px">Era Currency it gives (or its EC value)<input id="e_ofec" type="number" min="0" value="' + (cs.ofec || 0) + '"></label></div><div id="e_ver"></div></section>';

  h += '<section class="panel stack"><h2>How to climb the Era and Coliseum</h2><div class="steps">' +
    '<div class="step"><div><b>Fight the Coliseum boss every single day</b><p>Even the lowest daily rank pays Era Currency, and it adds up over ' + daysLeft + ' days. Bosses rotate every day: ' + (col ? col.bosses.map(function (b) { return esc(b.name); }).join(" → ") : "") + '.</p></div></div>' +
    '<div class="step"><div><b>Push the highest tier you can clear</b><p>Each boss pays one-off milestone rewards per tier. Tiers 1–10 give the materials you need to level Era units, tiers 11–12 give Era Currency directly.</p></div></div>' +
    '<div class="step"><div><b>Put Era materials into the Era unit every top team uses</b><p>Right now that\'s Edrio Two Tubes, the only Era unit in the best teams for all 4 bosses. Each level also counts toward the total-level Era Currency rewards.</p></div></div>' +
    '<div class="step"><div><b>Level other Era units as they unlock</b><p>Early levels are cheap and add to your total Era level, so bring each new Era unit up a little once you have it.</p></div></div>' +
    '<div class="step"><div><b>Raise your Loaned Era level</b><p>Loaned units fight at your loaned Era level (now ' + (E.loanedLevel || 0) + '). Claim every Loaned Unit Era Level token: daily inbox mail, the free calendar, Tier IV marquee packs and the Episode Pass pack.</p></div></div>' +
    '<div class="step"><div><b>Do the Era events</b><p>Era materials also come from the Era legendary event and each Era unit\'s marquee event. Clear every tier you can, for free.</p></div></div>' +
    '<div class="step"><div><b>Spend Era Currency on Lightspeed Tokens for goal units</b><p>Put tokens on low-star units your goals need, so you save the shards as well.</p></div></div></div></section>';

  setTimeout(function () {
    ["e_band", "e_tier", "e_dmg", "e_lv", "e_tok", "e_cry", "e_ofec"].forEach(function (k) { $(k).addEventListener("input", calc); });
    calc();
  });
  function calc() {
    var c = { band: $("e_band").value, tier: +$("e_tier").value, dmg: +$("e_dmg").value || 0, lv: +$("e_lv").value || total, tok: +$("e_tok").value || 3500, cry: +$("e_cry").value || 0, ofec: +$("e_ofec").value || 0 };
    store("hub-era-calc", c);
    var daily = bands[c.band] ? bands[c.band][2] * daysLeft : 0;
    var nb = col ? col.bosses.length : 0, prog = 0;
    if (col) col.bosses[0].diffs.forEach(function (d, i) {
      var t = i + 1; if (t < 12 && t <= c.tier) prog += d.ec * nb;
      if (t === 12) d.tiers.forEach(function (x) { if (x[0] <= c.dmg * 1e6 && x[0] > 100) x[1].forEach(function (r) { if (r[0] === "ERA_CURRENCY") prog += r[1] * nb; }); });
    });
    var lvEc = e.totalRewards.filter(function (t) { return t[0] > total && t[0] <= c.lv; }).reduce(function (s, t) { return s + t[1]; }, 0);
    var sum = daily + prog + lvEc, toks = Math.floor(sum / c.tok);
    $("e_out").innerHTML = '<div class="kpis" style="margin:10px 0"><div class="kpi"><b>' + daily.toLocaleString() + '</b><span>daily leaderboard</span></div><div class="kpi"><b>' + prog.toLocaleString() + '</b><span>Coliseum milestones (' + nb + ' bosses)</span></div><div class="kpi"><b>' + lvEc.toLocaleString() + '</b><span>total-level rewards</span></div><div class="kpi"><b class="yes">' + sum.toLocaleString() + '</b><span>free Era Currency by ' + new Date(e.end * 1000).toLocaleDateString() + '</span></div><div class="kpi"><b class="yes">' + toks + '</b><span>Lightspeed Tokens it buys</span></div></div><p class="tiny muted">Assumes Coliseum milestone rewards pay once per boss per Era.</p>';
    var v = "";
    if (c.cry && c.ofec) {
      var per = c.cry / c.ofec * c.tok, verdict = per <= 1000 ? ["Good deal", "yes", "if the token goes on a goal unit you need soon."] : per <= 2500 ? ["Only if you need it now", "", "free Era Currency gets you there by the end of the Era anyway."] : ["Skip", "no", "energy refreshes give you more progress for the same crystals."];
      v = '<div class="panel" style="margin-top:10px"><span class="verdict ' + verdict[1] + '">' + verdict[0] + '</span><p class="small">That\'s about <b>' + Math.round(per).toLocaleString() + " crystals per Lightspeed Token</b>: " + verdict[2] + '</p><p class="tiny muted">Bands (my rule of thumb, not game data): under 1,000 crystals per token good, 1,000–2,500 situational, over 2,500 skip.</p></div>';
    } else v = '<p class="tiny muted">Enter an offer\'s price and the Era Currency it gives to check it.</p>';
    $("e_ver").innerHTML = v;
  }
  return h;
};

// ---------------------------------------------------------------- planning helpers
function parseT(t) { t = String(t).toUpperCase(); if (t[0] === "R") return { stars: 7, gear: 13, relic: +t.slice(1) }; if (t[0] === "G") return { stars: 7, gear: +t.slice(1), relic: null }; return { stars: parseInt(t, 10), gear: 0, relic: null }; }
function firstNode(id) { var f = U[id].farm.filter(function (l) { return /Hard/.test(l); })[0] || U[id].farm.filter(function (l) { return !/^Event|^Guild/.test(l); })[0]; return f || null; }
function needText(id, target) {
  var r = R[id], t = parseT(target), node = firstNode(id);
  if (!r) return { k: "unlock", s: "Unlock it" + (node ? ": farm " + node : ": events or marquee only") };
  if (r.stars < t.stars) return { k: "shards", s: "Farm " + (CUM[t.stars] - CUM[r.stars]) + " shards" + (node ? " · " + node : " · events only") };
  if (t.gear && r.gear < Math.min(13, t.gear)) return { k: "gear", s: "Gear G" + r.gear + " → G" + Math.min(13, t.gear) + " (see Gear list)" };
  if (t.relic != null && (r.relic || 0) < t.relic) return { k: "relic", s: "Relic R" + (r.relic || 0) + " → R" + t.relic + " (relic materials, Signal Data)" };
  return { k: "done", s: "Done" };
}
var TOK_ERA = { ERA08: "New Republic", ERA09: "Myths & Legends", ERA10: "Mando & Grogu", ERA11: "Rogue One" };
function tokLabel(t) {
  var m = /ERA(\d+)_TIER0?(\d+)_(.+)$/.exec(t.id), fac = m ? m[3].replace(/_/g, " ").toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : t.id.replace(/^LST_/, "").replace(/_/g, " ").toLowerCase();
  return (m ? (TOK_ERA["ERA" + m[1]] || "Era " + m[1]) + " · Tier " + m[2] + " · " : "") + fac + " → " + t.stars + "★ " + (t.relic != null ? "R" + t.relic : "G" + t.gear);
}
function tokenTargets(t) {
  var gu = goalUnits(), tl = t.gear + (t.relic || 0);
  return t.units.filter(function (u) { return U[u] && !isGL(u); }).map(function (u) {
    var r = R[u], st = r ? r.stars : 0, shards = Math.max(0, CUM[t.stars] - CUM[st]), lv = r ? r.gear + (r.relic || 0) : 0, gain = Math.max(0, tl - lv);
    return { id: u, shards: shards, gain: gain, goal: !!gu[u], score: shards + gain * 20 + (gu[u] ? 250 : 0) };
  }).filter(function (x) { return x.shards > 0 || x.gain > 0; }).sort(function (a, b) { return b.score - a.score; });
}

// ---------------------------------------------------------------- fast plan
V.plan = function () {
  var gu = goalUnits(), e = eraNow(), CT = H.coliseumTeams;
  var open = H.goals.filter(function (g) { return !g.owned; }).sort(function (a, b) { return b.progress - a.progress; });
  var emptyMods = Object.keys(R).filter(function (i) { return !U[i].ship && gu[i] && R[i].mods.length < 6 && R[i].gear >= 8; });
  var slice = sliceCandidates();
  var f = H.farm.filter(function (x) { return farmable(x.id); })[0];
  var raid = H.guild && H.guild.raids[0];
  var edr = e ? e.units.filter(function (id) { return CT && JSON.stringify(CT.bosses || {}).indexOf(id) >= 0; })[0] : null;
  var h = '<section class="hero"><div class="stack"><span class="eyebrow">Fast plan</span><h1>Your fastest path</h1><p class="muted">Built from your live roster. Do the levers in this order; each one unlocks the next.</p></div>' +
    '<div class="stack"><span class="eyebrow">Next unlock</span><h2>' + (open[0] ? esc(open[0].name) : "All goals unlocked") + "</h2>" + (open[0] ? bar(open[0].progress) + '<span class="tiny muted">' + Math.round(open[0].progress * 100) + "% · " + open[0].done + " of " + open[0].rows.length + " requirements met</span>" : "") + "</div></section>";

  h += '<section class="panel stack"><h2>Are Lightspeed Tokens the best strategy?</h2><div class="two"><div class="stack small">' +
    "<p><b>They're the biggest single shortcut, but not the whole strategy.</b> A Tier 5 token turns an eligible unit straight into 7★ Gear 13, which saves up to 330 shards plus every gear piece. That's weeks of farming in one tap.</p>" +
    "<p>But you only get a few per Era, each is limited to one faction, and they <b>can't be used on Galactic Legends or journey units</b>. So they speed up the plan; they don't replace it.</p></div>" +
    '<div class="stack small"><p><b>The winning formula:</b></p><ol><li>A daily engine: energy on your slowest shards, Hard nodes, guild rewards</li><li>Full Speed mods on every goal character</li><li>Lightspeed Tokens on the <b>lowest-star goal unit each token can reach</b> (use the planner below)</li><li>Coliseum every day for Era Currency, which buys more tokens</li></ol></div></div></section>';

  var levers = [];
  if (open[0]) levers.push({ n: "Finish " + open[0].name, why: "Your closest unlock. Its blockers are listed below.", vis: '<div class="minis">' + open[0].rows.filter(function (r) { return r.progress < 1; }).sort(function (a, b) { return b.progress - a.progress; }).slice(0, 5).map(function (r) { return mini(r.id, esc(needText(r.id, r.target).s)); }).join("") + "</div>", link: "#goals" });
  if (f) levers.push({ n: "Farm " + U[f.id].name + " every day", why: "Shards are your slowest resource. Spend energy and Hard-node refreshes here first.", vis: unitShard(f) + '<div class="where">' + nodePath(firstNode(f.id)) + "</div>", link: "#farm" });
  if (emptyMods.length || slice.length) levers.push({ n: "Fix mods", why: emptyMods.length + " goal characters have empty slots; " + slice.length + " Speed mods are worth slicing.", vis: '<div class="minis">' + emptyMods.slice(0, 4).map(function (i) { return mini(i, R[i].mods.length + "/6 mods"); }).join("") + "</div>", link: "#mods" });
  levers.push({ n: "Use Lightspeed Tokens on low-star goal units", why: "Pick a token you own in the planner below to see where it saves the most.", vis: "", link: "#plan" });
  if (e && edr) levers.push({ n: "Coliseum every day, level " + U[edr].name, why: "Era Currency buys more Lightspeed Tokens. " + U[edr].name + " is in every top team.", vis: mini(edr, "Era level " + (H.era.mine[edr] || 0) + " · top players 55"), link: "#era" });
  if (raid) levers.push({ n: "Join every guild raid", why: raid.mine ? "Keep using every attempt." : "You scored 0 in the last raid. Raid rewards include relic and zeta materials.", vis: "", link: "#guild" });
  h += '<section class="stack"><h2>Your levers, in order</h2>' + levers.map(function (l, i) {
    return '<div class="mstep"><div class="num">' + (i + 1) + '</div><div style="min-width:0"><h3>' + esc(l.n) + '</h3><p class="small muted" style="margin:4px 0 0">' + esc(l.why) + '</p><div class="vis">' + l.vis + '</div></div><a class="tick" style="text-decoration:none" href="' + l.link + '">Open →</a></div>';
  }).join("") + "</section>";

  var toks = (H.tokens || []).filter(function (t) { return !t.ship && t.units.length; });
  var eras = {}; toks.forEach(function (t) { var m = /ERA(\d+)/.exec(t.id); eras[m ? "ERA" + m[1] : "OTHER"] = 1; });
  var cur = e ? e.id.slice(0, 5) : "ERA11", st = store("hub-tok") || {};
  var best = toks.filter(function (t) { return t.id.indexOf(cur) >= 0 && /TIER05/.test(t.id); }).map(function (t) { var top = tokenTargets(t)[0]; return { t: t, s: top ? top.score : -1 }; }).sort(function (a, b) { return b.s - a.s; })[0];
  var pick = toks.filter(function (t) { return t.id === st.id; })[0] || (best && best.t) || toks[0];
  h += '<section class="panel stack"><div class="sechead"><div><h2>Lightspeed Token planner</h2><p class="small muted">Pick a token you own. It ranks your units by shards and gear saved, goal units first. Units it can\'t be used on are already left out.</p></div></div>' +
    '<select id="tokPick" aria-label="Token">' + Object.keys(eras).sort().reverse().map(function (er) {
      return '<optgroup label="' + esc(TOK_ERA[er] || "Other tokens") + '">' + toks.filter(function (t) { return er === "OTHER" ? !/ERA\d+/.test(t.id) : t.id.indexOf(er + "_") >= 0; }).map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === (pick && pick.id) ? " selected" : "") + ">" + esc(tokLabel(t)) + "</option>"; }).join("") + "</optgroup>";
    }).join("") + '</select><div id="tokOut" class="list"></div></section>';

  h += '<section class="stack"><h2>What each goal still needs</h2>' + open.map(function (g) {
    var rows = g.rows.filter(function (r) { return r.progress < 1; }).map(function (r) { return { r: r, n: needText(r.id, r.target) }; });
    var order = { unlock: 0, shards: 1, gear: 2, relic: 3, done: 4 };
    rows.sort(function (a, b) { return order[a.n.k] - order[b.n.k] || b.r.progress - a.r.progress; });
    return '<div class="panel stack"><div class="sechead"><h3>' + esc(g.name) + '</h3><span class="tiny muted">' + Math.round(g.progress * 100) + "%</span></div>" + bar(g.progress) +
      '<div class="list">' + rows.map(function (x) { return '<div class="row">' + por(x.r.id, { size: "sm" }) + '<div style="min-width:0"><b>' + esc(U[x.r.id].name) + ' <span class="chip">needs ' + esc(x.r.target) + '</span></b><span class="small">' + esc(x.n.s) + '</span></div><span class="chip ' + (x.n.k === "shards" || x.n.k === "unlock" ? "hard" : "") + '">' + { unlock: "Unlock", shards: "Shards", gear: "Gear", relic: "Relic" }[x.n.k] + "</span></div>"; }).join("") + "</div></div>";
  }).join("") + "</section>";

  setTimeout(function () {
    function draw() {
      var t = toks.filter(function (x) { return x.id === $("tokPick").value; })[0]; if (!t) return;
      store("hub-tok", { id: t.id });
      var list = tokenTargets(t).slice(0, 10);
      $("tokOut").innerHTML = (list.map(function (x, i) {
        var r = R[x.id];
        return '<div class="row">' + por(x.id) + '<div style="min-width:0"><b>' + (i === 0 ? '<span class="chip hard">Best use</span> ' : "") + esc(U[x.id].name) + (x.goal ? ' <span class="chip">Goal unit</span>' : "") + '</b><span class="small">' + (r ? r.stars + "★ " + lvl(r) : "Locked") + " → <strong>" + t.stars + "★ " + (t.relic != null ? "R" + t.relic : "G" + t.gear) + '</strong></span><span class="tiny muted">Saves ' + x.shards + " shards" + (x.gain ? " + " + x.gain + " gear/relic levels" : "") + "</span></div>" + '<div class="big">' + (x.shards || "+" + x.gain) + "<small>" + (x.shards ? "shards saved" : "levels gained") + "</small></div></div>";
      }).join("")) || '<p class="small muted">None of your units would gain from this token.</p>';
    }
    var sel = $("tokPick"); if (sel) { sel.addEventListener("change", draw); draw(); }
  });
  return h;
};

// ---------------------------------------------------------------- mods helpers
function sliceCandidates() {
  var out = [];
  Object.keys(R).forEach(function (i) { if (U[i].ship) return; R[i].mods.forEach(function (m) {
    var sp = 0; m.sec.forEach(function (s) { if (s[0] === "Speed") sp = s[1]; });
    if (m.dots === 5 && m.lvl === 15 && m.tier < 5 && sp >= 8) out.push({ id: i, m: m, sp: sp, to: "gold (5A)" });
    else if (m.dots === 5 && m.tier === 5 && sp >= 15) out.push({ id: i, m: m, sp: sp, to: "6-dot" });
  }); });
  return out.sort(function (a, b) { return b.sp - a.sp; });
}
V.mods = function () {
  var gu = goalUnits(), ids = Object.keys(R).filter(function (i) { return !U[i].ship && R[i].gear >= 12; });
  ids.sort(function (a, b) { return (gu[b] ? 1 : 0) - (gu[a] ? 1 : 0) || "DCBA".indexOf(R[a].modGrade) - "DCBA".indexOf(R[b].modGrade) || R[a].modSpeed - R[b].modSpeed; });
  var c = { A: 0, B: 0, C: 0, D: 0 }; ids.forEach(function (i) { c[R[i].modGrade]++; });
  var empty = Object.keys(R).filter(function (i) { return !U[i].ship && gu[i] && R[i].mods.length < 6 && R[i].gear >= 8; });
  var low = Object.keys(R).filter(function (i) { return !U[i].ship && gu[i] && R[i].mods.some(function (m) { return m.lvl < 15; }); });
  var arrows = Object.keys(R).filter(function (i) { var a = R[i].mods.filter(function (m) { return m.slot === 2; })[0]; return !U[i].ship && gu[i] && a && a.prim !== "Speed"; });
  var slice = sliceCandidates();
  var spare = [];
  Object.keys(R).forEach(function (i) { if (U[i].ship || gu[i] || R[i].gear >= 12) return; R[i].mods.forEach(function (m) { var sp = 0; m.sec.forEach(function (s) { if (s[0] === "Speed") sp = s[1]; }); if (sp >= 12) spare.push({ id: i, m: m, sp: sp }); }); });
  spare.sort(function (a, b) { return b.sp - a.sp; });
  function modRow(x, note) { var m = x.m; return '<div class="row">' + modIcon(m.slot, "ok") + '<div style="min-width:0"><b>' + SLOT[m.slot] + " · " + esc(m.set) + " · " + m.dots + "-dot · " + ["", "grey", "green", "blue", "purple", "gold"][m.tier] + '</b><span class="small">Speed <strong class="yes">+' + x.sp + "</strong> · on " + esc(U[x.id].name) + '</span><span class="tiny muted">' + note + "</span></div>" + por(x.id, { size: "sm" }) + "</div>"; }
  var h = '<div class="sechead"><div><span class="eyebrow">Speed is king</span><h1>Mods</h1><p class="muted">Your mod to-do list comes first, then grades for every Gear 12+ character.</p></div><a class="link" href="#ships">Shipment checker →</a></div>';
  h += '<div class="kpis">' + ["A", "B", "C", "D"].map(function (g) { return '<div class="kpi"><b class="g' + g + '">' + c[g] + "</b><span>grade " + g + "</span></div>"; }).join("") + "</div>";
  h += '<section class="stack"><h2>Mod to-do list</h2>';
  var steps = [];
  if (empty.length) steps.push(["Fill empty slots on goal characters", "Characters › pick the unit › Mods › fill the red slots. Pull Speed mods off units you don't use.", empty.slice(0, 6).map(function (i) { return '<div class="stack" style="gap:6px">' + mini(i, R[i].mods.length + "/6 mods") + '<div style="display:flex;gap:4px">' + [1, 2, 3, 4, 5, 6].map(function (s) { return modIcon(s, R[i].mods.some(function (m) { return m.slot === s; }) ? "ok" : "empty"); }).join("") + "</div></div>"; }).join("")]);
  if (spare.length) steps.push(["Move Speed mods off characters you don't use", "These mods have +12 Speed or more but sit on low-gear units outside your goals.", '<div class="list" style="flex:1 1 100%">' + spare.slice(0, 5).map(function (x) { return modRow(x, "Move it to a goal character"); }).join("") + "</div>"]);
  if (low.length) steps.push(["Level goal characters' mods to 15", "Cheapest power in the game. Each level-up at 3, 6, 9 and 12 can roll into Speed.", '<div class="minis">' + low.slice(0, 8).map(function (i) { return mini(i, R[i].mods.filter(function (m) { return m.lvl < 15; }).length + " mods below 15"); }).join("") + "</div>"]);
  if (arrows.length) steps.push(["Swap to Speed arrows", "A Speed arrow gives +30 Speed at level 15. These goal characters use a different arrow.", '<div class="minis">' + arrows.slice(0, 8).map(function (i) { return mini(i, "Arrow: " + R[i].mods.filter(function (m) { return m.slot === 2; })[0].prim); }).join("") + "</div>"]);
  if (slice.length) steps.push(["Slice your best Speed mods", "Slicing adds rolls to secondaries. Only slice mods that already have good Speed.", '<div class="list" style="flex:1 1 100%">' + slice.slice(0, 6).map(function (x) { return modRow(x, "Slice to " + x.to); }).join("") + "</div>"]);
  h += steps.map(function (s, i) { return '<div class="mstep"><div class="num">' + (i + 1) + '</div><div style="min-width:0"><h3>' + esc(s[0]) + '</h3><p class="small muted" style="margin:4px 0 0">' + esc(s[1]) + '</p><div class="vis">' + s[2] + "</div></div><span></span></div>"; }).join("") + "</section>";
  h += '<section class="stack"><div class="sechead"><h2>Grades</h2>' + seg("m", [["bad", "Needs work (C, D)"], ["all", "Everyone"]], "bad") + '</div><p class="tiny muted">Graded on Speed from mods: A 80+, B 55–79, C 30–54, D under 30 or empty slots. Goal characters first.</p><div class="grid" id="mg"></div></section>';
  h += '<section class="panel stack"><h3>How to farm good mods</h3><ul class="clean small"><li><b>Mod Battles every day</b> with Mod Energy: tap each node to see its drops and pick Speed sets and arrows.</li><li><b>Mod Shipments</b>: buy 5-dot mods that already show Speed. Use the checker.</li><li><b>Daily Mod Challenges</b> pay slicing materials and credits.</li><li><b>Sell</b> low-dot mods without Speed for credits.</li></ul></section>';
  setTimeout(function () { var mode = "bad";
    document.querySelectorAll('.seg button[data-g="m"]').forEach(function (b) { b.addEventListener("click", function () { mode = b.dataset.v; b.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); draw(); }); });
    function draw() { $("mg").innerHTML = ids.filter(function (i) { return mode === "all" || "CD".indexOf(R[i].modGrade) >= 0; }).map(function (i) { return uc(i, '<span class="grade g' + R[i].modGrade + '">' + R[i].modGrade + '</span><span class="tiny muted">+' + Math.round(R[i].modSpeed) + " spd</span>"); }).join(""); }
    draw(); });
  return h;
};

// ---------------------------------------------------------------- farming guide
V.farm = function () {
  var st = store("hub-farm") || { ref: 0, rate: 0.5 };
  var h = '<div><span class="eyebrow">Energy plan</span><h1>Farming</h1><p class="muted">Shards your goals still need, top priority first. Each card shows exactly where to go in the game and how long it will take.</p></div>';
  h += '<div class="filters"><label class="small stack" style="gap:4px">Hard-node refreshes per day<select id="f_ref">' + [0, 1, 2, 3].map(function (n) { return '<option value="' + n + '"' + (+st.ref === n ? " selected" : "") + ">" + n + " (" + (5 * (n + 1)) + " attempts)</option>"; }).join("") + '</select></label><label class="small stack" style="gap:4px">Average shards per attempt<select id="f_rate">' + [[0.33, "0.33 (unlucky)"], [0.5, "0.5 (typical)"], [1, "1 (lucky)"]].map(function (o) { return '<option value="' + o[0] + '"' + (+st.rate === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + '</select></label></div><p class="tiny muted">Time estimates are rough. Hard nodes allow 5 attempts a day, plus 5 more per refresh. Drop rates vary; "typical" is a community rule of thumb.</p><div id="fl" class="mission"></div>';
  h += '<section class="panel stack"><h3>Energy rules</h3><ul class="clean small"><li>Buy the 3 cheapest energy refreshes every day and spend them at the top of this list.</li><li>Double drop events: put all energy and refreshes into this list.</li><li>Cantina energy: Cantina shards from this list first, then Signal Data on Cantina 9-F.</li><li>Units marked "Events only" can\'t be farmed. Watch for their event or use a Lightspeed Token if one fits (Fast plan page).</li></ul></section>';
  setTimeout(function () {
    function draw() {
      var ref = +$("f_ref").value, rate = +$("f_rate").value; store("hub-farm", { ref: ref, rate: rate });
      $("fl").innerHTML = H.farm.map(function (f, i) {
        var nodes = U[f.id].farm, farmableNode = nodes.filter(function (l) { return !/^Event|^Guild/.test(l); });
        var perDay = farmableNode.some(function (l) { return /Hard/.test(l); }) ? 5 * (ref + 1) * rate : farmableNode.length ? 8 * rate : 0;
        var days = perDay ? Math.ceil(f.shards / perDay) : null;
        var have = CUM[f.stars] || 0, need = CUM[f.to] || 1;
        return '<div class="mstep"><div class="num">' + (i + 1) + "</div><div style=\"min-width:0\"><h3>" + esc(U[f.id].name) + '</h3><div class="where">' + (farmableNode.length ? farmableNode.map(nodePath).join("<i>or</i>") : "Events or marquee only") + '</div><div class="vis">' + por(f.id, { badge: f.stars ? f.stars + "★" : "locked" }) +
          '<div class="stack" style="gap:6px;min-width:0"><span>' + stars(f.stars) + " → " + f.to + '★ <span class="tiny muted">for ' + esc(f.goals.join(", ")) + '</span></span><div class="shardbar">' + bar(have / need) + '<span class="muted">' + f.shards + " shards to go</span></div></div></div></div>" +
          '<div class="big">' + (days ? days : "—") + "<small>" + (days ? "days" : "events") + "</small></div></div>";
      }).join("") || '<p class="muted">Nothing left to farm for your goals.</p>';
    }
    ["f_ref", "f_rate"].forEach(function (k) { $(k).addEventListener("change", draw); }); draw();
  });
  return h;
};

// ---------------------------------------------------------------- crystals guide
V.crystals = function () {
  var f = H.farm.filter(function (x) { return farmable(x.id); })[0];
  var LADDER = [["Energy refresh 1", 50, "120 energy for your top farm"], ["Energy refresh 2", 50, "Same price, same value"], ["Energy refresh 3", 100, "Still the best value in the game"],
    ["Cantina refresh 1", 100, "Cantina shards or Signal Data"], ["Hard-node refresh" + (f ? " on " + U[f.id].name : ""), 100, "5 more attempts at your slowest shards"],
    ["Energy refresh 4", 100, "Only once the above are done"], ["Energy refresh 5", 100, "Good on double drop days"], ["Cantina refresh 2", 200, "If Cantina farms are on your list"]];
  var st = store("hub-cry") || { b: 250 };
  var h = '<div><span class="eyebrow">Premium currency</span><h1>Crystals</h1><p class="muted">Spend crystals on energy for your slowest shards, and never on random packs. Pick your daily budget to see exactly what to buy.</p></div>';
  h += '<section class="panel stack"><div class="sechead"><h2>Your daily spend plan</h2>' + seg("cb", [["0", "0"], ["100", "100"], ["250", "250"], ["500", "500"], ["1000", "1,000"]], String(st.b)) + '</div><div id="cl" class="list"></div><p class="tiny muted">Refresh prices are approximate and rise each time; check in game.</p></section>';
  var rank = H.arena && H.arena.fleet, PAY = [[1, 1, 400], [2, 5, 375], [6, 10, 200], [11, 20, 100], [21, 50, 50]];
  h += '<section class="panel stack"><h2>Earn more crystals</h2><div class="two"><div class="stack"><h3>Fleet Arena daily payout</h3><div class="tbl"><table><tr><th>Rank</th><th>Crystals / day</th><th>Per month</th></tr>' + PAY.map(function (p) { var me = rank && rank >= p[0] && rank <= p[1]; return '<tr class="' + (me ? "me" : "") + '"><td>#' + p[0] + (p[1] > p[0] ? "–" + p[1] : "") + "</td><td>" + p[2] + "</td><td>" + (p[2] * 30).toLocaleString() + "</td></tr>"; }).join("") + '<tr class="' + (rank > 50 ? "me" : "") + '"><td>#51+</td><td>0</td><td>0</td></tr></table></div><p class="small">You are <b>#' + (rank || "–") + "</b>. " + (rank > 50 ? "Reaching the top 50 is worth at least 1,500 crystals a month." : "Keep climbing.") + '</p></div><div class="stack"><h3>Other sources</h3><ul class="clean small"><li><b>Grand Arena</b>: rewards grow with your league, so win rounds to climb.</li><li><b>Territory Battles</b>: more guild stars mean more crystals for everyone.</li><li><b>Achievements and the Episode track</b>: claim every reward.</li><li><b>Daily activities</b>: complete all of them.</li></ul></div></div></section>';
  h += '<div class="two"><div class="panel stack"><h3 class="no">Never buy</h3><ul class="clean small"><li>Chromium or random packs</li><li>Marquee packs at full price</li><li>Gear or relic materials at full crystal price</li><li>Squad Arena refreshes</li><li>Era materials (use the free Coliseum instead; see the Era calculator)</li></ul></div><div class="panel stack"><h3 class="yes">Only sometimes</h3><ul class="clean small"><li><b>Packs with shards you are farming</b>, when the price per shard beats refreshing.</li><li><b>Conquest refreshes</b> when you need them for the Red crate.</li><li><b>Galactic Legend event packs</b> only if they finish a requirement.</li></ul></div></div>';
  setTimeout(function () {
    function draw(b) {
      st.b = b; store("hub-cry", st); var left_ = b;
      $("cl").innerHTML = LADDER.map(function (l, i) { var ok = left_ >= l[1]; if (ok) left_ -= l[1];
        return '<div class="row" style="' + (ok ? "" : "opacity:.45") + '"><div class="num" style="display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:' + (ok ? "var(--good)" : "var(--panel2)") + ";color:" + (ok ? "var(--bg)" : "var(--muted)") + ';font:700 1rem var(--display)">' + (ok ? "✓" : i + 1) + '</div><div style="min-width:0"><b>' + esc(l[0]) + '</b><span class="tiny muted">' + esc(l[2]) + '</span></div><div class="big">' + l[1] + "<small>crystals</small></div></div>"; }).join("") +
        '<p class="small">Spend <b>' + (b - left_) + "</b> of " + b + " today" + (left_ ? ". Save the rest " + left_ + " for double drop days." : ".") + "</p>";
    }
    document.querySelectorAll('.seg button[data-g="cb"]').forEach(function (bt) { bt.addEventListener("click", function () { bt.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === bt); x.setAttribute("aria-pressed", x === bt); }); draw(+bt.dataset.v); }); });
    draw(+st.b);
  });
  return h;
};

// ---------------------------------------------------------------- era game plan
function eraPlanHTML(e) {
  var cols = [["Every day", ["Claim Loaned Unit Era Level tokens: inbox and the free calendar", "Coliseum: fight today's boss at the highest tier you can clear, using all attempts", "Era legendary event: use your attempts for Era materials"]],
    ["When they're live", ["Era marquee events to Tier IV: free token pack plus Era materials", "Level Edrio to his next milestone as soon as you can afford it", "Check Era Shipments for Lightspeed Tokens"]],
    ["Before " + new Date(e.end * 1000).toLocaleDateString(), ["Spend Era Currency on Lightspeed Tokens for low-star goal units", "Hit the next total-Era-level reward marks", "Push each Coliseum boss to Tier 11 for 3,200 Era Currency each"]]];
  return '<section class="panel stack"><h2>Era game plan</h2><div class="cards">' + cols.map(function (c) { return '<div class="stack"><h3>' + esc(c[0]) + '</h3><ul class="clean small">' + c[1].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>"; }).join("") + "</div></section>";
}

// ---------------------------------------------------------------- routing
function nav(cur) { $("nav").innerHTML = VIEWS.map(function (v) { return '<a href="#' + v[0] + '" class="' + (cur === v[0] ? "on" : "") + '"' + (cur === v[0] ? ' aria-current="page"' : "") + ">" + icon(v[0]) + "<span>" + v[1] + "</span></a>"; }).join(""); }
function route() {
  var h = location.hash.slice(1) || "home", view = h, arg = null;
  if (h.indexOf("unit-") === 0) { view = "unit"; arg = h.slice(5); }
  if (h.indexOf("compare-") === 0) { view = "compare"; arg = decodeURIComponent(h.slice(8)); }
  if (!V[view]) view = "home";
  nav(view === "unit" ? "roster" : view);
  $("app").innerHTML = V[view](arg);
  var a = document.querySelector(".nav a.on"); if (a && window.innerWidth < 960) a.scrollIntoView({ block: "nearest", inline: "center" });
}
window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });
route();
initSync();

// ---------------------------------------------------------------- sync
function initSync() {
  var btn = $("syncBtn"), msg = $("syncMsg"), barEl = $("syncBar"), toast = $("toast"), started = 0;
  function say(t) { msg.textContent = t; }
  function show(t, ms) { toast.textContent = t; toast.hidden = false; if (ms) setTimeout(function () { toast.hidden = true; }, ms); }
  var base = H ? "Synced " + ago(H.generated) : "No data yet";
  say(base);
  if (location.protocol === "file:") { btn.disabled = true; btn.title = "Start the site with: python3 serve.py"; say(base + " · run serve.py to sync"); return; }
  if (H && H.cloud && H.cloud.repo) {                       // cloud copy: GitHub runs the sync
    var url = "https://github.com/" + H.cloud.repo + "/actions/workflows/" + H.cloud.workflow;
    say(base + " · auto-syncs every " + H.cloud.everyHours + "h");
    btn.addEventListener("click", function () { show("Opening GitHub: tap Run workflow. New data appears in about 3 minutes; then reload.", 8000); window.open(url, "_blank", "noopener"); });
    return;
  }
  function poll() {
    fetch("/api/status", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (s) {
      barEl.style.width = (s.running ? s.pct : 0) + "%";
      if (s.running) { btn.disabled = true; btn.classList.add("spin"); say(s.pct + "% · " + s.msg); show("Syncing " + s.pct + "% · " + s.msg); setTimeout(poll, 800); return; }
      btn.disabled = false; btn.classList.remove("spin");
      if (s.error) { say("Sync failed"); show("Sync failed: " + s.error + ". Is Docker running?", 9000); return; }
      if (started && s.finished && s.finished >= started) { show("Synced. Reloading…"); setTimeout(function () { location.reload(); }, 500); return; }
      toast.hidden = true; say(base);
    }).catch(function () { btn.disabled = true; btn.title = "Start the site with: python3 serve.py"; say(base + " · start serve.py to sync"); });
  }
  btn.addEventListener("click", function () {
    started = Math.floor(Date.now() / 1000) - 2;
    btn.disabled = true; btn.classList.add("spin"); say("Starting…");
    fetch("/api/sync", { method: "POST" }).then(function () { poll(); }).catch(function () { btn.disabled = false; btn.classList.remove("spin"); say("Can't reach serve.py"); });
  });
  poll();
}
})();
