// ── HELPERS ──────────────────────────────────────────────────────────────────
function getFood(name){return FOODS_DB.find(function(f){return f.name===name;})||{name:name,kcal:100,p:5,c:10,f:3};}
function calcFood(name,amt){var f=getFood(name);var r=amt/100;return{kcal:Math.round(f.kcal*r),p:Math.round(f.p*r*10)/10,c:Math.round(f.c*r*10)/10,f:Math.round(f.f*r*10)/10};}
function calcMeal(meal){var t={kcal:0,p:0,c:0,f:0};meal.foods.forEach(function(fd){var n=calcFood(fd.name,fd.amt);t.kcal+=n.kcal;t.p+=n.p;t.c+=n.c;t.f+=n.f;});return{kcal:t.kcal,p:Math.round(t.p*10)/10,c:Math.round(t.c*10)/10,f:Math.round(t.f*10)/10};}
function calcDay(wi,di){wi=wi!==undefined?wi:NUTRITION.currentWeek;di=di!==undefined?di:NUTRITION.currentDay;var t={kcal:0,p:0,c:0,f:0};NUTRITION.weeks[wi].days[di].meals.forEach(function(m){var n=calcMeal(m);t.kcal+=n.kcal;t.p+=n.p;t.c+=n.c;t.f+=n.f;});return{kcal:t.kcal,p:Math.round(t.p*10)/10,c:Math.round(t.c*10)/10,f:Math.round(t.f*10)/10};}
function pct(v,max){return Math.min(100,Math.round(v/max*100));}
function currentMeals(){return NUTRITION.weeks[NUTRITION.currentWeek].days[NUTRITION.currentDay].meals;}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function buildSidebar(containerId, activeScreen){
  var els=document.querySelectorAll('[id="'+containerId+'"]'); if(!els.length) return;
  var html='<div class="sb-ws"><div class="sb-ws-icon">GF</div><div class="sb-ws-name">GoodFellas</div><div class="sb-ws-chev">⌄</div></div>';
  html+='<div class="sb-div"></div>';
  html+='<div class="sb-sec"><div class="sb-item'+(activeScreen==='s-dashboard'?' active':'')+'" onclick="showScreen(\'s-dashboard\')"><span class="sbi-icon">⊞</span><span class="sbi-lbl">Dashboard</span></div>';
  html+='<div class="sb-item'+(activeScreen==='s-profile'?' active':'')+'" onclick="showScreen(\'s-profile\')"><span class="sbi-icon">👤</span><span class="sbi-lbl">Profil</span></div>';
  html+='<div class="sb-item'+(activeScreen==='s-messages'?' active':'')+'" onclick="showScreen(\'s-messages\')"><span class="sbi-icon">✉</span><span class="sbi-lbl">Zprávy</span><span class="sbi-badge">1</span></div></div>';
  html+='<div class="sb-div"></div><div class="sb-sec"><div class="sb-sec-lbl">Klienti</div>';
  var clientScreens=['s-client','s-training','s-training-session-builder','s-training-form-fix','s-nutrition','s-goals','s-client-photos','s-settings-checkins'];
  CLIENTS.forEach(function(cl){
    var isCl=clientScreens.indexOf(activeScreen)!==-1&&cl.id===1;
    html+='<div class="sb-item'+(isCl?' active':'')+'" onclick="showScreen(\'s-client\')"><span class="sbi-icon">👤</span><span class="sbi-lbl">'+cl.name+'</span><div class="sb-acts"><span>···</span></div></div>';
    if(isCl){
      html+='<div class="sb-item indent'+((activeScreen==='s-training'||activeScreen==='s-training-session-builder')?' active':'')+'" onclick="showScreen(\'s-training-session-builder\')"><span class="sbi-icon">🏋️</span><span class="sbi-lbl">Trén. plán</span></div>';
      html+='<div class="sb-item indent'+(activeScreen==='s-nutrition'?' active':'')+'" onclick="showScreen(\'s-nutrition\')"><span class="sbi-icon">🥗</span><span class="sbi-lbl">Jídelníček</span></div>';
      html+='<div class="sb-item indent'+(activeScreen==='s-goals'?' active':'')+'" onclick="showScreen(\'s-goals\')"><span class="sbi-icon">🎯</span><span class="sbi-lbl">Cíle a makra</span></div>';
    }
  });
  html+='<div class="sb-item" onclick="openDialog(\'dlg-new-client\')" style="color:var(--t3)"><span class="sbi-icon">+</span><span class="sbi-lbl">Přidat klienta</span></div></div>';
  html+='<div class="sb-div"></div><div class="sb-sec"><div class="sb-sec-lbl">Databáze</div>';
  html+='<div class="sb-item'+(activeScreen==='s-foods'?' active':'')+'" onclick="showScreen(\'s-foods\')"><span class="sbi-icon">📦</span><span class="sbi-lbl">Potraviny</span></div>';
  html+='<div class="sb-item'+(activeScreen==='s-recipes'?' active':'')+'" onclick="showScreen(\'s-recipes\')"><span class="sbi-icon">📖</span><span class="sbi-lbl">Recepty</span></div>';
  html+='<div class="sb-item'+(activeScreen==='s-training-section-templates'?' active':'')+'" onclick="showScreen(\'s-training-section-templates\')"><span class="sbi-icon">📚</span><span class="sbi-lbl">Šablony sekcí</span></div>';
  html+='<div class="sb-item'+(activeScreen==='s-training-section-types'?' active':'')+'" onclick="showScreen(\'s-training-section-types\')"><span class="sbi-icon">📑</span><span class="sbi-lbl">Typy sekcí</span></div></div>';
  html+='<div class="sb-user"><div class="sb-avatar">MT</div><div><div style="font-size:13px;font-weight:500">Marek Trenér</div><div style="font-size:11px;color:var(--t3)">Trenér & výživa</div></div></div>';
  els.forEach(function(el){el.innerHTML=html;});
}

// ── SCREEN SWITCHING ──────────────────────────────────────────────────────────
var _nutrInit=false;
function showScreen(id){
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('.tn-btn').forEach(function(b){b.classList.remove('active');});
  var el=document.getElementById(id); if(el) el.classList.add('active');
  document.querySelectorAll('.tn-btn').forEach(function(b){if(b.getAttribute('onclick')==="showScreen('"+id+"')") b.classList.add('active');});
  window.scrollTo(0,0);
  // Build sidebars
  var sbMap={'s-dashboard':'sb-dashboard','s-client':'sb-client','s-training':'sb-training','s-training-session-builder':'sb-training','s-training-section-templates':'sb-training','s-training-section-types':'sb-training','s-training-form-fix':'sb-training','s-messages':'sb-messages','s-nutrition':'sb-nutrition','s-foods':'sb-foods','s-goals':'sb-goals','s-settings-checkins':'sb-settings-checkins','s-client-photos':'sb-client-photos','s-profile':'sb-profile','s-recipes':'sb-recipes'};
  if(sbMap[id]) buildSidebar(sbMap[id],id);
  // Init nutrition editor
  if(id==='s-nutrition'&&!_nutrInit){_nutrInit=true;initNutrition();}
  if(id==='s-nutrition'){renderNutrWeekTabs();renderNutrDayTabs();renderNutrMeals();updateNutrSidebar();}
  if(id==='s-training'){renderTrainingExercises();}
  if(id==='s-messages'){renderMessages();}
  if(id==='s-foods'){renderFoods();}
  if(id==='s-recipes'){renderRecipesGrid();}
  if(id==='s-training-section-templates'){renderSectionTemplates();}
  if(id==='s-dashboard'){renderDashboard();}
}

// ── DARK MODE ─────────────────────────────────────────────────────────────────
function toggleDark(){
  document.body.classList.toggle('dark');
  document.getElementById('dark-btn').textContent=document.body.classList.contains('dark')?'☀':'☾';
}

// ── DIALOGS ───────────────────────────────────────────────────────────────────
function openDialog(id){
  document.getElementById(id).classList.add('open');
  if(id==='dlg-add-food-to-plan') renderPlanFoodSearch('');
  if(id==='dlg-add-meal') renderRecipeSearch('');
  if(id==='dlg-add-exercise') renderExerciseSearch('');
  if(id==='dlg-shopping-list') renderShoppingList();
}
function closeDialog(id){document.getElementById(id).classList.remove('open');}
function closeOnOverlay(e,id){if(e.target===document.getElementById(id)) closeDialog(id);}

// ── TOAST ─────────────────────────────────────────────────────────────────────
var _toastTimer;
function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg; t.style.opacity='1';
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(function(){t.style.opacity='0';},2200);
}



// ── DEEP-LINK BOOT ────────────────────────────────────────────────────────────
// Reads `?scene=<id>` from window.location on first load and navigates to that
// screen (e.g. `?scene=s-dashboard`). Enables stable URLs for Notion embeds.
(function bootSceneFromUrl(){
  function apply(){
    var params = new URLSearchParams(window.location.search);
    var scene = params.get("scene");
    if(!scene) return;
    try { showScreen(scene); } catch(e){ /* unknown scene id — ignore */ }
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
