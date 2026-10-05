"""Web: Recipes — card grid and the recipe editor drawer."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen2.py")).read().split("# ---------------------------------------------------------------- canvas")[0]
exec(_src)
PATHS.update({
    "grip": '<circle cx="9" cy="6" r="1.2"></circle><circle cx="15" cy="6" r="1.2"></circle><circle cx="9" cy="12" r="1.2"></circle><circle cx="15" cy="12" r="1.2"></circle><circle cx="9" cy="18" r="1.2"></circle><circle cx="15" cy="18" r="1.2"></circle>',
    "clock": '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>',
    "globe": '<circle cx="12" cy="12" r="8.5"></circle><path d="M3.5 12h17"></path><path d="M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"></path>',
    "lock": '<rect x="5" y="10.5" width="14" height="10" rx="2"></rect><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path>',
    "grid": '<rect x="4" y="4" width="7" height="7" rx="1.5"></rect><rect x="13" y="4" width="7" height="7" rx="1.5"></rect><rect x="4" y="13" width="7" height="7" rx="1.5"></rect><rect x="13" y="13" width="7" height="7" rx="1.5"></rect>',
    "list": PATHS.get("list", '<path d="M8 6h12"></path><path d="M8 12h12"></path><path d="M8 18h12"></path><circle cx="4" cy="6" r="1"></circle><circle cx="4" cy="12" r="1"></circle><circle cx="4" cy="18" r="1"></circle>'),
})

TAGS.update({"Meal prep": "#0E7490", "Quick": "#7C3AED", "Budget": "#64748B", "Family": "#DB2777"})

RECIPES = [
    ("Chicken rice bowl", 550, 45, 70, 10, 25, ["Lunch", "Dinner"], ["High protein"], "mine", 2, "#C9D9A8", ["Meal prep"]),
    ("Salmon, potatoes, greens", 610, 38, 69, 20, 30, ["Dinner"], ["Gluten-free"], "mine", 2, "#F2C9B1", []),
    ("Oat bowl with berries", 420, 26, 47, 14, 10, ["Breakfast"], ["Vegetarian"], "mine", 1, "#D8C8E6", ["Quick"]),
    ("Lentil curry", 560, 35, 63, 19, 35, ["Lunch", "Dinner"], ["Vegan", "Lactose-free"], "public", 4, "#E7B48F", ["Meal prep", "Budget"]),
    ("Turkey wrap", 520, 32, 58, 17, 15, ["Lunch"], ["High protein"], "mine", 1, "#E9D9C7", ["Quick"]),
    ("Greek yogurt, honey", 180, 11, 20, 6, 5, ["Snack"], ["Vegetarian", "Gluten-free"], "public", 1, "#F1F1EC", ["Quick"]),
    ("Beef stir-fry", 590, 37, 66, 20, 25, ["Dinner"], ["Lactose-free"], "mine", 2, "#D7A68E", ["Family"]),
    ("Tofu noodle bowl", 540, 34, 61, 18, 20, ["Lunch", "Dinner"], ["Vegan"], "public", 2, "#E3D6B9", []),
]


def tag(t, strong=False):
    st = "background: %%INK%%; color: %%SURFACE%%" if strong else "background: %%GROUND%%; color: %%INK2%%; border: 1px solid %%LINE%%"
    return f'<span style="height: 22px; padding: 0 8px; border-radius: 11px; {st}; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; white-space: nowrap">{t}</span>'


def macro_line(p, c, f):
    seg = lambda v, col: f'<span style="flex-grow: {v}; flex-basis: 0; height: 4px; background: {col}"></span>'
    return f'<div style="display: flex; gap: 1px; border-radius: 2px; overflow: hidden">{seg(p * 4, "%%PROT%%")}{seg(c * 4, "%%CARB%%")}{seg(f * 9, "%%FAT%%")}</div>'


def vis_badge(vis):
    return (f'<span style="height: 24px; padding: 0 9px; border-radius: 12px; background: rgba(20,20,20,0.6); color: #FFFFFF; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px">'
            f'{ic("globe" if vis == "public" else "lock", 12)}{"Public" if vis == "public" else "My library"}</span>')


def recipe_card(r, selected=False):
    name, kcal, p, c, f, mins, meals, diet, vis, serv, col, tg = r
    ring = "border: 2px solid %%INK%%;" if selected else "border: 1px solid %%LINE%%;"
    time = f'<span style="position: absolute; top: 10px; right: 10px; height: 24px; padding: 0 9px; border-radius: 12px; background: rgba(255,255,255,0.9); color: #141414; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 5px">{ic("clock", 12)}{mins} min</span>'
    tags_row = "".join(tagpill(x) for x in tg) or '<span style="font-size: 11px; color: %%MUTED%%">No tags</span>'
    return (f'<a href="#" style="display: flex; flex-direction: column; border-radius: 16px; {ring} background: %%SURFACE%%; overflow: hidden; text-decoration: none; color: %%INK%%">'
            f'<div style="position: relative; height: 116px; background: {col}"><span style="position: absolute; top: 10px; left: 10px">{vis_badge(vis)}</span>{time}</div>'
            f'<div style="padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 8px">'
            f'<span style="font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{name}</span>'
            f'<span style="display: flex; align-items: baseline; gap: 6px; font-size: 12px; color: %%MUTED%%"><b style="font-size: 14px; color: %%INK%%">{kcal}</b>kcal / portion · P {p} · C {c} · F {f}</span>'
            f'{macro_line(p, c, f)}'
            f'<div style="display: flex; flex-wrap: wrap; gap: 5px">{"".join(tag(m) for m in meals)}</div>'
            f'<div style="display: flex; flex-wrap: wrap; gap: 5px; padding-top: 8px; border-top: 1px solid %%LINE%%">{tags_row}</div></div></a>')


def layout_toggle(table):
    b = lambda icon, label, on: f'<button aria-pressed="{"true" if on else "false"}" aria-label="{label}" style="width: 32px; height: 30px; border-radius: 8px; border: none; background: {"%%SURFACE%%" if on else "transparent"}; color: {"%%INK%%" if on else "%%MUTED%%"}; display: flex; align-items: center; justify-content: center">{ic(icon, 15)}</button>'
    return f'<div role="group" aria-label="Layout" style="display: flex; padding: 3px; border-radius: 10px; background: %%LINE%%">{b("grid", "Cards", not table)}{b("list", "Table", table)}</div>'


def toolbar(table=False):
    owner = (f'<div role="group" aria-label="Library" style="display: flex; padding: 3px; border-radius: 10px; background: %%LINE%%">'
             + "".join(f'<button aria-pressed="{"true" if i == 0 else "false"}" style="height: 30px; padding: 0 12px; border-radius: 8px; border: none; {"background: %%SURFACE%%; color: %%INK%%; font-weight: 600" if i == 0 else "background: transparent; color: %%MUTED%%; font-weight: 500"}; font-family: inherit; font-size: 13px">{x}</button>'
                       for i, x in enumerate(["All · 48", "My library · 31", "Public · 17"])) + '</div>')
    return (f'<div style="display: flex; align-items: flex-end">{title_block("Recipes", "Your recipe library — drag them into plans and templates", ("NUTRITION", "%%NUTRI%%"))}<span style="margin-left: auto">{btn("New recipe", "primary", "plus", 40)}</span></div>'
            f'<div style="display: flex; align-items: center; gap: 10px">{search("Search recipes…", 280)}{filter_pill("Meal type", 1)}{filter_pill("Dietary")}{filter_pill("Tags")}'
            f'<span style="margin-left: auto; display: flex; gap: 8px">{owner}{layout_toggle(table)}</span></div>')


def recipes_main(selected=None):
    cards = "".join(recipe_card(r, r[0] == selected) for r in RECIPES)
    return f'{toolbar()}<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px">{cards}</div>'


def recipes_table_main():
    rows = ""
    for name, kcal, p, c, f, mins, meals, diet, vis, serv, col, tg in RECIPES:
        lib = (f'<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: %%INK2%%">{ic("globe" if vis == "public" else "lock", 13)}{"Public" if vis == "public" else "My library"}</span>')
        rows += f'''<tr>
<td style="{TD}"><div style="display: flex; align-items: center; gap: 12px"><span style="width: 34px; height: 34px; border-radius: 8px; background: {col}; flex-shrink: 0"></span><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 600">{name}</span><span style="font-size: 11px; color: %%MUTED%%">{mins} min</span></div></div></td>
<td style="{TD}; color: %%INK2%%; white-space: nowrap"><span style="font-weight: 600; color: %%INK%%">{kcal}</span> kcal</td>
<td style="{TD}">{nutrients(p, c, f, round(kcal / 75))}</td>
<td style="{TD}"><div style="display: flex; gap: 5px">{"".join(tag(m) for m in meals)}</div></td>
<td style="{TD}; color: %%INK2%%">{serv}</td>
<td style="{TD}"><div style="display: flex; gap: 6px">{"".join(tagpill(x) for x in tg)}</div></td>
<td style="{TD}">{lib}</td>
</tr>
'''
    sortable = lambda l, on=False: f'<th style="{TH}"><button style="border: none; background: transparent; padding: 0; font: 600 12px DM Sans, sans-serif; color: {"%%INK%%" if on else "%%MUTED%%"}; display: flex; align-items: center; gap: 5px">{l}<span style="display: flex; opacity: {1 if on else 0.5}">{ic("sortdown" if on else "sort", 13)}</span></button></th>'
    table = f'''<div style="border-radius: 14px; border: 1px solid %%LINE%%; background: %%SURFACE%%; overflow: hidden">
<table style="width: 100%; border-collapse: collapse">
<thead><tr>{sortable("Name", True)}{sortable("Calories")}<th style="{TH}">Nutrients per portion</th><th style="{TH}">Meal type</th>{sortable("Servings")}<th style="{TH}">Tags</th>{sortable("Library")}</tr></thead>
<tbody>{rows}</tbody></table>
{pagination(8, 48)}
</div>'''
    return f'{toolbar(True)}{table}'


def recipes(d, t):
    return page(f"Recipes {d}", W, H, shell(d, "Recipes", recipes_main()), t)


def recipes_table(d, t):
    return page(f"Recipes table {d}", W, H, shell(d, "Recipes", recipes_table_main()), t)


# ---------------------------------------------------------------- drawer with tabs
def recipe_drawer(d, t, tab="details"):
    under = shell(d, "Recipes", recipes_main("Chicken rice bowl"))
    two = lambda a, b: f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">{a}{b}</div>'
    chipsel = lambda xs: "".join(f'<span style="padding: 4px 10px; border-radius: 999px; background: %%NUTRI_SOFT%%; color: %%NUTRI_INK%%; font-size: 12px; font-weight: 600">{x}</span>' for x in xs)
    multi = lambda label, xs, hint="", ro=False: (f'<div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%"><span>{label}</span>'
                                                  f'<div style="min-height: 40px; padding: 6px 10px; box-sizing: border-box; border-radius: 10px; border: 1px solid %%LINE%%; {"background: %%GROUND%%;" if ro else ""} display: flex; flex-wrap: wrap; align-items: center; gap: 6px">{xs}'
                                                  f'{"" if ro else f"<span style=\"margin-left: auto; display: flex; color: %%MUTED%%\">{ic("chevdown", 16)}</span>"}</div>'
                                                  f'{f"<span style=\"font-size: 12px; font-weight: 400; color: %%MUTED%%\">{hint}</span>" if hint else ""}</div>')
    names = [("details", "Details"), ("ingredients", "Ingredients · 5"), ("preparation", "Preparation · 3"), ("pictures", "Pictures · 3")]
    tabs_html = "".join(f'<a href="#" role="tab" aria-selected="{"true" if k == tab else "false"}" style="padding: 0 2px 11px; margin-bottom: -1px; text-decoration: none; font-size: 14px; {"color: %%INK%%; font-weight: 600; border-bottom: 2px solid %%INK%%" if k == tab else "color: %%MUTED%%; font-weight: 500; border-bottom: 2px solid transparent"}">{l}</a>' for k, l in names)
    tabbar = f'<div role="tablist" aria-label="Recipe sections" style="display: flex; gap: 24px; padding: 0 24px; border-bottom: 1px solid %%LINE%%">{tabs_html}</div>'

    if tab == "details":
        mytags = "".join(tagpill(x) for x in ["Meal prep"]) + '<span style="font-size: 13px; color: %%MUTED%%">+ add tag</span>'
        body = f'''{section("info", "Basic Information", field("Name", "Chicken rice bowl") + two(field("Servings", "2"), field("Difficulty", "Easy", req=False, select=True)) + f'<label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: %%INK2%%"><span>Description</span><span style="min-height: 64px; padding: 10px 12px; box-sizing: border-box; border-radius: 10px; border: 1px solid %%LINE%%; font-size: 14px; line-height: 1.5; color: %%INK%%">High-protein bowl that keeps in the fridge for three days.</span></label>')}
{section("clock", "Recipe Details", multi("Meal types", chipsel(["Lunch", "Dinner"])) + two(field("Prep time (min)", "10", req=False), field("Cook time (min)", "15", req=False)))}
{section("tag", "Tags &amp; Classification", two(multi("Dietary preferences", chipsel(["High protein", "Gluten-free"])), multi("Allergens", '<span style="padding: 4px 10px; border-radius: 999px; border: 1px solid %%MARKER%%; color: %%MARKER%%; font-size: 12px; font-weight: 600">Soy</span>', "Derived from the ingredients.", ro=True)) + multi("My Tags", mytags))}'''
    elif tab == "preparation":
        steps = ["Rinse the rice and cook it in salted water for 12 minutes.", "Season the chicken with salt, pepper and paprika. Sear 6 minutes a side, then slice.", "Steam the broccoli for 4 minutes and toss with olive oil and soy sauce."]
        rows = ""
        for i, st in enumerate(steps):
            rows += (f'<div style="display: flex; gap: 10px; align-items: flex-start">'
                     f'<span aria-label="Reorder step {i + 1}" style="padding-top: 12px; color: %%MUTED%%; display: flex">{ic("grip", 14)}</span>'
                     f'<span style="width: 28px; height: 28px; margin-top: 6px; flex-shrink: 0; border-radius: 14px; background: %%INK%%; color: %%SURFACE%%; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">{i + 1}</span>'
                     f'<span style="flex-grow: 1; min-height: 64px; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid %%LINE%%; font-size: 14px; line-height: 1.5">{st}</span>'
                     f'<button aria-label="Remove step {i + 1}" style="margin-top: 8px; width: 28px; height: 28px; border-radius: 8px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("trash", 15)}</button></div>')
        rows += (f'<div style="display: flex; gap: 10px; align-items: flex-start; opacity: 0.7"><span style="width: 14px"></span>'
                 f'<span style="width: 28px; height: 28px; margin-top: 6px; flex-shrink: 0; box-sizing: border-box; border-radius: 14px; border: 1.5px dashed %%MUTED%%; color: %%MUTED%%; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">4</span>'
                 f'<span style="flex-grow: 1; min-height: 64px; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1.5px dashed %%LINE%%; font-size: 14px; color: %%MUTED%%">Describe this step</span><span style="width: 28px"></span></div>')
        body = (f'<div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: %%GROUND%%; border: 1px solid %%LINE%%; font-size: 13px; color: %%INK2%%">{ic("clock", 15)}<b>Prep 10 min · Cook 15 min</b><span style="color: %%MUTED%%">· set on the Details tab</span></div>'
                f'<div style="display: flex; flex-direction: column; gap: 12px">{rows}</div>'
                f'<a href="#" style="align-self: flex-start; height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid %%LINE%%; color: %%INK%%; text-decoration: none; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px">{ic("plus", 14)}Add step</a>'
                f'<span style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: %%MUTED%%">{ic("info", 14)}Steps are shown to the client in the app, in this order.</span>')
    elif tab == "pictures":
        thumb = lambda c: (f'<div style="position: relative; height: 120px; border-radius: 12px; background: {c}">'
                           f'<div style="position: absolute; left: 8px; right: 8px; bottom: 8px; display: flex; gap: 6px">'
                           f'<button style="height: 28px; padding: 0 10px; border-radius: 8px; border: none; background: rgba(255,255,255,0.92); color: #141414; font: 600 11px DM Sans, sans-serif">Set as main</button>'
                           f'<button aria-label="Remove picture" style="margin-left: auto; width: 28px; height: 28px; border-radius: 8px; border: none; background: rgba(255,255,255,0.92); color: %%DANGER%%; display: flex; align-items: center; justify-content: center">{ic("trash", 14)}</button></div></div>')
        main = (f'<div style="position: relative; height: 230px; border-radius: 14px; background: linear-gradient(135deg, #D5E3B6, #B9CC93)">'
                f'<span style="position: absolute; top: 12px; left: 12px; height: 26px; padding: 0 10px; border-radius: 13px; background: rgba(20,20,20,0.6); color: #FFFFFF; font-size: 12px; font-weight: 600; display: flex; align-items: center">Main picture</span>'
                f'<div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 6px"><button aria-label="Replace main picture" style="width: 34px; height: 34px; border-radius: 10px; border: none; background: rgba(255,255,255,0.92); color: #141414; display: flex; align-items: center; justify-content: center">{ic("pencil", 16)}</button>'
                f'<button aria-label="Remove main picture" style="width: 34px; height: 34px; border-radius: 10px; border: none; background: rgba(255,255,255,0.92); color: %%DANGER%%; display: flex; align-items: center; justify-content: center">{ic("trash", 16)}</button></div></div>')
        add = f'<div style="height: 120px; box-sizing: border-box; border-radius: 12px; border: 1.5px dashed %%LINE%%; color: %%MUTED%%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 600">{ic("plus", 18)}Add picture</div>'
        body = (f'{main}<span style="font-size: 12px; color: %%MUTED%%">Shown on the recipe card and at the top of the recipe in the client app.</span>'
                f'<div style="display: flex; align-items: baseline"><h3 style="margin: 0; font-size: 15px; font-weight: 700">More pictures</h3><span style="margin-left: auto; font-size: 12px; color: %%MUTED%%">2 of 6</span></div>'
                f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">{thumb("#C9D9A8")}{thumb("#E6DCC4")}{add}</div>'
                f'<span style="font-size: 12px; color: %%MUTED%%">JPEG, PNG, or WebP, up to 5 MB. Drag a picture onto the grid to upload.</span>')
    else:
        foods = [("#F2E3D3", "Chicken breast", 300, 330, 69, 0, 4), ("#EEE8DA", "Basmati rice, dry", 160, 570, 12, 125, 1), ("#C9D9A8", "Broccoli", 200, 68, 6, 14, 1),
                 ("#E8C547", "Olive oil", 15, 120, 0, 0, 14), ("#D8A86B", "Soy sauce", 20, 12, 2, 1, 0)]
        rows = ""
        for col, n, g, k, p, c, f in foods:
            rows += (f'<div style="display: grid; grid-template-columns: 18px 32px minmax(0, 1fr) 92px 74px 24px; gap: 10px; align-items: center; padding: 9px 0; border-top: 1px solid %%LINE%%">'
                     f'<span style="color: %%MUTED%%; display: flex">{ic("grip", 13)}</span><span style="width: 32px; height: 32px; border-radius: 8px; background: {col}"></span>'
                     f'<span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 13px; font-weight: 600">{n}</span><span style="font-size: 11px; color: %%MUTED%%">P {p} · C {c} · F {f}</span></span>'
                     f'<span style="height: 32px; padding: 0 10px; box-sizing: border-box; border-radius: 8px; border: 1px solid %%LINE%%; display: flex; align-items: center; font-size: 13px; font-weight: 600">{g}<span style="margin-left: auto; font-weight: 400; color: %%MUTED%%">g</span></span>'
                     f'<span style="font-size: 13px; font-weight: 600; text-align: right">{k} kcal</span>'
                     f'<button aria-label="Remove {n}" style="width: 24px; height: 24px; border: none; background: transparent; color: %%MUTED%%; display: flex; align-items: center; justify-content: center">{ic("x", 13)}</button></div>')
        body = (f'<div style="height: 42px; border-radius: 10px; border: 1px solid %%LINE%%; display: flex; align-items: center; gap: 8px; padding: 0 12px; font-size: 13px; color: %%MUTED%%">{ic("search", 15)}Search ingredients to add…</div>'
                f'<div style="display: flex; flex-direction: column">{rows}</div>'
                f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; background: %%NUTRI_SOFT%%">'
                f'<div style="display: flex; align-items: baseline; gap: 12px"><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: %%NUTRI_INK%%">TOTAL · 2 SERVINGS</span><span style="margin-left: auto; font-size: 13px; color: %%INK2%%">1,100 kcal</span></div>'
                f'<div style="display: flex; align-items: baseline; gap: 12px"><span style="{DISP}; font-size: 22px; font-weight: 600; color: %%INK%%">550 kcal</span><span style="font-size: 13px; color: %%INK2%%">per serving · P 45 · C 70 · F 10 · Fib 5 g</span></div>{macro_line(45, 70, 10)}</div>')

    sheet = f'''<div style="position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: rgba(10,10,12,0.45)"></div>
<aside aria-label="Edit Recipe" style="position: absolute; top: 0; right: 0; bottom: 0; width: 600px; background: %%SURFACE%%; box-shadow: -12px 0 40px rgba(0,0,0,0.18); display: flex; flex-direction: column">
<div style="padding: 22px 24px 16px; display: flex; align-items: flex-start; gap: 14px">
<span style="width: 52px; height: 52px; flex-shrink: 0; border-radius: 12px; background: #C9D9A8"></span>
<div style="display: flex; flex-direction: column; gap: 4px"><span style="{DISP}; font-size: 22px; font-weight: 600">Edit Recipe</span><span style="font-size: 13px; color: %%MUTED%%">Chicken rice bowl · 550 kcal per serving</span></div>
<button aria-label="Close" style="margin-left: auto; width: 34px; height: 34px; border-radius: 10px; border: none; background: transparent; color: %%INK2%%; display: flex; align-items: center; justify-content: center">{ic("x", 18)}</button>
</div>
{tabbar}
<div style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 20px 24px; display: flex; flex-direction: column; gap: 20px">{body}</div>
<div style="padding: 16px 24px; border-top: 1px solid %%LINE%%; display: flex; align-items: center; gap: 8px">{btn("Delete", "danger", "trash", 40)}<span style="margin-left: auto"></span>{btn("Cancel", "outline", h=40)}{btn("Save Recipe", "primary", h=40)}</div>
</aside>'''
    page_body = under.replace("</main>\n</div>", "</main>\n" + sheet + "\n</div>")
    return page(f"Recipe drawer {d}", W, H, page_body, t)


for d, t in DIRS.items():
    if d not in ("C", "D"):
        continue
    BOLD_ON = ""
    DARK_ON = t["DARK"]
    for name, fn in (("PageRecipes", recipes), ("PageRecipesTable", recipes_table),
                     ("PageRecipeDrawer", lambda d, t: recipe_drawer(d, t, "details")),
                     ("PageRecipeDrawerIngredients", lambda d, t: recipe_drawer(d, t, "ingredients")),
                     ("PageRecipeDrawerPreparation", lambda d, t: recipe_drawer(d, t, "preparation")),
                     ("PageRecipeDrawerPictures", lambda d, t: recipe_drawer(d, t, "pictures"))):
        with open(os.path.join(HERE, "project", f"{name}{d}.dc.html"), "w") as f:
            f.write(fn(d, t))
print("ok")
