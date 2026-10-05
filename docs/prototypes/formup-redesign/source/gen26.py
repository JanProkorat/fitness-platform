"""Web: client detail — Nutrition tab (with plans) and the empty state (no plan yet)."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen2.py")).read().split("# ---------------------------------------------------------------- canvas")[0]
exec(_src)

PATHS.setdefault("eye", '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="3"></circle>')
PATHS.update({"copy": '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"></path>'})

CARD = "background: %%SURFACE%%; border: 1px solid %%LINE%%; border-radius: 14px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px"


def eyebrow(text, color="%%MUTED%%"):
    return f'<span style="display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: {color}"><span style="width: 7px; height: 7px; border-radius: 4px; background: {color}"></span>{text}</span>'


def card_head(title, right=""):
    return f'<div style="display: flex; align-items: center"><h2 style="margin: 0; font-size: 15px; font-weight: 600">{title}</h2><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">{right}</span></div>'


def header():
    return f'''<div style="display: flex; align-items: center; gap: 16px">
<a href="#" aria-label="Back to clients" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("back", 18)}</a>
{avatar("ES", 56, "%%INK%%", "%%SURFACE%%")}
{identity()}
<div style="margin-left: auto; display: flex; gap: 8px">{btn("Chat", "primary", "chat")}{btn("Tasks", "disabled", "list")}{btn("Notes", "disabled", "clipboard")}{btn("Info", "disabled", "info")}</div>
</div>
{tabs([("Overview", None), ("Development", None), ("Nutrition", None), ("Workouts", None), ("Storage", None), ("Payment", None), ("Automations", None)], "Nutrition")}'''


# ---------------------------------------------------------------- current plan + timeline
def current_plan():
    segs = ""
    for w in range(1, 13):
        if w < 5:
            c, lab = "%%NUTRI%%", ""
        elif w == 5:
            c, lab = "%%MARKER%%", "now"
        elif w <= 6:
            c, lab = "%%NUTRI_SOFT%%", ""
        else:
            c, lab = "%%LINE%%", ""
        segs += f'<span title="Week {w}" style="flex-grow: 1; height: 8px; border-radius: 4px; background: {c}"></span>'
    leg = lambda c, l: f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 10px; height: 6px; border-radius: 3px; background: {c}"></span>{l}</span>'
    return f'''<div style="{CARD}">
<div style="display: flex; align-items: center; gap: 16px">{domain_tile("n", 48)}
<div style="display: flex; flex-direction: column; gap: 5px">{eyebrow("CURRENT MEAL PLAN", "%%NUTRI%%")}<span style="{DISP}; font-size: 22px; font-weight: 600">Lean cut — 12 weeks</span>
<span style="font-size: 13px; color: %%MUTED%%">Week 5 of 12 · 2,100 kcal a day · made from a template · started 1 Sep</span></div>
<div style="margin-left: auto; display: flex; gap: 8px">{btn("Preview as client", "outline", "eye", 38)}{btn("Open editor", "primary", "pencil", 38)}</div></div>
<div style="display: flex; gap: 4px">{segs}</div>
<div style="display: flex; gap: 18px; font-size: 12px; color: %%MUTED%%">{leg("%%NUTRI%%", "Done")}{leg("%%MARKER%%", "This week")}{leg("%%NUTRI_SOFT%%", "Published, upcoming")}{leg("%%LINE%%", "Draft — client can’t see it yet")}<span style="margin-left: auto; font-weight: 600; color: %%INK2%%">Week 7 needs publishing by Sunday</span></div>
</div>'''


def timeline():
    months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]
    axis = "".join(f'<span style="flex-grow: 1; flex-basis: 0; font-size: 11px; color: %%MUTED%%; border-left: 1px solid %%LINE%%; padding-left: 6px">{m}</span>' for m in months)

    def block(left, width, label, sub, kind):
        st = {"past": "background: %%GROUND%%; border: 1px solid %%LINE%%; color: %%INK2%%",
              "now": "background: %%NUTRI_SOFT%%; border: 1.5px solid %%NUTRI%%; color: %%NUTRI_INK%%",
              "next": "background: transparent; border: 1.5px dashed %%MUTED%%; color: %%INK2%%",
              "gap": "background: transparent; border: 1.5px dashed %%LINE%%; color: %%MUTED%%"}[kind]
        return (f'<a href="#" style="position: absolute; left: {left}%; width: {width}%; top: 0; height: 52px; box-sizing: border-box; border-radius: 10px; {st}; padding: 7px 10px; text-decoration: none; display: flex; flex-direction: column; gap: 2px; overflow: hidden">'
                f'<span style="font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{label}</span><span style="font-size: 11px; opacity: 0.8; white-space: nowrap">{sub}</span></a>')
    blocks = (block(0.5, 18.5, "Maintenance", "May – Jun · 6 wks", "past") + block(19.5, 27, "Cut — summer", "Jun – Aug · 8 wks", "past")
              + block(47, 9, "No plan", "1 – 14 Sep", "gap") + block(56.5, 26, "Lean cut — 12 weeks", "Sep – Nov · week 5 of 12", "now")
              + block(83, 16.5, "Lean bulk", "starts 1 Dec", "next"))
    today = '<span style="position: absolute; left: 66%; top: -10px; height: 8px; width: 2px; border-radius: 1px; background: %%MARKER%%"></span><span style="position: absolute; left: 66%; bottom: -10px; height: 8px; width: 2px; border-radius: 1px; background: %%MARKER%%"></span><span style="position: absolute; left: 66%; top: -26px; transform: translateX(-50%); font-size: 10px; font-weight: 700; color: %%MARKER%%">TODAY</span>'
    return f'''<div style="{CARD}">
{card_head("Plan timeline", "Click a plan to open it")}
<div style="position: relative; height: 52px; margin-top: 12px">{blocks}{today}</div>
<div style="display: flex">{axis}</div>
</div>'''


# ---------------------------------------------------------------- this week + chart
def this_week():
    days = [("Mon", 4, 4), ("Tue", 4, 4), ("Wed", 3, 4), ("Thu", 2, 4), ("Fri", 3, 4), ("Sat", 2, 4), ("Sun", 0, 0)]
    cols = ""
    for d, done, total in days:
        if total == 0:
            cols += f'<div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; align-items: center; gap: 6px"><div style="width: 100%; height: 44px; border-radius: 8px; border: 1.5px dashed %%LINE%%"></div><span style="font-size: 11px; color: %%MUTED%%">{d}</span><span style="font-size: 11px; color: %%MUTED%%">today</span></div>'
            continue
        pct = done / total
        col = "%%NUTRI%%" if pct >= 0.75 else ("%%TRAIN%%" if pct >= 0.5 else "%%MARKER%%")
        cols += (f'<div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; align-items: center; gap: 6px">'
                 f'<div style="position: relative; width: 100%; height: 44px; border-radius: 8px; background: %%GROUND%%; border: 1px solid %%LINE%%; overflow: hidden"><span style="position: absolute; left: 0; right: 0; bottom: 0; height: {round(pct * 100)}%; background: {col}; opacity: 0.5"></span></div>'
                 f'<span style="font-size: 11px; font-weight: 600">{d}</span><span style="font-size: 11px; color: %%MUTED%%">{done}/{total}</span></div>')
    slot = lambda name, v, n, note=None, warn=False: (f'<div style="display: grid; grid-template-columns: 74px minmax(0, 1fr) 40px 150px; gap: 10px; align-items: center; font-size: 12px">'
                                                     f'<span style="font-weight: 600">{name}</span><div style="height: 5px; border-radius: 3px; background: %%LINE%%"><div style="width: {round(v / n * 100)}%; height: 5px; border-radius: 3px; background: {"%%MARKER%%" if warn else "%%INK2%%"}"></div></div>'
                                                     f'<span style="color: %%MUTED%%">{v}/{n}</span><span style="color: {"%%MARKER%%" if warn else "%%MUTED%%"}; font-weight: {700 if warn else 400}">{note or ""}</span></div>')
    macro = lambda label, v, t, c, u="g": (f'<div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 4px"><span style="display: flex; align-items: baseline; gap: 5px; font-size: 12px; white-space: nowrap"><span style="align-self: center; width: 6px; height: 6px; border-radius: 3px; background: {c}"></span><span style="color: %%MUTED%%">{label}</span><b>{v:,}</b><span style="color: %%MUTED%%">/ {t:,}{" " + u if u else ""}</span></span>'
                                           f'<div style="height: 3px; border-radius: 2px; background: %%LINE%%"><div style="width: {min(100, round(v / t * 100))}%; height: 3px; border-radius: 2px; background: {c}"></div></div></div>')
    return f'''<div style="{CARD}">
{card_head("This week", "Week 5 · Mon – Sat logged")}
<div style="display: flex; align-items: baseline; gap: 10px"><span style="{DISP}; font-size: 28px; font-weight: 600">18 <span style="font-size: 16px; color: %%MUTED%%">of 21 meals</span></span><span style="font-size: 13px; color: %%MUTED%%">ticked off · 86 %</span></div>
<div style="display: flex; gap: 8px">{cols}</div>
<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 4px; border-top: 1px solid %%LINE%%; padding-top: 12px">
<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %%MUTED%%">BY MEAL</span>
{slot("Breakfast", 6, 6, "always")}{slot("Snack", 5, 6)}{slot("Lunch", 5, 6)}{slot("Dinner", 2, 3, "skipped 3× this week", True)}</div>
<div style="display: flex; gap: 16px; padding-top: 12px; border-top: 1px solid %%LINE%%">{macro("kcal", 1940, 2100, "%%NUTRI%%", "")}{macro("P", 138, 150, "%%PROT%%")}{macro("C", 201, 220, "%%CARB%%")}{macro("F", 66, 70, "%%FAT%%")}</div>
</div>'''


def working_chart():
    weights = [72.4, 72.1, 71.9, 71.5, 71.2, 70.9, 70.6, 70.3]
    kcal = [2400, 2350, 2300, 2300, 2100, 2100, 2100, 2100]
    w, h = 380, 170
    xs = [20 + i * (w - 40) / 7 for i in range(8)]
    ys = [16 + (72.6 - v) / 2.6 * (h - 50) for v in weights]
    bars = "".join(f'<rect x="{x - 11}" y="{h - 26 - (k - 1800) / 700 * 70}" width="22" height="{(k - 1800) / 700 * 70}" rx="4" fill="%%NUTRI%%" opacity="0.22"></rect>' for x, k in zip(xs, kcal))
    line = " ".join(f"{x:.0f},{y:.0f}" for x, y in zip(xs, ys))
    dots = "".join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3.5" fill="%%SURFACE%%" stroke="%%INK%%" stroke-width="2"></circle>' for x, y in zip(xs, ys))
    labels = "".join(f'<text x="{x:.0f}" y="{h - 8}" text-anchor="middle" font-size="10" fill="%%MUTED%%">W{i + 1}</text>' for i, x in enumerate(xs))
    switch = f'<line x1="{(xs[3] + xs[4]) / 2:.0f}" x2="{(xs[3] + xs[4]) / 2:.0f}" y1="8" y2="{h - 22}" stroke="%%MARKER%%" stroke-width="1.5" stroke-dasharray="3 3"></line><text x="{(xs[3] + xs[4]) / 2 + 5:.0f}" y="18" font-size="10" font-weight="700" fill="%%MARKER%%">new plan</text>'
    svg = f'<svg width="100%" height="{h}" viewBox="0 0 {w} {h}" preserveAspectRatio="none" aria-label="Weight and planned calories per week">{bars}{switch}<polyline points="{line}" fill="none" stroke="%%INK%%" stroke-width="2.5"></polyline>{dots}{labels}</svg>'
    leg = lambda sw, l: f'<span style="display: inline-flex; align-items: center; gap: 6px">{sw}{l}</span>'
    return f'''<div style="{CARD}">
{card_head("Is it working?", "Last 8 weeks")}
<div style="display: flex; align-items: baseline; gap: 10px"><span style="{DISP}; font-size: 28px; font-weight: 600">−2.1 kg</span><span style="font-size: 13px; color: %%NUTRI_INK%%; font-weight: 600">on track for 68 kg by Nov</span></div>
{svg}
<div style="display: flex; gap: 16px; font-size: 12px; color: %%MUTED%%">{leg('<span style="width: 14px; height: 2px; background: %%INK%%"></span>', "Weight (check-ins)")}{leg('<span style="width: 10px; height: 10px; border-radius: 2px; background: %%NUTRI%%; opacity: 0.35"></span>', "Planned kcal a day")}</div>
</div>'''


# ---------------------------------------------------------------- bottom row
def past_plans():
    rows = [("Cut — summer", "16 Jun – 10 Aug · 8 weeks", "82 %", "−3.4 kg"), ("Maintenance", "5 May – 15 Jun · 6 weeks", "74 %", "+0.2 kg"), ("Onboarding week", "28 Apr – 4 May · 1 week", "61 %", "—")]
    out = ""
    for name, when, adh, delta in rows:
        out += (f'<div style="display: flex; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid %%LINE%%">{domain_tile("n", 34)}'
                f'<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><a href="#" style="font-size: 14px; font-weight: 600; color: %%INK%%; text-decoration: none">{name}</a><span style="font-size: 12px; color: %%MUTED%%">{when}</span></div>'
                f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px"><span style="font-size: 13px; font-weight: 700">{adh}</span><span style="font-size: 11px; color: %%MUTED%%">meals ticked</span></div>'
                f'<div style="width: 64px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px"><span style="font-size: 13px; font-weight: 700">{delta}</span><span style="font-size: 11px; color: %%MUTED%%">weight</span></div>'
                f'<button aria-label="More actions for {name}" style="width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("more", 17)}</button></div>')
    return f'''<div style="{CARD}">
{card_head("Past plans", "3 plans")}
<div style="display: flex; flex-direction: column">{out}</div>
<span style="font-size: 12px; color: %%MUTED%%">Open one to see it read-only, or reuse it: <b style="color: %%INK2%%">Duplicate for Eva</b> · <b style="color: %%INK2%%">Save as template</b></span>
</div>'''


def photos_notes():
    tiles = [("#D8C8A8", "Breakfast · Mon"), ("#C9D9A8", "Lunch · Mon"), ("#E7B48F", "Dinner · Tue"), ("#F1F1EC", "Snack · Wed"), ("#D7A68E", "Lunch · Thu"), ("#BFD3D8", "Dinner · Fri")]
    grid = "".join(f'<div style="height: 64px; border-radius: 10px; background: {c}; position: relative"><span style="position: absolute; left: 6px; bottom: 5px; padding: 2px 6px; border-radius: 6px; background: rgba(0,0,0,0.45); color: #FFFFFF; font-size: 10px">{l}</span></div>' for c, l in tiles)
    quote = lambda q, meta: f'<div style="display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 10px; background: %%GROUND%%; border: 1px solid %%LINE%%"><span style="font-size: 13px; line-height: 1.45">“{q}”</span><span style="font-size: 11px; color: %%MUTED%%">{meta}</span></div>'
    return f'''<div style="{CARD}">
{card_head("Meal photos and notes", "This week")}
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px">{grid}</div>
{quote("Hungry in the evenings, that’s why I skip dinner and snack later.", "Check-in · Sun 28 Sep · hunger 4/5")}
</div>'''


def context():
    tag = lambda t, c="%%LINE%%", fg="%%INK2%%": f'<span style="padding: 4px 9px; border-radius: 999px; border: 1px solid {c}; color: {fg}; font-size: 12px; font-weight: 600">{t}</span>'
    row = lambda label, inner: f'<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %%MUTED%%">{label}</span><div style="display: flex; flex-wrap: wrap; gap: 6px">{inner}</div></div>'
    return f'''<div style="{CARD}">
{card_head("Eva’s nutrition profile", '<a href="#" style="color: %%INK2%%; font-weight: 600">Edit</a>')}
{row("TARGETS", tag("2,100 kcal") + tag("P 150 g") + tag("C 220 g") + tag("F 70 g") + tag("Fib 30 g"))}
{row("ALLERGIES", tag("Lactose", "%%MARKER%%", "%%MARKER%%"))}
{row("DISLIKES", tag("Mushrooms") + tag("Olives"))}
{row("HABITS", tag("4 meals a day") + tag("Cooks on Sundays") + tag("Eats out on Fridays"))}
<span style="font-size: 12px; color: %%MUTED%%">From onboarding · updated 12 Sep</span>
</div>'''


def nutrition_tab(d, t):
    main = f'''{header()}
{current_plan()}
{timeline()}
<div style="display: grid; grid-template-columns: 3fr 2fr; gap: 14px">{this_week()}{working_chart()}</div>
<div style="display: grid; grid-template-columns: 4fr 3fr 3fr; gap: 14px; align-items: start">{past_plans()}{photos_notes()}{context()}</div>'''
    return main


# ---------------------------------------------------------------- empty state
def empty_tab():
    Y = lambda t: f'<span style="display: inline-flex; align-items: center; gap: 4px"><span style="color: %%NUTRI%%; font-weight: 700">✓</span>{t}</span>'
    N = lambda t: f'<span style="display: inline-flex; align-items: center; gap: 4px"><span style="color: %%TRAIN%%; font-weight: 700">~</span>{t}</span>'
    tpl = lambda name, desc, weeks, kcal, why, best=False: (f'<a href="#" style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 8px; padding: 16px; border-radius: 14px; border: {"2px solid %%NUTRI%%" if best else "1px solid %%LINE%%"}; background: %%SURFACE%%; text-decoration: none; color: %%INK%%">'
                                                      f'<div style="display: flex; align-items: center; gap: 8px">{domain_tile("n", 30)}{"<span style=\"margin-left: auto; padding: 3px 8px; border-radius: 6px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 10px; font-weight: 700; letter-spacing: 0.06em\">BEST MATCH</span>" if best else ""}</div>'
                                                      f'<span style="font-size: 15px; font-weight: 700">{name}</span><span style="font-size: 12px; line-height: 1.45; color: %%MUTED%%">{desc}</span>'
                                                      f'<span style="margin-top: auto; font-size: 12px; font-weight: 600; color: %%INK2%%">{weeks} weeks · {kcal} kcal a day</span>'
                                                      f'<span style="display: flex; flex-wrap: wrap; gap: 4px 10px; padding-top: 8px; border-top: 1px solid %%LINE%%; font-size: 11px; color: %%MUTED%%">{why}</span></a>')
    start = f'''<div style="{CARD}; padding: 28px; gap: 18px">
<div style="display: flex; align-items: flex-start; gap: 16px">{domain_tile("n", 52)}
<div style="display: flex; flex-direction: column; gap: 6px">{eyebrow("NUTRITION", "%%NUTRI%%")}<h2 style="margin: 0; {DISP}; font-size: 26px; font-weight: 600">Eva has no meal plan yet</h2>
<span style="font-size: 14px; line-height: 1.5; color: %%MUTED%%; max-width: 560px">Start from a template that fits her goal, copy a plan from another client, or build one from scratch. Nothing is visible to Eva until you publish a week.</span></div></div>
<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %%MUTED%%">MATCHED TO EVA · GOAL LOSE FAT · 2,100 KCAL · NO LACTOSE</span>
<div style="display: flex; gap: 12px">{tpl("Lean cut — 12 weeks", "Moderate deficit, high protein, four meals a day", 12, "2,100", Y("Lose fat") + Y("2,100 kcal") + Y("lactose-free"), True)}{tpl("Cut — 4 weeks", "Shorter cut to start with", 4, "2,100", Y("Lose fat") + Y("2,100 kcal") + Y("lactose-free"))}{tpl("Vegetarian cut", "Plant protein focus, no meat or fish", 6, "1,950", Y("Lose fat") + N("1,950 kcal (−7 %)") + Y("lactose-free"))}</div>
<div style="display: flex; align-items: center; gap: 10px; padding-top: 6px; border-top: 1px solid %%LINE%%; padding-top: 16px">{btn("Use “Lean cut — 12 weeks”", "primary", "check", 42)}{btn("Copy from another client", "outline", "copy", 42)}{btn("Start blank", "ghost", "plus", 42)}<a href="#" style="margin-left: auto; font-size: 13px; font-weight: 600; color: %%INK2%%">Browse all templates</a></div>
</div>'''
    past = f'''<div style="{CARD}">{card_head("Past plans", "none yet")}<span style="font-size: 13px; line-height: 1.5; color: %%MUTED%%">Finished plans land here, with how well Eva followed them.</span></div>'''
    return f'''{header()}
<div style="display: grid; grid-template-columns: 7fr 3fr; gap: 14px; align-items: start">{start}<div style="display: flex; flex-direction: column; gap: 14px">{context()}{past}</div></div>'''


TAB_H = 1380
for d, t in DIRS.items():
    if d not in ("C", "D"):
        continue
    BOLD_ON = ""
    DARK_ON = t["DARK"]
    H = TAB_H
    with open(os.path.join(HERE, "project", f"PageClientNutrition{d}.dc.html"), "w") as f:
        f.write(page(f"Client nutrition {d}", W, TAB_H, shell(d, "Clients", nutrition_tab(d, t)), t))
    H = 900
    with open(os.path.join(HERE, "project", f"PageClientNutritionEmpty{d}.dc.html"), "w") as f:
        f.write(page(f"Client nutrition empty {d}", W, 900, shell(d, "Clients", empty_tab()), t))
print("ok")
