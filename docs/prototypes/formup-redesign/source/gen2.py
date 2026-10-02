import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen.py")).read().split("# ---------------------------------------------------------------- palette")[0]
_src = _src.replace('os.path.dirname(__file__)', repr(HERE))
exec(_src)

PATHS.update({
    "utensils": '<path d="M7 3v8"></path><path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3"></path><path d="M7 11v10"></path><path d="M17 21V3c-2.2 1-3.5 3.5-3.5 7v3H17"></path>',
    "more": '<circle cx="5.5" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="18.5" cy="12" r="1.2"></circle>',
    "x": '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
    "arrowup": '<path d="M12 19V5"></path><path d="M6 11l6-6 6 6"></path>',
    "paperclip": '<path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"></path>',
    "image": '<rect x="3.5" y="4.5" width="17" height="15" rx="2"></rect><circle cx="9" cy="10" r="1.6"></circle><path d="M20.5 16l-5-5-9 8.5"></path>',
    "help": '<circle cx="12" cy="12" r="8.5"></circle><path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.2-2.4 3.7"></path><path d="M12 17v.1"></path>',
    "settings": '<circle cx="12" cy="12" r="3"></circle><path d="M12 3v2.5"></path><path d="M12 18.5V21"></path><path d="M3 12h2.5"></path><path d="M18.5 12H21"></path><path d="M5.6 5.6l1.8 1.8"></path><path d="M16.6 16.6l1.8 1.8"></path><path d="M5.6 18.4l1.8-1.8"></path><path d="M16.6 7.4l1.8-1.8"></path>',
    "logout": '<path d="M14 4h5v16h-5"></path><path d="M10 8l-4 4 4 4"></path><path d="M6 12h10"></path>',
    "chevdown": '<path d="M6 9l6 6 6-6"></path>',
    "sort": '<path d="M8 4v16"></path><path d="M4.5 7.5L8 4l3.5 3.5"></path><path d="M16 20V4"></path><path d="M12.5 16.5L16 20l3.5-3.5"></path>',
    "sortdown": '<path d="M12 5v14"></path><path d="M6 13l6 6 6-6"></path>',
    "info": '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 11v5"></path><path d="M12 8v.1"></path>',
    "activity": '<path d="M3 12h4l3-7 4 14 3-7h4"></path>',
    "tag": '<path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z"></path><circle cx="8" cy="8.5" r="1.3"></circle>',
    "external": '<path d="M14 4h6v6"></path><path d="M20 4l-9 9"></path><path d="M18 14v6H4V6h6"></path>',
    "pencil": '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"></path>',
    "trash": '<path d="M4.5 7h15"></path><path d="M9.5 7V4.5h5V7"></path><path d="M6.5 7l1 13h9l1-13"></path>',
    "apple": '<path d="M15.5 4c-.3 1.6-1.6 2.9-3.1 2.8.1-1.5 1.5-2.8 3.1-2.8z"></path><path d="M17.5 12.8c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.4 2 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-1 2.3-2 .7-1 1-2 1-2.1 0 0-1.6-.6-1.6-3.2z"></path>',
    "play": '<path d="M6 4l13 8-13 8z"></path>',
    "users2": '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"></path>',
})

DIRS["D"] = dict(
    TAG="C · Dark", GROUND="#0E0E0F", SURFACE="#18181A", INK="#F4F2EE", INK2="#CFCAC2", MUTED="#958F87",
    LINE="#2A292C", SIDEBAR="#070708", SIDEBAR_ACTIVE="#1F1E21", SIDEBAR_TEXT="#F6F4F0", SIDEBAR_MUTED="#8F8A82",
    PRIMARY="#F4F2EE", PRIMARY_TEXT="#141414",
    TRAIN="#F28C38", TRAIN_SOFT="#3A2414", TRAIN_INK="#F7A863", TRAIN_BRIGHT="#F28C38", ON_TRAIN="#141414",
    NUTRI="#8CC152", NUTRI_SOFT="#243319", NUTRI_INK="#A9D673", NUTRI_BRIGHT="#8CC152", ON_NUTRI="#141414",
    MARKER="#E5483D", DANGER="#F2705F", DANGER_SOFT="#3A1A17", CTA_BG="#141414", CTA_TEXT="#F28C38",
    BOLD="1", DARK="1", OWN_BUBBLE="#2C2B30", OWN_TEXT="#F6F4F0",
)
for _t in DIRS.values():
    _t.setdefault("DARK", "")
    _t.setdefault("OWN_BUBBLE", _t["SIDEBAR"])
    _t.setdefault("OWN_TEXT", _t["SIDEBAR_TEXT"])
DARK_ON = ""

TAGS = {"Online": "#2563EB", "Competition": "#7C3AED", "Postpartum": "#DB2777", "Beginner": "#64748B", "High protein": "#0E7490", "Pantry": "#64748B"}
W, H = 1440, 900


def btn(label, kind="primary", icon=None, h=36, extra=""):
    styles = {
        "primary": "border: none; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%",
        "outline": "border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%",
        "ghost": "border: none; background: transparent; color: %%INK2%%",
        "danger": "border: 1px solid %%DANGER%%; background: %%DANGER_SOFT%%; color: %%DANGER%%",
        "nutri": "border: none; background: %%NUTRI%%; color: #FFFFFF",
        "disabled": "border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%MUTED%%; opacity: 0.6",
    }
    i = ic(icon, 16) if icon else ""
    dis = ' disabled=""' if kind == "disabled" else ""
    return f'<button{dis} style="height: {h}px; padding: 0 14px; border-radius: 10px; {styles[kind]}; font: 600 13px \'DM Sans\', sans-serif; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap{extra}">{i}{label}</button>'


def tagpill(name):
    c = TAGS[name]
    return f'<span style="padding: 3px 8px; border-radius: 6px; background: {c}1a; color: {c}; font-size: 12px; font-weight: 600; white-space: nowrap">{name}</span>'


def avatar(initials, size=32, bg="%%GROUND%%", fg="%%INK2%%"):
    return f'<span style="width: {size}px; height: {size}px; border-radius: {size // 2}px; background: {bg}; color: {fg}; font-size: {max(11, size // 3)}px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{initials}</span>'


def search(ph, width=280):
    return f'<label style="display: flex; align-items: center; gap: 8px; width: {width}px; height: 36px; padding: 0 12px; box-sizing: border-box; border-radius: 10px; background: %%SURFACE%%; border: 1px solid %%LINE%%; color: %%MUTED%%">{ic("search", 16)}<input placeholder="{ph}" aria-label="{ph}" style="border: none; outline: none; background: transparent; font: 13px \'DM Sans\', sans-serif; color: %%INK%%; width: 100%"></label>'


def status(kind):
    m = {"Active": ("%%INK%%", "%%SURFACE%%", "%%INK%%"), "Paused": ("%%MUTED%%", "%%GROUND%%", "%%INK2%%"), "Archived": ("%%LINE%%", "transparent", "%%MUTED%%")}
    dot, bg, fg = m[kind]
    return f'<span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; border: 1px solid %%LINE%%; background: {bg}; color: {fg}; font-size: 12px; font-weight: 600">{"" if kind == "Archived" else f"<span style=\"width: 6px; height: 6px; border-radius: 3px; background: {dot}\"></span>"}{kind}</span>'


BOLD_ON = ""


def domain_tile(kind, size=28):
    if BOLD_ON:
        bg, fg, icon, k = ("%%TRAIN%%", "%%ON_TRAIN%%", "dumbbell", 0.58) if kind == "t" else ("%%NUTRI%%", "%%ON_NUTRI%%", "utensils", 0.55)
        return f'<span title="{"Training" if kind == "t" else "Nutrition"}" style="width: {size}px; height: {size}px; border-radius: 8px; background: {bg}; color: {fg}; display: flex; align-items: center; justify-content: center">{ic(icon, size * k)}</span>'
    if kind == "t":
        return f'<span title="Training" style="width: {size}px; height: {size}px; border-radius: 8px; background: %%TRAIN_SOFT%%; color: %%TRAIN_INK%%; display: flex; align-items: center; justify-content: center">{ic("dumbbell", size * 0.58)}</span>'
    return f'<span title="Nutrition" style="width: {size}px; height: {size}px; border-radius: 8px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; display: flex; align-items: center; justify-content: center">{ic("utensils", size * 0.55)}</span>'


# ---------------------------------------------------------------- shell
def nav(label, icon, active=False, disabled=False):
    bg = "%%SIDEBAR_ACTIVE%%" if active else "transparent"
    col = "%%SIDEBAR_TEXT%%" if active else "%%SIDEBAR_MUTED%%"
    marker = '<span style="position: absolute; left: 0; top: 9px; bottom: 9px; width: 3px; border-radius: 2px; background: %%MARKER%%"></span>' if active else ""
    op = "; opacity: 0.55" if disabled else ""
    return f'<a href="#" style="position: relative; display: flex; align-items: center; gap: 11px; height: 36px; padding: 0 12px; border-radius: 8px; background: {bg}; color: {col}; text-decoration: none; font-size: 14px; font-weight: {600 if active else 500}{op}">{marker}{ic(icon, 17)}{label}</a>'


def group(label, dot=None):
    d = f'<span style="width: 7px; height: 7px; border-radius: 4px; background: {dot}"></span>' if dot else ""
    return f'<div style="display: flex; align-items: center; gap: 8px; padding: 18px 12px 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; color: %%SIDEBAR_MUTED%%">{d}{label}<span style="margin-left: auto; display: flex">{ic("chevdown", 14)}</span></div>'


def shell(d, active, main, main_style="padding: 28px 32px; gap: 18px"):
    items = lambda *xs: "".join(nav(l, i, l == active) for l, i in xs)
    side = f'''<nav aria-label="Main" style="width: 248px; flex-shrink: 0; background: %%SIDEBAR%%; padding: 24px 14px 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 2px">
<div style="display: flex; align-items: center; padding: 4px 6px 14px 12px">{logo(d, True, 19)}<button disabled="" aria-label="Notifications" style="margin-left: auto; width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: %%SIDEBAR_MUTED%%; display: flex; align-items: center; justify-content: center">{ic("bell", 17)}</button></div>
{group("CLIENT MANAGEMENT")}{items(("Clients", "users"), ("Inbox", "chat"))}
{group("NUTRITION", "%%NUTRI_BRIGHT%%")}{items(("Recipes", "book"), ("Ingredients", "leaf"))}
<div style="margin-top: auto; display: flex; flex-direction: column; gap: 2px; padding-bottom: 12px">{nav("Help &amp; Support", "help", disabled=True)}{nav("Settings", "settings", disabled=True)}</div>
<div style="display: flex; align-items: center; gap: 11px; padding: 14px 6px 0 12px; border-top: 1px solid %%SIDEBAR_ACTIVE%%">
{avatar("MK", 32, "%%SIDEBAR_ACTIVE%%", "%%SIDEBAR_TEXT%%")}
<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 600; color: %%SIDEBAR_TEXT%%">Martin Král</span><span style="font-size: 11px; color: %%SIDEBAR_MUTED%%">Personal trainer · Nutritionist</span></div>
<button aria-label="Log out" style="margin-left: auto; width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: %%SIDEBAR_MUTED%%; display: flex; align-items: center; justify-content: center">{ic("logout", 17)}</button>
</div>
</nav>'''
    return f'''<div style="position: relative; width: {W}px; height: {H}px; display: flex; background: %%GROUND%%; {FONT}; color: %%INK%%; overflow: hidden">
{side}
<main style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; {main_style}">
{main}
</main>
</div>'''


def title_block(title, sub=None, eyebrow=None):
    e = ""
    if eyebrow:
        txt, col = eyebrow
        e = f'<span style="display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; color: {col}"><span style="width: 7px; height: 7px; border-radius: 4px; background: {col}"></span>{txt}</span>'
    s = f'<span style="font-size: 14px; color: %%MUTED%%">{sub}</span>' if sub else ""
    return f'<div style="display: flex; flex-direction: column; gap: 6px">{e}<h1 style="margin: 0; {DISP}; font-size: 30px; font-weight: 600; letter-spacing: -0.01em">{title}</h1>{s}</div>'


def tabs(items, active):
    out = ""
    for label, count in items:
        on = label == active
        c = ""
        if count is not None:
            cbg, cfg = ("%%INK%%", "%%SURFACE%%") if on else ("%%LINE%%", "%%MUTED%%")
            c = f'<span style="min-width: 20px; padding: 1px 6px; box-sizing: border-box; border-radius: 999px; background: {cbg}; color: {cfg}; font-size: 11px; font-weight: 700; text-align: center">{count}</span>'
        style = "color: %%INK%%; font-weight: 600; border-bottom: 2px solid %%INK%%" if on else "color: %%MUTED%%; font-weight: 500; border-bottom: 2px solid transparent"
        out += f'<a href="#" style="display: flex; align-items: center; gap: 8px; padding: 0 2px 11px; margin-bottom: -1px; text-decoration: none; font-size: 14px; {style}">{label}{c}</a>'
    return f'<div style="display: flex; gap: 26px; border-bottom: 1px solid %%LINE%%">{out}</div>'


def chip(label, count, active=False, disabled=False):
    if active:
        st, cs = "background: %%INK%%; color: %%SURFACE%%; border: 1px solid %%INK%%", "background: rgba(255,255,255,0.2); color: %%SURFACE%%"
    else:
        st, cs = "background: %%SURFACE%%; color: %%INK2%%; border: 1px solid %%LINE%%", "background: %%GROUND%%; color: %%MUTED%%"
    op = "; opacity: 0.5" if disabled else ""
    dis = ' disabled=""' if disabled else ""
    return f'<button{dis} style="height: 32px; padding: 0 12px 0 6px; border-radius: 999px; {st}; font: 500 13px \'DM Sans\', sans-serif; display: inline-flex; align-items: center; gap: 7px{op}"><span style="min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 10px; {cs}; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center">{count}</span>{label}</button>'


def checkbox(checked=False, label="Select row"):
    if checked:
        return f'<span role="checkbox" aria-checked="true" aria-label="{label}" style="width: 18px; height: 18px; border-radius: 5px; background: %%INK%%; color: %%SURFACE%%; display: flex; align-items: center; justify-content: center">{ic("check", 13, sw="3")}</span>'
    return f'<span role="checkbox" aria-checked="false" aria-label="{label}" style="width: 16px; height: 16px; border-radius: 5px; border: 1.5px solid %%LINE%%; background: %%SURFACE%%"></span>'


def pagination(n, total):
    return f'''<div style="display: flex; align-items: center; padding: 14px 20px; border-top: 1px solid %%LINE%%">
<span style="font-size: 12px; color: %%MUTED%%">Viewing {n} of {total}</span>
<div style="margin-left: auto; display: flex; align-items: center; gap: 6px">{btn(ic("back", 15) + "Previous", "ghost", h=30)}<span style="width: 28px; height: 28px; border-radius: 14px; background: %%INK%%; color: %%SURFACE%%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">1</span>{btn("Next" + ic("chevron", 15), "ghost", h=30)}</div>
</div>'''


TH = "padding: 0 16px; height: 42px; text-align: left; font-size: 12px; font-weight: 600; color: %%MUTED%%; background: %%GROUND%%; border-bottom: 1px solid %%LINE%%"
TD = "padding: 11px 16px; border-bottom: 1px solid %%LINE%%; font-size: 13px; vertical-align: middle"


# ---------------------------------------------------------------- clients
CLIENTS = [
    ("ES", "Eva Svobodová", "eva.svobodova@email.cz", "Active", ["Online", "Beginner"], 2, "tn", True),
    ("TD", "Tomáš Dvořák", "tomas.dvorak@email.cz", "Active", ["Competition"], 0, "t", True),
    ("LH", "Lucie Horáková", "lucie.h@email.cz", "Active", ["Postpartum"], 1, "n", False),
    ("PN", "Petr Novotný", "petr.novotny@email.cz", "Active", [], 0, "tn", False),
    ("KV", "Kateřina Veselá", "katerina.vesela@email.cz", "Active", ["Online"], 4, "n", False),
    ("MP", "Martin Procházka", "m.prochazka@email.cz", "Paused", ["Beginner"], 0, "", False),
    ("JK", "Jana Kučerová", "jana.kucerova@email.cz", "Active", ["Online", "Competition"], 0, "t", False),
    ("OM", "Ondřej Marek", "ondrej.marek@email.cz", "Active", [], 0, "tn", False),
]


def clients(d, t):
    rows = ""
    for ini, name, mail, st, tg, unread, plans, sel in CLIENTS:
        pl = "".join(domain_tile(k) for k in plans) or '<span style="font-size: 12px; color: %%MUTED%%">No active plans</span>'
        un = f'<span title="{unread} unread messages" style="min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 11px; background: %%MARKER%%; color: #FFFFFF; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center">{unread}</span>' if unread else ""
        bg = "%%GROUND%%" if sel else "%%SURFACE%%"
        rows += f'''<tr style="background: {bg}">
<td style="{TD}; width: 18px; padding-right: 0">{checkbox(sel, "Select " + name)}</td>
<td style="{TD}"><div style="display: flex; align-items: center; gap: 12px">{avatar(ini, 34)}<div style="display: flex; flex-direction: column; gap: 2px"><a href="#" style="font-size: 14px; font-weight: 600; color: %%INK%%; text-decoration: none">{name}</a><span style="font-size: 12px; color: %%MUTED%%">{mail}</span></div></div></td>
<td style="{TD}">{status(st)}</td>
<td style="{TD}"><div style="display: flex; gap: 6px; align-items: center">{"".join(tagpill(x) for x in tg)}<button aria-label="Assign tags" style="width: 24px; height: 24px; border-radius: 6px; border: 1px dashed %%LINE%%; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("plus", 13)}</button></div></td>
<td style="{TD}; text-align: center">{un}</td>
<td style="{TD}"><div style="display: flex; gap: 6px">{pl}</div></td>
<td style="{TD}; width: 32px"><button aria-label="Open row menu" style="width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("more", 18)}</button></td>
</tr>
'''
    main = f'''<div style="display: flex; align-items: flex-end">{title_block("Clients", "Client management and overview")}<span style="margin-left: auto">{btn("Invite client", "primary", "plus", 40)}</span></div>
{tabs([("Active", "8"), ("Pending", "2"), ("Paused", "1"), ("Archived", "3")], "Active")}
<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">{search("Search clients...")}{btn("Select tags" + ic("chevdown", 15), "outline", "tag", 36)}
<span style="width: 1px; height: 24px; background: %%LINE%%; margin: 0 4px"></span>
{chip("All", 8, True)}{chip("Unread messages", 3)}{chip("No messages", 1)}{chip("New check-ins", 2)}{chip("Missing check-ins", 1)}{chip("Ending soon", 0, disabled=True)}</div>
<div style="border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; overflow: hidden">
<table style="width: 100%; border-collapse: collapse">
<thead><tr><th style="{TH}; width: 18px; padding-right: 0">{checkbox(False, "Select all clients on this page")}</th><th style="{TH}">Client</th><th style="{TH}">Status</th><th style="{TH}">Tags</th><th style="{TH}; text-align: center">Unread</th><th style="{TH}">Plans</th><th style="{TH}"></th></tr></thead>
<tbody>
{rows}</tbody>
</table>
{pagination(8, 8)}
</div>
<div style="position: absolute; left: 248px; right: 0; bottom: 26px; display: flex; justify-content: center">
<div style="display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 20px; border-radius: 999px; background: %%SURFACE%%; border: 1px solid %%LINE%%; box-shadow: 0 6px 20px rgba(0,0,0,0.12)">
<span style="font-size: 13px; font-weight: 600">1 client selected</span><span style="width: 1px; height: 22px; background: %%LINE%%"></span>
<button style="height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK%%; font: 600 13px 'DM Sans', sans-serif; display: flex; align-items: center; gap: 7px">{ic("chat", 15)}Broadcast</button>
<button style="height: 34px; padding: 0 14px; border-radius: 999px; border: none; background: %%GROUND%%; color: %%INK2%%; font: 600 13px 'DM Sans', sans-serif">Cancel</button>
</div>
</div>'''
    return page(f"Clients {d}", W, H, shell(d, "Clients", main), t)


# ---------------------------------------------------------------- client detail
def stat_card(label, value, cap, accent=None):
    a = f'<span style="width: 7px; height: 7px; border-radius: 4px; background: {accent}"></span>' if accent else ""
    return f'''<div style="background: %%SURFACE%%; border: 1px solid %%LINE%%; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px">
<span style="display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: %%MUTED%%">{a}{label}</span>
<span style="{DISP}; font-size: 28px; font-weight: 600">{value}</span>
<span style="font-size: 12px; color: %%MUTED%%">{cap}</span>
</div>'''


def plan_card(title, kind, name, meta, link):
    if BOLD_ON:
        bg, fg = ("%%NUTRI%%", "%%ON_NUTRI%%") if kind == "n" else ("%%TRAIN%%", "%%ON_TRAIN%%")
        icon = "utensils" if kind == "n" else "dumbbell"
        return f'''<div style="background: {bg}; color: {fg}; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: center"><h2 style="margin: 0; font-size: 14px; font-weight: 600">{title}</h2><a href="#" style="margin-left: auto; font-size: 13px; font-weight: 700; color: {fg}; text-decoration: none; display: flex; align-items: center; gap: 2px">{link}{ic("chevron", 15)}</a></div>
<div style="display: flex; align-items: center; gap: 14px"><span style="width: 44px; height: 44px; border-radius: 10px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center">{ic(icon, 24)}</span><div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 18px; font-weight: 600">{name}</span><span style="font-size: 12px">{meta}</span></div></div>
</div>'''
    ink = "%%NUTRI_INK%%" if kind == "n" else "%%TRAIN_INK%%"
    return f'''<div style="background: %%SURFACE%%; border: 1px solid %%LINE%%; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: center"><h2 style="margin: 0; font-size: 14px; font-weight: 600">{title}</h2><a href="#" style="margin-left: auto; font-size: 13px; font-weight: 600; color: {ink}; text-decoration: none; display: flex; align-items: center; gap: 2px">{link}{ic("chevron", 15)}</a></div>
<div style="display: flex; align-items: center; gap: 14px">{domain_tile(kind, 44)}<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; font-weight: 600">{name}</span><span style="font-size: 12px; color: %%MUTED%%">{meta}</span></div></div>
</div>'''


def checkin_card():
    pattern = "cccmcccccmccuuu"
    dots = ""
    for i, ch in enumerate(pattern):
        col = {"c": "%%INK%%", "m": "%%DANGER%%", "u": "%%LINE%%"}[ch]
        dots += f'<span style="height: 26px; border-radius: 6px; background: {col}"></span>'
    leg = lambda c, l: f'<span style="display: flex; align-items: center; gap: 6px"><span style="width: 8px; height: 8px; border-radius: 2px; background: {c}"></span>{l}</span>'
    return f'''<div style="background: %%SURFACE%%; border: 1px solid %%LINE%%; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; align-items: center"><h2 style="margin: 0; font-size: 14px; font-weight: 600">Check-in trend</h2><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Last 15 days</span></div>
<div style="display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 5px">{dots}</div>
<div style="display: flex; gap: 16px; font-size: 12px; color: %%MUTED%%">{leg("%%INK%%", "Completed")}{leg("%%DANGER%%", "Missed")}{leg("%%LINE%%", "Upcoming")}</div>
</div>'''


def messages_card():
    bars = ""
    for wk, a, b in [("W1", 44, 30), ("W2", 62, 48), ("W3", 38, 52), ("W4", 70, 58)]:
        bars += f'<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 6px"><div style="height: 90px; display: flex; align-items: flex-end; gap: 4px"><span style="width: 12px; height: {a}px; border-radius: 4px 4px 0 0; background: %%INK%%"></span><span style="width: 12px; height: {b}px; border-radius: 4px 4px 0 0; background: %%MUTED%%; opacity: 0.4"></span></div><span style="font-size: 11px; color: %%MUTED%%">{wk}</span></div>'
    leg = lambda s, l: f'<span style="display: flex; align-items: center; gap: 6px"><span style="width: 8px; height: 8px; border-radius: 2px; background: %%{s}%%"></span>{l}</span>'
    return f'''<div style="background: %%SURFACE%%; border: 1px solid %%LINE%%; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center"><h2 style="margin: 0; font-size: 14px; font-weight: 600">Messages trend</h2><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Last 4 weeks</span></div>
<div style="display: flex; gap: 8px">{bars}</div>
<div style="display: flex; gap: 16px; font-size: 12px; color: %%MUTED%%">{leg("INK", "Coach messages")}<span style="display: flex; align-items: center; gap: 6px"><span style="width: 8px; height: 8px; border-radius: 2px; background: %%MUTED%%; opacity: 0.4"></span>Client messages</span></div>
</div>'''


def identity(size="h1"):
    fs = 30 if size == "h1" else 22
    return f'''<div style="display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; align-items: center; gap: 12px"><{size} style="margin: 0; {DISP}; font-size: {fs}px; font-weight: 600; letter-spacing: -0.01em">Eva Svobodová</{size}>{status("Active")}</div>
<div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: %%MUTED%%"><span>34 years • Female • 168 cm</span><span style="padding: 3px 10px; border-radius: 999px; border: 1px solid %%LINE%%; font-size: 12px">Lose fat</span></div>
</div>'''


def client_detail(d, t):
    main = f'''<div style="display: flex; align-items: center; gap: 16px">
<a href="#" aria-label="Back to clients" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("back", 18)}</a>
{avatar("ES", 56, "%%INK%%", "%%SURFACE%%")}
{identity()}
<div style="margin-left: auto; display: flex; gap: 8px">{btn("Chat", "primary", "chat")}{btn("Tasks", "disabled", "list")}{btn("Notes", "disabled", "clipboard")}{btn("Info", "disabled", "info")}</div>
</div>
{tabs([("Overview", None), ("Development", None), ("Nutrition", None), ("Workouts", None), ("Storage", None), ("Payment", None), ("Automations", None)], "Overview")}
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px">
{stat_card("AVERAGE RATING", "4.3", "Based on check-in answers")}{stat_card("PAYMENTS", "TBD", "No payments found for client")}{stat_card("CURRENT WEIGHT", "72.4 kg", "−0.6 kg this week • 68 kg goal")}{stat_card("CLIENT SINCE", "214 days", "Started 1 Mar 2026")}
</div>
<div style="display: grid; grid-template-columns: 3fr 2fr; gap: 14px">
{plan_card("Current meal plan", "n", "Cut — phase 2", "2,100 kcal • 40 % Carb / 30 % Protein / 30 % Fat", "Open plan")}
{plan_card("Latest workout", "t", "Strength block A", "6 exercises • Thursday", "Open plan")}
</div>
<div style="display: grid; grid-template-columns: 3fr 2fr; gap: 14px">{checkin_card()}{messages_card()}</div>'''
    return page(f"Client detail {d}", W, H, shell(d, "Clients", main), t)


# ---------------------------------------------------------------- inbox
CONVOS = [
    ("ES", "Eva Svobodová", "Thanks! See you Thursday then", "10:42", True, True),
    ("KV", "Kateřina Veselá", "Photo", "09:15", True, False),
    ("TD", "Tomáš Dvořák", "Can we swap Friday for Saturday?", "Yesterday", False, False),
    ("LH", "Lucie Horáková", "You accepted Lucie's request", "Yesterday", False, False),
    ("JK", "Jana Kučerová", "The recipe for the curry was great", "28 Sep", False, False),
    ("PN", "Petr Novotný", "No messages yet — start the chat", "", False, False),
    ("OM", "Ondřej Marek", "Shoulder feels better this week", "26 Sep", False, False),
]


def inbox(d, t):
    rows = ""
    for ini, name, prev, when, unread, sel in CONVOS:
        bg = "%%GROUND%%" if sel else "transparent"
        dot = '<span style="width: 8px; height: 8px; border-radius: 4px; background: %%MARKER%%; flex-shrink: 0"></span>' if unread else ""
        p = (ic("image", 13) + " " + prev) if prev == "Photo" else prev
        rows += f'''<a href="#" style="display: flex; gap: 12px; padding: 10px; border-radius: 12px; background: {bg}; text-decoration: none; color: %%INK%%">{avatar(ini, 42)}<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px"><div style="display: flex"><span style="font-size: 14px; font-weight: {700 if unread else 600}">{name}</span><span style="margin-left: auto; font-size: 11px; color: %%MUTED%%">{when}</span></div><div style="display: flex; align-items: center; gap: 8px"><span style="font-size: 12px; color: {"%%INK2%%" if unread else "%%MUTED%%"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px">{p}</span><span style="margin-left: auto">{dot}</span></div></div></a>'''
    incoming = lambda txt: f'<div style="display: flex; gap: 10px; align-items: flex-end">{avatar("ES", 28)}<div style="max-width: 420px; padding: 10px 14px; border-radius: 18px 18px 18px 6px; background: %%SURFACE%%; border: 1px solid %%LINE%%; font-size: 14px; line-height: 1.45">{txt}</div></div>'
    own = lambda txt: f'<div style="display: flex; gap: 10px; align-items: flex-end; justify-content: flex-end"><div style="max-width: 420px; padding: 10px 14px; border-radius: 18px 18px 6px 18px; background: %%OWN_BUBBLE%%; color: %%OWN_TEXT%%; font-size: 14px; line-height: 1.45">{txt}</div>{avatar("MK", 28, "%%SIDEBAR%%", "%%SIDEBAR_TEXT%%")}</div>'
    thread = f'''<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; background: %%GROUND%%">
<div style="display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: %%SURFACE%%; border-bottom: 1px solid %%LINE%%">{avatar("ES", 34)}<span style="font-size: 15px; font-weight: 600">Eva Svobodová</span>
<div style="margin-left: auto; display: flex; gap: 6px">{btn("Hide client", "outline", "user", 34)}<button disabled="" aria-label="Conversation settings" style="width: 34px; height: 34px; border-radius: 10px; border: none; background: transparent; color: %%MUTED%%; opacity: 0.5; display: flex; align-items: center; justify-content: center">{ic("settings", 17)}</button><a href="#" aria-label="Open client profile" style="width: 34px; height: 34px; border-radius: 10px; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("external", 17)}</a></div></div>
<div style="flex-grow: 1; padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; overflow: hidden">
<span style="align-self: center; font-size: 11px; color: %%MUTED%%">Tue 29 Sep, 18:05</span>
<span style="align-self: center; padding: 5px 12px; border-radius: 999px; background: %%SURFACE%%; border: 1px solid %%LINE%%; font-size: 12px; color: %%MUTED%%">Eva accepted your invitation</span>
{incoming("Hi Martin! Leg day felt heavy today, I only managed 8 reps on the last RDL set.")}
{own("That's fine — keep 62.5 kg next time and aim for 9. Sleep was short this week, right?")}
{incoming("Yes, about 6 hours. I'll try to fix that.")}
<span style="align-self: center; font-size: 11px; color: %%MUTED%%">Today, 10:30</span>
{own("New week is published. Thursday is Lower body A again.")}
{incoming("Thanks! See you Thursday then")}
<span style="font-size: 12px; color: %%MUTED%%; padding-left: 38px">Typing…</span>
</div>
<div style="padding: 14px 20px; background: %%SURFACE%%; border-top: 1px solid %%LINE%%; display: flex; align-items: center; gap: 10px">
<div style="flex-grow: 1; display: flex; align-items: center; gap: 4px; height: 46px; padding: 0 8px; border-radius: 23px; border: 1px solid %%LINE%%; background: %%GROUND%%">
<button disabled="" aria-label="Attach file" style="width: 34px; height: 34px; border-radius: 17px; border: none; background: transparent; color: %%MUTED%%; opacity: 0.5; display: flex; align-items: center; justify-content: center">{ic("paperclip", 17)}</button>
<button aria-label="Attach image" style="width: 34px; height: 34px; border-radius: 17px; border: none; background: transparent; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("image", 17)}</button>
<input placeholder="Type your message here..." aria-label="Message" style="flex-grow: 1; border: none; outline: none; background: transparent; font: 14px 'DM Sans', sans-serif; color: %%INK%%">
</div>
<button aria-label="Send message" style="width: 46px; height: 46px; border-radius: 23px; border: none; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; display: flex; align-items: center; justify-content: center">{ic("arrowup", 20, sw="2.2")}</button>
</div>
</div>'''
    panel = f'''<aside style="width: 360px; flex-shrink: 0; background: %%SURFACE%%; border-left: 1px solid %%LINE%%; padding: 22px 18px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; overflow: hidden">
{identity("h2")}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{stat_card("WEIGHT", "72.4 kg", "−0.6 kg this week")}{stat_card("CLIENT SINCE", "214 days", "Started 1 Mar")}</div>
{plan_card("Current meal plan", "n", "Cut — phase 2", "2,100 kcal • 40/30/30", "Open")}
{plan_card("Latest workout", "t", "Strength block A", "6 exercises • Thursday", "Open")}
</aside>'''
    main = f'''<div style="width: 290px; flex-shrink: 0; background: %%SURFACE%%; border-right: 1px solid %%LINE%%; padding: 22px 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center; padding: 0 6px"><h1 style="margin: 0; {DISP}; font-size: 26px; font-weight: 600">Inbox</h1><button style="margin-left: auto; height: 30px; padding: 0 8px; border-radius: 8px; border: none; background: transparent; color: %%MUTED%%; font: 500 12px 'DM Sans', sans-serif; display: flex; align-items: center; gap: 4px">Active{ic("chevdown", 14)}</button></div>
<div style="padding: 0 4px">{search("Search chats...", 258)}</div>
<button style="margin: 0 4px; height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%GROUND%%; color: %%INK2%%; font: 500 13px 'DM Sans', sans-serif; display: flex; align-items: center">Unread messages (2)<span style="margin-left: auto; display: flex">{ic("chevdown", 15)}</span></button>
<div style="display: flex; flex-direction: column; gap: 2px">{rows}</div>
</div>
{thread}
{panel}'''
    return page(f"Inbox {d}", W, H, shell(d, "Inbox", main, "flex-direction: row; padding: 0"), t)


# ---------------------------------------------------------------- ingredients
FOODS = [
    ("Chicken breast", 110, (23, 0, 1.5), "Meat", ["High protein"], "System", "#E9D9C7"),
    ("Jasmine rice, cooked", 129, (2.7, 28, 0.3), "Grains and Cereals", [], "System", "#EFEBE1"),
    ("Greek yogurt 0 %", 59, (10, 3.6, 0.4), "Dairy", ["High protein"], "Mine", "#F1F1EC"),
    ("Salmon fillet", 208, (20, 0, 13), "Fish and Seafood", [], "System", "#F2C9B1"),
    ("Red lentils", 116, (9, 20, 0.4), "Legumes", ["Pantry"], "Shared", "#E7B48F"),
    ("Blueberries", 57, (0.7, 14, 0.3), "Fruit", [], "System", "#9AA5C9"),
    ("Rolled oats", 379, (13, 68, 6.5), "Grains and Cereals", ["Pantry"], "Mine", "#E3D6B9"),
    ("Almonds", 579, (21, 22, 50), "Nuts and Seeds", [], "System", "#C99D77"),
    ("Broccoli", 34, (2.8, 7, 0.4), "Vegetables", [], "System", "#A9C79B"),
]


def library(kind):
    st = {"Mine": "background: %%INK%%; color: %%SURFACE%%", "System": "background: %%GROUND%%; color: %%INK2%%", "Shared": "border: 1px solid %%LINE%%; color: %%INK2%%"}[kind]
    return f'<span style="padding: 3px 8px; border-radius: 6px; {st}; font-size: 12px; font-weight: 600">{kind}</span>'


FIBER = {"Chicken breast": 0, "Jasmine rice, cooked": 0.4, "Greek yogurt 0 %": 0, "Salmon fillet": 0, "Red lentils": 7.9, "Blueberries": 2.4, "Rolled oats": 10.1, "Almonds": 12.5, "Broccoli": 2.6}


def nutrients(p, c, f, fib=0):
    one = lambda l, v, col: f'<span style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap"><span style="width: 6px; height: 6px; border-radius: 3px; background: %%{col}%%"></span>{l} {v} g</span>'
    return f'<div style="display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12px; color: %%INK2%%">{one("P", p, "PROT")}{one("C", c, "CARB")}{one("F", f, "FAT")}{one("Fib", fib, "FIB")}</div>'


def ingredients_table(sel=None):
    rows = ""
    for name, kcal, (p, c, f), cat, tg, lib, thumb in FOODS:
        bg = "%%GROUND%%" if name == sel else "%%SURFACE%%"
        rows += f'''<tr style="background: {bg}">
<td style="{TD}"><div style="display: flex; align-items: center; gap: 12px"><span style="width: 34px; height: 34px; border-radius: 8px; background: {thumb}; flex-shrink: 0"></span><span style="font-size: 14px; font-weight: 600">{name}</span></div></td>
<td style="{TD}; color: %%INK2%%"><span style="font-weight: 600; color: %%INK%%">{kcal}</span> kcal / 100g</td>
<td style="{TD}">{nutrients(p, c, f, FIBER[name])}</td>
<td style="{TD}; color: %%INK2%%">{cat}</td>
<td style="{TD}"><div style="display: flex; gap: 6px">{"".join(tagpill(x) for x in tg)}</div></td>
<td style="{TD}">{library(lib)}</td>
</tr>
'''
    sortable = lambda l, on=False: f'<th style="{TH}"><button style="border: none; background: transparent; padding: 0; font: 600 12px \'DM Sans\', sans-serif; color: {"%%INK%%" if on else "%%MUTED%%"}; display: flex; align-items: center; gap: 5px">{l}<span style="display: flex; opacity: {1 if on else 0.5}">{ic("sortdown" if on else "sort", 13)}</span></button></th>'
    return f'''<div style="border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; overflow: hidden">
<table style="width: 100%; border-collapse: collapse">
<thead><tr>{sortable("Name", True)}{sortable("Calories")}<th style="{TH}">Nutrients</th>{sortable("Category")}<th style="{TH}">Tags</th>{sortable("Library")}</tr></thead>
<tbody>
{rows}</tbody>
</table>
{pagination(9, 184)}
</div>'''


def filter_pill(label, count=None):
    c = f'<span style="min-width: 18px; height: 18px; border-radius: 9px; background: %%NUTRI%%; color: #FFFFFF; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center">{count}</span>' if count else ""
    border = "%%NUTRI%%" if count else "%%LINE%%"
    return f'<button style="height: 34px; padding: 0 12px; border-radius: 999px; border: 1px {"solid" if count else "dashed"} {border}; background: %%SURFACE%%; color: %%INK2%%; font: 500 13px \'DM Sans\', sans-serif; display: inline-flex; align-items: center; gap: 6px">{ic("plus", 14)}{label}{c}</button>'


def ingredients_main(sel=None):
    head = (f'<div style="border-radius: 16px; background: %%NUTRI%%; color: %%ON_NUTRI%%; padding: 22px 26px; display: flex; align-items: center; gap: 16px"><span style="width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center">{ic("leaf", 26)}</span><div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.14em">NUTRITION</span><h1 style="margin: 0; {DISP}; font-size: 30px; font-weight: 600">Ingredients</h1></div><span style="margin-left: auto; font-size: 14px; font-weight: 600">184 in your library</span></div>'
            if BOLD_ON else f'<div style="display: flex; align-items: flex-end">{title_block("Ingredients", None, ("NUTRITION", "%%NUTRI%%"))}</div>')
    return f'''{head}
<div style="display: flex; align-items: center; gap: 10px">{search("Search ingredients…")}{filter_pill("Category", 2)}{filter_pill("Owner")}{filter_pill("Tags")}<span style="margin-left: auto">{btn("New Ingredient", "primary", "plus", 40)}</span></div>
{ingredients_table(sel)}'''


def ingredients(d, t):
    return page(f"Ingredients {d}", W, H, shell(d, "Ingredients", ingredients_main()), t)


def field(label, value, req=True, ph=False, select=False):
    star = '<span style="color: %%DANGER%%"> *</span>' if req else ""
    tail = f'<span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevdown", 16)}</span>' if select else ""
    col = "%%MUTED%%" if ph else "%%INK%%"
    return f'''<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%"><span>{label}{star}</span>
<span style="height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; display: flex; align-items: center; font-size: 14px; color: {col}">{value}{tail}</span></label>'''


def section(icon, title, inner):
    return f'<div style="display: flex; flex-direction: column; gap: 14px"><div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600"><span style="display: flex; color: %%NUTRI%%">{ic(icon, 17)}</span>{title}</div>{inner}</div>'


def drawer(d, t):
    under = shell(d, "Ingredients", ingredients_main("Red lentils"))
    two = lambda a, b: f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">{a}{b}</div>'
    chipsel = lambda xs: "".join(f'<span style="padding: 4px 10px; border-radius: 999px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 12px; font-weight: 600">{x}</span>' for x in xs)
    multi = lambda label, xs: f'<div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%"><span>{label}</span><div style="min-height: 40px; padding: 6px 10px; box-sizing: border-box; border-radius: 10px; border: 1px solid %%LINE%%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px">{xs}<span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevdown", 16)}</span></div></div>'
    sheet = f'''<div style="position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: rgba(10,10,12,0.45)"></div>
<aside aria-label="Edit Ingredient" style="position: absolute; top: 0; right: 0; bottom: 0; width: 560px; background: %%SURFACE%%; box-shadow: -12px 0 40px rgba(0,0,0,0.18); display: flex; flex-direction: column">
<div style="padding: 22px 24px; border-bottom: 1px solid %%LINE%%; display: flex; align-items: flex-start">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 22px; font-weight: 600">Edit Ingredient</span><span style="font-size: 13px; color: %%MUTED%%">Edit this ingredient's details</span></div>
<button aria-label="Close" style="margin-left: auto; width: 34px; height: 34px; border-radius: 10px; border: none; background: transparent; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("x", 18)}</button>
</div>
<div style="flex-grow: 1; overflow: hidden; padding: 20px 24px; display: flex; flex-direction: column; gap: 22px">
{section("image", "Picture", f'<div style="position: relative; height: 150px; border-radius: 12px; background: linear-gradient(135deg, #E7B48F, #D58F63)"><div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 6px"><button aria-label="Replace picture" style="width: 34px; height: 34px; border-radius: 10px; border: none; background: rgba(255,255,255,0.92); color: %%INK%%; display: flex; align-items: center; justify-content: center">{ic("pencil", 16)}</button><button aria-label="Remove picture" style="width: 34px; height: 34px; border-radius: 10px; border: none; background: rgba(255,255,255,0.92); color: %%DANGER%%; display: flex; align-items: center; justify-content: center">{ic("trash", 16)}</button></div></div>')}
{section("info", "Basic Information", two(field("Name", "Red lentils"), field("Category", "Legumes", select=True)))}
{section("activity", "Nutritional Information", two(field("Protein / 100g", "9.0"), field("Carbs / 100g", "20.1")) + two(field("Fat / 100g", "0.4"), field("Fiber / 100g", "7.9", req=False)) + two(field("Calories / 100g", "116"), field("Unit", "Cup", select=True)))}
{section("tag", "Tags &amp; Classification", two(multi("Dietary Preferences", chipsel(["Vegan", "Gluten-free"])), multi("Contains Allergens", '<span style="font-size: 14px; color: %%MUTED%%">Select allergens</span>')))}
</div>
<div style="padding: 16px 24px; border-top: 1px solid %%LINE%%; display: flex; align-items: center; gap: 8px">{btn("Delete", "danger", "trash", 40)}<span style="margin-left: auto"></span>{btn("Cancel", "outline", h=40)}{btn("Save Ingredient", "primary", h=40)}</div>
</aside>'''
    body = under.replace("</main>\n</div>", "</main>\n" + sheet + "\n</div>")
    return page(f"Ingredient drawer {d}", W, H, body, t)


# ---------------------------------------------------------------- entry
def entry(d, t):
    EH = 1400
    accent = (f'<span style="font-weight: 300; background: {GRAD}; -webkit-background-clip: text; background-clip: text; color: transparent">without the mess</span>'
              if d == "A" else '<span style="font-weight: 300; color: #C8382F">without the mess</span>')
    hchip = lambda l, c: f'<span style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; border: 1px solid %%LINE%%; background: %%SURFACE%%; font-size: 13px; color: %%INK2%%"><span style="width: 7px; height: 7px; border-radius: 4px; background: {c}"></span>{l}</span>'
    cell = lambda l, span, bg, fg: f'<div style="grid-column: span {span}; min-height: 132px; border-radius: 16px; background: {bg}; padding: 14px; box-sizing: border-box; display: flex; align-items: flex-end; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; color: {fg}">{l}</div>'
    cap = lambda tag, soft, ink, title, body: f'<div style="border-radius: 16px; border: 1px solid %%LINE%%; background: %%SURFACE%%; padding: 22px; display: flex; flex-direction: column; gap: 10px"><span style="align-self: flex-start; padding: 4px 9px; border-radius: 6px; background: {soft}; color: {ink}; font-size: 11px; font-weight: 700; letter-spacing: 0.1em">{tag}</span><span style="{DISP}; font-size: 19px; font-weight: 600">{title}</span><span style="font-size: 14px; line-height: 1.55; color: %%MUTED%%">{body}</span></div>'
    if BOLD_ON:
        cells = (cell("STRENGTH", 3, "%%TRAIN%%", "%%ON_TRAIN%%") + cell("CONDITIONING", 3, "%%SIDEBAR%%", "%%SIDEBAR_TEXT%%")
                 + cell("NUTRITION", 2, "%%NUTRI%%", "%%ON_NUTRI%%") + cell("COACHING", 2, "%%MARKER%%", "#FFFFFF") + cell("PROGRESS", 2, "%%TRAIN_SOFT%%", "%%TRAIN_INK%%"))
        tn, tt, tc = ("%%NUTRI%%", "%%ON_NUTRI%%"), ("%%TRAIN%%", "%%ON_TRAIN%%"), ("%%SIDEBAR%%", "%%SIDEBAR_TEXT%%")
        band, band_sub = "%%MARKER%%", "rgba(255,255,255,0.88)"
    else:
        cells = (cell("STRENGTH", 3, "%%TRAIN_SOFT%%", "%%TRAIN_INK%%") + cell("CONDITIONING", 3, "%%TRAIN_SOFT%%", "%%TRAIN_INK%%")
                 + cell("NUTRITION", 2, "%%NUTRI_SOFT%%", "%%NUTRI_INK%%") + cell("COACHING", 2, "%%SURFACE%%", "%%MUTED%%") + cell("PROGRESS", 2, "%%SURFACE%%", "%%MUTED%%"))
        tn, tt, tc = ("%%NUTRI_SOFT%%", "%%NUTRI_INK%%"), ("%%TRAIN_SOFT%%", "%%TRAIN_INK%%"), ("%%GROUND%%", "%%INK2%%")
        band, band_sub = "%%SIDEBAR%%", "%%SIDEBAR_MUTED%%"
    left = f'''<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column">
<section style="padding: 40px 72px 56px; display: flex; flex-direction: column; gap: 26px">
<div>{logo(d, bool(DARK_ON), 22)}</div>
<div style="display: flex; flex-direction: column; gap: 18px; padding-top: 34px; max-width: 860px">
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: %%MUTED%%">PLATFORM FOR COACHES AND NUTRITIONISTS</span>
<h1 style="margin: 0; {DISP}; font-size: 60px; line-height: 1.04; font-weight: 600; letter-spacing: -0.02em">Client coaching<br>{accent}</h1>
<p style="margin: 0; font-size: 17px; line-height: 1.6; color: %%INK2%%; max-width: 600px">Meal plans, training plans, measurements and messaging in one place. You work in the browser, your client gets it all on their phone.</p>
<div style="display: flex; flex-wrap: wrap; gap: 8px">{hchip("Meal plans by week", "%%NUTRI%%")}{hchip("Training plans", "%%TRAIN%%")}{hchip("Weekly check-ins", "%%INK%%")}{hchip("Live chat", "%%MARKER%%")}</div>
</div>
<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; max-width: 860px; padding-top: 10px">
{cells}
</div>
<span style="font-size: 12px; color: %%MUTED%%">Photography goes here — added when the app is built.</span>
</section>
<section style="padding: 56px 72px; border-top: 1px solid %%LINE%%; display: flex; flex-direction: column; gap: 14px">
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.16em; color: %%MUTED%%">WHAT IT DOES</span>
<h2 style="margin: 0; {DISP}; font-size: 34px; font-weight: 600; letter-spacing: -0.01em">One app instead of spreadsheets, email and WhatsApp</h2>
<p style="margin: 0; font-size: 15px; color: %%MUTED%%">A trainer and a nutritionist work on the same client. The client sees only what has been published.</p>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding-top: 12px">
{cap("NUTRITION", *tn, "Meal plans by week", "Build a week from recipes and ingredients, check the macros, and publish only finished weeks. A week in progress stays hidden.")}
{cap("TRAINING", *tt, "Plans and an exercise library", "Drag exercises into a session, save it as a template, and reuse it next time in one click.")}
{cap("CONTACT", *tc, "Check-ins and messages", "Once a week your client sends measurements, photos and how they feel. You reply in a chat that updates live — no page refresh.")}
</div>
</section>
<section style="padding: 8px 72px 40px">
<div style="border-radius: 18px; background: {band}; padding: 34px 36px; display: flex; align-items: center; gap: 24px">
<div style="display: flex; flex-direction: column; gap: 8px"><span style="{DISP}; font-size: 28px; font-weight: 600; color: %%SIDEBAR_TEXT%%">Try it with one client</span><span style="font-size: 14px; color: {band_sub}">Create an account, invite your first client, and build their first week. It takes an afternoon.</span></div>
<a href="#" style="margin-left: auto; height: 44px; padding: 0 20px; border-radius: 12px; background: %%SURFACE%%; color: %%INK%%; text-decoration: none; font-size: 14px; font-weight: 700; display: flex; align-items: center; white-space: nowrap">Create a coach account</a>
</div>
<div style="display: flex; padding-top: 22px; font-size: 12px; color: %%MUTED%%"><span>© 2026 Form Up</span><span style="margin-left: auto">Coach portal · Client app for iOS and Android</span></div>
</section>
</div>'''
    inp = lambda label, ph, tail="": f'<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%">{label}<span style="height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid %%LINE%%; background: %%SURFACE%%; display: flex; align-items: center; font-size: 14px; color: %%MUTED%%">{ph}{tail}</span></label>'
    lang = lambda l, on: f'<button style="height: 28px; padding: 0 9px; border-radius: 6px; border: 1px solid {"%%INK%%" if on else "%%LINE%%"}; background: {"%%INK%%" if on else "transparent"}; color: {"%%SURFACE%%" if on else "%%MUTED%%"}; font: 600 11px \'DM Sans\', sans-serif">{l}</button>'
    right = f'''<aside style="width: 440px; flex-shrink: 0; background: %%SURFACE%%; border-left: 1px solid %%LINE%%; box-sizing: border-box">
<div style="height: 900px; padding: 40px 44px 32px; box-sizing: border-box; display: flex; flex-direction: column">
<h2 style="margin: 0; {DISP}; font-size: 22px; font-weight: 500; line-height: 1.3; color: %%INK2%%">Join our community of coaches and nutritionists</h2>
<div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 26px; font-weight: 600">Welcome back</span><span style="font-size: 13px; color: %%MUTED%%">Sign in to the coach portal.</span></div>
{inp("Email", "coach@example.com")}
{inp("Password", "••••••••", '<span style="margin-left: auto; font-size: 12px; font-weight: 600; color: %%INK2%%">Show</span>')}
<div style="display: flex; align-items: center; font-size: 13px"><span style="display: flex; align-items: center; gap: 8px; color: %%INK2%%">{checkbox(True, "Keep me signed in")}Keep me signed in</span><a href="#" style="margin-left: auto; font-weight: 600; color: %%INK%%">Forgot password?</a></div>
<button style="height: 46px; border-radius: 12px; border: none; background: %%PRIMARY%%; color: %%PRIMARY_TEXT%%; font: 700 15px 'DM Sans', sans-serif">Sign in</button>
<div style="display: flex; align-items: center; gap: 12px; font-size: 11px; letter-spacing: 0.14em; color: %%MUTED%%"><span style="flex-grow: 1; height: 1px; background: %%LINE%%"></span>OR<span style="flex-grow: 1; height: 1px; background: %%LINE%%"></span></div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{btn("Google", "disabled", h=42, extra="; justify-content: center")}{btn("Apple", "disabled", "apple", 42, "; justify-content: center")}</div>
<div style="border-radius: 12px; background: %%GROUND%%; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; line-height: 1.5; color: %%MUTED%%"><span><span style="font-weight: 700; color: %%INK%%">Looking for a coach or nutritionist?</span> Download our mobile app and join today.</span><div style="display: flex; gap: 8px">{btn("App Store", "outline", "apple", 32)}{btn("Google Play", "outline", "play", 32)}</div></div>
<span style="font-size: 13px; color: %%MUTED%%">No account yet? <a href="#" style="font-weight: 700; color: %%INK%%">Create a coach account</a></span>
</div>
<div style="display: flex; gap: 6px">{lang("CS", False)}{lang("EN", True)}{lang("DE", False)}</div>
</div>
</aside>'''
    wash = (f"radial-gradient(1200px 520px at 0% 0%, %%TRAIN_SOFT%% 0%, transparent 60%), radial-gradient(900px 500px at 70% 0%, %%NUTRI_SOFT%% 0%, transparent 60%), %%GROUND%%"
            if d == "A" else "%%GROUND%%")
    body = f'<div style="width: {W}px; height: {EH}px; display: flex; background: {wash}; {FONT}; color: %%INK%%; overflow: hidden">{left}{right}</div>'
    return page(f"Entry {d}", W, EH, body, t)


# ---------------------------------------------------------------- canvas
PAGES = [("Entry", 1400, entry), ("Clients", H, clients), ("ClientDetail", H, client_detail),
         ("Inbox", H, inbox), ("Ingredients", H, ingredients), ("IngredientDrawer", H, drawer)]
cpath = os.path.join(HERE, "project", "canvas.json")
canvas = json.load(open(cpath))
canvas["pages"] = [{"id": "concepts", "name": "Concepts"}, {"id": "web", "name": "Web pages redesigned"}]
for k, v in canvas["boards"].items():
    v.setdefault("page", "concepts")
for n in canvas["notes"].values():
    n.setdefault("page", "concepts")
row_y = {"A": 0, "B": 1820, "C": 3640, "D": 5460}
new = []
for d, t in DIRS.items():
    BOLD_ON = t["BOLD"]
    DARK_ON = t["DARK"]
    x = 0
    for label, h, fn in PAGES:
        fname = f"Page{label}{d}.dc.html"
        os.makedirs(os.path.join(HERE, "project", "web"), exist_ok=True)
        with open(os.path.join(HERE, "project", fname), "w") as f:
            f.write(fn(d, t))
        canvas["boards"][fname] = {"x": x, "y": row_y[d], "w": W, "h": h, "title": f"{d} · {label}", "page": "web"}
        if fname not in canvas["order"]:
            canvas["order"].append(fname)
        new.append(fname)
        x += W + 80
    canvas["notes"][f"web{d}"] = {"x": 0, "y": row_y[d] - 300, "text": DIRS[d]["TAG"] + " — current web pages", "kind": "title1", "maxW": x - 80, "page": "web"}
json.dump(canvas, open(cpath, "w"), indent=1)
print("\n".join(new))
