"""Training-format screens: mixed session, AMRAP, EMOM, Tabata, For Time, block result."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen6.py")).read().split("NEW = {")[0]
exec(_src)

BIG = f"{DISP}; font-weight: 300; letter-spacing: -0.03em; font-variant-numeric: tabular-nums"


def fmt_chip(text, on_color=False):
    st = "background: rgba(20,20,20,0.12); color: #141414" if on_color else "background: %%TRAIN_SOFT%%; color: %%TRAIN_TEXT%%"
    return f'<span style="{ROW}; gap: 5px; padding: 4px 9px; border-radius: 999px; {st}; font-size: 12px; font-weight: 600; white-space: nowrap">{ic("clock", 12, sw="2")}{text}</span>'


def live_top(label, step):
    return top_bar(gbtn("x", "End workout"), f'<span style="display: flex; flex-direction: column; align-items: center; gap: 1px"><span style="font-size: 13px; font-weight: 600">{label}</span><span style="font-size: 11px; color: %%MUTED%%">{step}</span></span>', gbtn("pause", "Pause"))


def ring(pct, size=250, stroke=10, color="%%TRAIN%%", inner=""):
    r = (size - stroke) / 2
    c = 2 * 3.14159 * r
    return f'''<div style="position: relative; width: {size}px; height: {size}px; align-self: center">
<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" aria-hidden="true"><circle cx="{size / 2}" cy="{size / 2}" r="{r}" fill="none" stroke="%%HAIR%%" stroke-width="{stroke}"></circle><circle cx="{size / 2}" cy="{size / 2}" r="{r}" fill="none" stroke="{color}" stroke-width="{stroke}" stroke-linecap="round" stroke-dasharray="{c * pct:.1f} {c:.1f}" transform="rotate(-90 {size / 2} {size / 2})"></circle></svg>
<div style="position: absolute; top: 0; left: 0; width: {size}px; height: {size}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px">{inner}</div></div>'''


def move_rows(items, first_border=False):
    return "".join(f'<div style="{ROW}; padding: 11px 0; border-top: {"1px solid %%HAIR%%" if i or first_border else "none"}"><span style="width: 34px; font-size: 15px; font-weight: 600; color: %%TRAIN_TEXT%%">{r}</span><span style="font-size: 15px">{n}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{w}</span></div>' for i, (r, n, w) in enumerate(items))


# ---------------------------------------------------------------- mixed session
def session_mixed(mode, t):
    def block(letter, name, chip_text, inner, note=None):
        n = f'<span style="font-size: 12px; color: %%MUTED%%; padding-top: 2px">{note}</span>' if note else ""
        return f'''<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 14px 16px 6px">
<div style="{ROW}; gap: 10px; padding-bottom: 6px"><span style="width: 26px; height: 26px; border-radius: 13px; background: %%SEG%%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">{letter}</span><span style="font-size: 16px; font-weight: 600">{name}</span><span style="margin-left: auto">{fmt_chip(chip_text)}</span></div>
{inner}{n}</div>'''
    strength = "".join(f'<div style="{ROW}; padding: 10px 0 10px 36px; border-top: 1px solid %%HAIR%%"><span style="font-size: 15px">{n}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{s}</span></div>' for n, s in [("Back squat", "4 × 6 · 80 kg"), ("Bench press", "4 × 8 · 45 kg")])
    amrap = "".join(f'<div style="{ROW}; padding: 10px 0 10px 36px; border-top: 1px solid %%HAIR%%"><span style="width: 30px; font-size: 15px; font-weight: 600; color: %%TRAIN_TEXT%%">{r}</span><span style="font-size: 15px">{n}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">{w}</span></div>' for r, n, w in [("10", "Kettlebell swings", "24 kg"), ("8", "Box jumps", "60 cm"), ("6", "Push-ups", "")])
    tabata = "".join(f'<div style="{ROW}; padding: 10px 0 10px 36px; border-top: 1px solid %%HAIR%%"><span style="font-size: 15px">{n}</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">rounds {r}</span></div>' for n, r in [("Air bike", "1 · 5"), ("Burpees", "2 · 6"), ("Mountain climbers", "3 · 7"), ("Jump squats", "4 · 8")])
    body = body_top(f'''<div style="padding: 0 20px; display: flex; flex-direction: column; gap: 6px">{eyebrow("SATURDAY · WEEK 6", "%%TRAIN_TEXT%%", "dumbbell")}<h1 style="{H1}">Full body C</h1><span style="font-size: 14px; color: %%MUTED%%">3 blocks · about 50 min</span></div>
{block("A", "Strength", "Sets &amp; reps", strength)}
{block("B", "Conditioning", "AMRAP · 12 min", amrap, "Score: rounds + reps")}
{block("C", "Finisher", "Tabata · 4 min", tabata)}''', top=88, gap=12)
    return screen("Session mixed", body + top_bar(gbtn("back", "Back"), "", gbtn("swap", "Move to another day")) + fade() + cta("Start workout", "play", "%%TRAIN%%", "%%ON%%", "0 8px 22px rgba(242,140,56,0.3)"), t, mode)


# ---------------------------------------------------------------- AMRAP
def amrap(mode, t):
    inner = f'<span style="{BIG}; font-size: 64px; line-height: 1">07:34</span><span style="font-size: 13px; color: %%MUTED%%">left of 12:00</span>'
    body = body_top(f'''{ring(0.37, 240, 9, inner=inner)}
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 14px 18px; {ROW}">
<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%">Rounds</span><span style="{DISP}; font-size: 38px; font-weight: 500; line-height: 1">5</span><span style="font-size: 12px; color: %%MUTED%%">last round 1:52</span></div>
<div style="margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 2px"><span style="font-size: 12px; color: %%MUTED%%">Pace</span><span style="font-size: 17px; font-weight: 600">≈ 7 rounds</span><span style="font-size: 12px; color: %%MUTED%%">at this speed</span></div>
</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 4px 18px">{move_rows([("10", "Kettlebell swings", "24 kg"), ("8", "Box jumps", "60 cm"), ("6", "Push-ups", "")])}</div>''', top=96, gap=14)
    btns = f'''<div style="position: absolute; left: 20px; right: 20px; bottom: 34px; display: flex; gap: 10px">
{round_btn("minus", "Remove a round", 60).replace("background: transparent", "background: %%CARD%%")}
<button style="{BTN}; flex-grow: 1; height: 60px; border-radius: 30px; background: %%TRAIN%%; color: %%ON%%; font-size: 17px; box-shadow: 0 8px 22px rgba(242,140,56,0.3)">{ic("plus", 18, sw="2.2")}Round done</button></div>'''
    return screen("AMRAP live", body + live_top("AMRAP · 12 min", "Block B of 3") + fade() + btns, t, mode)


# ---------------------------------------------------------------- EMOM
def emom(mode, t):
    segs = ""
    for i in range(10):
        if i < 5:
            s = "background: %%TRAIN%%"
        elif i == 5:
            s = "background: linear-gradient(90deg, %%TRAIN%% 37%, %%HAIR%% 37%)"
        else:
            s = "background: %%HAIR%%"
        segs += f'<span style="height: 6px; border-radius: 3px; {s}"></span>'
    body = body_top(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding-top: 10px">
<span style="font-size: 13px; color: %%MUTED%%">Minute</span><span style="{DISP}; font-size: 22px; font-weight: 500">6 <span style="color: %%MUTED%%; font-weight: 300">of 10</span></span>
<span style="{BIG}; font-size: 104px; line-height: 1.05">0:38</span><span style="font-size: 13px; color: %%MUTED%%">until the next minute</span></div>
<div style="margin: 4px 24px 0; display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 4px">{segs}</div>
<div style="margin: 10px 16px 0; border-radius: 22px; background: %%TRAIN_SOFT%%; padding: 18px; display: flex; flex-direction: column; gap: 4px">
<span style="font-size: 12px; font-weight: 600; color: %%TRAIN_TEXT%%">THIS MINUTE · EVEN</span>
<span style="{DISP}; font-size: 28px; font-weight: 500">8 burpees</span>
<span style="font-size: 13px; color: %%INK2%%">Rest for the rest of the minute</span></div>
<div style="margin: 0 16px; border-radius: 20px; {CARD}; padding: 14px 18px; {ROW}"><span style="font-size: 12px; color: %%MUTED%%; width: 86px">NEXT · ODD</span><span style="font-size: 15px">12 kettlebell swings</span><span style="margin-left: auto; font-size: 13px; color: %%MUTED%%">24 kg</span></div>''', top=88, gap=12)
    btns = f'''<div style="position: absolute; left: 20px; right: 20px; bottom: 34px; display: flex; gap: 10px">
<button style="{BTN}; flex-grow: 1; height: 56px; background: %%CARD%%; border: 1px solid %%HAIR%%; color: %%INK%%; font-weight: 500">Missed this minute</button>
<button style="{BTN}; flex-grow: 1; height: 56px; background: %%INK%%; color: %%BG%%">{ic("check", 16, sw="2.2")}Done</button></div>'''
    return screen("EMOM live", body + live_top("EMOM · 10 min", "Alternating minutes") + btns, t, mode)


# ---------------------------------------------------------------- Tabata (work phase)
TABATA_MOVES = [("Air bike", "1 · 5"), ("Burpees", "2 · 6"), ("Mountain climbers", "3 · 7"), ("Jump squats", "4 · 8")]


def tabata(mode, t):
    # 8 rounds = 16 intervals (work, rest); we are in round 5's work interval
    segs = ""
    for i in range(16):
        work = i % 2 == 0
        if i < 8:
            s = "background: %%TRAIN%%" if work else "background: %%MUTED%%; opacity: 0.45"
        elif i == 8:
            s = "background: linear-gradient(90deg, %%TRAIN%% 30%, %%HAIR%% 30%)"
        else:
            s = "background: %%HAIR%%"
        segs += f'<span style="height: 6px; border-radius: 3px; {s}"></span>'
    cols = " ".join("2fr" if i % 2 == 0 else "1fr" for i in range(16))
    rows = ""
    for i, (name, rounds) in enumerate(TABATA_MOVES):
        now, nxt = i == 0, i == 1
        tag = (f'<span style="padding: 3px 8px; border-radius: 999px; background: %%TRAIN%%; color: %%ON%%; font-size: 11px; font-weight: 600">Now</span>' if now
               else '<span style="font-size: 12px; color: %%MUTED%%">Next</span>' if nxt else "")
        bg = "background: %%TRAIN_SOFT%%; border-radius: 14px; margin: 0 -10px; padding-left: 10px; padding-right: 10px;" if now else f"border-top: {'1px solid %%HAIR%%' if i > 1 else 'none'};"
        rows += f'<div style="{ROW}; padding-top: 11px; padding-bottom: 11px; {bg}"><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: {600 if now else 400}">{name}</span><span style="font-size: 12px; color: %%MUTED%%">Rounds {rounds}</span></span><span style="margin-left: auto">{tag}</span></div>'
    inner = (f'<span style="{ROW}; gap: 6px; padding: 4px 10px; border-radius: 999px; background: %%TRAIN_SOFT%%; color: %%TRAIN_TEXT%%; font-size: 12px; font-weight: 600"><span style="width: 6px; height: 6px; border-radius: 3px; background: %%TRAIN%%"></span>Work</span>'
             f'<span style="{BIG}; font-size: 72px; line-height: 1">0:14</span><span style="font-size: 13px; color: %%MUTED%%">Round 5 of 8</span>')
    body = body_top(f'''{ring(0.7, 220, 9, inner=inner)}
<div style="margin: 0 24px; display: grid; grid-template-columns: {cols}; gap: 3px">{segs}</div>
<div style="margin: 0 24px; {ROW}; font-size: 12px; color: %%MUTED%%"><span>20 s work · 10 s rest</span><span style="margin-left: auto">Then rest 10 s → Burpees</span></div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 6px 18px"><div style="{ROW}; padding: 8px 0"><span style="font-size: 15px; font-weight: 600">Exercises</span><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">rotate every round</span></div>{rows}</div>''', top=92, gap=12)
    btns = f'''<div style="position: absolute; left: 20px; right: 20px; bottom: 34px; display: flex; gap: 10px">
<button style="{BTN}; flex-grow: 1; height: 56px; background: %%CARD%%; border: 1px solid %%HAIR%%; color: %%INK%%; font-weight: 500">{ic("pause", 16, sw="2")}Pause</button>
<button style="{BTN}; flex-grow: 1; height: 56px; background: %%INK%%; color: %%BG%%">Skip interval{ic("chevron", 16, sw="2.2")}</button></div>'''
    return screen("Tabata live", body + live_top("Tabata · 4 min", "Block C of 3") + fade() + btns, t, mode)


# ---------------------------------------------------------------- For Time
def for_time(mode, t):
    work = [("21", "Thrusters", "40 kg", "done"), ("21", "Pull-ups", "", "done"), ("15", "Thrusters", "40 kg", "done"),
            ("15", "Pull-ups", "", "now"), ("9", "Thrusters", "40 kg", "todo"), ("9", "Pull-ups", "", "todo")]
    rows = ""
    for i, (r, n, w, s) in enumerate(work):
        if s == "done":
            mark = f'<span style="width: 24px; height: 24px; border-radius: 12px; background: %%TRAIN%%; color: %%ON%%; display: flex; align-items: center; justify-content: center">{ic("check", 13, sw="2.4")}</span>'
            txt = "color: %%MUTED%%"
        elif s == "now":
            mark = '<span style="width: 22px; height: 22px; border-radius: 12px; border: 1.5px solid %%TRAIN%%"></span>'
            txt = "color: %%INK%%; font-weight: 600"
        else:
            mark = '<span style="width: 22px; height: 22px; border-radius: 12px; border: 1.5px solid %%HAIR%%"></span>'
            txt = "color: %%INK%%"
        bg = "background: %%TRAIN_SOFT%%; margin: 0 -10px; padding-left: 10px; padding-right: 10px; border-radius: 14px;" if s == "now" else f"border-top: {'1px solid %%HAIR%%' if i else 'none'};"
        rows += f'<div role="checkbox" aria-checked="{"true" if s == "done" else "false"}" style="{ROW}; padding-top: 12px; padding-bottom: 12px; {bg}"><span style="width: 30px; font-size: 15px; font-weight: 600; color: %%TRAIN_TEXT%%">{r}</span><span style="font-size: 15px; {txt}">{n}</span><span style="margin-left: auto; {ROW}; gap: 10px; font-size: 13px; color: %%MUTED%%">{w}{mark}</span></div>'
    body = body_top(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 2px; padding-top: 6px">
<span style="{BIG}; font-size: 88px; line-height: 1.05">08:42</span>
<span style="font-size: 13px; color: %%MUTED%%">time cap 15:00</span></div>
<div style="margin: 0 40px">{thin_bar(58, "%%TRAIN%%", 4)}</div>
<div style="margin: 6px 16px 0; border-radius: 22px; {CARD}; padding: 6px 18px"><div style="{ROW}; padding: 8px 0"><span style="font-size: 15px; font-weight: 600">21 – 15 – 9</span><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">Tap each line when done</span></div>{rows}</div>''', top=92, gap=12)
    return screen("For Time live", body + live_top("For time", "Block B of 3") + fade() + cta("Finish — stop the clock", "check", "%%TRAIN%%", "%%ON%%", "0 8px 22px rgba(242,140,56,0.3)"), t, mode)


# ---------------------------------------------------------------- Block result
def block_result(mode, t):
    def stepper(lbl, v):
        return f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px; align-items: center"><span style="font-size: 12px; color: %%MUTED%%">{lbl}</span><div style="{ROW}; gap: 14px">{round_btn("minus", "Decrease " + lbl, 34)}<span style="{DISP}; font-size: 30px; font-weight: 500; min-width: 30px; text-align: center">{v}</span>{round_btn("plus", "Increase " + lbl, 34)}</div></div>'
    body = body_top(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 20px; text-align: center">
{soft_icon("check", "%%TRAIN_SOFT%%", "%%TRAIN_TEXT%%", 52)}
<span style="font-size: 13px; color: %%MUTED%%; padding-top: 6px">AMRAP · 12 min · Conditioning</span>
<h1 style="{H1}; font-size: 34px">6 rounds + 4 reps</h1></div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 16px 12px; display: flex">{stepper("Rounds", 6)}<span style="width: 1px; background: %%HAIR%%"></span>{stepper("Extra reps", 4)}</div>
<div style="margin: 0 16px; border-radius: 22px; {CARD}; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="{ROW}"><span style="font-size: 15px; font-weight: 500">How hard was it?</span><span style="margin-left: auto; font-size: 13px; font-weight: 600; color: %%TRAIN_TEXT%%">8 · Very hard</span></div>
{seg_scale("Effort", 8, 10, "%%TRAIN_TEXT%%")}
<div style="display: flex; font-size: 11px; color: %%MUTED%%"><span>Easy</span><span style="margin-left: auto">Max effort</span></div></div>
<label style="margin: 0 16px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: %%MUTED%%">Note for Martin (optional)<span style="min-height: 64px; padding: 12px 14px; box-sizing: border-box; border-radius: 16px; background: %%INPUT_BG%%; border: 1px solid %%HAIR%%; font-size: 15px; color: %%MUTED%%">Box jumps felt slow after round 4</span></label>''', top=96, gap=14)
    return screen("Block result", body + top_bar("", "", "") + fade() + cta("Save · next: Tabata finisher", "chevron"), t, mode)


NEW7 = {"SessionMixed": session_mixed, "Amrap": amrap, "Emom": emom, "Tabata": tabata, "ForTime": for_time, "BlockResult": block_result}
for mode, t in MODES.items():
    for label_, fn in NEW7.items():
        with open(os.path.join(HERE, "project", f"Glass{label_}{mode}.dc.html"), "w") as f:
            f.write(fn(mode, t))
        print(f"Glass{label_}{mode}.dc.html")
