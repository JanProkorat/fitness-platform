"""Build the clickable web-portal prototype from the canvas boards.

Usage: python3 export_interactive.py <out_dir>
Writes <out_dir>/interactive/: one HTML per web board and theme, wired with a click map,
a light/dark switch and a screen picker. Press H in the browser to show the hotspots.
"""
import html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(sys.argv[1], "interactive")
canvas = json.load(open(os.path.join(HERE, "project", "canvas.json")))

# Navigation shared by every page with the sidebar or the collapsed rail.
NAV = {"Clients": "PageClients", "Inbox": "PageInbox", "Recipes": "PageRecipes", "Ingredients": "PageIngredients",
       "Plan templates": "PageTemplates", "Forms": "PageForms", "Log out": "PageHome"}

# Per page: visible text, aria-label or title of the clicked element -> target board.
# A key starting with ^ matches the beginning of the text, * matches anywhere in it.
FLOWS = {
    "PageHome": {"Sign in": "PageHomeSignIn", "Create account": "PageRegister"},
    "PageHomeSignIn": {"Close": "PageHome", "Sign in": "PageClients", "Create account": "PageRegister"},
    "PageRegister": {"Create account": "PageRegisterCheckEmail", "Sign in": "PageHomeSignIn"},
    "PageRegisterCheckEmail": {"^Open Gmail": "PageRegisterVerified", "^Open Outlook": "PageRegisterVerified", "Change email": "PageRegister"},
    "PageRegisterVerified": {"^Set up your profile": "PageClients", "Skip for now and go to the portal": "PageClients"},
    "PageClients": {"Eva Svobodová": "PageClientDetail", "^Invite client": "PageClients"},
    "PageClientDetail": {"Nutrition": "PageClientNutrition", "Back to clients": "PageClients", "^Open plan": "PageClientPlanEditor", "^Chat": "PageInbox"},
    "PageClientNutrition": {"Overview": "PageClientDetail", "Back to clients": "PageClients", "^Open editor": "PageClientPlanEditor", "^Chat": "PageInbox"},
    "PageClientNutritionEmpty": {"Overview": "PageClientDetail", "Back to clients": "PageClients", "^Use “": "PageClientPlanEditor", "^Start blank": "PageClientPlanBlank", "^Chat": "PageInbox"},
    "PageClientPlanEditor": {"Use": "PageClientPlanStartOver", "Plan Info": "PageClientPlanInfo", "Library": "PageClientPlanClosed", "Close panel": "PageClientPlanClosed",
                             "Day": "PageClientPlanDay", "Back to Eva": "PageClientNutrition"},
    "PageClientPlanStartOver": {"^Cancel": "PageClientPlanEditor", "Replace draft weeks": "PageClientPlanEditor"},
    "PageClientPlanInfo": {"Library": "PageClientPlanEditor", "Plan Info": "PageClientPlanClosed", "Close panel": "PageClientPlanClosed",
                           "Day": "PageClientPlanDay", "Back to Eva": "PageClientNutrition"},
    "PageClientPlanClosed": {"Open panel": "PageClientPlanEditor", "Library": "PageClientPlanEditor", "Plan Info": "PageClientPlanInfo",
                             "Day": "PageClientPlanDay", "Back to Eva": "PageClientNutrition"},
    "PageClientPlanDay": {"Week": "PageClientPlanEditor", "^Add meal": "PageClientPlanDayAddMeal", "Plan Info": "PageClientPlanInfo",
                          "Library": "PageClientPlanClosed", "Close panel": "PageClientPlanClosed", "Back to Eva": "PageClientNutrition"},
    "PageClientPlanDayAddMeal": {"^Cancel": "PageClientPlanDay", "Close": "PageClientPlanDay", "^Add meal": "PageClientPlanDay"},
    "PageClientPlanBlank": {"Use": "PageClientPlanEditor", "Plan Info": "PageClientPlanInfo", "Back to Eva": "PageClientNutrition"},
    "PageRecipes": {"Table": "PageRecipesTable", "^New recipe": "PageRecipeDrawer", "*Chicken rice bowl": "PageRecipeDrawer"},
    "PageRecipesTable": {"Cards": "PageRecipes", "^New recipe": "PageRecipeDrawer", "*Chicken rice bowl": "PageRecipeDrawer"},
    "PageRecipeDrawer": {"^Ingredients ·": "PageRecipeDrawerIngredients", "^Preparation ·": "PageRecipeDrawerPreparation", "^Pictures ·": "PageRecipeDrawerPictures",
                         "Close": "PageRecipes", "^Cancel": "PageRecipes", "^Save Recipe": "PageRecipes"},
    "PageIngredients": {"^New Ingredient": "PageIngredientDrawer", "*Red lentils": "PageIngredientDrawer"},
    "PageIngredientDrawer": {"Close": "PageIngredients", "^Cancel": "PageIngredients", "^Save Ingredient": "PageIngredients"},
    "PageTemplates": {"^New template": "PageTemplateNew", "^Cut — 4 weeks": "PageTemplateEditor", "^Lean bulk": "PageTemplateEditor",
                      "^Maintenance": "PageTemplateEditor", "^Vegetarian cut": "PageTemplateEditor"},
    "PageTemplateNew": {"Close": "PageTemplates", "^Cancel": "PageTemplates", "^Create & open editor": "PageTemplateEditorEmpty"},
    "PageTemplateEditorEmpty": {"^Breakfast · Snack": "PageTemplateEditor"},
    "PageTemplateEditor": {"Day": "PageTemplateDay", "Nutrition": "PageTemplateNutrition", "Collapse library": "PageTemplateNutrition", "^Chicken rice bowl": "PageTemplateMeal"},
    "PageTemplateMeal": {"Close": "PageTemplateEditor", "Day": "PageTemplateDay", "Nutrition": "PageTemplateNutrition"},
    "PageTemplateNutrition": {"Meals": "PageTemplateEditor", "Day": "PageTemplateDay", "Open library": "PageTemplateEditor"},
    "PageTemplateDay": {"Week": "PageTemplateEditor", "Nutrition": "PageTemplateNutrition", "^Add meal": "PageTemplateDayAddMeal"},
    "PageTemplateDayAddMeal": {"^Cancel": "PageTemplateDay", "Close": "PageTemplateDay", "^Add meal": "PageTemplateDay"},
    "PageForms": {"Client Onboarding Form": "PageFormOnboarding", "Weekly Check-In": "PageFormCheckIn", "^New form": "PageFormOnboarding"},
    "PageFormOnboarding": {"Back to forms": "PageForms"},
    "PageFormCheckIn": {"Back to forms": "PageForms"},
}
# The recipe drawer's other tabs share the Details tab's map, plus a way back to Details.
for tab in ("PageRecipeDrawerIngredients", "PageRecipeDrawerPreparation", "PageRecipeDrawerPictures"):
    FLOWS[tab] = dict(FLOWS["PageRecipeDrawer"], Details="PageRecipeDrawer")

RUNTIME = r"""
<style>
html,body{margin:0}
body{overflow-x:hidden}
.fu-hot{cursor:pointer}
body.fu-show .fu-hot{outline:2px solid rgba(37,99,235,.75);outline-offset:1px}
#fu-bar{position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;gap:6px;align-items:center;padding:6px;border-radius:14px;background:rgba(20,20,20,.88);color:#fff;font:600 12px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3)}
#fu-bar a,#fu-bar button,#fu-bar select{height:30px;padding:0 10px;border-radius:9px;border:0;background:rgba(255,255,255,.12);color:#fff;font:inherit;text-decoration:none;display:flex;align-items:center;cursor:pointer}
#fu-bar .on{background:#fff;color:#141414}
</style>
<script>
(function(){
  var FLOW = __FLOW__, PAGE = __PAGE__, THEME = __THEME__, PAGES = __PAGES__;
  function key(el){ return (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g,' ').trim(); }
  function target(el){
    var k = key(el);
    for (var m in FLOW){ var c = m[0], v = m.slice(1); if (c === '^' ? k.indexOf(v) === 0 : c === '*' ? k.indexOf(v) >= 0 : k === m) return FLOW[m]; }
    return null;
  }
  function go(page, theme){ location.href = page + '-' + (theme || THEME) + '.html'; }
  function fit(){
    // Boards are fixed-size frames; zoom the frame to the window width and paint the page in its colour.
    var board = document.body.firstElementChild;
    if (!board || board.id === 'fu-bar') return;
    if (!board.dataset.w){ board.dataset.w = board.offsetWidth; document.body.style.background = getComputedStyle(board).backgroundColor; }
    board.style.zoom = document.documentElement.clientWidth / board.dataset.w;
  }
  window.addEventListener('resize', fit);
  document.addEventListener('DOMContentLoaded', function(){
    fit();
    document.querySelectorAll('a,button,tr,[role=tab],[role=radio]').forEach(function(el){ if (target(el)) el.classList.add('fu-hot'); });
    var bar = document.createElement('div'); bar.id = 'fu-bar';
    var opts = PAGES.map(function(p){ return '<option value="'+p[0]+'"'+(p[0]===PAGE?' selected':'')+'>'+p[1]+'</option>'; }).join('');
    bar.innerHTML = '<select aria-label="Jump to screen">'+opts+'</select>'
      + '<button data-t="light" class="'+(THEME==='light'?'on':'')+'">Light</button><button data-t="dark" class="'+(THEME==='dark'?'on':'')+'">Dark</button>'
      + '<button data-h="1" title="Show clickable areas (H)">Hotspots</button><a href="../index.html">All screens</a>';
    document.body.appendChild(bar);
    bar.querySelector('select').addEventListener('change', function(e){ go(e.target.value); });
    bar.querySelectorAll('[data-t]').forEach(function(b){ b.addEventListener('click', function(){ go(PAGE, b.getAttribute('data-t')); }); });
    bar.querySelector('[data-h]').addEventListener('click', function(){ document.body.classList.toggle('fu-show'); });
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('fu-show'); });
  document.addEventListener('click', function(e){
    if (e.target.closest && e.target.closest('#fu-bar')) return;
    var el = e.target.closest ? e.target.closest('a,button,tr,[role=tab],[role=radio]') : null;
    if (!el) return;
    e.preventDefault();
    var t = target(el);
    if (t) go(t); else if (el.tagName !== 'TR' && !document.body.classList.contains('fu-show')) { document.body.classList.add('fu-show'); setTimeout(function(){ document.body.classList.remove('fu-show'); }, 600); }
  }, true);
})();
</script>
"""


def page_name(key):
    return re.sub(r"[CD]\.dc\.html$", "", key)


boards = sorted(((k, b) for k, b in canvas["boards"].items() if b.get("page") == "web"), key=lambda kb: (kb[1]["y"], kb[1]["x"]))
names = []
for k, b in boards:
    n = page_name(k)
    if n not in [x[0] for x in names]:
        names.append((n, re.sub(r"^[CD] · ", "", b.get("title", n))))

os.makedirs(OUT, exist_ok=True)
count = 0
for k, b in boards:
    name, theme = page_name(k), ("dark" if k.endswith("D.dc.html") else "light")
    src = open(os.path.join(HERE, "project", k)).read()
    helmet = re.search(r"<helmet>(.*?)</helmet>", src, re.S).group(1).strip()
    body = re.search(r"</helmet>(.*?)</x-dc>", src, re.S).group(1).strip()
    flow = dict(NAV, **FLOWS.get(name, {}))
    runtime = (RUNTIME.replace("__FLOW__", json.dumps(flow, ensure_ascii=False)).replace("__PAGE__", json.dumps(name))
               .replace("__THEME__", json.dumps(theme)).replace("__PAGES__", json.dumps(names, ensure_ascii=False)))
    title = re.sub(r"^[CD] · ", "", b.get("title", name))
    with open(os.path.join(OUT, f"{name}-{theme}.html"), "w") as f:
        f.write(f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
                f'<title>{html.escape(title)} · Form Up prototype</title>\n{helmet}\n{runtime}\n</head>\n<body>\n{body}\n</body>\n</html>\n')
    count += 1

with open(os.path.join(OUT, "index.html"), "w") as f:
    f.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Form Up prototype</title>'
            '<meta http-equiv="refresh" content="0; url=PageHome-light.html"></head><body><a href="PageHome-light.html">Open the prototype</a></body></html>\n')
missing = sorted({t for fl in FLOWS.values() for t in fl.values()} - {n for n, _ in names})
print(count, "interactive screens; unknown targets:", missing)
