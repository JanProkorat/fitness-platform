"""Coach zone (mobile): today, clients, client detail, plans (read-only), check-in review,
find clients, prospect, join request, invite sheet, messages, broadcast, profile."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen12.py")).read().split("NEW12 = {")[0]
exec(_src)
PATHS.update({
    "users": '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M18 14.8c1.9.7 3.1 2.4 3.5 5.2"></path>',
    "userplus": '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"></path><path d="M19 8v6"></path><path d="M16 11h6"></path>',
    "megaphone": '<path d="M4 10v4h3l7 4V6L7 10z"></path><path d="M17.5 9a4 4 0 0 1 0 6"></path>',
    "link": '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>',
    "lock": '<rect x="5" y="10.5" width="14" height="10" rx="2"></rect><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path>',
    "eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="3"></circle>',
    "flag": '<path d="M5 21V4"></path><path d="M5 4h11l-2 4 2 4H5"></path>',
    "note": '<rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M9 9h6"></path><path d="M9 13h6"></path><path d="M9 17h3"></path>',
})
PATHS.setdefault("more", '<circle cx="5.5" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="18.5" cy="12" r="1.2"></circle>')
PATHS.setdefault("external", '<path d="M14 4h6v6"></path><path d="M20 4l-9 9"></path><path d="M18 14v6H4V6h6"></path>')
PATHS.setdefault("chevdown", '<path d="M6 9l6 6 6-6"></path>')


def coach_tabbar(active, search=False):
    items = [("Today", "home"), ("Clients", "users"), ("Messages", "chat")]  # profile lives behind the avatar, as in the client app
    out = ""
    for label, icon in items:
        on = label == active
        bg = "background: %%SEG%%;" if on else ""
        c = "%%RED%%" if on else "%%MUTED%%"
        out += f'<a href="#" style="flex-grow: 1; height: 48px; border-radius: 24px; {bg} color: {c}; {A}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 10px; font-weight: {600 if on else 500}"><span style="position: relative; display: flex">{ic(icon, 20, sw="1.8" if on else "1.6")}{UNREAD_BADGE.format(n=3) if label == "Messages" else ""}</span>{label}</a>'
    if search:
        btn = f'<button aria-label="Search" style="position: absolute; right: 20px; bottom: 28px; width: 58px; height: 58px; border-radius: 29px; {GL}; color: %%INK%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic("search", 22, sw="1.8")}</button>'
        return f'<nav aria-label="Coach tabs" style="position: absolute; left: 20px; right: 88px; bottom: 28px; height: 58px; padding: 0 5px; box-sizing: border-box; border-radius: 29px; {GL}; display: flex; align-items: center">{out}</nav>' + btn
    return f'<nav aria-label="Coach tabs" style="position: absolute; left: 20px; right: 20px; bottom: 28px; height: 58px; padding: 0 5px; box-sizing: border-box; border-radius: 29px; {GL}; display: flex; align-items: center">{out}</nav>'


COACH_AVATAR_BTN = f'<button aria-label="Profile" style="width: 40px; height: 40px; border-radius: 20px; {GL}; color: %%INK%%; font: 600 13px \'DM Sans\', sans-serif; padding: 0">MK</button>'


def count_badge(n):
    return f'<span style="min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 10px; background: %%RED%%; color: #FFFFFF; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center">{n}</span>'


def plan_icons(kinds):
    out = ""
    for k in kinds:
        icon, soft, ink = ("dumbbell", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%") if k == "t" else ("leaf", "%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%")
        out += soft_icon(icon, soft, ink, 22)
    return f'<span style="display: flex; gap: 4px">{out}</span>'


def small_btn(label, primary=False, color="%%INK%%"):
    st = f"background: {color}; color: %%BG%%; border: none" if primary else "background: transparent; color: %%INK%%; border: 1px solid %%HAIR%%"
    return f'<button style="height: 30px; padding: 0 12px; border-radius: 15px; {st}; font: 600 12px \'DM Sans\', sans-serif; white-space: nowrap">{label}</button>'


def person_row(ini, name, sub, right="", first=False, unread=False, sub_color="%%MUTED%%"):
    dot = '<span style="position: absolute; top: 0; right: 0; width: 10px; height: 10px; border-radius: 5px; background: %%RED%%; border: 2px solid %%CARD%%"></span>' if unread else ""
    return f'''<div style="display: flex; align-items: center; gap: 12px; padding: 11px 0; {"" if first else "border-top: 1px solid %%HAIR%%;"}">
<span style="position: relative">{avatar(ini, 40)}{dot}</span>
<a href="#" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; color: %%INK%%; {A}"><span style="font-size: 15px; font-weight: 600">{name}</span><span style="font-size: 12px; color: {sub_color}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span></a>
{right}</div>'''


def section(title, n, rows):
    return f'''<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 12px 16px 2px">
<div style="display: flex; align-items: center; gap: 8px; padding-bottom: 2px"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: %%MUTED%%">{title}</span>{count_badge(n)}</div>{rows}</div>'''


CHEV = '<span style="display: flex; color: %%MUTED%%">' + ic("chevron", 15) + '</span>'


# ---------------------------------------------------------------- Today
def coach_today(mode, t):
    stat = lambda v, l, red=False: f'<div style="border-radius: 16px; {CARD}; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px"><span style="{DISP}; font-size: 20px; font-weight: 600; color: {"%%RED%%" if red else "%%INK%%"}">{v}</span><span style="font-size: 11px; color: %%MUTED%%">{l}</span></div>'
    checkins = (person_row("ES", "Eva Svobodová", "Week 6 · −0.6 kg · sleep flagged", CHEV, first=True)
                + person_row("TD", "Tomáš Dvořák", "Week 3 · 2 new photos", CHEV)
                + f'<a href="#" style="display: block; padding: 10px 0; border-top: 1px solid %%HAIR%%; font-size: 13px; color: %%MUTED%%; {A}">+ 2 more</a>')
    requests = person_row("LH", "Lucie Horáková", "Wants training · Lose fat", f'<span style="display: flex; gap: 6px">{small_btn("Decline")}{small_btn("Accept", True)}</span>', first=True)
    missing = person_row("PN", "Petr Novotný", "Check-in due Sun · not sent", small_btn("Remind"), first=True)
    ending = person_row("KV", "Kateřina Veselá", "Training plan ends in 6 days", small_btn("Plan on web"), first=True)
    body = body_top(f'''{head("Today", gbtn("userplus", "Invite client") + gbtn("bell", "Notifications", dot=True) + COACH_AVATAR_BTN, "Thursday, 1 October · Coach")}
<div style="margin: 0 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">{stat("18", "Active clients")}{stat("4", "Check-ins to review", True)}</div>
{section("CHECK-INS TO REVIEW", 4, checkins)}
{section("JOIN REQUESTS", 1, requests)}
{section("MISSING CHECK-INS", 1, missing)}
{section("PLANS ENDING SOON", 1, ending)}''', gap=12)
    return screen("Coach today", body + fade() + coach_tabbar("Today"), t, mode)


# ---------------------------------------------------------------- Clients
CLIENTS = [("ES", "Eva Svobodová", "New check-in", "tn", True, "%%RED%%"), ("TD", "Tomáš Dvořák", "Week 3 of 8", "t", True, "%%MUTED%%"),
           ("KV", "Kateřina Veselá", "Plan ends in 6 days", "tn", False, "%%TRAIN_TEXT%%"), ("PN", "Petr Novotný", "Check-in missing", "t", False, "%%RED%%"),
           ("JK", "Jana Kučerová", "Week 9 of 12", "t", False, "%%MUTED%%"), ("OM", "Ondřej Marek", "Week 2 of 10", "tn", False, "%%MUTED%%")]


def mode_switch(active):
    return f'<div style="padding: 0 16px">{seg(["My clients", "Find clients"], active)}</div>'


def coach_clients(mode, t):
    rows = "".join(person_row(i, n, s, plan_icons(k) + CHEV, first=idx == 0, unread=u, sub_color=c) for idx, (i, n, s, k, u, c) in enumerate(CLIENTS))
    body = body_top(f'''{head("Clients", gbtn("userplus", "Invite client"), "18 active")}
{mode_switch("My clients")}
<div style="padding: 0 16px; display: flex; gap: 8px; overflow: hidden">{chip("Active · 18", True)}{chip("Pending · 2")}{chip("Paused · 1")}{chip("Archived · 3")}</div>
<div style="padding: 0 16px; display: flex; gap: 8px; overflow: hidden">{chip("Unread 3")}{chip("New check-ins 4")}{chip("Missing 2")}{chip("Ending soon 1")}</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px">{rows}</div>''', gap=12)
    return screen("Coach clients", body + fade() + coach_tabbar("Clients", search=True), t, mode)


# ---------------------------------------------------------------- Client detail
def client_header(active):
    plan_chip = lambda icon, soft, ink, text: f'<span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px; background: {soft}; color: {ink}; font-size: 11px; font-weight: 600">{ic(icon, 12, sw="2")}{text}</span>'
    return f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 20px; text-align: center">{avatar("ES", 64)}
<h1 style="{H1}; font-size: 24px">Eva Svobodová</h1><span style="font-size: 13px; color: %%MUTED%%">34 · Lose fat · client since March</span>
<span style="display: flex; gap: 6px; padding-top: 2px">{plan_chip("dumbbell", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", "Training · you")}{plan_chip("leaf", "%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%", "Nutrition · Jana K.")}</span></div>
<div style="padding: 0 16px">{seg(["Overview", "Plans", "Check-ins", "Notes"], active)}</div>'''


def coach_client_detail(mode, t):
    act = lambda icon, label: f'<button style="flex-grow: 1; height: 56px; border-radius: 16px; {CARD}; color: %%INK%%; font: 500 12px \'DM Sans\', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px">{ic(icon, 18, sw="1.8")}{label}</button>'
    body = body_top(f'''{client_header("Overview")}
<div style="margin: 0 16px; display: flex; gap: 8px">{act("chat", "Message")}{act("camera", "Ask for photos")}{act("note", "Add note")}</div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 16px; display: flex; align-items: center; gap: 12px"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%">Weight</span><span style="{DISP}; font-size: 22px; font-weight: 600">72.4 kg</span><span style="font-size: 12px; color: %%NUTRI_TEXT%%; font-weight: 600">−3.7 kg since start</span></span><span style="margin-left: auto">{sparkline(130, 40, "%%INK%%")}</span></div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; font-size: 13px"><span>Training plan · week 6 of 12</span><span style="margin-left: auto; font-weight: 600">17 / 18 sessions</span></div>{thin_bar(94, "%%TRAIN%%", 4)}
<div style="display: flex; align-items: center; gap: 6px; padding-top: 4px; font-size: 12px; color: %%MUTED%%">{ic("lock", 12, sw="1.8")}Nutrition is Jana Kučerová's plan — you see the summary only</div></div>
<div style="padding: 0 16px">{group("", list_row("Last check-in", "Sun 27 Sep · reviewed", icon="clipboard", soft="%%RED_SOFT%%", ink="%%RED%%", first=True) + list_row("Progress photos", "14 · shared", icon="photo"))}</div>''', top=84, gap=12)
    return screen("Coach client detail", body + top_bar(gbtn("back", "Back"), "", gbtn("more", "More")) + fade(), t, mode)


def coach_client_plans(mode, t):
    days = [("Mon 28", "Upper body A", "done"), ("Wed 30", "Lower body A", "done"), ("Thu 1 · today", "Lower body B", "todo"), ("Sat 3", "Full body C", "todo")]
    rows = ""
    for i, (d, n, st) in enumerate(days):
        mark = (f'<span style="width: 22px; height: 22px; border-radius: 11px; background: %%TRAIN%%; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 11, sw="2.8")}</span>' if st == "done"
                else '<span style="width: 20px; height: 20px; border-radius: 11px; border: 1.5px solid %%MUTED%%; opacity: 0.5"></span>')
        rows += f'<a href="#" style="display: flex; align-items: center; gap: 12px; padding: 11px 0; {"" if i == 0 else "border-top: 1px solid %%HAIR%%;"} color: %%INK%%; {A}">{mark}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 12px; color: %%MUTED%%">{d}</span><span style="font-size: 15px; font-weight: 500">{n}</span></span><span style="margin-left: auto">{CHEV}</span></a>'
    body = body_top(f'''{client_header("Plans")}
<div style="margin: 0 16px; border-radius: 16px; background: %%SEG%%; padding: 10px 14px; display: flex; align-items: center; gap: 10px; font-size: 13px; color: %%INK2%%">{ic("eye", 16, sw="1.8")}View only — edit plans in the web portal<a href="#" style="margin-left: auto; font-weight: 600; color: %%INK%%; display: flex; {A}">{ic("external", 15, sw="1.8")}</a></div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 14px 16px 4px; display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; align-items: center">{eyebrow("STRENGTH BLOCK 2", "%%TRAIN_TEXT%%", "dumbbell")}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Week 6 of 12</span></div>{thin_bar(50, "%%TRAIN%%", 3)}
<div>{rows}</div></div>
<a href="#" style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 16px; display: flex; align-items: center; gap: 12px; color: %%INK%%; {A}">{soft_icon("leaf", "%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%", 32)}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 500">Cut — phase 2</span><span style="font-size: 12px; color: %%MUTED%%">Jana Kučerová's plan · summary only</span></span><span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("lock", 15, sw="1.8")}</span></a>''', top=84, gap=12)
    return screen("Coach client plans", body + top_bar(gbtn("back", "Back"), "", gbtn("more", "More")) + fade(), t, mode)


def coach_checkin_review(mode, t):
    scale_ro = lambda lbl, v, desc, color, flag=False: f'<div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-top: 1px solid %%HAIR%%"><div style="display: flex; font-size: 14px"><span>{lbl}</span>{"<span style=\"margin-left: 8px; display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px; border-radius: 999px; background: %%RED_SOFT%%; color: %%RED%%; font-size: 11px; font-weight: 600\">" + ic("flag", 10, sw="2") + "Low</span>" if flag else ""}<span style="margin-left: auto; font-size: 13px; color: {color}; font-weight: 600">{desc}</span></div>{seg_scale(lbl, v, 5, color)}</div>'
    ph = lambda c: f'<div style="flex-grow: 1; height: 84px; border-radius: 12px; background: linear-gradient(160deg, {c}, #A9805F)"></div>'
    body = body_top(f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 4px"><span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: %%MUTED%%">{avatar("ES", 22)}Eva Svobodová · Sun 19:40</span><h1 style="{H1}">Check-in · week 6</h1></div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 12px 16px; display: flex; align-items: baseline"><span style="font-size: 13px; color: %%MUTED%%">Weight</span><span style="margin-left: auto; {DISP}; font-size: 22px; font-weight: 600">72.4 kg</span><span style="margin-left: 8px; font-size: 12px; font-weight: 600; color: %%NUTRI_TEXT%%">−0.6</span></div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 2px 16px 6px">{scale_ro("Energy", 4, "Good", "%%TRAIN_TEXT%%").replace("border-top: 1px solid %%HAIR%%", "border-top: none", 1)}{scale_ro("Sleep", 2, "Short nights", "%%RED%%", True)}{scale_ro("Hunger", 3, "Okay", "%%NUTRI_TEXT%%")}</div>
<div style="margin: 0 16px; display: flex; gap: 8px">{ph("#D9B9A0")}{ph("#CFAE95")}{ph("#C9A285")}</div>
<div style="margin: 0 16px; border-radius: 16px; background: %%SEG%%; padding: 12px 14px; font-size: 14px; line-height: 1.45; color: %%INK2%%">“Work was crazy, slept about 6 hours. Training went fine though.”</div>
<label style="margin: 0 16px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: %%MUTED%%">Reply to Eva<span style="min-height: 52px; padding: 10px 12px; box-sizing: border-box; border-radius: 14px; background: %%INPUT_BG%%; border: 1px solid %%HAIR%%; font-size: 14px; color: %%INK%%">Great consistency! Let's aim for 7 hours this week —</span></label>''', top=84, gap=10)
    return screen("Coach check-in review", body + top_bar(gbtn("back", "Back")) + fade() + cta("Mark reviewed &amp; reply", "check"), t, mode)


# ---------------------------------------------------------------- Find clients
PROSPECTS = [("LH", "Lucie H.", "29 · Lose fat · Prague", "2 days ago"), ("MS", "Michal S.", "41 · Get stronger · Online", "today"),
             ("BN", "Barbora N.", "24 · Build muscle · Brno", "4 days ago"), ("DK", "David K.", "35 · Move more · Online", "1 week ago")]


def coach_find(mode, t):
    rows = "".join(f'''<a href="#" style="display: flex; align-items: center; gap: 12px; padding: 12px 0; {"" if i == 0 else "border-top: 1px solid %%HAIR%%;"} color: %%INK%%; {A}">{avatar(ini, 44, "%%SEG%%", "%%INK2%%")}
<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 3px"><span style="display: flex; align-items: center; gap: 6px"><span style="font-size: 15px; font-weight: 600">{n}</span>{role_chip("Trainer").replace("Trainer", "Needs trainer")}</span><span style="font-size: 12px; color: %%MUTED%%">{d}</span><span style="font-size: 11px; color: %%MUTED%%">Looking since {w}</span></span>{CHEV}</a>''' for i, (ini, n, d, w) in enumerate(PROSPECTS))
    body = body_top(f'''{head("Clients", gbtn("userplus", "Invite client"), "Find new clients")}
{mode_switch("Find clients")}
<div style="margin: 0 16px; border-radius: 16px; background: %%SEG%%; padding: 10px 14px; display: flex; gap: 10px; font-size: 13px; line-height: 1.45; color: %%INK2%%"><span style="display: flex; padding-top: 1px">{ic("eye", 16, sw="1.8")}</span>People without a trainer who chose to be visible to coaches. You see first name, age, goal and city only.</div>
<div style="padding: 0 16px; display: flex; gap: 8px; overflow: hidden">{chip("Near me", True)}{chip("Online")}{chip("Lose fat")}{chip("Build muscle")}{chip("Get stronger")}</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px"><div style="padding: 10px 0 2px; font-size: 12px; color: %%MUTED%%">12 people looking for a trainer</div>{rows}</div>''', gap=12)
    return screen("Coach find clients", body + fade() + coach_tabbar("Clients", search=True), t, mode)


def coach_prospect(mode, t):
    fact = lambda l, v, first=False: f'<div style="display: flex; padding: 11px 0; {"" if first else "border-top: 1px solid %%HAIR%%;"} font-size: 14px"><span style="color: %%MUTED%%">{l}</span><span style="margin-left: auto; font-weight: 500">{v}</span></div>'
    body = body_top(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 20px; text-align: center">{avatar("LH", 64, "%%SEG%%", "%%INK2%%")}<h1 style="{H1}; font-size: 24px">Lucie H.</h1><span style="font-size: 13px; color: %%MUTED%%">Looking for a trainer · since 2 days</span></div>
<div style="margin: 0 16px; border-radius: 16px; background: %%SEG%%; padding: 12px 14px; font-size: 14px; line-height: 1.45; color: %%INK2%%">“I want to lose about 5 kg and feel stronger. I can train 3× a week, mornings.”</div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 2px 16px">{fact("Goal", "Lose fat", True)}{fact("Age", "29")}{fact("City", "Prague · also online")}{fact("Activity", "Moderately active")}{fact("Has a nutritionist", "No")}</div>
<div style="margin: 0 16px; display: flex; gap: 10px; padding: 0 4px; font-size: 12px; line-height: 1.45; color: %%MUTED%%"><span style="display: flex; padding-top: 1px">{ic("lock", 14, sw="1.8")}</span>Height, weight and history stay hidden until Lucie accepts your offer.</div>
<label style="margin: 0 16px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: %%MUTED%%">Your message<span style="min-height: 64px; padding: 10px 12px; box-sizing: border-box; border-radius: 14px; background: %%INPUT_BG%%; border: 1px solid %%HAIR%%; font-size: 14px; color: %%INK%%">Hi Lucie, mornings work great for me. Happy to build you a 3-day plan.</span></label>''', top=84, gap=12)
    return screen("Coach prospect", body + top_bar(gbtn("back", "Back")) + fade() + cta("Send coaching offer", "arrowup"), t, mode)


def coach_join_request(mode, t):
    fact = lambda l, v, first=False: f'<div style="display: flex; padding: 11px 0; {"" if first else "border-top: 1px solid %%HAIR%%;"} font-size: 14px"><span style="color: %%MUTED%%">{l}</span><span style="margin-left: auto; font-weight: 500">{v}</span></div>'
    body = body_top(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 20px; text-align: center">{avatar("LH", 64)}<h1 style="{H1}; font-size: 24px">Lucie Horáková</h1><span style="display: flex; gap: 6px">{role_chip("Trainer").replace("Trainer", "Wants training")}<span style="font-size: 12px; color: %%MUTED%%">Sent today, 09:12</span></span></div>
<div style="margin: 0 16px; border-radius: 16px; background: %%SEG%%; padding: 12px 14px; font-size: 14px; line-height: 1.45; color: %%INK2%%">“Hi Martin, I'd like to get stronger and lose a few kilos.”</div>
<div style="padding: 0 20px">{eyebrow("ONBOARDING ANSWERS")}</div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 2px 16px">{fact("Goal", "Lose fat", True)}{fact("Height", "168 cm")}{fact("Weight", "73.0 kg")}{fact("Activity", "Moderately active")}</div>
<div style="margin: 0 16px; border-radius: 16px; {CARD}; padding: 12px 14px; display: flex; align-items: center; gap: 10px; font-size: 13px; color: %%MUTED%%">{ic("lock", 15, sw="1.8")}History not shared<span style="margin-left: auto; font-size: 12px">past plans stay private</span></div>''', top=84, gap=12)
    btns = f'''<div style="position: absolute; left: 20px; right: 20px; bottom: 34px; display: flex; gap: 10px">
<button style="{BTN}; flex-grow: 1; background: %%CARD%%; border: 1px solid %%HAIR%%; color: %%INK%%; font-weight: 500">Decline</button>
<button style="{BTN}; flex-grow: 1; background: %%INK%%; color: %%BG%%">{ic("check", 16, sw="2.2")}Accept</button></div>'''
    return screen("Coach join request", body + top_bar(gbtn("back", "Back")) + fade() + btns, t, mode)


def coach_invite(mode, t):
    under = coach_clients(mode, t)
    inner = under[under.index("<x-dc>"):under.index("</x-dc>")]
    sheet = f'''<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4)"></div>
<div role="dialog" aria-label="Invite a client" style="position: absolute; left: 8px; right: 8px; bottom: 8px; border-radius: 34px; {GL}; background: %%CARD%%; {FONT}; color: %%INK%%; padding: 10px 20px 22px; display: flex; flex-direction: column; gap: 14px">
<span style="align-self: center; width: 36px; height: 5px; border-radius: 3px; background: %%HAIR%%"></span>
<span style="{DISP}; font-size: 22px; font-weight: 600">Invite a client</span>
{field("Email", "lucie@example.com", "mail")}
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: %%MUTED%%">Message (optional)<span style="min-height: 60px; padding: 10px 12px; box-sizing: border-box; border-radius: 14px; background: %%INPUT_BG%%; border: 1px solid %%HAIR%%; font-size: 14px; color: %%INK%%">Great to meet you at the gym today!</span></label>
<button style="{BTN}; background: %%INK%%; color: %%BG%%">Send invitation</button>
<div style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: %%MUTED%%"><span style="flex-grow: 1; height: 1px; background: %%HAIR%%"></span>or meet in person<span style="flex-grow: 1; height: 1px; background: %%HAIR%%"></span></div>
<div style="display: flex; gap: 12px; align-items: center"><div style="width: 84px; height: 84px; flex-shrink: 0; border-radius: 14px; background: repeating-linear-gradient(90deg, %%INK%% 0 6px, transparent 6px 10px), repeating-linear-gradient(0deg, %%INK%% 0 6px, transparent 6px 10px); opacity: 0.85" aria-label="Invite QR code" role="img"></div>
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 8px"><span style="font-size: 13px; color: %%MUTED%%">Let them scan the code, or share your personal link</span>{small_btn("Share invite link")}</div></div>
</div>'''
    sheet = fill(sheet, t)  # the page is already filled; fill the sheet's own colour tokens
    return under.replace(inner, inner.rstrip() + "\n" + sheet + "\n").replace("<title>Coach clients", "<title>Coach invite")


# ---------------------------------------------------------------- Messages & broadcast
def coach_messages(mode, t):
    conv = [("ES", "Eva Svobodová", "Thanks! See you Thursday", "10:42", True), ("TD", "Tomáš Dvořák", "Can we swap Friday for Saturday?", "09:15", True),
            ("KV", "Kateřina Veselá", "Photo", "Yesterday", True), ("PN", "Petr Novotný", "You: Don't forget Sunday's check-in", "Yesterday", False),
            ("JK", "Jana Kučerová", "Knee feels better now", "28 Sep", False), ("OM", "Ondřej Marek", "You: New week is up", "27 Sep", False)]
    rows = "".join(person_row(i, n, m, f'<span style="font-size: 11px; color: %%MUTED%%">{w}</span>', first=idx == 0, unread=u, sub_color="%%INK2%%" if u else "%%MUTED%%") for idx, (i, n, m, w, u) in enumerate(conv))
    body = body_top(f'''{head("Messages", gbtn("megaphone", "Broadcast") + gbtn("compose", "New message"), "3 unread")}
<div style="padding: 0 16px; display: flex; gap: 8px">{chip("All", True)}{chip("Unread 3")}{chip("New check-ins 4")}{chip("Archived")}</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px">{rows}</div>''', gap=12)
    return screen("Coach messages", body + fade() + coach_tabbar("Messages", search=True), t, mode)


def coach_broadcast(mode, t):
    stack = "".join(f'<span style="margin-left: {0 if i == 0 else -10}px; border: 2px solid %%CARD%%; border-radius: 18px; display: flex">{avatar(x, 32)}</span>' for i, x in enumerate(["ES", "TD", "KV", "JK", "OM"]))
    body = body_top(f'''<div style="padding: 0 20px"><h1 style="{H1}">Broadcast</h1></div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 12px 16px; display: flex; align-items: center; gap: 12px"><span style="display: flex">{stack}</span><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 600">5 clients</span><span style="font-size: 12px; color: %%MUTED%%">Each gets it in their own chat</span></span><span style="margin-left: auto">{small_btn("Edit")}</span></div>
<label style="margin: 0 16px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: %%MUTED%%">Message<span style="min-height: 150px; padding: 12px 14px; box-sizing: border-box; border-radius: 16px; background: %%INPUT_BG%%; border: 1px solid %%HAIR%%; font-size: 15px; line-height: 1.5; color: %%INK%%">Hi <span style="padding: 1px 6px; border-radius: 6px; background: %%RED_SOFT%%; color: %%RED%%; font-weight: 600">first name</span>, next week is a deload — keep the weights at 80 % and focus on sleep. 💤</span></label>
<div style="padding: 0 16px; display: flex; gap: 8px">{chip("+ First name")}{chip("+ Full name")}</div>''', top=84, gap=12)
    return screen("Coach broadcast", body.replace(" 💤", "") + top_bar(gbtn("x", "Close")) + cta("Send to 5 clients", "arrowup"), t, mode)


# ---------------------------------------------------------------- Profile
def coach_profile(mode, t):
    body = body_top(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 20px">{avatar("MK", 76)}<h1 style="{H1}; font-size: 26px">Martin Král</h1><span style="display: flex; gap: 6px; align-items: center">{role_chip("Trainer")}<span style="font-size: 13px; color: %%MUTED%%">Prague · online</span></span></div>
<div style="padding: 0 16px">{group("AVAILABILITY", list_row("Taking new clients", chevron=False, first=True, right=toggle(True)) + list_row("Visible in coach search", chevron=False, right=toggle(True)) + list_row("Client limit", "18 of 20"))}</div>
<div style="padding: 0 16px">{group("PUBLIC PROFILE", list_row("Preview as a client sees it", icon="eye", first=True) + list_row("Bio, photo, specialties", "Edit on web", icon="external"))}</div>
<div style="padding: 0 16px">{group("", list_row("Settings", icon="gear", first=True) + list_row("Open web portal", icon="external"))}</div>''', top=84, gap=14)
    return screen("Coach profile", body + top_bar(gbtn("back", "Back"), "", gbtn("compose", "Edit profile")), t, mode)


def coach_clients_search(mode, t):
    hits = [("ES", "Eva Svobodová", "eva.svobodova@email.cz", "tn"), ("EK", "Evžen Kos", "Paused · ev.kos@email.cz", "t")]
    rows = "".join(person_row(i, n, s, plan_icons(k) + CHEV, first=idx == 0) for idx, (i, n, s, k) in enumerate(hits))
    body = body_top(f'''{head("Clients", "", "Search")}
<div style="padding: 0 20px; font-size: 12px; color: %%MUTED%%">2 results for “ev” · active, paused and archived</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px">{rows}</div>
<div style="padding: 0 20px">{eyebrow("RECENT")}</div>
<div style="padding: 0 16px; display: flex; flex-wrap: wrap; gap: 8px">{chip("Tomáš")}{chip("missing check-in")}{chip("Kateřina")}</div>''', gap=12)
    field_ = f'''<label style="position: absolute; left: 20px; right: 88px; bottom: 28px; height: 58px; padding: 0 8px 0 18px; box-sizing: border-box; border-radius: 29px; {GL}; display: flex; align-items: center; gap: 10px; color: %%MUTED%%">{ic("search", 20, sw="1.8")}<input value="ev" aria-label="Search clients" style="flex-grow: 1; border: none; outline: none; background: transparent; font: 16px 'DM Sans', sans-serif; color: %%INK%%"><button aria-label="Clear" style="width: 26px; height: 26px; border-radius: 13px; border: none; background: %%SEG%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic("x", 12, sw="2.4")}</button></label>
<button aria-label="Close search" style="position: absolute; right: 20px; bottom: 28px; width: 58px; height: 58px; border-radius: 29px; {GL}; color: %%INK%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic("x", 20, sw="1.8")}</button>'''
    return screen("Coach clients search", body + fade() + field_, t, mode)


NEW13 = [
    ("Coach — today & clients", [("CoachToday", coach_today), ("CoachClients", coach_clients), ("CoachClientsSearch", coach_clients_search), ("CoachClientDetail", coach_client_detail), ("CoachClientPlans", coach_client_plans), ("CoachCheckInReview", coach_checkin_review)]),
    ("Coach — growing: find clients, offers, requests, invites", [("CoachFindClients", coach_find), ("CoachProspect", coach_prospect), ("CoachJoinRequest", coach_join_request), ("CoachInvite", coach_invite)]),
    ("Coach — messages & profile", [("CoachMessages", coach_messages), ("CoachBroadcast", coach_broadcast), ("CoachProfile", coach_profile)]),
]
for mode, t in MODES.items():
    for _, screens in NEW13:
        for label_, fn in screens:
            with open(os.path.join(HERE, "project", f"{label_}{mode}.dc.html"), "w") as f:
                f.write(fn(mode, t))
print("ok")
