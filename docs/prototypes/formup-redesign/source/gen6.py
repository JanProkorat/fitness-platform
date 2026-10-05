"""Full mobile app map: new screens in the refined glass style, plus a canvas layout grouped by area."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen5.py")).read().split("SCREENS = [")[0]
exec(_src)
PATHS.update({
    "filter": '<path d="M4 6h16"></path><path d="M7 12h10"></path><path d="M10 18h4"></path>',
    "pin": '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"></path><circle cx="12" cy="10" r="2.3"></circle>',
    "globe": '<circle cx="12" cy="12" r="8.5"></circle><path d="M3.5 12h17"></path><path d="M12 3.5c2.5 2.6 3.6 5.5 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.5-3.6-8.5s1.1-5.9 3.6-8.5z"></path>',
    "share": '<path d="M12 4v11"></path><path d="M8 8l4-4 4 4"></path><path d="M6 12v7h12v-7"></path>',
    "ruler": '<rect x="3" y="8" width="18" height="8" rx="1.5"></rect><path d="M7 8v3"></path><path d="M11 8v4"></path><path d="M15 8v3"></path>',
    "photo": '<rect x="3.5" y="4.5" width="17" height="15" rx="2"></rect><circle cx="9" cy="10" r="1.6"></circle><path d="M20.5 16l-5-5-9 8.5"></path>',
    "route": '<circle cx="6" cy="18" r="2"></circle><circle cx="18" cy="6" r="2"></circle><path d="M8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6"></path>',
    "gear": '<circle cx="12" cy="12" r="3"></circle><path d="M12 3v2.5"></path><path d="M12 18.5V21"></path><path d="M3 12h2.5"></path><path d="M18.5 12H21"></path><path d="M5.6 5.6l1.8 1.8"></path><path d="M16.6 16.6l1.8 1.8"></path><path d="M5.6 18.4l1.8-1.8"></path><path d="M16.6 7.4l1.8-1.8"></path>',
    "compose": '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"></path>',
    "swap": '<path d="M7 7h11l-3-3"></path><path d="M17 17H6l3 3"></path>',
    "star": '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"></path>',
})

ROW = "display: flex; align-items: center; gap: 12px"


def avatar(ini, size=44, bg="#141414", fg="#F6F4F0"):
    return f'<span style="width: {size}px; height: {size}px; flex-shrink: 0; border-radius: {size // 2}px; background: {bg}; color: {fg}; font-size: {max(11, size // 3)}px; font-weight: 600; display: flex; align-items: center; justify-content: center">{ini}</span>'


def role_chip(role):
    soft, ink = ("%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%") if role == "Trainer" else ("%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%")
    return f'<span style="padding: 3px 8px; border-radius: 999px; background: {soft}; color: {ink}; font-size: 11px; font-weight: 600">{role}</span>'


def toggle(on, color="%%NUTRI%%", label="Toggle"):
    if on:
        return f'<span role="switch" aria-checked="true" aria-label="{label}" style="width: 48px; height: 28px; flex-shrink: 0; border-radius: 14px; background: {color}; position: relative"><span style="position: absolute; top: 2px; right: 2px; width: 24px; height: 24px; border-radius: 12px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,0.25)"></span></span>'
    return f'<span role="switch" aria-checked="false" aria-label="{label}" style="width: 48px; height: 28px; flex-shrink: 0; border-radius: 14px; background: %%SEG%%; border: 1px solid %%HAIR%%; box-sizing: border-box; position: relative"><span style="position: absolute; top: 1px; left: 1px; width: 24px; height: 24px; border-radius: 12px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,0.25)"></span></span>'


def list_row(label, value="", icon=None, soft=None, ink=None, chevron=True, first=False, right=None, color="%%INK%%", sub=None):
    i = soft_icon(icon, soft or "%%SEG%%", ink or "%%INK2%%", 30) if icon else ""
    v = f'<span style="font-size: 14px; color: %%MUTED%%">{value}</span>' if value else ""
    c = f'<span style="display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span>' if chevron else ""
    s = f'<span style="font-size: 12px; color: %%MUTED%%">{sub}</span>' if sub else ""
    border = "" if first else "border-top: 1px solid %%HAIR%%;"
    return f'<a href="#" style="{ROW}; padding: 12px 0; {border} color: {color}; {A}">{i}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px">{label}</span>{s}</span><span style="margin-left: auto; {ROW}; gap: 6px">{v}{right or ""}{c}</span></a>'


def group(title, rows):
    t = f'<span style="padding: 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: %%MUTED%%">{title}</span>' if title else ""
    return f'<div style="display: flex; flex-direction: column; gap: 6px">{t}<div style="border-radius: 20px; {CARD}; padding: 2px 16px">{rows}</div></div>'


def body_top(inner, top=34, gap=16):
    return f'<div style="position: absolute; top: 0; left: 0; right: 0; padding-top: {top}px; display: flex; flex-direction: column; gap: {gap}px">{inner}</div>'


def search_field(ph):
    return f'<label style="margin: 0 16px; height: 44px; padding: 0 14px; border-radius: 22px; {GL}; display: flex; align-items: center; gap: 8px; color: %%MUTED%%">{ic("search", 17, sw="1.7")}<input placeholder="{ph}" aria-label="{ph}" style="flex-grow: 1; border: none; outline: none; background: transparent; font: 15px \'DM Sans\', sans-serif; color: %%INK%%"></label>'


def seg(options, active):
    out = "".join(f'<button style="flex-grow: 1; height: 32px; border-radius: 16px; border: none; {"background: %%SEG_ON%%; box-shadow: %%SEG_SHADOW%%; color: %%INK%%; font-weight: 600" if o == active else "background: transparent; color: %%MUTED%%; font-weight: 500"}; font-family: \'DM Sans\', sans-serif; font-size: 13px">{o}</button>' for o in options)
    return f'<div style="display: flex; padding: 3px; border-radius: 19px; background: %%SEG%%">{out}</div>'


def chip(label, on=False):
    st = "background: %%INK%%; color: %%BG%%; border: 1px solid %%INK%%" if on else "background: transparent; color: %%INK2%%; border: 1px solid %%HAIR%%"
    return f'<button style="height: 32px; padding: 0 12px; border-radius: 16px; {st}; font: 500 13px \'DM Sans\', sans-serif; white-space: nowrap">{label}</button>'


def search_fab():
    return f'<button aria-label="Search" style="position: absolute; right: 20px; bottom: 34px; width: 58px; height: 58px; border-radius: 29px; {GL}; color: %%INK%%; display: flex; align-items: center; justify-content: center; padding: 0">{ic("search", 22, sw="1.8")}</button>'


def search_acc():
    return gbtn("search", "Search", size=58)


# ================================================================ START
def today_no_coach(mode, t):
    inv = f'''<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 16px; display: flex; flex-direction: column; gap: 12px">
<div style="{ROW}">{avatar("JK", 42)}<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">Jana Kučerová invited you</span><span style="{ROW}; gap: 6px; font-size: 12px; color: %%MUTED%%">{role_chip("Nutritionist")} 2 hours ago</span></div></div>
<div style="display: flex; gap: 8px"><button style="{BTN}; height: 40px; flex-grow: 1; background: %%INK%%; color: %%BG%%; font-size: 14px">Accept</button><button style="{BTN}; height: 40px; flex-grow: 1; background: transparent; border: 1px solid %%HAIR%%; color: %%INK%%; font-size: 14px; font-weight: 500">Decline</button></div>
</div>'''
    find = lambda role, sub, icon, soft, ink: f'<a href="#" style="{ROW}; padding: 14px 0; border-top: 1px solid rgba(255,255,255,0.14); color: #F6F4F0; {A}">{soft_icon(icon, soft, ink, 36)}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 600">Find a {role}</span><span style="font-size: 12px; color: rgba(246,244,240,0.65)">{sub}</span></span><span style="margin-left: auto; display: flex; color: rgba(246,244,240,0.6)">{ic("chevron", 16)}</span></a>'
    body = body_top(f'''{head("Welcome, Eva", gbtn("bell", "Notifications", dot=True), "Let's get you started")}
<div style="margin: 4px 16px 0; border-radius: 24px; background: #141414; border: 1px solid %%HAIR%%; color: #F6F4F0; padding: 20px 18px 6px; display: flex; flex-direction: column; gap: 6px">
<span style="{DISP}; font-size: 24px; font-weight: 600; letter-spacing: -0.01em">Get a plan made for you</span>
<span style="font-size: 14px; color: rgba(246,244,240,0.7); padding-bottom: 8px">Connect with a coach. They build your training and meals, you follow them here.</span>
{find("trainer", "Sessions built around your goal", "dumbbell", "rgba(242,140,56,0.2)", "#F28C38")}{find("nutritionist", "Meals that fit your day", "leaf", "rgba(140,193,82,0.2)", "#8CC152")}
</div>
<div style="padding: 6px 20px 0">{eyebrow("INVITES")}</div>
{inv}
<a href="#" style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 16px; {ROW}; color: %%INK%%; {A}">{soft_icon("clipboard", "%%RED_SOFT%%", "%%RED%%")}<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 15px; font-weight: 600">Finish your profile</span>{thin_bar(66, "%%RED%%", 3)}<span style="font-size: 12px; color: %%MUTED%%">4 of 6 steps · coaches see this when you connect</span></span></a>''')
    return screen("Today no coach", body + tabbar("Today", search_acc()), t, mode)


COACHES = [
    ("MK", "Martin Král", "Trainer", "Prague · online", "Strength, fat loss", True),
    ("TD", "Tomáš Dvořák", "Trainer", "Brno", "Powerlifting, beginners", True),
    ("PV", "Petra Vlková", "Trainer", "Online only", "Postpartum, mobility", False),
    ("LH", "Lukáš Hora", "Trainer", "Prague", "Running, conditioning", True),
]


def coach_search(mode, t):
    cards = ""
    for ini, name, role, where, spec, open_ in COACHES:
        st = f'<span style="{ROW}; gap: 5px; font-size: 12px; color: {"%%NUTRI_TEXT%%" if open_ else "%%MUTED%%"}"><span style="width: 6px; height: 6px; border-radius: 3px; background: {"%%NUTRI%%" if open_ else "%%MUTED%%"}"></span>{"Taking clients" if open_ else "Waitlist"}</span>'
        cards += f'''<a href="#" style="{ROW}; align-items: flex-start; padding: 14px 0; border-top: 1px solid %%HAIR%%; color: %%INK%%; {A}">{avatar(ini, 48)}
<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px"><span style="{ROW}; gap: 8px"><span style="font-size: 16px; font-weight: 600">{name}</span>{role_chip(role)}</span>
<span style="{ROW}; gap: 5px; font-size: 13px; color: %%MUTED%%">{ic("pin", 13, sw="1.7")}{where}</span><span style="font-size: 13px; color: %%INK2%%">{spec}</span>{st}</span>
<span style="display: flex; color: %%MUTED%%; padding-top: 14px">{ic("chevron", 15)}</span></a>'''
    body = body_top(f'''<div style="padding: 0 20px"><h1 style="{H1}">Find a coach</h1></div>
<div style="padding: 0 16px">{seg(["All", "Trainers", "Nutritionists"], "Trainers")}</div>
<div style="padding: 0 16px; display: flex; gap: 8px; overflow: hidden">{chip("Online", True)}{chip("Near me")}{chip("Strength")}{chip("Fat loss")}{chip("Beginners")}</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 0 16px"><div style="padding: 12px 0 2px; font-size: 12px; color: %%MUTED%%">24 trainers</div>{cards}</div>''', top=84, gap=14)
    return screen("Coach search", body + top_bar(gbtn("back", "Back"), "", gbtn("filter", "More filters")) + fade() + search_fab(), t, mode)


def coach_profile_body():
    return f'''<div style="position: absolute; top: 0; left: 0; right: 0; height: 250px; background: linear-gradient(160deg, #3A3A3E, #1B1B1D); display: flex; align-items: flex-end; padding: 0 20px 18px; box-sizing: border-box; color: #F6F4F0; font-size: 12px; letter-spacing: 0.08em">[COACH PHOTO]</div>
<div style="position: absolute; top: 226px; left: 0; right: 0; bottom: 0; border-radius: 24px 24px 0 0; background: %%BG%%; padding: 22px 20px 0; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-direction: column; gap: 6px"><span style="{ROW}; gap: 8px"><h1 style="{H1}; font-size: 28px">Martin Král</h1>{role_chip("Trainer")}</span><span style="{ROW}; gap: 5px; font-size: 13px; color: %%MUTED%%">{ic("pin", 13, sw="1.7")}Prague · also online<span style="margin-left: 8px; {ROW}; gap: 5px; color: %%NUTRI_TEXT%%"><span style="width: 6px; height: 6px; border-radius: 3px; background: %%NUTRI%%"></span>Taking clients</span></span></div>
<p style="margin: 0; font-size: 15px; line-height: 1.55; color: %%INK2%%">[Coach's own bio — written by the coach in their profile. Two or three sentences about how they work.]</p>
<div style="display: flex; flex-wrap: wrap; gap: 6px">{chip("Strength")}{chip("Fat loss")}{chip("Beginners")}</div>
{group("WORKING WITH MARTIN", list_row("Personal training plan", icon="dumbbell", soft="%%TRAIN_SOFT%%", ink="%%TRAIN_TEXT%%", chevron=False, first=True) + list_row("Weekly check-ins", icon="clipboard", soft="%%RED_SOFT%%", ink="%%RED%%", chevron=False) + list_row("Chat with your coach", icon="chat", chevron=False))}
</div>'''


def coach_profile(mode, t):
    glass_dark = "background: rgba(20,20,20,0.35); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.25)"
    tb = top_bar(gbtn("back", "Back", style=glass_dark, color="#F6F4F0"), "", gbtn("share", "Share", style=glass_dark, color="#F6F4F0"))
    return screen("Coach profile", coach_profile_body() + fade() + tb + cta("Send request"), t, mode)


def request_sheet(mode, t):
    sheet = f'''<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4)"></div>
<div role="dialog" aria-label="Send request" style="position: absolute; left: 8px; right: 8px; bottom: 8px; border-radius: 34px; {GL}; background: %%CARD%%; padding: 10px 20px 22px; display: flex; flex-direction: column; gap: 14px">
<span style="align-self: center; width: 36px; height: 5px; border-radius: 3px; background: %%HAIR%%"></span>
<div style="{ROW}">{avatar("MK", 40)}<div style="display: flex; flex-direction: column; gap: 2px"><span style="{DISP}; font-size: 20px; font-weight: 600">Request Martin</span><span style="font-size: 13px; color: %%MUTED%%">He replies within a few days</span></div></div>
<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: %%MUTED%%">Message (optional)<span style="min-height: 76px; padding: 12px 14px; box-sizing: border-box; border-radius: 14px; background: %%INPUT_BG%%; border: 1px solid %%HAIR%%; font-size: 15px; line-height: 1.4; color: %%INK%%">Hi Martin, I'd like to get stronger and lose a few kilos.</span></label>
<div style="border-radius: 18px; background: %%SEG%%; padding: 4px 14px">
<div style="{ROW}; padding: 10px 0"><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 500">Share my onboarding answers</span><span style="font-size: 12px; color: %%MUTED%%">Goal, height, weight, activity</span></span>{toggle(True, label="Share onboarding answers")}</div>
<div style="{ROW}; padding: 10px 0; border-top: 1px solid %%HAIR%%"><span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 500">Share my history</span><span style="font-size: 12px; line-height: 1.4; color: %%MUTED%%">Past plans, measurements and photos from before Martin. Change it any time in Settings.</span></span>{toggle(False, label="Share my history")}</div>
</div>
<button style="{BTN}; background: %%INK%%; color: %%BG%%">Send request</button>
</div>'''
    return screen("Request sheet", coach_profile_body() + sheet, t, mode)


# ================================================================ TRAINING
def week_strip(days, color, on_color):
    out = ""
    for dn, num, state in days:
        if state == "done":
            mark = f'<span style="width: 30px; height: 30px; border-radius: 15px; background: {color}; color: {on_color}; display: flex; align-items: center; justify-content: center">{ic("check", 14, sw="2.4")}</span>'
        elif state == "today":
            mark = f'<span style="width: 27px; height: 27px; border-radius: 15px; border: 1.5px solid {color}; color: %%INK%%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600">{num}</span>'
        elif state == "planned":
            mark = f'<span style="width: 28px; height: 28px; border-radius: 15px; border: 1px dashed %%MUTED%%; color: %%INK2%%; display: flex; align-items: center; justify-content: center; font-size: 13px">{num}</span>'
        else:
            mark = f'<span style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 13px; color: %%MUTED%%">{num}</span>'
        out += f'<span style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 4px"><span style="font-size: 11px; color: %%MUTED%%">{dn}</span>{mark}</span>'
    return f'<div style="display: flex">{out}</div>'


def training_week(mode, t):
    days = [("M", "28", "done"), ("T", "29", "rest"), ("W", "30", "done"), ("T", "1", "today"), ("F", "2", "rest"), ("S", "3", "planned"), ("S", "4", "rest")]

    def sess(day, name, meta, state):
        if state == "done":
            r = f'<span style="width: 24px; height: 24px; border-radius: 12px; background: %%TRAIN%%; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 13, sw="2.4")}</span>'
        elif state == "today":
            r = f'<span style="height: 32px; padding: 0 14px; border-radius: 16px; background: %%TRAIN%%; color: %%ON%%; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 5px">{ic("play", 11, sw="2.2")}Start</span>'
        else:
            r = f'<span style="display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span>'
        return f'<a href="#" style="{ROW}; padding: 13px 0; border-top: 1px solid %%HAIR%%; color: %%INK%%; {A}"><span style="width: 34px; font-size: 12px; color: %%MUTED%%">{day}</span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: {600 if state == "today" else 500}">{name}</span><span style="font-size: 12px; color: %%MUTED%%">{meta}</span></span><span style="margin-left: auto">{r}</span></a>'
    body = body_top(f'''{head("Training", gbtn("calendar", "Full plan") + gbtn("dumbbell", "Workouts"), "Strength block 2 · Martin")}
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px">
<div style="{ROW}"><span style="font-size: 15px; font-weight: 600">Week 6 of 12</span><span style="margin-left: auto; font-size: 13px; color: %%TRAIN_TEXT%%; font-weight: 600">2 of 3 done</span></div>
{week_strip(days, "%%TRAIN%%", "%%ON%%")}
{thin_bar(50, "%%TRAIN%%", 3)}<span style="font-size: 12px; color: %%MUTED%%; margin-top: -8px">Plan progress · ends 13 Dec</span>
</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 4px 18px 2px">
<div style="padding: 10px 0; {DISP}; font-size: 17px; font-weight: 600">This week</div>
{sess("Mon", "Upper body A", "5 exercises · 50 min", "done")}{sess("Wed", "Lower body A", "6 exercises · 55 min", "done")}{sess("Today", "Lower body B", "6 exercises · 55 min", "today")}{sess("Sat", "Upper body B", "5 exercises · 50 min", "planned")}
</div>
{group("", list_row("Workout history", "23 sessions", icon="clock", first=True) + list_row("Exercise library", icon="book"))}''')
    return screen("Training week", body + tabbar("Training", search_acc()), t, mode)


def empty_section(mode, t, section):
    tr = section == "Training"
    soft, ink, color = ("%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", "%%TRAIN%%") if tr else ("%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%", "%%NUTRI%%")
    role, icon = ("trainer", "dumbbell") if tr else ("nutritionist", "leaf")
    blurb = "A trainer builds your sessions, adjusts them every week and checks your form." if tr else "A nutritionist plans your meals, macros and shopping list around your day."
    pending = ("Tomáš Dvořák", "TD") if tr else ("Jana Kučerová", "JK")
    body = body_top(f'''{head(section, "", "No " + role + " yet")}
<div style="margin: 8px 16px 0; border-radius: 26px; {CARD}; padding: 30px 22px 22px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px">
{soft_icon(icon, soft, ink, 64)}
<span style="{DISP}; font-size: 22px; font-weight: 600; padding-top: 6px">Add a {role}</span>
<span style="font-size: 14px; line-height: 1.5; color: %%MUTED%%; max-width: 270px">{blurb}</span>
<a href="#" style="margin-top: 10px; {BTN}; height: 46px; padding: 0 22px; background: {color}; color: %%ON%%; {A}">{ic("search", 16, sw="2")}Find a {role}</a>
</div>
<div style="padding: 6px 20px 0">{eyebrow("PENDING REQUEST")}</div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 16px; {ROW}">{avatar(pending[1], 40)}<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">{pending[0]}</span><span style="font-size: 12px; color: %%MUTED%%">Sent 2 days ago · waiting for reply</span></span><button style="margin-left: auto; height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid %%HAIR%%; background: transparent; color: %%INK2%%; font: 500 13px \'DM Sans\', sans-serif">Cancel</button></div>
<div style="margin: 0 16px; {ROW}; gap: 10px; padding: 4px 4px; font-size: 13px; color: %%MUTED%%">{ic("info", 15, sw="1.7")}You can have one trainer and one nutritionist at a time.</div>''')
    return screen(f"{section} empty", body + tabbar(section, search_acc()), t, mode)


def session_detail(mode, t):
    ex = [("Back squat", "4 × 6 · 80 kg"), ("Romanian deadlift", "3 × 8–10 · 62.5 kg"), ("Bulgarian split squat", "3 × 10 each"), ("Lying leg curl", "3 × 12"), ("Standing calf raise", "4 × 15"), ("Plank", "3 × 45 s")]
    rows = "".join(f'<a href="#" style="{ROW}; padding: 10px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}; color: %%INK%%; {A}"><span style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; background: %%TRAIN_SOFT%%; color: %%TRAIN_TEXT%%; display: flex; align-items: center; justify-content: center">{ic("play", 14, sw="2")}</span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 500">{i + 1}. {n}</span><span style="font-size: 12px; color: %%MUTED%%">{s}</span></span><span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span></a>' for i, (n, s) in enumerate(ex))
    body = body_top(f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 6px">{eyebrow("TODAY · WEEK 6", "%%TRAIN_TEXT%%", "dumbbell")}<h1 style="{H1}">Lower body B</h1><span style="font-size: 14px; color: %%MUTED%%">6 exercises · about 55 min</span></div>
<div style="margin: 0 16px; border-radius: 20px; background: %%TRAIN_SOFT%%; padding: 14px 16px; display: flex; gap: 12px">{avatar("MK", 32)}<span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 12px; font-weight: 600; color: %%TRAIN_TEXT%%">Note from Martin</span><span style="font-size: 14px; line-height: 1.45; color: %%INK%%">Keep RDL at 62.5 kg and aim for 9 reps on the last set.</span></span></div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 6px 16px">{rows}</div>''', top=88, gap=14)
    return screen("Session detail", body + top_bar(gbtn("back", "Back"), "", gbtn("swap", "Move to another day")) + fade() + cta("Start workout", "play", "%%TRAIN%%", "%%ON%%", "0 8px 22px rgba(242,140,56,0.3)"), t, mode)


# ================================================================ NUTRITION
def meal_detail(mode, t):
    ingr = [("Chicken breast", "150 g"), ("Jasmine rice, cooked", "180 g"), ("Broccoli", "120 g"), ("Olive oil", "1 tbsp"), ("Soy sauce", "1 tsp")]
    rows = "".join(f'<a href="#" aria-label="Open {n}" style="{ROW}; padding: 11px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}; color: %%INK%%; {A}"><span style="font-size: 15px">{n}</span><span style="margin-left: auto; font-size: 14px; color: %%MUTED%%">{q}</span><span style="display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span></a>' for i, (n, q) in enumerate(ingr))
    mac = lambda l, v, c: f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; align-items: center"><span style="font-size: 17px; font-weight: 600">{v}</span><span style="{ROW}; gap: 4px; font-size: 12px; color: %%MUTED%%"><span style="width: 6px; height: 6px; border-radius: 3px; background: {c}"></span>{l}</span></span>'
    glass_dark = "background: rgba(20,20,20,0.3); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.25)"
    body = f'''<div style="position: absolute; top: 0; left: 0; right: 0; height: 270px; background: linear-gradient(150deg, #C9D9A8, #8CA86A); display: flex; align-items: flex-end; padding: 0 20px 36px; box-sizing: border-box; color: #1B1B1D; font-size: 12px; letter-spacing: 0.08em">[MEAL PHOTO]</div>
<div style="position: absolute; top: 246px; left: 0; right: 0; bottom: 0; border-radius: 24px 24px 0 0; background: %%BG%%; padding: 22px 16px 0; display: flex; flex-direction: column; gap: 14px">
<div style="padding: 0 4px; display: flex; flex-direction: column; gap: 4px">{eyebrow("LUNCH · 12:30", "%%NUTRI_TEXT%%", "leaf")}<h1 style="{H1}; font-size: 28px">Chicken rice bowl</h1></div>
<div style="border-radius: 20px; {CARD}; padding: 14px 6px; display: flex">{mac("kcal", "640", "%%INK%%")}{mac("Protein", "48 g", "%%PROT%%")}{mac("Carbs", "72 g", "%%CARB%%")}{mac("Fat", "16 g", "%%FAT%%")}{mac("Fiber", "6 g", "%%FIB%%")}</div>
<div style="border-radius: 20px; {CARD}; padding: 6px 16px"><div style="{ROW}; padding: 8px 0"><span style="{DISP}; font-size: 17px; font-weight: 600">Ingredients</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">1 serving</span></div>{rows}</div>
{group("", list_row("How to make it", "4 steps", icon="book", first=True))}
</div>'''
    tb = top_bar(gbtn("back", "Back", style=glass_dark, color="#1B1B1D"), "", gbtn("swap", "Swap meal", style=glass_dark, color="#1B1B1D"))
    btns = f'''<div style="position: absolute; left: 20px; right: 20px; bottom: 34px; display: flex; gap: 10px">
<button style="{BTN}; padding: 0 18px; {GL}; color: %%INK%%; font-weight: 500; font-size: 15px">Ate something else</button>
<button style="{BTN}; flex-grow: 1; background: %%NUTRI%%; color: %%ON%%; box-shadow: 0 8px 22px rgba(140,193,82,0.3)">{ic("check", 16, sw="2.2")}Log meal</button></div>'''
    return screen("Meal detail", body + tb + fade() + btns, t, mode)


def shopping_list(mode, t):
    groups = [("MEAT & FISH", [("Chicken breast", "900 g", True), ("Salmon fillet", "2 × 150 g", False)]),
              ("VEGETABLES", [("Broccoli", "600 g", True), ("Baby spinach", "200 g", False), ("Sweet potatoes", "1 kg", False)]),
              ("DAIRY", [("Greek yogurt 0 %", "4 × 150 g", False), ("Eggs", "10", True)]),
              ("GRAINS", [("Jasmine rice", "500 g", False), ("Rolled oats", "400 g", False)])]
    out = ""
    for g, items in groups:
        rows = ""
        for i, (n, q, done) in enumerate(items):
            box = (f'<span style="width: 22px; height: 22px; flex-shrink: 0; border-radius: 11px; background: %%NUTRI%%; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 12, sw="2.6")}</span>'
                   if done else '<span style="width: 20px; height: 20px; flex-shrink: 0; border-radius: 11px; border: 1.5px solid %%HAIR%%"></span>')
            st = "color: %%MUTED%%; text-decoration: line-through" if done else "color: %%INK%%"
            rows += f'<div role="checkbox" aria-checked="{"true" if done else "false"}" style="{ROW}; padding: 11px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}">{box}<span style="font-size: 15px; {st}">{n}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{q}</span></div>'
        out += group(g, rows)
    body = body_top(f'''{head("Shopping list", gbtn("share", "Share list"), "Week of 28 Sep · 3 of 9 bought")}
<div style="padding: 0 16px">{seg(["This week", "Next week"], "This week")}</div>
<div style="padding: 0 16px; display: flex; flex-direction: column; gap: 14px">{out}</div>''', top=88)
    return screen("Shopping list", body + top_bar(gbtn("back", "Back")), t, mode)


# ================================================================ MESSAGES
def messages_list(mode, t):
    conv = [("MK", "Martin Král", "Trainer", "New week is up — Thursday is Lower body A…", "10:42", True),
            ("JK", "Jana Kučerová", "Nutritionist", "Try swapping the rice for potatoes on Friday", "Yesterday", False)]
    rows = ""
    for i, (ini, n, r, m, w, unread) in enumerate(conv):
        dot = '<span style="width: 9px; height: 9px; border-radius: 5px; background: %%RED%%"></span>' if unread else ""
        rows += f'<a href="#" style="{ROW}; padding: 14px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}; color: %%INK%%; {A}">{avatar(ini, 48)}<span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="{ROW}; gap: 8px"><span style="font-size: 16px; font-weight: {700 if unread else 600}">{n}</span>{role_chip(r)}<span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">{w}</span></span><span style="{ROW}; gap: 8px"><span style="font-size: 14px; color: {"%%INK2%%" if unread else "%%MUTED%%"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{m}</span><span style="margin-left: auto">{dot}</span></span></span></a>'
    body = body_top(f'''{head("Messages", gbtn("compose", "New message"), "Your coaches")}
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px">{rows}</div>
<div style="padding: 6px 20px 0">{eyebrow("PAST COACHES")}</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px"><a href="#" style="{ROW}; padding: 14px 0; color: %%INK%%; {A}">{avatar("PV", 48, "%%SEG%%", "%%MUTED%%")}<span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 500; color: %%INK2%%">Petra Vlková</span><span style="font-size: 13px; color: %%MUTED%%">Read only · ended June 2026</span></span><span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span></a></div>''')
    return screen("Messages list", body + tabbar("Messages", search_acc()), t, mode)


# ================================================================ PROFILE & PROGRESS
def sparkline(w=120, h=34, color="%%NUTRI%%"):
    pts = [76.1, 75.8, 75.9, 75.2, 74.8, 74.9, 74.1, 73.7, 73.9, 73.2, 72.9, 72.6, 72.4]
    lo, hi = min(pts), max(pts)
    p = " ".join(f"{i * w / (len(pts) - 1):.1f},{(hi - v) / (hi - lo) * (h - 6) + 3:.1f}" for i, v in enumerate(pts))
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-hidden="true"><polyline points="{p}" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>'


def profile(mode, t):
    coach = lambda ini, n, r, first: f'<a href="#" style="{ROW}; padding: 12px 0; {"" if first else "border-top: 1px solid %%HAIR%%;"} color: %%INK%%; {A}">{avatar(ini, 36)}<span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 500">{n}</span>{role_chip(r)}</span><span style="margin-left: auto; display: flex; color: %%MUTED%%">{ic("chevron", 15)}</span></a>'
    stat = lambda v, l: f'<span style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 2px"><span style="{DISP}; font-size: 20px; font-weight: 600">{v}</span><span style="font-size: 12px; color: %%MUTED%%">{l}</span></span>'
    body = body_top(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0 20px">{avatar("ES", 76)}<h1 style="{H1}; font-size: 26px">Eva Svobodová</h1><span style="font-size: 13px; color: %%MUTED%%">Lose fat · since March 2026</span></div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 6px; display: flex">{stat("3", "Plans")}{stat("71", "Workouts")}{stat("−3.7 kg", "Since start")}</div>
{f'<div style="padding: 0 16px">{group("MY COACHES", coach("MK", "Martin Král", "Trainer", True) + coach("JK", "Jana Kučerová", "Nutritionist", False))}</div>'}
<div style="padding: 0 16px">{group("PROGRESS", list_row("My journey", icon="route", soft="%%RED_SOFT%%", ink="%%RED%%", first=True, right=sparkline(70, 22)) + list_row("Body measurements", "72.4 kg", icon="ruler", soft="%%NUTRI_SOFT%%", ink="%%NUTRI_TEXT%%") + list_row("Progress photos", "14", icon="photo", soft="%%TRAIN_SOFT%%", ink="%%TRAIN_TEXT%%") + list_row("Check-in history", "26", icon="clipboard"))}</div>
<div style="padding: 0 16px">{group("", list_row("Settings", icon="gear", first=True))}</div>''', top=84, gap=14)
    return screen("Profile", body + top_bar(gbtn("back", "Back"), "", gbtn("compose", "Edit profile")), t, mode)


def journey_chart(w=322, h=170):
    # months Mar..Oct across the width; weight 77 → 72
    months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]
    mx = lambda m: m / 7 * w
    top, bot = 12, h - 26
    wy = lambda v: top + (77 - v) / 5 * (bot - top)
    bands = [(0.1, 3.3, "%%TRAIN%%", 0, "Strength 1"), (4.0, 7.0, "%%TRAIN%%", 0, "Strength 2"), (5.0, 7.0, "%%NUTRI%%", 1, "Cut 2")]
    svg = ""
    for a, b, c, lane, lbl in bands:
        y = bot + 6 + lane * 9
        svg += f'<rect x="{mx(a):.1f}" y="{top}" width="{mx(b) - mx(a):.1f}" height="{bot - top}" fill="{c}" opacity="0.08"></rect><rect x="{mx(a):.1f}" y="{y}" width="{mx(b) - mx(a):.1f}" height="5" rx="2.5" fill="{c}"></rect>'
    pts = [(0.1, 76.1), (0.8, 75.6), (1.6, 75.0), (2.4, 74.3), (3.2, 73.6), (3.6, 73.9), (4.0, 74.0), (4.6, 73.6), (5.2, 73.2), (5.8, 72.9), (6.4, 72.6), (7.0, 72.4)]
    poly = " ".join(f"{mx(m):.1f},{wy(v):.1f}" for m, v in pts)
    svg += f'<polyline points="{poly}" fill="none" stroke="%%INK%%" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>'
    for m in (0.1, 3.2, 4.0, 7.0):
        v = dict(pts)[m]
        svg += f'<circle cx="{mx(m):.1f}" cy="{wy(v):.1f}" r="4.5" fill="%%CARD%%" stroke="%%RED%%" stroke-width="2"></circle>'
    labels = "".join(f'<span>{m}</span>' for m in months)
    return f'''<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-label="Weight over time with plan periods" role="img">{svg}</svg>
<div style="display: flex; justify-content: space-between; font-size: 11px; color: %%MUTED%%; margin-top: -10px">{labels}</div>'''


def plan_card(title, coach, dates, status, color, soft, ink, extra, pct=None):
    p = f'<div style="padding-top: 4px">{thin_bar(pct, color, 3)}</div>' if pct is not None else ""
    return f'''<a href="#" style="display: flex; flex-direction: column; gap: 6px; padding: 14px 0; border-top: 1px solid %%HAIR%%; color: %%INK%%; {A}">
<span style="{ROW}; gap: 10px"><span style="width: 4px; height: 34px; border-radius: 2px; background: {color}"></span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">{title}</span><span style="font-size: 12px; color: %%MUTED%%">{coach} · {dates}</span></span><span style="margin-left: auto; padding: 3px 8px; border-radius: 999px; background: {soft}; color: {ink}; font-size: 11px; font-weight: 600">{status}</span></span>
<span style="padding-left: 14px; font-size: 13px; color: %%INK2%%">{extra}</span>{p}</a>'''


def my_journey(mode, t):
    plans = (plan_card("Strength block 2", "Martin", "Jul – now", "Active", "%%TRAIN%%", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", "Week 6 of 12 · 17 of 18 sessions", 50)
             + plan_card("Cut — phase 2", "Jana", "Aug – now", "Active", "%%NUTRI%%", "%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%", "Week 8 of 10 · 89 % of meals logged", 80)
             + plan_card("Strength block 1", "Martin", "Mar – Jun", "Completed", "%%TRAIN%%", "%%SEG%%", "%%MUTED%%", "48 of 52 sessions · −2.5 kg"))
    body = body_top(f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; color: %%MUTED%%">March – October 2026</span><h1 style="{H1}">My journey</h1></div>
<div style="padding: 0 16px">{seg(["Weight", "Waist", "Photos"], "Weight")}</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 16px; display: flex; flex-direction: column; gap: 12px">
<div style="{ROW}; align-items: baseline"><span style="{DISP}; font-size: 26px; font-weight: 600">−3.7 kg</span><span style="font-size: 13px; color: %%MUTED%%">76.1 → 72.4 kg</span></div>
{journey_chart()}
<div style="display: flex; gap: 14px; font-size: 12px; color: %%MUTED%%"><span style="{ROW}; gap: 5px"><span style="width: 10px; height: 4px; border-radius: 2px; background: %%TRAIN%%"></span>Training plan</span><span style="{ROW}; gap: 5px"><span style="width: 10px; height: 4px; border-radius: 2px; background: %%NUTRI%%"></span>Nutrition plan</span><span style="{ROW}; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 4px; border: 2px solid %%RED%%; box-sizing: border-box"></span>Photos</span></div>
</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 4px 16px 2px"><div style="padding: 10px 0; {DISP}; font-size: 17px; font-weight: 600">Plans</div>{plans}</div>''', top=84, gap=14)
    return screen("My journey", body + top_bar(gbtn("back", "Back"), "", gbtn("share", "Export")), t, mode)


def plan_summary(mode, t):
    stat = lambda l, v, s: f'<div style="border-radius: 18px; {CARD}; padding: 14px; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 12px; color: %%MUTED%%">{l}</span><span style="{DISP}; font-size: 22px; font-weight: 600">{v}</span><span style="font-size: 12px; color: %%MUTED%%">{s}</span></div>'
    ph = lambda lbl, d, g: f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px"><div style="height: 150px; border-radius: 16px; background: {g}"></div><span style="font-size: 13px; font-weight: 600">{lbl}</span><span style="font-size: 12px; color: %%MUTED%%; margin-top: -4px">{d}</span></div>'
    body = body_top(f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 6px">{eyebrow("COMPLETED PLAN", "%%TRAIN_TEXT%%", "dumbbell")}<h1 style="{H1}">Strength block 1</h1><span style="{ROW}; gap: 8px; font-size: 13px; color: %%MUTED%%">{avatar("MK", 22)}Martin Král · 4 Mar – 9 Jun 2026 · 14 weeks</span></div>
<div style="padding: 0 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{stat("Sessions", "48 / 52", "92 % completed")}{stat("Weight", "−2.5 kg", "76.1 → 73.6 kg")}{stat("Check-ins", "13 / 14", "Avg energy 3.8")}{stat("Waist", "−4 cm", "84 → 80 cm")}</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px"><div style="{ROW}"><span style="{DISP}; font-size: 17px; font-weight: 600">Before and after</span><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Front</span></div>
<div style="display: flex; gap: 10px">{ph("Start", "4 Mar", "linear-gradient(160deg, #D9B9A0, #B98E73)")}{ph("End", "9 Jun", "linear-gradient(160deg, #D4B094, #A9805F)")}</div></div>
{f'<div style="padding: 0 16px">{group("", list_row("All sessions in this plan", "48", icon="list", first=True))}</div>'}''', top=84, gap=14)
    return screen("Plan summary", body + top_bar(gbtn("back", "Back")), t, mode)


def measurements(mode, t):
    m = [("Weight", "72.4 kg", "−0.6 this week", "%%NUTRI_TEXT%%"), ("Waist", "79 cm", "−1 this month", "%%NUTRI_TEXT%%"), ("Hips", "97 cm", "no change", "%%MUTED%%"),
         ("Chest", "90 cm", "−1 this month", "%%NUTRI_TEXT%%"), ("Thigh", "56 cm", "−0.5 this month", "%%NUTRI_TEXT%%"), ("Body fat", "26 %", "estimate", "%%MUTED%%")]
    rows = "".join(f'<a href="#" style="{ROW}; padding: 12px 0; border-top: {"none" if i == 0 else "1px solid %%HAIR%%"}; color: %%INK%%; {A}"><span style="display: flex; flex-direction: column; gap: 2px; width: 120px"><span style="font-size: 15px">{n}</span><span style="font-size: 12px; color: {c}">{d}</span></span>{sparkline(90, 26, "%%INK2%%")}<span style="margin-left: auto; font-size: 16px; font-weight: 600">{v}</span></a>' for i, (n, v, d, c) in enumerate(m))
    body = body_top(f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; color: %%MUTED%%">Last updated this morning</span><h1 style="{H1}">Body measurements</h1></div>
<div style="padding: 0 16px">{seg(["1 month", "Plan", "All time"], "Plan")}</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 2px 16px">{rows}</div>
<div style="margin: 0 16px; {ROW}; gap: 10px; padding: 0 4px; font-size: 13px; color: %%MUTED%%">{ic("info", 15, sw="1.7")}Shared with Martin and Jana.</div>''', top=84, gap=14)
    return screen("Measurements", body + top_bar(gbtn("back", "Back")) + fade() + cta("Add measurement", "plus"), t, mode)


def photos(mode, t):
    tones = ["#D9B9A0", "#D4B094", "#CBA88C", "#C9A285", "#C49C80", "#BE967A"]
    tile = lambda i: f'<div style="aspect-ratio: 3 / 4; border-radius: 12px; background: linear-gradient(160deg, {tones[i % 6]}, #A9805F)"></div>'
    sec = lambda title, color, sub, n, off: f'<div style="display: flex; flex-direction: column; gap: 8px"><span style="{ROW}; gap: 8px; padding: 0 4px"><span style="width: 4px; height: 16px; border-radius: 2px; background: {color}"></span><span style="font-size: 14px; font-weight: 600">{title}</span><span style="font-size: 12px; color: %%MUTED%%">{sub}</span></span><div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px">{"".join(tile(i + off) for i in range(n))}</div></div>'
    body = body_top(f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 13px; color: %%MUTED%%">14 photos · grouped by plan</span><h1 style="{H1}">Progress photos</h1></div>
<div style="padding: 0 16px">{seg(["Front", "Side", "Back"], "Front")}</div>
<div style="padding: 0 16px; display: flex; flex-direction: column; gap: 16px">{sec("Strength block 2", "%%TRAIN%%", "Jul – now", 3, 0)}{sec("Between plans", "%%MUTED%%", "Jun – Jul", 1, 3)}{sec("Strength block 1", "%%TRAIN%%", "Mar – Jun", 3, 4)}</div>''', top=84, gap=14)
    return screen("Progress photos", body + top_bar(gbtn("back", "Back"), "", gbtn("compose", "Compare")) + fade() + cta("Take photo", "camera"), t, mode)


def settings(mode, t):
    tg = lambda on: toggle(on)
    body = body_top(f'''<div style="padding: 0 20px"><h1 style="{H1}">Settings</h1></div>
<div style="padding: 0 16px; display: flex; flex-direction: column; gap: 16px">
{group("ACCOUNT", list_row("Email", "eva.svobodova@email.cz", first=True) + list_row("Password"))}
{group("PREFERENCES", list_row("Language", "Čeština", first=True) + list_row("Units", "Metric") + list_row("Appearance", "Automatic"))}
{group("NOTIFICATIONS", list_row("Workout reminders", chevron=False, first=True, right=tg(True)) + list_row("Meal reminders", chevron=False, right=tg(True)) + list_row("Messages", chevron=False, right=tg(True)))}
{group("PRIVACY", list_row("History shared with coaches", "Martin", first=True) + list_row("Download my data"))}
{group("", list_row("Log out", chevron=False, first=True, color="%%RED%%") + list_row("Delete account", chevron=False, color="%%RED%%"))}
</div>''', top=84, gap=14)
    return screen("Settings", body + top_bar(gbtn("back", "Back")), t, mode)


NEW = {
    "TodayNoCoach": today_no_coach, "CoachSearch": coach_search, "CoachProfile": coach_profile, "RequestSheet": request_sheet,
    "TrainingWeek": training_week, "TrainingEmpty": lambda m, t: empty_section(m, t, "Training"), "SessionDetail": session_detail,
    "NutritionEmpty": lambda m, t: empty_section(m, t, "Nutrition"), "MealDetail": meal_detail, "ShoppingList": shopping_list,
    "MessagesList": messages_list, "Profile": profile, "MyJourney": my_journey, "PlanSummary": plan_summary,
    "Measurements": measurements, "Photos": photos, "Settings": settings,
}
for mode, t in MODES.items():
    for label_, fn in NEW.items():
        with open(os.path.join(HERE, "project", f"Glass{label_}{mode}.dc.html"), "w") as f:
            f.write(fn(mode, t))

ROWS = [
    ("Start — sign in, onboarding, finding a coach", ["Login", "Register", "OnboardingGoal", "OnboardingBasics", "TodayNoCoach", "CoachSearch", "CoachProfile", "RequestSheet"]),
    ("Today & Training", ["Today", "TrainingWeek", "TrainingEmpty", "SessionDetail", "Workout"]),
    ("Nutrition", ["Nutrition", "NutritionEmpty", "MealDetail", "ShoppingList"]),
    ("Messages", ["MessagesList", "Chat"]),
    ("Profile & progress — measurements, photos and journey come after v1", ["Profile", "MyJourney", "PlanSummary", "Measurements", "Photos", "CheckIn", "Settings"]),
]
layout = {"boards": {}, "notes": {}}
for mode, pid in (("Light", "glass"), ("Dark", "glassdark")):
    for r, (title, names) in enumerate(ROWS):
        y = r * 1264
        for i, n in enumerate(names):
            layout["boards"][f"Glass{n}{mode}.dc.html"] = {"x": i * 470, "y": y, "w": 390, "h": 844, "title": n, "page": pid}
        layout["notes"][f"m{mode[0]}{r}"] = {"x": 0, "y": y - 300, "text": title, "kind": "title1", "maxW": len(names) * 470 - 80, "page": pid}
json.dump(layout, open(os.path.join(HERE, "layout6.json"), "w"), indent=1)
print(len(layout["boards"]), "boards")
