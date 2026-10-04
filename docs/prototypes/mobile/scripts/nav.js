
var _hasTrainer = true;
var _collabState = 'trainer';
var _dark = false;

function toggleNavGroup(btn){
  var items = btn.parentElement.querySelector('.pnav-items');
  if(!items) return;
  var isOpen = items.classList.contains('open');
  // Close all groups first
  document.querySelectorAll('.pnav-items').forEach(function(el){ el.classList.remove('open'); });
  // Toggle the clicked one
  if(!isOpen) items.classList.add('open');
}

function showPhone(id){
  document.querySelectorAll('.phone').forEach(function(p){ p.style.display='none'; });
  var el = document.getElementById(id); if(el) el.style.display='block';
  document.querySelectorAll('.pb').forEach(function(b){ b.classList.remove('active'); });
  var map = {'ph-today':'Dnes','ph-invite-detail':'Detail pozvánky','ph-discover':'Spolupráce','ph-trainer-profile':'Profil trenéra','ph-plans':'Plány (původní)','ph-plans-sched':'Plány — 1 plán','ph-plans-two':'Plány — 2 plány','ph-plan-history':'Archiv plánů','ph-plan-detail-complete':'Dokončený plán','ph-nutrition-plan-detail':'Detail výživového plánu','ph-training-plan-detail':'Detail tréninku','ph-session-lock':'Zámek sekce','ph-food-detail':'Detail potraviny','ph-recipe-detail':'Detail receptu','ph-pending-questionnaires':'Čekající dotazníky','ph-weekly-checkin':'Check-in — vyplnit','ph-weekly-checkin-sent':'Check-in — odesláno','ph-profile':'Profil','ph-messages':'Zprávy','ph-archive':'Archiv','ph-chat':'Chat detail','ph-chat-former':'Chat — bývalý trenér','ph-live-training':'Živý trénink','ph-live-amrap':'Živý AMRAP','ph-live-emom':'Živý EMOM','ph-live-tabata':'Živá Tabata','ph-live-fortime':'Živý ForTime','ph-live-time-distance':'Živý Čas/Distance','ph-live-results-summary':'Výsledky tréninku','ph-live-session-runner':'Living session · runner','ph-diary-request':'Žádost','ph-diary-dismiss':'Odmítnutí','ph-diary-accept-wizard':'Výběr způsobu','ph-diary-bulk':'Hromadné nahrání','ph-diary-workflow':'Aktivní workflow','ph-diary-finalize':'Dokončení','ph-meal-log-photo':'Log jídla · foto','ph-plan-photos':'Fotky plánu','ph-profile-photos':'Timeline fotek','ph-hydration-setup':'Pitný režim · nastavení'};
  document.querySelectorAll('.pb').forEach(function(b){
    if(b.textContent.trim() === map[id]) b.classList.add('active');
  });
}

var _collabState = 'none'; // none | trainer | coach | both

function resetTrainingStatCard() {
  var card = document.getElementById('today-training-stat-card');
  if (card) {
    card.innerHTML =
      '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Trénink</div>' +
      '<div style="font-size:22px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px">2 tréninky</div>' +
      '<div style="font-size:11px;color:var(--ios-label3);margin-top:1px">7 cviků · 95 min</div>' +
      '<div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;background:rgba(52,199,89,.12);border-radius:99px;padding:2px 8px">' +
        '<div style="width:5px;height:5px;border-radius:50%;background:var(--ios-green)"></div>' +
        '<span style="font-size:11px;font-weight:600;color:var(--ios-green)"><span class="tp-stat-done">2</span>/<span class="tp-stat-total">7</span> hotovo</span>' +
      '</div>';
  }
}

function setCollabState(state) {
  _collabState = state;
  var hasTrainer = state === 'trainer' || state === 'both' || state === 'plan-pending';
  var hasCoach   = state === 'coach'   || state === 'both';
  var hasAny     = hasTrainer || hasCoach;
  var isPlanPending = state === 'plan-pending';

  // Today screen
  var ht = document.getElementById('today-has-trainer');
  var nt = document.getElementById('today-no-trainer');
  var pp = document.getElementById('today-plan-pending');
  var tw = document.getElementById('today-waiting');
  var ic = document.getElementById('invite-card-wrap');
  if(ht) ht.style.display = (hasAny || isPlanPending) ? '' : 'none';
  if(nt) nt.style.display = (!hasAny && !isPlanPending) ? '' : 'none';
  if(pp) pp.style.display = 'none'; /* plan-pending banners now render inside has-trainer */
  if(tw) tw.style.display = 'none';
  if(!isPlanPending) {
    var banners = document.getElementById('pending-banners');
    if (banners) banners.innerHTML = '';
    var inlineBanners = document.getElementById('today-pending-banners-inline');
    if (inlineBanners) inlineBanners.innerHTML = '';
    resetTrainingStatCard();
  }
  if(ic) ic.style.display = (hasAny || isPlanPending) ? 'none' : '';

  /* Show/hide today's training and nutrition blocks based on which
     professional the client is linked to. Trainer-only hides nutrition;
     coach-only hides training; both shows both. */
  var trainingBlock  = document.getElementById('today-training-block');
  var nutritionBlock = document.getElementById('today-nutrition-block');
  var trainingStat   = document.getElementById('today-training-stat-card');
  var nutritionStat  = document.getElementById('today-nutrition-stat-card');
  if(trainingBlock)  trainingBlock.style.display  = hasTrainer ? '' : 'none';
  if(nutritionBlock) nutritionBlock.style.display = hasCoach   ? '' : 'none';
  /* Swap the middle stat tile: training-stat for trainer roles, kcal for
     coach-only, training-stat for both (training is the primary KPI). */
  if(trainingStat)  trainingStat.style.display  = hasTrainer ? '' : 'none';
  if(nutritionStat) nutritionStat.style.display = (hasCoach && !hasTrainer) ? '' : 'none';
  // When the drinking-regimen feature is on, the hydration card owns the middle
  // stat slot — re-apply that override on top of the role-based tile choice.
  if(typeof applyHydrationStatSlot === 'function') applyHydrationStatSlot();

  // Spolupráce — configure the tab switcher (Trenér / Poradce / Hledat).
  // Enablement rules: own pro's tab is enabled; the missing pro's tab is
  // disabled; Hledat is disabled only once the client has both.
  var enable = { trainer: hasTrainer, coach: hasCoach, search: !(hasTrainer && hasCoach) };
  ['trainer','coach','search'].forEach(function(t) {
    var seg = document.getElementById('seg-tab-' + t);
    if(seg) seg.classList.toggle('disabled', !enable[t]);
  });
  // Land on the client's own pro first; fall back to Hledat when they have none.
  selectCollabTab(hasTrainer ? 'trainer' : (hasCoach ? 'coach' : 'search'));

  // Nav bar buttons
  ['none','pending','trainer','coach','both'].forEach(function(s) {
    var btn = document.getElementById('btn-state-' + s);
    if(btn) btn.classList.toggle('active', s === state);
  });
}

// Switch the Spolupráce tab. No-op for disabled tabs (e.g. the missing
// pro, or Hledat once the client has both a trainer and a coach).
function selectCollabTab(tab) {
  var seg = document.getElementById('seg-tab-' + tab);
  if(seg && seg.classList.contains('disabled')) return;
  ['trainer','coach','search'].forEach(function(t) {
    var s = document.getElementById('seg-tab-' + t);
    if(s) s.classList.toggle('active', t === tab);
    var pane = document.getElementById('collab-tab-' + t);
    if(pane) pane.style.display = t === tab ? '' : 'none';
  });
}

// Switch the Plány page Trénink / Výživa pane (only present when the client
// has both a training and a nutrition plan active at once).
function selectPlanTab(tab) {
  ['training','nutrition'].forEach(function(t) {
    var seg = document.getElementById('plantab-seg-' + t);
    if(seg) seg.classList.toggle('active', t === tab);
    var pane = document.getElementById('plantab-' + t);
    if(pane) pane.style.display = t === tab ? '' : 'none';
  });
  // Sync in-card toggles (the switch merged into the navy hero card)
  document.querySelectorAll('[data-plantab]').forEach(function(el) {
    el.classList.toggle('active', el.getAttribute('data-plantab') === tab);
  });
}

// Keep backward compat
function setHasTrainer(v) { setCollabState(v ? 'trainer' : 'none'); }

function setPendingPlans(which) {
  setCollabState('plan-pending');

  var hasT = which === 'training' || which === 'both';
  var hasN = which === 'nutrition' || which === 'both';

  /* ---- BANNERS ---- */
  var plans = [];
  if (hasT) plans.push({
    type: 'Tréninkový plán', emoji: '🏋️', name: 'Silový A/B',
    trainer: 'Marek Trenér', detail: '4× týdně · 12 týdnů',
    tags: ['Hrudník','Záda','Nohy'], start: '14. dubna 2026',
    accent: '#c9a84c', bg: 'rgba(201,168,76,.08)', border: 'rgba(201,168,76,.22)', bgTag: 'rgba(201,168,76,.18)'
  });
  if (hasN) plans.push({
    type: 'Výživový plán', emoji: '🥗', name: 'Duben / Květen',
    trainer: 'Lucie Poradce', detail: '1 700 kcal · 12 týdnů',
    tags: ['Bez laktózy','High protein'], start: '14. dubna 2026',
    accent: '#34c759', bg: 'rgba(52,199,89,.07)', border: 'rgba(52,199,89,.22)', bgTag: 'rgba(52,199,89,.15)'
  });

  /* Inject banners into the inline container inside today-has-trainer */
  var inlineContainer = document.getElementById('today-pending-banners-inline');
  /* Also clear the old container in #today-plan-pending so no stale content lingers */
  var oldContainer = document.getElementById('pending-banners');
  if (oldContainer) oldContainer.innerHTML = '';

  if (inlineContainer) {
    inlineContainer.innerHTML = '';
    var calIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
    plans.forEach(function(p) {
      var tagsHtml = p.tags.map(function(t) {
        return '<span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:99px;background:rgba(0,0,0,.06);color:var(--ios-label2)">' + t + '</span>';
      }).join('');
      var div = document.createElement('div');
      div.style.cssText = 'background:' + p.bg + ';border:1px solid ' + p.border + ';border-radius:var(--ios-r-lg);padding:16px';
      div.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
          '<div style="display:flex;align-items:center;gap:7px">' +
            '<div style="width:28px;height:28px;border-radius:8px;background:' + p.bgTag + ';display:flex;align-items:center;justify-content:center;font-size:15px">' + p.emoji + '</div>' +
            '<span style="font-size:12px;font-weight:600;color:var(--ios-label2);text-transform:uppercase;letter-spacing:.05em">' + p.type + '</span>' +
          '</div>' +
          '<span style="font-size:12px;font-weight:500;padding:3px 9px;border-radius:99px;background:rgba(255,149,0,.1);color:#ff9500">Začíná ' + p.start + '</span>' +
        '</div>' +
        '<div style="font-size:20px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px;margin-bottom:3px">' + p.name + '</div>' +
        '<div style="font-size:13px;color:var(--ios-label2);margin-bottom:10px">' + p.trainer + ' · ' + p.detail + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">' + tagsHtml + '</div>' +
        '<div style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:99px;background:' + p.accent + ';color:#fff;font-size:13px;font-weight:600;cursor:pointer" onclick="showPhone(\'ph-plans\')">' + calIcon + 'Zobrazit plán</div>';
      inlineContainer.appendChild(div);
    });
  }

  /* ---- TRAINING STAT CARD — show start date instead of session name ---- */
  if (hasT) {
    var trainingCard = document.getElementById('today-training-stat-card');
    if (trainingCard) {
      trainingCard.innerHTML =
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Trénink</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px">14. 4.</div>' +
        '<div style="font-size:11px;color:var(--ios-label3);margin-top:1px">začíná</div>';
    }
  }

  /* ---- EXTRA CONTENT (renders into #pending-extra inside the now-hidden
     #today-plan-pending; kept for data parity but not surfaced in the
     has-trainer view — can be cut entirely later) ---- */
  var extra = document.getElementById('pending-extra');
  if (!extra) { _finishPendingNav(which); return; }
  extra.innerHTML = '';

  /* Weekly schedule */
  if (hasT) {
    var days = [
      { lbl:'Po', chips:[{n:'Push A',bg:'rgba(11,110,153,.1)',c:'#0b6e99'},{n:'Kardió',bg:'rgba(15,123,108,.1)',c:'#0f7b6c'}], dur:'60 min' },
      { lbl:'Út', chips:[{n:'Pull A',bg:'rgba(15,123,108,.1)',c:'#0f7b6c'}], dur:'50 min' },
      { lbl:'St',  chips:[], dur:'' },
      { lbl:'Čt', chips:[{n:'Legs A',bg:'rgba(173,87,0,.1)',c:'#ad5700'}], dur:'55 min' },
      { lbl:'Pá', chips:[{n:'Push B',bg:'rgba(11,110,153,.1)',c:'#0b6e99'},{n:'Core',bg:'rgba(192,57,43,.1)',c:'#c0392b'}], dur:'50 min' },
      { lbl:'So',  chips:[], dur:'' },
      { lbl:'Ne',  chips:[{n:'Pull B',bg:'rgba(15,123,108,.1)',c:'#0f7b6c'}], dur:'50 min' }
    ];
    var rowsHtml = days.map(function(d, i) {
      var br = i < days.length-1 ? 'border-bottom:.5px solid var(--ios-sep2)' : '';
      var mid = d.chips.length === 0
        ? '<span style="font-size:12px;font-style:italic;color:var(--ios-label3)">Odpočinek</span>'
        : d.chips.map(function(ch) {
            return '<span style="font-size:12px;font-weight:600;padding:4px 10px;border-radius:99px;background:' + ch.bg + ';color:' + ch.c + '">' + ch.n + '</span>';
          }).join('');
      return '<div style="display:flex;align-items:center;gap:12px;padding:11px 16px;' + br + '">' +
        '<div style="width:28px;font-size:13px;font-weight:600;color:var(--ios-label3);flex-shrink:0">' + d.lbl + '</div>' +
        '<div style="flex:1;display:flex;gap:6px;flex-wrap:wrap">' + mid + '</div>' +
        (d.dur ? '<div style="font-size:11px;color:var(--ios-label3)">' + d.dur + '</div>' : '') +
        '</div>';
    }).join('');
    var sec = document.createElement('div');
    sec.innerHTML =
      '<div class="ios-section-hdr" style="margin-top:20px"><div class="ios-section-title">Týdenní rozvrh</div></div>' +
      '<div style="margin:0 20px 24px;background:var(--ios-bg2);border-radius:var(--ios-r-lg);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">' + rowsHtml + '</div>';
    extra.appendChild(sec);
  }

  /* Daily meal structure */
  if (hasN) {
    var meals = [
      { icon:'🌅', name:'Snídaně',  time:'7:00',  kcal:'450 kcal', note:'Vejce, ověsená kaše, ovoce',    p:'28g', c:'52g', f:'14g' },
      { icon:'🍎', name:'Svačina',    time:'10:30', kcal:'200 kcal', note:'Tvaroh, ovoce',                   p:'18g', c:'20g', f:'4g'  },
      { icon:'🌞', name:'Oběd',      time:'13:00', kcal:'550 kcal', note:'Kuřecí, rýže, zelenina',     p:'42g', c:'58g', f:'12g' },
      { icon:'🌰', name:'Svačina',    time:'16:30', kcal:'180 kcal', note:'Protein shake',                   p:'25g', c:'10g', f:'5g'  },
      { icon:'🌙', name:'Večeře',    time:'19:00', kcal:'320 kcal', note:'Losos, brambory, salát',       p:'35g', c:'28g', f:'10g' }
    ];
    var mHtml = meals.map(function(m, i) {
      var br = i < meals.length-1 ? 'border-bottom:.5px solid var(--ios-sep2)' : '';
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;' + br + '">' +
        '<div style="width:34px;height:34px;border-radius:11px;background:rgba(52,199,89,.08);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">' + m.icon + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">' +
            '<div style="font-size:15px;font-weight:600;color:var(--ios-label)">' + m.name + '</div>' +
            '<div style="font-size:12px;color:var(--ios-label3)">' + m.time + '</div>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--ios-label2);margin-bottom:4px">' + m.note + '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<span style="font-size:11px;font-weight:600;color:#007aff">B ' + m.p + '</span>' +
            '<span style="font-size:11px;font-weight:600;color:#ff9500">S ' + m.c + '</span>' +
            '<span style="font-size:11px;font-weight:600;color:#af52de">T ' + m.f + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:13px;font-weight:600;color:var(--ios-label);flex-shrink:0">' + m.kcal + '</div>' +
      '</div>';
    }).join('');
    var mTop = hasT ? '4px' : '20px';
    var mSec = document.createElement('div');
    mSec.innerHTML =
      '<div class="ios-section-hdr" style="margin-top:' + mTop + '"><div class="ios-section-title">Denní struktura jídel</div></div>' +
      '<div style="margin:0 20px 24px;background:var(--ios-bg2);border-radius:var(--ios-r-lg);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        mHtml +
        '<div style="padding:10px 16px;border-top:.5px solid var(--ios-sep2);background:rgba(120,120,128,.06);display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-size:12px;font-weight:600;color:var(--ios-label2)">Celkem</span>' +
          '<div style="display:flex;gap:10px">' +
            '<span style="font-size:12px;font-weight:600;color:#007aff">B 148g</span>' +
            '<span style="font-size:12px;font-weight:600;color:#ff9500">S 168g</span>' +
            '<span style="font-size:12px;font-weight:600;color:#af52de">T 45g</span>' +
            '<span style="font-size:13px;font-weight:700;color:var(--ios-label)">1 700 kcal</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    extra.appendChild(mSec);
  }

  /* Prep tips */
  var tips = hasT && !hasN ? [
    { icon:'💧', bg:'rgba(0,122,255,.1)',  title:'Hydratace',    text:'Zaměř se na 2–3 l vody denně. Dobře hydratované svaly se lépe regenerují.' },
    { icon:'😴', bg:'rgba(255,149,0,.1)',  title:'Spánek',      text:'7–9 hodin spánku je základ. Svaly rostou a regenerují hlavně v noci.' },
    { icon:'🥩', bg:'rgba(52,199,89,.1)',  title:'Bílkoviny',    text:'Tvůj plán počítá s 130 g bílkovin denně. Začni se připravovat ještě před startem.' },
    { icon:'🎒', bg:'rgba(175,82,222,.1)', title:'Výbava',       text:'Připrav si sportovní oblečení, láhev na vodu a pohodlnou obuv.' }
  ] : !hasT && hasN ? [
    { icon:'💧', bg:'rgba(0,122,255,.1)',  title:'Hydratace',    text:'Pij alespoň 2 l vody denně — pomáhá trávení a využití živin z jídla.' },
    { icon:'🛒', bg:'rgba(255,149,0,.1)',  title:'Nákupy',       text:'Připrav si surovinář na první týden. Jde to lépe, když máš vše předem.' },
    { icon:'⌚',     bg:'rgba(52,199,89,.1)',  title:'Pravidelnost',  text:'Jídej v podobných časech každý den — tělo si na rytmus rychle zvykne.' },
    { icon:'🥩', bg:'rgba(175,82,222,.1)', title:'Bílkoviny',    text:'Vejce, tvaroh, kuřecí prso, ryby — to jsou tvůj základ pro každý den.' }
  ] : [
    { icon:'💧', bg:'rgba(0,122,255,.1)',  title:'Hydratace',    text:'2–3 l vody denně — základ pro trénink i správnou výživu.' },
    { icon:'😴', bg:'rgba(255,149,0,.1)',  title:'Spánek',      text:'7–9 hodin je minimum. Svaly rostou a výživa se vstřebává hlavně v noci.' },
    { icon:'🥩', bg:'rgba(52,199,89,.1)',  title:'Bílkoviny',    text:'Jídelníček máš připravený — začni žít přesně tak jak je navržen.' },
    { icon:'🎒', bg:'rgba(175,82,222,.1)', title:'Příprava',    text:'Sportovní výbava + nákup na první týden jídelníčku — udělej to dnes.' }
  ];

  var tipsHtml = tips.map(function(t) {
    return '<div style="background:var(--ios-bg2);border-radius:var(--ios-r);padding:14px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
      '<div style="width:38px;height:38px;border-radius:12px;background:' + t.bg + ';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">' + t.icon + '</div>' +
      '<div style="flex:1"><div style="font-size:15px;font-weight:600;color:var(--ios-label);margin-bottom:2px">' + t.title + '</div>' +
      '<div style="font-size:13px;color:var(--ios-label2);line-height:1.4">' + t.text + '</div></div>' +
    '</div>';
  }).join('');
  var tSec = document.createElement('div');
  tSec.innerHTML =
    '<div class="ios-section-hdr"><div class="ios-section-title">Příprava na start</div></div>' +
    '<div style="margin:0 20px 24px;display:flex;flex-direction:column;gap:10px">' + tipsHtml + '</div>';
  extra.appendChild(tSec);

  _finishPendingNav(which);
}

function _finishPendingNav(which) {
  ['btn-state-pending-t','btn-state-pending-n','btn-state-pending-tn'].forEach(function(id) {
    var b = document.getElementById(id); if (b) b.classList.remove('active');
  });
  var btnMap = { training: 'btn-state-pending-t', nutrition: 'btn-state-pending-n', both: 'btn-state-pending-tn' };
  var ab = document.getElementById(btnMap[which]); if (ab) ab.classList.add('active');
}

// which: 'nutrition' | 'training' | 'both' | 'has-training' | 'has-nutrition'
function setWaitingState(which) {
  _collabState = 'waiting';
  var ht = document.getElementById('today-has-trainer');
  var nt = document.getElementById('today-no-trainer');
  var pp = document.getElementById('today-plan-pending');
  var tw = document.getElementById('today-waiting');
  var ic = document.getElementById('invite-card-wrap');
  if(ht) ht.style.display = 'none';
  if(nt) nt.style.display = 'none';
  if(pp) pp.style.display = 'none';
  if(tw) tw.style.display = '';
  if(ic) ic.style.display = 'none';
  var banners = document.getElementById('pending-banners');
  if (banners) banners.innerHTML = '';

  // nav buttons
  ['btn-state-none','btn-state-trainer','btn-state-coach','btn-state-both','btn-state-pending-t','btn-state-pending-n','btn-state-pending-tn','btn-wait-n','btn-wait-t','btn-wait-tn','btn-wait-ht','btn-wait-hn'].forEach(function(id) {
    var b = document.getElementById(id); if(b) b.classList.remove('active');
  });
  var btnMap = { nutrition:'btn-wait-n', training:'btn-wait-t', both:'btn-wait-tn', 'has-training':'btn-wait-ht', 'has-nutrition':'btn-wait-hn' };
  var ab = document.getElementById(btnMap[which]); if(ab) ab.classList.add('active');

  var hasActivePlan = which === 'has-training' || which === 'has-nutrition';
  var waitingForNutrition = which === 'nutrition' || which === 'both' || which === 'has-training';
  var waitingForTraining  = which === 'training'  || which === 'both' || which === 'has-nutrition';

  var html = '';

  /* ── Stats strip ── */
  if (!hasActivePlan) {
    html += '<div style="margin:12px 20px;display:flex;gap:10px">' +
      '<div style="flex:1;background:var(--ios-bg2);border-radius:var(--ios-r);padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Kalorie</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px">0</div>' +
        '<div style="height:4px;background:var(--ios-fill);border-radius:99px;margin-top:8px;overflow:hidden"><div style="width:0%;height:100%;background:var(--ios-gold);border-radius:99px"></div></div>' +
      '</div>' +
      '<div style="flex:1;background:var(--ios-bg2);border-radius:var(--ios-r);padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Trénink</div>' +
        '<div style="font-size:16px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px;margin-top:2px">Den odpočinku</div>' +
      '</div>' +
      '<div style="flex:1;background:var(--ios-bg2);border-radius:var(--ios-r);padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">\uD83D\uDD25 Série</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--ios-orange);letter-spacing:-.3px">0</div>' +
        '<div style="font-size:11px;color:var(--ios-label3);margin-top:1px">dní v řadě</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Active training card (for has-training) ── */
  if (which === 'has-training') {
    html += '<div style="margin:12px 20px;display:flex;gap:10px">' +
      '<div style="flex:1;background:var(--ios-bg2);border-radius:var(--ios-r);padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Kalorie</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px">0</div>' +
        '<div style="font-size:11px;color:var(--ios-label3);margin-top:1px">/ ? kcal</div>' +
        '<div style="height:4px;background:var(--ios-fill);border-radius:99px;margin-top:6px;overflow:hidden"><div style="width:0%;height:100%;background:var(--ios-gold);border-radius:99px"></div></div>' +
      '</div>' +
      '<div style="flex:1;background:var(--ios-bg2);border-radius:var(--ios-r);padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Trénink</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px">Push A</div>' +
        '<div style="font-size:11px;color:var(--ios-label3);margin-top:1px">5 cviků · 60 min</div>' +
        '<div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;background:rgba(52,199,89,.12);border-radius:99px;padding:2px 8px">' +
          '<div style="width:5px;height:5px;border-radius:50%;background:var(--ios-green)"></div>' +
          '<span style="font-size:11px;font-weight:600;color:var(--ios-green)">Čeká</span>' +
        '</div>' +
      '</div>' +
      '<div style="flex:1;background:var(--ios-bg2);border-radius:var(--ios-r);padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Streak</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--ios-orange);letter-spacing:-.3px">5</div>' +
        '<div style="font-size:11px;color:var(--ios-label3);margin-top:1px">dní v řadě</div>' +
        '<div style="font-size:18px;margin-top:4px">\uD83D\uDD25</div>' +
      '</div>' +
    '</div>';
    // Training card
    html += '<div class="ios-section-hdr"><div class="ios-section-title">Dnešní trénink</div><div style="display:flex;gap:14px;align-items:center"><span class="ios-section-action" style="display:inline-flex;align-items:center;gap:4px;color:var(--ios-gold)" onclick="showPhone(\'ph-plan-photos\')">📷 Foto</span><span class="ios-section-action">Detail</span></div></div>' +
    '<div class="ios-card"><div class="ios-card-hero grad-push" style="display:flex;align-items:center;padding:20px">' +
      '<div>' +
        '<div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Silový A/B · Týden 3</div>' +
        '<div style="font-size:26px;font-weight:700;color:#fff;letter-spacing:-.3px">Push A</div>' +
        '<div style="font-size:14px;color:rgba(255,255,255,.7);margin-top:4px">5 cviků · 60 min · odpočinek 90s</div>' +
        '<div style="display:flex;gap:6px;margin-top:10px">' +
          '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;background:rgba(201,168,76,.2);color:#c9a84c">Hrudník</span>' +
          '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;background:rgba(175,82,222,.2);color:#af52de">Ramena</span>' +
          '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;background:rgba(255,149,0,.2);color:#ff9500">Paže</span>' +
        '</div>' +
      '</div>' +
      '<div style="margin-left:auto;flex-shrink:0"><div class="prog-ring"><svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="5"/><circle cx="28" cy="28" r="23" fill="none" stroke="#c9a84c" stroke-width="5" stroke-dasharray="144" stroke-dashoffset="144" stroke-linecap="round"/></svg><div class="prog-ring-label" style="color:#fff;font-size:12px">0/5</div></div></div>' +
    '</div><div style="background:var(--ios-bg2);padding:12px 16px"><div class="ios-btn ios-btn-primary" style="font-size:15px;padding:12px">Začít trénink</div></div></div>';
  }

  /* ── Active nutrition card (for has-nutrition) ── */
  if (which === 'has-nutrition') {
    html += '<div style="margin:12px 20px;display:flex;gap:10px">' +
      '<div style="flex:1;background:var(--ios-bg2);border-radius:var(--ios-r);padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Kalorie</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px">431</div>' +
        '<div style="font-size:11px;color:var(--ios-label3);margin-top:1px">/ 1 700 kcal</div>' +
        '<div style="height:4px;background:var(--ios-fill);border-radius:99px;margin-top:6px;overflow:hidden"><div style="width:25%;height:100%;background:var(--ios-gold);border-radius:99px"></div></div>' +
      '</div>' +
      '<div style="flex:1;background:var(--ios-bg2);border-radius:var(--ios-r);padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Trénink</div>' +
        '<div style="font-size:16px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px;margin-top:2px">Den odpočinku</div>' +
      '</div>' +
      '<div style="flex:1;background:var(--ios-bg2);border-radius:var(--ios-r);padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
        '<div style="font-size:11px;color:var(--ios-label2);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Streak</div>' +
        '<div style="font-size:22px;font-weight:700;color:var(--ios-orange);letter-spacing:-.3px">3</div>' +
        '<div style="font-size:11px;color:var(--ios-label3);margin-top:1px">dní v řadě</div>' +
        '<div style="font-size:18px;margin-top:4px">\uD83D\uDD25</div>' +
      '</div>' +
    '</div>';
    // Nutrition card — training-card style with hero, expandable meal rows, mark-all button
    var hnMeals = [
      {
        dot:'#ff9500', name:'Sn\u00EDdan\u011B', sub:'08:00 \u00B7 431 kcal \u00B7 3 polo\u017Eky', eaten:true,
        ingredients:[
          { name:'Ovesn\u00E1 ka\u0161e s proteinem', cat:'Obiloviny \u00B7 110 g', kcal:'291 kcal', note:'Pou\u017Eij jemn\u00E9 vlo\u010Dky, neva\u0159 d\u00E9le ne\u017E 5 min.' },
          { name:'Ban\u00E1n', cat:'Ovoce \u00B7 120 g', kcal:'105 kcal', note:'Vyber zralej\u0161\u00ED \u2014 l\u00E9pe se vst\u0159eb\u00E1v\u00E1.' },
          { name:'Bor\u016Fvky', cat:'Ovoce \u00B7 60 g', kcal:'35 kcal', note:'' }
        ],
        mealNote:'P\u0159iprav si ve\u010Der p\u0159edem jako overnight oats.'
      },
      {
        dot:'#007aff', name:'Ob\u011Bd', sub:'12:30 \u00B7 540 kcal \u00B7 3 polo\u017Eky', eaten:false,
        ingredients:[
          { name:'Ku\u0159ec\u00ED prsa', cat:'Dr\u016Fbe\u017E \u00B7 150 g', kcal:'250 kcal', note:'Griluj na sucho, s\u016Fl + pep\u0159 + paprika.' },
          { name:'Jasm\u00EDnov\u00E1 r\u00FD\u017Ee', cat:'Obiloviny \u00B7 150 g', kcal:'215 kcal', note:'' },
          { name:'Brokolice', cat:'Zelenina \u00B7 200 g', kcal:'75 kcal', note:'' }
        ],
        mealNote:'Servirovat sv\u011B\u017E\u00ED \u2014 brokolice nesm\u00ED p\u0159eva\u0159it.'
      },
      {
        dot:'#af52de', name:'Ve\u010De\u0159e', sub:'18:30 \u00B7 576 kcal \u00B7 3 polo\u017Eky', eaten:false,
        ingredients:[
          { name:'Losos s quinoou', cat:'Recept \u00B7 1\u00D7 porce', isRecipe:true, kcal:'450 kcal', note:'Losos pe\u010D max. 12 minut na 180\u00A0\u00B0C, a\u0165 z\u016Fstane \u0161\u0165avnat\u00FD.' },
          { name:'Zeleninov\u00FD sal\u00E1t', cat:'Zelenina \u00B7 150 g', kcal:'95 kcal', note:'' },
          { name:'Olivov\u00FD olej', cat:'Oleje a tuky \u00B7 5 ml', kcal:'31 kcal', note:'Pou\u017Eij extra panensk\u00FD, neva\u0159.' }
        ],
        mealNote:'Lehk\u00E1 ve\u010De\u0159e 3 h p\u0159ed sp\u00E1nkem \u2014 podpo\u0159\u00ED regeneraci.'
      }
    ];

    var eatenCnt = hnMeals.filter(function(m){return m.eaten;}).length;
    var totalCnt = hnMeals.length;
    var ringDash = 144;
    var ringOff = ringDash * (1 - eatenCnt/totalCnt);

    var rowsHtml = hnMeals.map(function(m) {
      var ingHtml = m.ingredients.map(function(ing) {
        var rowClick = ing.isRecipe ? ' onclick="event.stopPropagation();showPhone(\'ph-recipe-detail\')" style="cursor:pointer"' : '';
        var chev = ing.isRecipe ? '<span style="color:var(--ios-label3);font-size:13px;font-weight:600;margin-left:4px">\u203A</span>' : '';
        var catCls = ing.isRecipe ? 'ing-cat recipe' : 'ing-cat';
        var noteH = ing.note ? '<div class="ing-note"><span class="lbl">Pozn:</span> ' + ing.note + '</div>' : '';
        return '<div class="ing-row"' + rowClick + '>' +
            '<div class="ing-info"><div class="ing-name">' + ing.name + '</div><div class="' + catCls + '">' + ing.cat + '</div></div>' +
            '<div class="ing-kcal">' + ing.kcal + '</div>' + chev +
          '</div>' + noteH;
      }).join('');
      var mealNoteH = m.mealNote ? '<div class="meal-note"><span class="lbl">Pozn k j\u00EDdlu:</span> ' + m.mealNote + '</div>' : '';
      var doneCls = m.eaten ? 'ex-ios-done done' : 'ex-ios-done';
      var doneTxt = m.eaten ? '\u2713' : '';
      return '<div class="meal-row-wrap">' +
        '<div class="meal-row-header" onclick="todayMealToggle(this)">' +
          '<div class="ex-ios-dot" style="background:' + m.dot + '"></div>' +
          '<div class="ex-ios-info"><div class="ex-ios-name">' + m.name + '</div><div class="ex-ios-sets">' + m.sub + '</div></div>' +
          '<div style="width:28px;height:28px;border-radius:50%;background:rgba(201,168,76,.12);border:1.5px solid rgba(201,168,76,.35);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;flex-shrink:0;margin-right:6px" onclick="event.stopPropagation();showPhone(\'ph-meal-log-photo\')" title="P\u0159idat fotku">\uD83D\uDCF7</div>' +
          '<div class="' + doneCls + '" onclick="event.stopPropagation();todayMealCheck(this)">' + doneTxt + '</div>' +
          '<span class="meal-chev">\u25BC</span>' +
        '</div>' +
        '<div class="meal-row-body" style="display:none">' + ingHtml + mealNoteH + '</div>' +
      '</div>';
    }).join('');

    html += '<div class="ios-section-hdr"><div class="ios-section-title">Dne\u0161n\u00ED j\u00EDdeln\u00ED\u010Dek</div><div style="display:flex;gap:14px;align-items:center"><span class="ios-section-action" style="display:inline-flex;align-items:center;gap:4px;color:var(--ios-gold)" onclick="showPhone(\'ph-plan-photos\')">\uD83D\uDCF7 Foto</span><span class="ios-section-action" onclick="showPhone(\'ph-nutrition-plan-detail\')">Detail</span></div></div>' +
    '<div class="ios-card">' +
      '<div class="ios-card-hero grad-meal" style="display:flex;align-items:center;padding:20px">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">V\u00FD\u017Eiva \u00B7 T\u00FDden 4</div>' +
          '<div style="font-size:26px;font-weight:700;color:#fff;letter-spacing:-.3px">431 / 1 700 kcal</div>' +
          '<div style="font-size:14px;color:rgba(255,255,255,.7);margin-top:4px">' + totalCnt + ' j\u00EDdla \u00B7 9 polo\u017Eek</div>' +
          '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">' +
            '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;background:rgba(0,122,255,.22);color:#7ab8ff">B 32/130</span>' +
            '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;background:rgba(255,149,0,.22);color:#ffb347">S 40/180</span>' +
            '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;background:rgba(175,82,222,.22);color:#d59cf0">T 10/55</span>' +
          '</div>' +
        '</div>' +
        '<div style="margin-left:12px;flex-shrink:0">' +
          '<div class="prog-ring">' +
            '<svg width="56" height="56" viewBox="0 0 56 56">' +
              '<circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="5"/>' +
              '<circle cx="28" cy="28" r="23" fill="none" stroke="#c9a84c" stroke-width="5" stroke-dasharray="' + ringDash + '" stroke-dashoffset="' + ringOff + '" stroke-linecap="round"/>' +
            '</svg>' +
            '<div class="prog-ring-label" style="color:#fff;font-size:12px">' + eatenCnt + '/' + totalCnt + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:10px 16px;background:rgba(201,168,76,.08);border-bottom:.5px solid var(--ios-sep2);font-size:12px;color:var(--ios-label2);line-height:1.45">' +
        '<span style="font-weight:600;color:var(--ios-gold)">Pozn k dni:</span> Dnes je den odpo\u010Dinku \u2014 dr\u017E se pl\u00E1nu, klidov\u00E9 dny jsou stejn\u011B d\u016Fle\u017Eit\u00E9.' +
      '</div>' +
      '<div style="background:var(--ios-bg2)">' +
        rowsHtml +
        '<div style="padding:12px 16px"><div class="ios-btn ios-btn-primary" style="font-size:15px;padding:12px" onclick="markWholeDayEaten(this)">Ozna\u010Dit cel\u00FD den jako spln\u011Bno</div></div>' +
      '</div>' +
    '</div>';
  }

  /* ── Waiting card ── */
  var waitLabel, waitDesc, chipLabel;
  if (waitingForTraining && waitingForNutrition) {
    waitLabel = 'Vše je připraveno';
    waitDesc = 'Všechna data byla odeslána. Váš trenér nyní připravuje tréninkový i výživový plán na míru. Jakmile budou hotové, dostanete notifikaci.';
    chipLabel = 'Plány se připravují';
  } else if (waitingForNutrition) {
    waitLabel = which === 'has-training' ? 'Výživový plán se připravuje' : 'Vše je připraveno';
    waitDesc = which === 'has-training'
      ? 'Váš výživový poradce nyní připravuje jídelníček na míru. Jakmile bude hotový, dostanete notifikaci.'
      : 'Všechna data byla odeslána. Váš výživový poradce nyní připravuje jídelníček na míru. Jakmile bude hotový, dostanete notifikaci.';
    chipLabel = 'Jídelníček se připravuje';
  } else {
    waitLabel = which === 'has-nutrition' ? 'Tréninkový plán se připravuje' : 'Vše je připraveno';
    waitDesc = which === 'has-nutrition'
      ? 'Váš trenér nyní připravuje tréninkový plán na míru. Jakmile bude hotový, dostanete notifikaci.'
      : 'Všechna data byla odeslána. Váš trenér nyní připravuje tréninkový plán na míru. Jakmile bude hotový, dostanete notifikaci.';
    chipLabel = 'Trénink se připravuje';
  }
  var waitEmoji = hasActivePlan ? '⏳' : '✅';

  html += '<div style="margin:' + (hasActivePlan ? '16px' : '0') + ' 20px 0;border-radius:var(--ios-r-lg);background:var(--ios-bg2);padding:28px 24px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
    '<div style="font-size:44px;margin-bottom:12px">' + waitEmoji + '</div>' +
    '<div style="font-size:18px;font-weight:700;color:var(--ios-label);letter-spacing:-.3px;margin-bottom:6px">' + waitLabel + '</div>' +
    '<div style="font-size:14px;color:var(--ios-label2);line-height:1.5;max-width:280px;margin:0 auto">' + waitDesc + '</div>' +
    '<div style="display:inline-flex;align-items:center;gap:6px;margin-top:16px;padding:6px 14px;background:rgba(201,168,76,.1);border-radius:99px">' +
      '<span style="font-size:12px">⏳</span>' +
      '<span style="font-size:12px;font-weight:600;color:var(--ios-gold)">' + chipLabel + '</span>' +
    '</div>' +
  '</div>';

  /* ── Prep tips ── */
  var tips;
  if (waitingForTraining && !waitingForNutrition) {
    tips = [
      { icon:'💧', bg:'rgba(0,122,255,.1)',  title:'Hydratace',   text:'Zaměř se na 2–3 l vody denně. Dobře hydratované svaly se lépe regenerují.' },
      { icon:'😴', bg:'rgba(255,149,0,.1)',  title:'Spánek',     text:'7–9 hodin spánku je základ. Svaly rostou a regenerují hlavně v noci.' },
      { icon:'🥩', bg:'rgba(52,199,89,.1)',  title:'Bílkoviny',   text:'Tvůj plán počítá s dostatkem bílkovin. Začni se na ně zaměřovat už teď.' },
      { icon:'🎒', bg:'rgba(175,82,222,.1)', title:'Výbava',      text:'Připrav si sportovní oblečení, láhev na vodu a pohodlnou obuv.' }
    ];
  } else if (waitingForNutrition && !waitingForTraining) {
    tips = [
      { icon:'💧', bg:'rgba(0,122,255,.1)',  title:'Hydratace',    text:'Pij alespoň 2 l vody denně — pomáhá trávení a využití živin z jídla.' },
      { icon:'🛒', bg:'rgba(255,149,0,.1)',  title:'Nákupy',      text:'Připrav si seznam potravin na první týden. Jde to lépe, když máš vše předem.' },
      { icon:'⌚',  bg:'rgba(52,199,89,.1)',  title:'Pravidelnost', text:'Jez v podobných časech každý den — tělo si na rytmus rychle zvykne.' },
      { icon:'🥩', bg:'rgba(175,82,222,.1)', title:'Bílkoviny',    text:'Vejce, tvaroh, kuřecí prso, ryby — to jsou tvůj základ pro každý den.' }
    ];
  } else {
    tips = [
      { icon:'💧', bg:'rgba(0,122,255,.1)',  title:'Hydratace', text:'2–3 l vody denně — základ pro trénink i správnou výživu.' },
      { icon:'😴', bg:'rgba(255,149,0,.1)',  title:'Spánek',   text:'7–9 hodin je minimum. Svaly rostou a výživa se vstřebává hlavně v noci.' },
      { icon:'🥩', bg:'rgba(52,199,89,.1)',  title:'Bílkoviny', text:'Jídelníček máš připravený — začni žít přesně tak jak je navržen.' },
      { icon:'🎒', bg:'rgba(175,82,222,.1)', title:'Příprava', text:'Sportovní výbava + nákup na první týden jídelníčku — udělej to dnes.' }
    ];
  }

  var tipsHtml = tips.map(function(t) {
    return '<div style="background:var(--ios-bg2);border-radius:var(--ios-r);padding:14px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
      '<div style="width:38px;height:38px;border-radius:12px;background:' + t.bg + ';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">' + t.icon + '</div>' +
      '<div style="flex:1"><div style="font-size:15px;font-weight:600;color:var(--ios-label);margin-bottom:2px">' + t.title + '</div>' +
      '<div style="font-size:13px;color:var(--ios-label2);line-height:1.4">' + t.text + '</div></div>' +
    '</div>';
  }).join('');

  html += '<div class="ios-section-hdr" style="margin-top:20px"><div class="ios-section-title">Příprava na start</div></div>' +
    '<div style="margin:0 20px 24px;display:flex;flex-direction:column;gap:10px">' + tipsHtml + '</div>' +
    '<div style="height:16px"></div>';

  tw.innerHTML = html;
}

function toggleDark(){
  _dark = !_dark;
  document.body.classList.toggle('dark-proto', _dark);
  document.getElementById('dark-btn').textContent = _dark ? '☀' : '☾';
  // Swap status bar color for dark
  document.querySelectorAll('.sb-time').forEach(function(el){
    el.style.color = _dark ? '#fff' : '#000';
  });
  document.querySelectorAll('.sb-icons svg').forEach(function(el){
    el.style.fill = _dark ? '#fff' : '#000';
  });
  // Swap CSS variables on phones
  document.querySelectorAll('.phone').forEach(function(p){
    if(_dark){
      p.style.setProperty('--ios-bg','#1c1c1e');
      p.style.setProperty('--ios-bg2','#2c2c2e');
      p.style.setProperty('--ios-bg3','#3a3a3c');
      p.style.setProperty('--ios-label','#ffffff');
      p.style.setProperty('--ios-label2','rgba(235,235,245,.6)');
      p.style.setProperty('--ios-label3','rgba(235,235,245,.3)');
      p.style.setProperty('--ios-label4','rgba(235,235,245,.18)');
      p.style.setProperty('--ios-fill','rgba(120,120,128,.24)');
      p.style.setProperty('--ios-fill2','rgba(120,120,128,.16)');
      p.style.setProperty('--ios-sep','rgba(84,84,88,.65)');
      p.style.setProperty('--ios-sep2','rgba(84,84,88,.4)');
      p.style.background = '#000';
    } else {
      p.style.removeProperty('--ios-bg');
      p.style.removeProperty('--ios-bg2');
      p.style.removeProperty('--ios-bg3');
      p.style.removeProperty('--ios-label');
      p.style.removeProperty('--ios-label2');
      p.style.removeProperty('--ios-label3');
      p.style.removeProperty('--ios-label4');
      p.style.removeProperty('--ios-fill');
      p.style.removeProperty('--ios-fill2');
      p.style.removeProperty('--ios-sep');
      p.style.removeProperty('--ios-sep2');
      p.style.background = '#f2f2f7';
    }
  });
}



// ── DEEP-LINK BOOT ────────────────────────────────────────────────────────────
// Reads `?scene=<id>` from window.location on first load and navigates to that
// scene. Enables stable URLs for Notion embeds and shared links.
(function bootSceneFromUrl(){
  function apply(){
    var params = new URLSearchParams(window.location.search);
    var scene = params.get("scene");
    if(!scene) return;
    try { showPhone(scene); } catch(e){ /* unknown scene id — ignore */ }
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
