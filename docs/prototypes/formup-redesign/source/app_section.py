def phone_coach_clients():
    muted = "#9A958D" if DARK_ON else "#6B6863"
    row = lambda n, c, status, tone: (f'<div style="display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-top: 1px solid rgba(127,127,127,0.18)">'
                                      f'<span style="width: 32px; height: 32px; border-radius: 16px; background: {c}"></span>'
                                      f'<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 13px; font-weight: 600">{n}</span><span style="font-size: 11px; color: {tone}">{status}</span></span></div>')
    inner = (f'<div style="padding: 4px 6px; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: {muted}">Coach · 12 clients</span><span style="{DISP}; font-size: 20px; font-weight: 600">Clients</span></div>'
             + glass_card(f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: %%MARKER%%">NEEDS YOU · 2</span>'
                          + row("Petra N.", "#C9B29E", "Check-in waiting", "%%MARKER%%") + row("Tomáš K.", "#B7C4CF", "Missed 2 meals", "%%TRAIN%%"), "10px 12px")
             + glass_card(f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: {muted}">ON TRACK</span>'
                          + row("Eva M.", "#C6C9B0", "Workout done · 52 min", "%%NUTRI%%") + row("Lukáš P.", "#D7A68E", "All meals today", "%%NUTRI%%"), "10px 12px"))
    return phone_shell(inner)


def phone_coach_review():
    muted = "#9A958D" if DARK_ON else "#6B6863"
    pts = [(0, 40), (34, 34), (68, 30), (102, 26), (136, 20), (170, 14)]
    poly = " ".join(f"{x},{y}" for x, y in pts)
    graph = (f'<svg width="190" height="48" viewBox="0 0 190 48" aria-hidden="true"><polyline points="{poly}" fill="none" stroke="%%NUTRI%%" stroke-width="2.5" stroke-linejoin="round"></polyline>'
             + "".join(f'<circle cx="{x}" cy="{y}" r="2.6" fill="%%NUTRI%%"></circle>' for x, y in pts) + '</svg>')
    thumbs = "".join(f'<span style="flex-grow: 1; height: 54px; border-radius: 9px; background: {c}"></span>' for c in ("#D9C2AE", "#C9B29E", "#BFA48E"))
    inner = (f'<div style="padding: 4px 6px; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: {muted}">Petra N. · week 5</span><span style="{DISP}; font-size: 20px; font-weight: 600">Check-in</span></div>'
             + glass_card(f'<div style="display: flex; align-items: baseline; gap: 6px"><span style="{DISP}; font-size: 24px; font-weight: 600">68.4</span><span style="font-size: 12px; color: {muted}">kg</span><span style="margin-left: auto; font-size: 11px; font-weight: 700; color: %%NUTRI%%">−2.1 in 6 weeks</span></div>{graph}', "10px 12px")
             + glass_card(f'<div style="display: flex; gap: 6px">{thumbs}</div><span style="display: block; padding-top: 8px; font-size: 11px; color: {muted}">“Legs felt heavy on Friday.” · energy 4/5</span>', "10px 12px")
             + f'<div style="margin-top: auto; display: flex; gap: 8px"><span style="flex-grow: 1; height: 40px; border-radius: 20px; border: 1px solid rgba(127,127,127,0.3); padding: 0 14px; display: flex; align-items: center; font-size: 12px; color: {muted}">Reply to Petra…</span>'
             f'<span style="width: 40px; height: 40px; border-radius: 20px; background: %%MARKER%%; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{ic("arrowup", 16)}</span></div>')
    return phone_shell(inner, extra="; margin-top: 50px")


def phone_checkin_low():
    return phone_checkin().replace("margin-top: 80px", "margin-top: 50px")


def app_group(label, sub, phones, color):
    return (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 18px">'
            f'<div style="display: flex; flex-direction: column; align-items: center; gap: 4px"><span style="padding: 5px 12px; border-radius: 999px; background: {color}; color: #FFFFFF; font-size: 12px; font-weight: 700; letter-spacing: 0.06em">{label}</span>'
            f'<span style="font-size: 13px; color: %%MUTED%%">{sub}</span></div>'
            f'<div style="display: flex; gap: 26px; align-items: flex-start">{phones}</div></div>')


def client_app():
    head = (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center">'
            f'<span style="font-size: 12px; font-weight: 700; letter-spacing: 0.16em; color: %%MARKER%%">THE MOBILE APP</span>'
            f'<h2 style="margin: 0; {DISP}; font-size: 38px; font-weight: 600; letter-spacing: -0.015em">One app for your clients — and for you</h2>'
            f'<p style="margin: 0; max-width: 680px; font-size: 16px; line-height: 1.6; color: %%INK2%%">For your clients, the app is where everything happens: today’s meals and workouts, the chat with you and the Sunday check-in. '
            f'You get the same app with a coach view — see who needs you, review check-ins and reply from anywhere.</p>'
            f'<div style="display: flex; gap: 10px">{btn("App Store", "outline", "apple", 40)}{btn("Google Play", "outline", "play", 40)}</div></div>')
    clients = app_group("YOUR CLIENTS", "Their main tool, every day", phone_today_static() + phone_checkin_low(), "%%INK%%")
    coach = app_group("YOU", "Your clients in your pocket", phone_coach_clients() + phone_coach_review(), "%%MARKER%%")
    return (f'<section style="padding: 96px {PAD}px 90px; display: flex; flex-direction: column; align-items: center; gap: 48px">{head}'
            f'<div style="display: flex; gap: 56px; align-items: flex-start">{clients}<span style="width: 1px; align-self: stretch; background: %%LINE%%"></span>{coach}</div></section>')


