"""Notifications sheet for the client and coach zones, drawn over each zone's Today screen."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen14.py")).read().split("NEW14 = [")[0]
exec(_src)
PATHS.setdefault("bell", '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"></path><path d="M10 20.5a2 2 0 0 0 4 0"></path>')

KIND = {
    "train": ("dumbbell", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%"),
    "nutri": ("leaf", "%%NUTRI_SOFT%%", "%%NUTRI_TEXT%%"),
    "check": ("clipboard", "%%RED_SOFT%%", "%%RED%%"),
    "photo": ("camera", "%%RED_SOFT%%", "%%RED%%"),
    "people": ("users", "%%SEG%%", "%%INK2%%"),
}


def note_row(kind, title, text, when, unread=False, actions="", first=False):
    icon, soft, ink = KIND[kind]
    dot = '<span style="width: 8px; height: 8px; border-radius: 4px; background: %%RED%%; flex-shrink: 0; margin-top: 6px"></span>' if unread else '<span style="width: 8px; flex-shrink: 0"></span>'
    act = f'<div style="display: flex; gap: 6px; padding-top: 8px">{actions}</div>' if actions else ""
    return f'''<div style="display: flex; gap: 12px; padding: 12px 0; {"" if first else "border-top: 1px solid %%HAIR%%;"}">
{soft_icon(icon, soft, ink, 36)}
<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><div style="display: flex; gap: 8px"><span style="font-size: 14px; font-weight: {600 if unread else 500}">{title}</span><span style="margin-left: auto; font-size: 11px; color: %%MUTED%%; white-space: nowrap">{when}</span></div>
<span style="font-size: 13px; line-height: 1.4; color: %%INK2%%">{text}</span>{act}</div>{dot}</div>'''


def sheet(today_rows, earlier_rows, unread):
    return f'''<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.38)"></div>
<div role="dialog" aria-label="Notifications" style="position: absolute; left: 0; right: 0; top: 64px; bottom: 0; border-radius: 34px 34px 0 0; {GL}; background: %%BG%%; {FONT}; color: %%INK%%; padding: 10px 20px 0; display: flex; flex-direction: column; gap: 6px; overflow: hidden">
<span style="align-self: center; width: 36px; height: 5px; border-radius: 3px; background: %%HAIR%%"></span>
<div style="display: flex; align-items: center; padding: 8px 0 4px"><span style="{DISP}; font-size: 24px; font-weight: 600">Notifications</span><span style="margin-left: 8px">{count_badge(unread)}</span><a href="#" style="margin-left: auto; font-size: 13px; font-weight: 600; color: %%RED%%; {A}">Mark all read</a></div>
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: %%MUTED%%; padding-top: 6px">TODAY</span>
<div>{today_rows}</div>
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: %%MUTED%%; padding-top: 8px">EARLIER</span>
<div>{earlier_rows}</div>
<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 90px; background: linear-gradient(180deg, transparent, %%BG%% 70%)"></div>
</div>'''


def over(page_file, sheet_html, t, title):
    src = open(os.path.join(HERE, "project", page_file)).read()
    i = src.index("</x-dc>")
    return src[:i].rstrip() + "\n" + fill(sheet_html, t) + "\n" + src[i:].replace("", "", 0).replace("<title>", "<title>", 1) if False else (src[:i].rstrip() + "\n" + fill(sheet_html, t) + "\n" + src[i:]).replace("<title>Today glass", f"<title>{title}").replace("<title>Coach today", f"<title>{title}")


def client_notes(mode, t):
    today = (note_row("train", "New week published", "Martin published week 7 of Strength block 2.", "10:30", True, first=True)
             + note_row("nutri", "Meal plan updated", "Jana changed Friday's dinner to salmon and potatoes.", "09:12", True)
             + note_row("check", "Check-in reviewed", "Martin replied to your week 6 check-in.", "08:05"))
    earlier = (note_row("photo", "Photos requested", "Martin asked for front and side progress photos.", "Yesterday", True, small_btn("Take photos", True), first=True)
               + note_row("people", "Request accepted", "Jana Kučerová is now your nutritionist.", "Mon")
               + note_row("check", "Check-in due Sunday", "Your weekly check-in opens on Friday.", "Fri"))
    return over(f"GlassToday{mode}.dc.html", sheet(today, earlier, 3), t, "Client notifications")


def coach_notes(mode, t):
    today = (note_row("check", "New check-in", "Eva Svobodová sent week 6 · sleep flagged low.", "19:40", True, small_btn("Review", True), first=True)
             + note_row("people", "Join request", "Lucie Horáková wants training · Lose fat.", "09:12", True, small_btn("Decline") + small_btn("Accept", True))
             + note_row("people", "Invite accepted", "Ondřej Marek is now your client.", "08:30"))
    earlier = (note_row("check", "Check-in missing", "Petr Novotný hasn't sent week 4.", "Mon", True, small_btn("Remind"), first=True)
               + note_row("train", "Plan ending soon", "Kateřina Veselá's training plan ends in 6 days.", "Sun")
               + note_row("people", "Offer viewed", "Michal S. opened your coaching offer.", "Sat"))
    return over(f"CoachToday{mode}.dc.html", sheet(today, earlier, 4), t, "Coach notifications")


for mode, t in MODES.items():
    for name, fn in (("GlassNotifications", client_notes), ("CoachNotifications", coach_notes)):
        with open(os.path.join(HERE, "project", f"{name}{mode}.dc.html"), "w") as f:
            f.write(fn(mode, t))
print("ok")
