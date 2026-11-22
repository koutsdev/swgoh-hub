#!/usr/bin/env python3
"""SWGOH Hub: your own swgoh.gg-style site, built from swgoh-comlink.

  python3 build.py            fetch fresh data and rebuild site/data.js
  python3 build.py --offline  rebuild from cached data
  python3 build.py --no-guild skip fetching guild members' rosters
Then open site/index.html.

Your ally code comes from --ally, the HUB_ALLY environment variable, or ally.txt next to this file
(kept out of git). When HUB_PASSWORD is set, site/data.js is written encrypted (AES-GCM, key from
PBKDF2-SHA256) and the site asks for the password once per device.

Needs comlink running locally:
  docker run -d --name swgoh-comlink -e APP_NAME=yourAppName \
    -p 127.0.0.1:3000:3000 ghcr.io/swgoh-utils/swgoh-comlink:latest
"""
import argparse, base64, gzip, hashlib, json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
SITE = os.path.join(HERE, "site")
ALLY_FILE = os.path.join(HERE, "ally.txt")
KDF_ITERATIONS = 600_000  # PBKDF2-SHA256; the browser repeats this once per device, then keeps the key

SCHEMA = 3  # bump when extract() output changes, so cached game data is rebuilt
SHARD_COST = {1: 10, 2: 15, 3: 25, 4: 30, 5: 65, 6: 85, 7: 100}   # shards to reach each star
CAMPAIGN_LABEL = {"C01L": "Light Side", "C01D": "Dark Side", "C01H": "Cantina", "C01SP": "Fleet",
                  "C01MB": "Mod Battles"}
SETS = {1: "Health", 2: "Offense", 3: "Defense", 4: "Speed", 5: "Crit Chance", 6: "Crit Damage",
        7: "Potency", 8: "Tenacity"}
STATS = {1: "Health", 5: "Speed", 16: "Crit Damage", 17: "Potency", 18: "Tenacity", 28: "Protection",
         41: "Offense", 42: "Defense", 48: "Offense %", 49: "Defense %", 52: "Accuracy", 53: "Crit Chance",
         54: "Crit Avoidance", 55: "Health %", 56: "Protection %"}
PERCENT = {16, 17, 18, 48, 49, 52, 53, 54, 55, 56}


def post(base, path, payload, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(base + path, data=json.dumps(payload).encode(),
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.load(r)
        except OSError:
            if i == tries - 1:
                raise
            time.sleep(2)


def clean(text):
    """Strip the game's colour tags: [c][ffffff]...[-][/c] and literal \\n."""
    text = re.sub(r"\[/?c\]|\[-\]|\[[0-9a-fA-F]{6}\]", "", text or "")
    return text.replace("\\n", "\n").strip()


# ---------------------------------------------------------------- game data
def ensure_comlink(base, progress):
    """Make sure comlink answers; start Docker Desktop and the container if not."""
    def up():
        try:
            post(base, "/metadata", {}, tries=1)
            return True
        except OSError:
            return False
    if up():
        return
    progress(2, "Starting Docker and comlink...")
    import subprocess
    if subprocess.run(["docker", "info"], capture_output=True).returncode != 0:
        subprocess.run(["open", "-a", "Docker"], capture_output=True)
        for _ in range(60):
            if subprocess.run(["docker", "info"], capture_output=True).returncode == 0:
                break
            time.sleep(2)
    subprocess.run(["docker", "start", "swgoh-comlink"], capture_output=True)
    for _ in range(45):
        if up():
            return
        time.sleep(2)
    raise OSError("comlink did not start")


def load_game(base, offline, progress=lambda p, m: None):
    path = os.path.join(CACHE, "game.json")
    if offline:
        return json.load(open(path))
    meta = post(base, "/metadata", {})
    ver = meta["latestGamedataVersion"]
    if os.path.exists(path):
        cached = json.load(open(path))
        if cached.get("version") == ver and cached.get("schema") == SCHEMA:
            progress(40, "Game data up to date")
            return cached
    progress(6, "New game update: downloading game data")
    seg = {}
    for s in (1, 2, 3, 4):
        part = post(base, "/data", {"payload": {"version": ver, "includePveUnits": False,
                                               "requestSegment": s}, "enums": False})
        seg.update({k: v for k, v in part.items() if v})   # each segment lists every key, most empty
        progress(6 + s * 7, f"Game data part {s} of 4")
    progress(36, "Downloading names and ability text")
    loc = post(base, "/localization", {"payload": {"id": meta["latestLocalizationBundleVersion"]},
                                       "unzip": True})["Loc_ENG_US.txt"]
    game = extract(seg, loc)
    game["version"], game["schema"] = ver, SCHEMA
    json.dump(game, open(path, "w"))
    return game


def extract(seg, loc_text):
    units_raw = [u for u in seg["units"] if u.get("obtainable") and u["rarity"] == 7
                 and u["combatType"] in (1, 2)]
    skills = {s["id"]: s for s in seg["skill"]}
    abilities = {a["id"]: a for a in seg["ability"]}
    cats = {c["id"]: c for c in seg["category"] if c.get("visible")}
    equipment = {e["id"]: e for e in seg["equipment"]}
    recipes = {r["id"]: r for r in seg["recipe"]}
    shards = {m["id"][len("unitshard_"):]: m for m in seg["material"] if m["id"].startswith("unitshard_")}

    missions = {}
    for c in seg["campaign"]:
        for mp in c.get("campaignMap", []):
            for g in mp.get("campaignNodeDifficultyGroup", []):
                for n in g.get("campaignNode", []):
                    for mi in n.get("campaignNodeMission", []):
                        missions[(c["id"], mp["id"], mi["id"], g["campaignNodeDifficulty"])] = mi.get("shortNameKey", "")

    wanted = set(missions.values())
    for u in units_raw:
        wanted.add(u["nameKey"])
        wanted.update(cats[c]["descKey"] for c in u.get("categoryId", []) if c in cats)
    for a in abilities.values():
        wanted.add(a.get("nameKey"))
        wanted.add(a.get("descKey"))
        wanted.update(t.get("descKey") for t in a.get("tier") or [])
    wanted.update(e.get("nameKey") for e in equipment.values())
    wanted.update(r.get("nameKey") for r in seg.get("guildRaid", []))
    wanted.update(e.get("nameKey") for e in seg.get("eraDefinition", []))
    wanted.update(m.get("nameKey") for m in seg["material"] if m["id"].startswith("era_upgrade"))
    wanted.update(t.get("nameKey") for t in seg.get("lightspeedToken", []))
    loc = {}
    for line in loc_text.splitlines():
        if "|" in line:
            k, v = line.split("|", 1)
            if k in wanted:
                loc[k] = v

    def where(lookups):
        out = []
        for l in lookups or []:
            m = l["missionIdentifier"]
            camp = m["campaignId"]
            if camp in CAMPAIGN_LABEL:
                short = loc.get(missions.get((camp, m["campaignMapId"], m["campaignMissionId"],
                                              m["campaignNodeDifficulty"]), ""), "")
                short = short or f"{m['campaignMapId'][1:].lstrip('0')}-?"
                hard = " Hard" if m["campaignNodeDifficulty"] == 5 else ""
                out.append(f"{CAMPAIGN_LABEL[camp]} {short}{hard}")
            elif camp == "EVENTS":
                out.append("Event: " + m["campaignMapId"].title())
            elif camp == "GUILD":
                out.append("Guild raid")
        return sorted(set(out))

    units = {}
    for u in units_raw:
        sk = []
        for ref in u.get("skillReference", []):
            s = skills.get(ref["skillId"])
            if not s:
                continue
            a = abilities.get(s.get("abilityReference"), {})
            tiers = a.get("tier") or []
            desc = tiers[-1].get("descKey") if tiers else a.get("descKey")
            sk.append({"id": s["id"], "name": loc.get(a.get("nameKey"), s["id"]),
                       "type": s["id"].split("_")[0].replace("skill", ""),
                       "desc": clean(loc.get(desc, "")),
                       "max": len(s.get("tier", [])) + 1,
                       "zeta": [i + 2 for i, t in enumerate(s.get("tier", [])) if t.get("isZetaTier")],
                       "omi": [i + 2 for i, t in enumerate(s.get("tier", [])) if t.get("isOmicronTier")]})
        units[u["baseId"]] = {
            "name": loc.get(u["nameKey"], u["baseId"]), "thumb": u["thumbnailName"],
            "ship": u["combatType"] == 2,
            "align": {1: "Neutral", 2: "Light", 3: "Dark"}.get(u["forceAlignment"], ""),
            "tags": sorted({loc.get(cats[c]["descKey"], "") for c in u.get("categoryId", []) if c in cats} - {""}),
            "roles": [c[5:] for c in u.get("categoryId", []) if c.startswith("role_")],
            "skills": sk,
            "tiers": {str(t["tier"]): t["equipmentSet"] for t in u.get("unitTier", [])},
            "farm": where(shards.get(u["baseId"], {}).get("lookupMission")),
        }

    gear = {}
    for eid, e in equipment.items():
        rec = recipes.get(e.get("recipeId") or "") or {}
        ing = [[i["id"], i.get("minQuantity", 1)] for i in rec.get("ingredients", [])
               if i["id"] in equipment and i["id"] != "GRIND"]
        gear[eid] = {"name": loc.get(e.get("nameKey"), eid), "icon": e.get("iconKey", ""), "tier": e.get("tier", 0),
                     "mark": (e.get("mark") or "").strip(), "ing": ing, "farm": where(e.get("lookupMission"))}
    raids = {r["id"].lower(): loc.get(r.get("nameKey"), r["id"]) for r in seg.get("guildRaid", [])}
    materials = {m["id"]: m for m in seg["material"]}
    boss_names = {"TERENTATEK": "Terentatek", "PIRATEATST": "Pirate AT-ST", "KRAYTDRAGON": "Krayt Dragon", "DRYAX": "Dryax"}

    def rewards(lst):
        return [[p["id"], p.get("minQuantity", 0)] for p in lst or []]

    eras, era_mats = [], {}
    for e in seg.get("eraDefinition", []):
        levels = []
        for l in e.get("eraLevel", []):
            g_ = l.get("currentGearTier", 0)
            rec = recipes.get(l.get("upgradeRecipeId") or "") or {}
            cost = [[i["id"], i.get("minQuantity", 0)] for i in rec.get("ingredients", [])]
            for mid, _ in cost:
                if mid in materials:
                    era_mats[mid] = materials[mid]
            levels.append({"lv": l["level"], "lvl": l.get("currentUnitLevel"), "gear": g_, "ab": l.get("currentAbilityLevel"),
                           "relic": max(0, l.get("currentRelicTier", 0) - 2) if g_ >= 13 else None,
                           "stars": l.get("requiredRarity"), "major": bool(l.get("majorMilestone")), "cost": cost})
        total = [[t["rankStart"], sum(q for i, q in rewards(t["primaryReward"]) if i == "ERA_CURRENCY")]
                 for t in e.get("totalEraLevelsRewardPreview", [])]
        col = e.get("coliseum") or {}
        bosses = []
        for b in col.get("bossDefinition", []):
            diffs = []
            for t in b.get("bossRewardTable", []):
                ec, mats = 0, {}
                for x in t.get("bossProgressionRewardPreview", []):
                    for i, q in rewards(x.get("detailedReward")):
                        if i == "ERA_CURRENCY":
                            ec += q
                        elif i.startswith("era_upgrade"):
                            mats[i] = mats.get(i, 0) + q
                diffs.append({"diff": t["missionId"], "ec": ec, "mats": mats,
                              "tiers": [[x.get("rankStart"), rewards(x.get("detailedReward"))]
                                        for x in t.get("bossProgressionRewardPreview", [])]})
            node = b["identifier"]["campaignNodeId"]
            bosses.append({"id": node, "name": boss_names.get(node, node.title()), "diffs": diffs})
        eras.append({
            "id": e["id"], "name": loc.get(e.get("nameKey"), e["id"]), "units": e.get("eraUnitId", []), "icon": e.get("icon"),
            "journey": e.get("journeyUnit") or None, "loaned": [l["id"] for l in e.get("loanedUnit", [])],
            "start": int(e.get("startTimeMs", 0)) // 1000, "end": int(e.get("endTimeMs", 0)) // 1000,
            "maxLoaned": e.get("maxLoanedUnitEraLevel"), "levels": levels, "shards": e.get("eraShardCount"),
            "totalRewards": total,
            "coliseum": {"bosses": bosses,
                         "schedule": [[int(s["startTime"]) // 1000, int(s["endTime"]) // 1000, s["bossIndex"]]
                                      for s in col.get("bossSchedule", [])],
                         "daily": [[t["rankStart"], t["rankEnd"], sum(q for i, q in rewards(t["primaryReward"]) if i == "ERA_CURRENCY")]
                                   for t in col.get("dailyRankRewardPreview", [])]} if col else None})
    era_mat_info = {}
    for mid, m in era_mats.items():
        era_mat_info[mid] = {"name": loc.get(m.get("nameKey"), mid), "icon": m.get("iconKey", ""),
                             "from": sorted({l["missionIdentifier"]["campaignNodeId"] for l in m.get("lookupMission") or []})}
    tokens = []
    for t in seg.get("lightspeedToken", []):
        up = t.get("unitUpgrade") or {}
        tier = up.get("tier", 0)
        tokens.append({"id": t["id"], "name": loc.get(t.get("nameKey"), ""), "stars": up.get("rarity", 0), "gear": tier,
                       "relic": max(0, up.get("relicTier", 0) - 2) if tier >= 13 else None,
                       "units": [u for u in t.get("applicableUnitDefs") or [] if u in units],
                       "icon": t.get("tokenTierSmallSprite", ""), "ship": t.get("combatType") == 2})
    return {"units": units, "gear": gear, "raids": raids, "eras": eras, "eraMats": era_mat_info, "tokens": tokens}


# ---------------------------------------------------------------- player data
def stat(s):
    sid = s["unitStatId"]
    v = int(s["statValueDecimal"]) / 10000
    return sid, (round(v * 100, 2) if sid in PERCENT else round(v))


def parse_roster(player, game):
    roster = {}
    for r in player["rosterUnit"]:
        base = r["definitionId"].split(":")[0]
        if base not in game["units"]:
            continue
        tier = r.get("currentTier", 1)
        mods = []
        for m in r.get("equippedStatMod") or []:
            d = m["definitionId"]
            pid, pval = stat(m["primaryStat"]["stat"])
            secs = [[STATS.get(stat(s["stat"])[0], "?"), stat(s["stat"])[1], s.get("statRolls", 1)]
                    for s in m.get("secondaryStat") or []]
            mods.append({"slot": int(d[2]), "set": SETS[int(d[0])], "dots": int(d[1]), "lvl": m["level"],
                         "tier": m["tier"], "prim": STATS.get(pid, "?"), "pv": pval, "sec": secs})
        relic = (r.get("relic") or {}).get("currentTier", 0)
        roster[base] = {"stars": r.get("currentRarity", 0), "lvl": r.get("currentLevel", 1), "gear": tier,
                        "relic": max(0, relic - 2) if tier >= 13 else None,
                        "eq": [e["slot"] for e in r.get("equipment") or []],
                        "sk": {s["id"]: s.get("tier", -1) + 2 for s in r.get("skill") or []},
                        "mods": mods}
    return roster


def mod_speed(m):
    s = sum(v for n, v, _ in m["sec"] if n == "Speed")
    return s + (m["pv"] if m["prim"] == "Speed" else 0)


def mod_grade(u):
    if len(u["mods"]) < 6:
        return "D"
    sp = sum(mod_speed(m) for m in u["mods"])
    return "A" if sp >= 80 else "B" if sp >= 55 else "C" if sp >= 30 else "D"


# ---------------------------------------------------------------- planning
def parse_target(t):
    t = t.strip().upper()
    if t.startswith("R"):
        return {"stars": 7, "gear": 13, "relic": int(t[1:])}
    if t.startswith("G"):
        return {"stars": 7, "gear": int(t[1:]), "relic": None}
    return {"stars": int(t.rstrip("*★")), "gear": 0, "relic": None}


def unit_progress(have, tgt):
    stars = have["stars"] if have else 0
    star_p = min(stars, tgt["stars"]) / tgt["stars"] if tgt["stars"] else 1
    if not tgt["gear"]:
        return round(star_p, 3)
    need = tgt["gear"] + (tgt["relic"] or 0)
    got = have["gear"] + (have["relic"] or 0) if have else 0
    return round(0.3 * star_p + 0.7 * min(got, need) / need, 3)


def shards_needed(stars, target):
    return sum(SHARD_COST[s] for s in range(stars + 1, target + 1))


def gear_needed(uid, have, game, target_gear):
    """Gear still to equip from the current tier up to the target, broken down to base pieces."""
    tiers = game["units"][uid]["tiers"]
    cur = have["gear"] if have else 1
    pieces = []
    for t in range(cur, min(target_gear, 13)):
        for slot, gid in enumerate(tiers.get(str(t), [])):
            if t == cur and have and slot in have["eq"]:
                continue
            pieces.append(gid)
    need = {}

    def add(gid, qty, depth=0):
        g = game["gear"].get(gid)
        if not g or depth > 12:
            return
        if g["ing"]:
            for sub, q in g["ing"]:
                add(sub, q * qty, depth + 1)
        else:
            need[gid] = need.get(gid, 0) + qty
    for p in pieces:
        add(p, 1)
    return need


def plan(roster, game, goals):
    units = game["units"]
    out_goals, farm, gear_total = [], {}, {}
    for gi, g in enumerate(goals):
        rows = []
        for uid, t in g["req"].items():
            if uid not in units:
                continue
            tgt = parse_target(t)
            have = roster.get(uid)
            rows.append({"id": uid, "target": t, "progress": unit_progress(have, tgt)})
            stars = have["stars"] if have else 0
            if stars < tgt["stars"]:
                f = farm.setdefault(uid, {"id": uid, "stars": stars, "to": 0, "goals": [], "prio": gi})
                f["to"] = max(f["to"], tgt["stars"])
                f["shards"] = shards_needed(stars, f["to"])
                f["goals"].append(g["name"])
            if tgt["gear"] and not units[uid]["ship"]:
                for gid, q in gear_needed(uid, have, game, tgt["gear"]).items():
                    e = gear_total.setdefault(gid, {"id": gid, "qty": 0, "for": {}})
                    e["qty"] += q
                    e["for"][g["name"]] = e["for"].get(g["name"], 0) + q
        out_goals.append({"name": g["name"], "unlock": g.get("unlock"), "note": g.get("note", ""),
                          "owned": g.get("unlock") in roster, "rows": rows,
                          "done": sum(1 for r in rows if r["progress"] >= 1),
                          "progress": round(sum(r["progress"] for r in rows) / max(1, len(rows)), 3)})
    farm_list = sorted(farm.values(), key=lambda f: (f["prio"], -f["shards"]))
    gear_list = sorted(gear_total.values(), key=lambda e: -e["qty"])[:40]
    return out_goals, farm_list, gear_list


# ---------------------------------------------------------------- guild
def compact_roster(player, game):
    """{unit id: [stars, gear, relic, zetas applied, omicrons applied]} for one player."""
    out = {}
    for r in player["rosterUnit"]:
        base = r["definitionId"].split(":")[0]
        u = game["units"].get(base)
        if not u:
            continue
        tier = r.get("currentTier", 1)
        relic = max(0, (r.get("relic") or {}).get("currentTier", 0) - 2) if tier >= 13 else 0
        have = {s["id"]: s.get("tier", -1) + 2 for s in r.get("skill") or []}
        z = sum(1 for s in u["skills"] if s["zeta"] and have.get(s["id"], 0) >= s["zeta"][0])
        o = sum(1 for s in u["skills"] if s["omi"] and have.get(s["id"], 0) >= s["omi"][0])
        out[base] = [r.get("currentRarity", 0), 0 if u["ship"] else tier, relic, z, o]
    return out


def load_guild(base, player, game, with_rosters, progress=lambda p, m: None):
    gid = player.get("guildId")
    if not gid:
        return None
    g = post(base, "/guild", {"payload": {"guildId": gid, "includeRecentGuildActivityInfo": True},
                              "enums": False})["guild"]
    gl_ids = [u for u, v in game["units"].items() if "Galactic Legend" in v["tags"]]
    members = []
    for i, m in enumerate(g["member"]):
        row = {"id": m["playerId"], "name": m["playerName"], "gp": int(m.get("galacticPower", 0)),
               "cgp": int(m.get("characterGalacticPower", 0)), "sgp": int(m.get("shipGalacticPower", 0)),
               "role": {2: "Member", 3: "Officer", 4: "Leader"}.get(m.get("memberLevel"), "Member"),
               "last": int(m.get("lastActivityTime", 0)) // 1000, "gls": []}
        if with_rosters:
            try:
                p = post(base, "/player", {"payload": {"playerId": m["playerId"]}, "enums": False})
                row["units"] = compact_roster(p, game)
                row["gls"] = [u for u in gl_ids if u in row["units"]]
                chars = [v for k, v in row["units"].items() if not game["units"][k]["ship"]]
                for n in (5, 7, 9):
                    row[f"r{n}"] = sum(1 for v in chars if v[1] >= 13 and v[2] >= n)
                row["zetas"] = sum(v[3] for v in chars)
                row["omis"] = sum(v[4] for v in chars)
            except OSError:
                pass
            progress(50 + int(40 * (i + 1) / len(g["member"])), f"Guild rosters {i + 1} of {len(g['member'])}")
        members.append(row)
    members.sort(key=lambda m: -m["gp"])
    raids = []
    for r in g.get("recentRaidResult") or []:
        rm = r.get("raidMember", [])
        mine = next((x for x in rm if x["playerId"] == player["playerId"]), None)
        raids.append({"name": game["raids"].get(r["raidId"].lower(), r["raidId"]).title(), "end": int(r.get("endTime", 0)),
                      "score": int(r.get("guildRewardScore", 0)), "players": len(rm),
                      "mine": int(mine["memberProgress"]) if mine else 0, "rank": mine["memberRank"] if mine else None,
                      "top": max((int(x["memberProgress"]) for x in rm), default=0)})
    raids.sort(key=lambda r: -r["end"])
    p = g["profile"]
    return {"name": p["name"], "gp": int(p.get("guildGalacticPower", 0)), "count": p.get("memberCount"),
            "message": p.get("externalMessageKey", ""), "members": members, "raids": raids}


# ---------------------------------------------------------------- main
HISTORY = os.path.join(CACHE, "history")


def snapshot(player, roster, goals, units):
    stats = {s.get("nameKey"): s.get("value") for s in player.get("profileStat", [])}
    return {"t": int(time.time()), "gp": int(stats.get("STAT_GALACTIC_POWER_ACQUIRED_NAME") or 0),
            "units": {i: [u["stars"], 0 if units[i]["ship"] else u["gear"], u["relic"] or 0] for i, u in roster.items()},
            "goals": {g["name"]: g["progress"] for g in goals}}


def history_and_changes(snap):
    """Save this sync, return (GP history, changes since the previous sync)."""
    os.makedirs(HISTORY, exist_ok=True)
    files = sorted(f for f in os.listdir(HISTORY) if f.endswith(".json"))
    prev = json.load(open(os.path.join(HISTORY, files[-1]))) if files else None
    json.dump(snap, open(os.path.join(HISTORY, f"{snap['t']}.json"), "w"))
    for old in files[:-59]:                      # keep the last 60 syncs
        os.remove(os.path.join(HISTORY, old))
    hist = []
    for f in sorted(os.listdir(HISTORY)):
        s = json.load(open(os.path.join(HISTORY, f)))
        hist.append({"t": s["t"], "gp": s["gp"], "goals": s.get("goals", {})})
    changes = {"since": prev["t"] if prev else None, "gp": snap["gp"] - prev["gp"] if prev else 0, "items": [],
               "goals": {k: round(v - prev.get("goals", {}).get(k, v), 3) for k, v in snap["goals"].items()} if prev else {}}
    if prev:
        for uid, (st, ge, re_) in snap["units"].items():
            old = prev["units"].get(uid)
            if not old:
                changes["items"].append({"id": uid, "kind": "unlocked", "to": f"{st}★"})
                continue
            if st > old[0]:
                changes["items"].append({"id": uid, "kind": "stars", "from": f"{old[0]}★", "to": f"{st}★"})
            if re_ > old[2]:
                changes["items"].append({"id": uid, "kind": "relic", "from": f"R{old[2]}" if old[1] >= 13 else f"G{old[1]}", "to": f"R{re_}"})
            elif ge > old[1]:
                changes["items"].append({"id": uid, "kind": "gear", "from": f"G{old[1]}", "to": f"G{ge}"})
    return hist, changes


def ally_code(given=None):
    """The ally code to sync, from the argument, HUB_ALLY, or ally.txt (in that order)."""
    code = given or os.environ.get("HUB_ALLY")
    if not code and os.path.exists(ALLY_FILE):
        code = open(ALLY_FILE).read()
    code = re.sub(r"\D", "", code or "")
    if len(code) != 9:
        sys.exit(f"No ally code. Put your 9-digit ally code in {ALLY_FILE}, or pass --ally.")
    return code


def b64(raw):
    return base64.b64encode(raw).decode()


def encrypt_site_data(text, password, salt_seed):
    """Encrypt the site's JSON so only someone with the password can read it in the browser.

    The salt comes from the repository name, so it stays the same between syncs and a device that
    unlocked the site once keeps working; the browser's stored key is replaced if the salt changes."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    salt = hashlib.sha256(f"swgoh-hub|{salt_seed}".encode()).digest()[:16]
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, KDF_ITERATIONS)
    iv = os.urandom(12)
    sealed = AESGCM(key).encrypt(iv, gzip.compress(text.encode(), 9), None)
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iter": KDF_ITERATIONS, "salt": b64(salt), "iv": b64(iv),
            "data": b64(sealed)}


def write_site_data(data):
    """Write site/data.js: plain for the local copy, encrypted whenever HUB_PASSWORD is set."""
    text = json.dumps(data, separators=(",", ":"))
    password = os.environ.get("HUB_PASSWORD")
    if password:
        body = "window.HUB_ENC=" + json.dumps(
            encrypt_site_data(text, password, os.environ.get("HUB_CLOUD_REPO") or "local"))
    elif os.environ.get("HUB_CLOUD_REPO"):
        sys.exit("HUB_PASSWORD is not set: refusing to publish unencrypted data.")
    else:
        body = "window.HUB=" + text
    os.makedirs(SITE, exist_ok=True)
    tmp = os.path.join(SITE, "data.js.tmp")
    with open(tmp, "w") as f:
        f.write(body + ";")
    os.replace(tmp, os.path.join(SITE, "data.js"))


def build(ally=None, comlink="http://localhost:3000", offline=False, guild_rosters=True,
          progress=lambda p, m: print(f"[{p:3d}%] {m}")):
    if not offline:
        ally = ally_code(ally)
    os.makedirs(CACHE, exist_ok=True)
    ppath, gpath = os.path.join(CACHE, "player.json"), os.path.join(CACHE, "guild.json")
    if not offline:
        progress(1, "Connecting to comlink")
        ensure_comlink(comlink, progress)
    game = load_game(comlink, offline, progress)
    if offline:
        player = json.load(open(ppath))
        guild = json.load(open(gpath)) if os.path.exists(gpath) else None
    else:
        progress(44, "Downloading your roster and mods")
        player = post(comlink, "/player", {"payload": {"allyCode": ally.replace("-", "")}, "enums": False})
        json.dump(player, open(ppath, "w"))
        progress(50, "Downloading guild")
        guild = load_guild(comlink, player, game, guild_rosters, progress)
        json.dump(guild, open(gpath, "w"))
    progress(92, "Working out goals, farming and gear")
    roster = parse_roster(player, game)
    goals = json.load(open(os.path.join(HERE, "goals.json")))["goals"]
    out_goals, farm, gear = plan(roster, game, goals)
    for uid, u in roster.items():
        if not game["units"][uid]["ship"]:
            u["modGrade"] = mod_grade(u)
            u["modSpeed"] = sum(mod_speed(m) for m in u["mods"])
    used = {e["id"] for e in gear}
    for uid in roster:
        for items in game["units"][uid]["tiers"].values():
            used.update(items)
    stats = {s.get("nameKey"): s.get("value") for s in player.get("profileStat", [])}
    data = {
        "generated": int(time.time()),
        "player": {"name": player.get("name"), "ally": player.get("allyCode"), "id": player.get("playerId"),
                   "guild": player.get("guildName"), "level": player.get("level"),
                   "gp": stats.get("STAT_GALACTIC_POWER_ACQUIRED_NAME"),
                   "cgp": stats.get("STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME"),
                   "sgp": stats.get("STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME")},
        "units": game["units"],
        "gear": {k: v for k, v in game["gear"].items() if k in used},
        "roster": roster, "goals": out_goals, "farm": farm, "gearNeed": gear, "guild": guild,
        "resetOffsetMin": player.get("localTimeZoneOffsetMinutes", 0),
        "arena": {("squad" if p.get("tab") == 1 else "fleet"): p.get("rank") for p in player.get("pvpProfile") or []},
        "era": {"eras": game.get("eras", []), "mats": game.get("eraMats", {}), "loanedLevel": player.get("loanedUnitEraLevel"),
                "mine": {x["unitBaseId"]: x["eraLevel"] for x in player.get("eraUnitStatus") or []}},
    }
    data["tokens"] = game.get("tokens", [])
    repo = os.environ.get("HUB_CLOUD_REPO")
    data["cloud"] = {"repo": repo, "workflow": "sync.yml", "everyHours": 4} if repo else None
    cpath = os.path.join(HERE, "coliseum.json")
    data["coliseumTeams"] = json.load(open(cpath)) if os.path.exists(cpath) else None
    if offline:
        files = sorted(os.listdir(HISTORY)) if os.path.isdir(HISTORY) else []
        data["history"] = [json.load(open(os.path.join(HISTORY, f))) for f in files]
        data["history"] = [{"t": s["t"], "gp": s["gp"], "goals": s.get("goals", {})} for s in data["history"]]
        data["changes"] = {"since": None, "gp": 0, "items": [], "goals": {}}
    else:
        data["history"], data["changes"] = history_and_changes(snapshot(player, roster, out_goals, game["units"]))
    write_site_data(data)
    progress(100, f"Done: {len(roster)} units, {len(data['changes']['items'])} changes since last sync")
    return data


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ally", help="9-digit ally code (default: HUB_ALLY or ally.txt)")
    ap.add_argument("--comlink", default="http://localhost:3000")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--no-guild", action="store_true")
    a = ap.parse_args()
    try:
        build(a.ally, a.comlink, a.offline, not a.no_guild)
    except OSError as err:
        sys.exit(f"Can't reach comlink at {a.comlink} ({err}).\nStart Docker Desktop, then run: "
                 "docker start swgoh-comlink\nOr rerun with --offline to use the last saved data.")
    print("Open:", os.path.join(SITE, "index.html"), "or run: python3 serve.py")


if __name__ == "__main__":
    main()
