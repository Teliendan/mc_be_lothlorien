# Builds an English review sheet of every Loremaster text (M2) from en_US.lang, grouped by where it appears.
# Usage (workspace root): python -B mods/lothlorien/tools/make_dialog_review.py mods/lothlorien/lothlorien_rp/texts/en_US.lang > temp/dialog_review.md
import re, sys
sys.stdout.reconfigure(encoding="utf-8")
lang = sys.argv[1]
T = {}
for line in open(lang, encoding="utf-8"):
    if "=" in line and not line.startswith("#"):
        k, v = line.rstrip("\n").split("=", 1)
        T[k] = re.sub("§.", "", v).replace("%s", "[…]").replace("%%", "%")
RAW = {}
for line in open(lang, encoding="utf-8"):
    if "=" in line and not line.startswith("#"):
        k, v = line.rstrip(chr(10)).split("=", 1)
        RAW[k] = re.sub("§.", "", v)
def fill(k, *args):
    text = RAW.get("lothlorien.message.lore." + k, "(missing)")
    for a in args: text = text.replace("%s", a, 1)
    return text
L = lambda k: T.get("lothlorien.message.lore." + k, "(missing)")
out = ["# Loremaster dialog — English review sheet (M2)", "",
       "Generated from `lothlorien_rp/texts/en_US.lang`. `[…]` = a value filled in by the game. Comment by row number.", ""]
n = 0
def table(title, rows, note=None):
    global n
    out.extend([f"## {title}", ""])
    if note: out.extend([note, ""])
    out.extend(["| # | Where | Text |", "|---|---|---|"])
    for where, text in rows:
        n += 1
        out.append(f"| {n} | {where} | {text.replace('|', '/')} |")
    out.append("")
table("Opening the dialog", [
    ("prompt on the Loremaster (touch / hover)", T.get("action.interact.lothlorien.speak", "(missing)")),
    ("prompt on a trader elf: only shown to a player whose current request is from that profession", T.get("action.interact.lothlorien.hand_over", "(missing)")),
    ("form title (when he has no name tag)", L("title")),
    ("greeting, Friend (+10)", L("greet.friend")),
    ("greeting, Guest (0..+9)", L("greet.guest")),
    ("greeting, Uneasy (-1..-14)", L("greet.uneasy")),
    ("Shunned (-15..-29): chat line only, no form", L("shunned")),
    ("Hated (-30 and below)", "(no reply)"),
])
table("Main screen: rank and status lines", [
    ("rank line", L("rank.line")), ("progress to next rank", L("rank.next")), ("top rank", L("rank.max")),
    ("rank name 0", L("rank.stranger")), ("rank name 1", L("rank.welcome")), ("rank name 2", L("rank.trusted")), ("rank name 3", L("rank.elf_friend")),
    ("requests not open yet (chapters I+II unfinished)", L("requests.locked")),
    ("all 12 requests done", L("requests.none")),
    ("Uneasy with an active request", L("requests.paused")),
])
table("Buttons", [(k, L("btn." + k)) for k in
    ["teaching", "request_new", "earlier", "take", "understand", "done", "set_aside", "keep", "accept", "notnow", "continue", "back", "farewell", "handover"]],
    note="`handover` is on the small form of the trader elf; `done` is on the Loremaster only for lessons and for the fallback case.")
table("Main screen: the current task", [
    ("line above the task button", L("task.header")),
    ("task button, line 1 (gardener)", L("req.prof.gardener")), ("task button, line 1 (healer)", L("req.prof.healer")),
    ("task button, line 1 (woodwright)", L("req.prof.woodwright")), ("task button, line 1 (lamplighter)", L("req.prof.lamplighter")),
    ("task button, line 2, request ready and its trader lives near (green), gardener", L("status.bring.gardener")),
    ("... healer", L("status.bring.healer")), ("... woodwright", L("status.bring.woodwright")), ("... lamplighter", L("status.bring.lamplighter")),
    ("task button, line 2, not done (grey)", L("status.active")), ("task button, line 2, lesson ready, or request ready and the Loremaster takes it himself (green)", L("status.ready")),
    ("task screen status when ready", L("status.done")),
    ("teaching button count line", L("teach.count")), ("chapter names", L("chapter.1") + " / " + L("chapter.2") + " / " + L("chapter.3")),
    ("teaching screen while a task is held", L("teach.busy")),
    ("goal line on lesson and task screens", L("lesson.task")),
])
chapters = {1: ["harmony", "elves", "renown", "dew", "nectar"], 2: ["depth", "lembas", "fireflies", "rope"], 3: ["gifts", "white_animals", "trades"]}
kind = {"harmony": "deed: Harmony >= +3 when talking", "dew": "deed", "nectar": "deed", "lembas": "deed", "fireflies": "deed", "rope": "deed", "gifts": "deed (squirrel)"}
for ch, ids in chapters.items():
    rows = []
    for i in ids:
        rows.append((f"**{L(f'lesson.{i}.name')}** — {kind.get(i, 'lore')}", L(f"lesson.{i}.text")))
        if i in kind: rows.append((f"goal of **{L(f'lesson.{i}.name')}**", L(f"lesson.{i}.goal")))
    table(f"Lessons, chapter {'I' * ch if ch < 4 else ch}", rows)
table("Turn-in feedback: chat lines, no result screen (round 2)", [
    ("deed done in the field (chat, soft sound)", L("ready.chat")),
    ("Harmony reaches the level while it is the task (chat)", L("harmony.ready_chat")),
    ("chat: lesson handed in", L("done.lesson")), ("chat: renown line", L("result.renown")), ("chat: progress line (or the top-rank line)", L("rank.next")), ("chat: new chapter opened", L("chapter.opened")),
    ("teaching screen, top line after reading a lore lesson (no result screen)", L("result.learned")),
    ("chat: Harmony lesson not ready", L("harmony.not_yet")),
    ("Earlier lessons list (body)", L("remind.body")),
    ("chat: walked away, dialog closed", L("too_far")), ("chat: another screen stayed open", L("busy")),
    ("rank up to Welcome (chat)", L("rankup.welcome")), ("rank up to Trusted (chat)", L("rankup.trusted")), ("rank up to Elf-friend (chat)", L("rankup.elf_friend")),
])
prof = {"g": "Gardener", "h": "Healer", "w": "Woodwright", "l": "Lamplighter"}
reqs = ["g_acorns", "g_dew", "g_bonemeal", "h_athelas", "h_nectar", "h_flowers", "w_logs", "w_fletching", "w_iron", "l_fireflies", "l_coal", "l_glass"]
table("Requests (offer text)", [(f"{prof[r[0]]} `{r}`", L(f"req.{r}.text")) for r in reqs])
table("Request feedback", [
    ("progress line (items)", L("req.have")), ("progress line / chat (acorns)", L("saplings.counted")),
    ("chat: request handed in", L("deliver.ok")), ("chat: missing items", L("deliver.missing")), ("chat: acorns no longer standing", L("saplings.missing")),
    ("set aside? (confirm)", L("abandon.ask")), ("result screen: set aside (kept)", L("abandon.done")),
])
DIRS = ["north", "north_east", "east", "south_east", "south", "south_west", "west", "north_west"]
PROFS = ["gardener", "healer", "woodwright", "lamplighter"]
table("Round 2: where the request goes (under the request text in the offer and on the task screen)", [
    ("trader far: sentence template, e.g.", fill("where.dir", L("who.gardener"), L("dir.north_east"))),
    ("trader within 8 blocks, e.g.", fill("where.near", L("who.healer"))),
    ("who (subject): " + " / ".join(PROFS), " / ".join(L("who." + p) for p in PROFS)),
    ("the 8 directions", " / ".join(L("dir." + d) for d in DIRS)),
] + [(f"no such elf near, the Loremaster takes it himself: {p}", RAW["lothlorien.message.lore.where.none." + p]) for p in PROFS],
    note="Compass: north is -Z on the map (F3 screen), east +X. Direction is from the Loremaster to the nearest elf of that profession within 96 blocks (loaded chunks); closer than 8 blocks says it lives close by.")
print("\n".join(out))
