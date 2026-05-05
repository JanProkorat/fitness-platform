// ── WHEEL PICKER ─────────────────────────────────────────────────────────────
var _wheelState = {};

function initWheel(id) {
  var el = document.getElementById(id);
  if (!el || el.dataset.init) return;
  el.dataset.init = '1';

  var min   = parseFloat(el.dataset.min);
  var max   = parseFloat(el.dataset.max);
  var step  = parseFloat(el.dataset.step);
  var val   = parseFloat(el.dataset.val);
  var track = el.querySelector('.wheel-picker-track');
  var ITEM_H = 44;

  // Build items array
  var items = [];
  for (var v = min; v <= max + 0.001; v = Math.round((v + step) * 1000) / 1000) {
    items.push(Math.round(v * 10) / 10);
  }

  var idx = Math.round((val - min) / step);
  idx = Math.max(0, Math.min(idx, items.length - 1));

  // Render 2 padding items top/bottom so selection is centred
  var PAD = 2;
  track.innerHTML = '';
  for (var p = 0; p < PAD; p++) {
    var d = document.createElement('div');
    d.className = 'wheel-picker-item far';
    d.textContent = '';
    track.appendChild(d);
  }
  items.forEach(function(v) {
    var d = document.createElement('div');
    d.className = 'wheel-picker-item';
    d.textContent = step < 1 ? v.toFixed(1).replace('.', ',') : v;
    track.appendChild(d);
  });
  for (var p = 0; p < PAD; p++) {
    var d = document.createElement('div');
    d.className = 'wheel-picker-item far';
    d.textContent = '';
    track.appendChild(d);
  }

  var state = { items: items, idx: idx, PAD: PAD, ITEM_H: ITEM_H, dragging: false, startY: 0, startOffset: 0, currentOffset: 0 };
  _wheelState[id] = state;

  function offsetForIdx(i) { return -i * ITEM_H; }

  function applyOffset(offset, animate) {
    if (animate) {
      track.style.transition = 'transform .2s cubic-bezier(.25,.46,.45,.94)';
    } else {
      track.style.transition = 'none';
    }
    track.style.transform = 'translateY(' + offset + 'px)';
  }

  function updateClasses(i) {
    var allItems = track.querySelectorAll('.wheel-picker-item');
    allItems.forEach(function(d, di) {
      var dist = Math.abs(di - (i + PAD));
      d.classList.remove('active','near','far');
      if (dist === 0) d.classList.add('active');
      else if (dist === 1) d.classList.add('near');
      else if (dist === 2) d.classList.add('far');
      // beyond 2 stays default (very faded)
    });
  }

  function snapToIdx(i) {
    i = Math.max(0, Math.min(i, items.length - 1));
    state.idx = i;
    state.currentOffset = offsetForIdx(i);
    applyOffset(state.currentOffset, true);
    updateClasses(i);
    el.dataset.val = items[i];
  }

  // Init position
  applyOffset(offsetForIdx(idx), false);
  updateClasses(idx);

  // ── Drag / touch ──────────────────────────────────────────────────────────
  function onStart(clientY) {
    state.dragging = true;
    state.startY = clientY;
    state.startOffset = state.currentOffset;
    track.style.transition = 'none';
  }

  function onMove(clientY) {
    if (!state.dragging) return;
    var dy = clientY - state.startY;
    var rawOffset = state.startOffset + dy;
    var minOff = offsetForIdx(items.length - 1);
    var maxOff = 0;
    rawOffset = Math.max(minOff - ITEM_H, Math.min(maxOff + ITEM_H, rawOffset));
    state.currentOffset = rawOffset;
    track.style.transform = 'translateY(' + rawOffset + 'px)';
    // update classes live
    var approxIdx = Math.round(-rawOffset / ITEM_H);
    approxIdx = Math.max(0, Math.min(approxIdx, items.length - 1));
    updateClasses(approxIdx);
  }

  function onEnd() {
    if (!state.dragging) return;
    state.dragging = false;
    var rawIdx = Math.round(-state.currentOffset / ITEM_H);
    snapToIdx(rawIdx);
  }

  // Mouse
  el.addEventListener('mousedown', function(e) { e.preventDefault(); onStart(e.clientY); });
  window.addEventListener('mousemove', function(e) { onMove(e.clientY); });
  window.addEventListener('mouseup', onEnd);

  // Touch
  el.addEventListener('touchstart', function(e) { onStart(e.touches[0].clientY); }, {passive:true});
  el.addEventListener('touchmove', function(e) { e.preventDefault(); onMove(e.touches[0].clientY); }, {passive:false});
  el.addEventListener('touchend', onEnd);

  // Click on item
  track.addEventListener('click', function(e) {
    var item = e.target.closest('.wheel-picker-item');
    if (!item) return;
    var allItems = Array.from(track.querySelectorAll('.wheel-picker-item'));
    var di = allItems.indexOf(item);
    if (di >= PAD && di < PAD + items.length) {
      snapToIdx(di - PAD);
    }
  });
}

function initAllWheels() {
  document.querySelectorAll('.wheel-picker').forEach(function(el) {
    initWheel(el.id);
  });
}

// Init wheels when their screen is shown
var _origShowPhone = showPhone;
showPhone = function(id) {
  _origShowPhone(id);
  setTimeout(initAllWheels, 30);
};


// ── NUTRITION PLAN DETAIL ──
var _npWeek = 4;
var _npTotalWeeks = 12;
var _npWeekDates = {
  1:'3. 2. – 9. 2. 2026', 2:'10. 2. – 16. 2. 2026', 3:'17. 2. – 23. 2. 2026',
  4:'23. 3. – 29. 3. 2026', 5:'30. 3. – 5. 4. 2026', 6:'6. 4. – 12. 4. 2026',
  7:'13. 4. – 19. 4. 2026', 8:'20. 4. – 26. 4. 2026', 9:'27. 4. – 3. 5. 2026',
  10:'4. 5. – 10. 5. 2026', 11:'11. 5. – 17. 5. 2026', 12:'18. 5. – 24. 5. 2026'
};

function npUpdateWeekUI() {
  var label = document.getElementById('np-week-label');
  var dates = document.getElementById('np-week-dates');
  if (label) label.textContent = 'Týden ' + _npWeek + ' z ' + _npTotalWeeks;
  if (dates) dates.textContent = _npWeekDates[_npWeek] || '';
  // Collapse all open meals
  document.querySelectorAll('#ph-nutrition-plan-detail .np-meal-body').forEach(function(b) { b.style.display = 'none'; });
  document.querySelectorAll('#ph-nutrition-plan-detail .np-meal-chev').forEach(function(c) { c.style.transform = ''; });
  // Close week grid if open
  var grid = document.getElementById('np-week-grid');
  if (grid) grid.style.display = 'none';
  // Update grid active state
  document.querySelectorAll('#np-week-grid-inner .np-wg-btn').forEach(function(b) {
    var w = parseInt(b.getAttribute('data-w'));
    b.style.background = w === _npWeek ? 'var(--ios-gold)' : 'var(--ios-fill)';
    b.style.color = w === _npWeek ? '#fff' : 'var(--ios-label)';
  });
}

function npStepWeek(dir) {
  var next = _npWeek + dir;
  if (next < 1 || next > _npTotalWeeks) return;
  _npWeek = next;
  npUpdateWeekUI();
}

function npSelectWeek(num) {
  if (num < 1 || num > _npTotalWeeks) return;
  _npWeek = num;
  npUpdateWeekUI();
}

function npOpenWeekGrid() {
  var grid = document.getElementById('np-week-grid');
  if (!grid) return;
  var isOpen = grid.style.display !== 'none';
  if (isOpen) { grid.style.display = 'none'; return; }
  // Build grid buttons
  var inner = document.getElementById('np-week-grid-inner');
  if (inner) {
    inner.innerHTML = '';
    for (var i = 1; i <= _npTotalWeeks; i++) {
      var isActive = i === _npWeek;
      var btn = document.createElement('div');
      btn.className = 'np-wg-btn';
      btn.setAttribute('data-w', i);
      btn.style.cssText = 'padding:10px 0;text-align:center;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:background .12s,color .12s;' +
        'background:' + (isActive ? 'var(--ios-gold)' : 'var(--ios-fill)') + ';' +
        'color:' + (isActive ? '#fff' : 'var(--ios-label)');
      btn.textContent = i;
      btn.onclick = (function(w) { return function() { npSelectWeek(w); }; })(i);
      inner.appendChild(btn);
    }
  }
  grid.style.display = '';
}

function npSelectDay(dayNum) {
  document.querySelectorAll('#np-day-strip .week-day').forEach(function(d) {
    var dn = parseInt(d.getAttribute('data-np-day'));
    var numEl = d.querySelector('.week-day-num');
    if (dn === dayNum) {
      numEl.style.background = 'var(--ios-gold)';
      numEl.style.color = '#fff';
      numEl.style.fontSize = '';
    } else if (dn < 4) {
      numEl.style.background = 'rgba(52,199,89,.15)';
      numEl.style.color = 'var(--ios-green)';
      numEl.style.fontSize = '14px';
    } else {
      numEl.style.background = '';
      numEl.style.color = 'var(--ios-label3)';
      numEl.style.fontSize = '';
    }
  });
  // Collapse all open meals
  document.querySelectorAll('#ph-nutrition-plan-detail .np-meal-body').forEach(function(b) { b.style.display = 'none'; });
  document.querySelectorAll('#ph-nutrition-plan-detail .np-meal-chev').forEach(function(c) { c.style.transform = ''; });
}

function npToggleMeal(headerEl) {
  var card = headerEl.parentElement;
  var body = card.querySelector('.np-meal-body');
  var chev = headerEl.querySelector('.np-meal-chev');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// Today screen — meal row toggle / check / mark-all
function todayMealToggle(headerEl) {
  var wrap = headerEl.parentElement;
  var body = wrap.querySelector('.meal-row-body');
  var chev = headerEl.querySelector('.meal-chev');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function todayMealCheck(checkEl) {
  var done = checkEl.classList.toggle('done');
  checkEl.textContent = done ? '\u2713' : '';
}

function markWholeDayEaten(btn) {
  var card = btn.closest('.ios-card');
  if (!card) return;
  card.querySelectorAll('.meal-row-header .ex-ios-done').forEach(function(c) {
    c.classList.add('done');
    c.textContent = '\u2713';
  });
}

// Today screen — training session / exercise toggle + check
function todayExToggle(exCardEl) {
  exCardEl.classList.toggle('expanded');
}

function todayExCheck(checkEl) {
  var done = checkEl.classList.toggle('done');
  checkEl.textContent = done ? '\u2713' : '';
  updateTrainingProgress(checkEl.closest('#today-training-card'));
  updateTrainingStatTile();
}

function updateTrainingProgress(cardEl) {
  if (!cardEl) return;
  var total = 0, done = 0;
  cardEl.querySelectorAll('.tp-session').forEach(function(s) {
    var exCards = s.querySelectorAll('.tp-ex-card');
    var sTotal = exCards.length;
    var sDone = s.querySelectorAll('.tp-ex-card .tp-ex-header .ex-ios-done.done').length;
    total += sTotal;
    done += sDone;
    var chip = s.querySelector('.tp-session-progress');
    if (chip) {
      chip.textContent = sDone + '/' + sTotal;
      if (sDone === sTotal && sTotal > 0) {
        chip.style.background = 'rgba(52,199,89,.12)';
        chip.style.color = 'var(--ios-green)';
      } else {
        chip.style.background = '';
        chip.style.color = '';
      }
    }
    var sessionCheck = s.querySelector('.tp-session-header > .ex-ios-done');
    if (sessionCheck) {
      var allDone = sTotal > 0 && sDone === sTotal;
      sessionCheck.classList.toggle('done', allDone);
      sessionCheck.textContent = allDone ? '\u2713' : '';
    }
    s.querySelectorAll('.tp-section').forEach(function(sec) {
      var secCards = sec.querySelectorAll('.tp-ex-card');
      var secTotal = secCards.length;
      var secDone = sec.querySelectorAll('.tp-ex-card .tp-ex-header .ex-ios-done.done').length;
      var secCheck = sec.querySelector('.tp-section-header > .ex-ios-done');
      if (secCheck) {
        var allDone = secTotal > 0 && secDone === secTotal;
        secCheck.classList.toggle('done', allDone);
        secCheck.textContent = allDone ? '\u2713' : '';
      }
    });
  });
  var label = cardEl.querySelector('.tp-day-progress-label');
  if (label) label.textContent = done + '/' + total + ' hotovo';
  var bar = cardEl.querySelector('.tp-day-progress-bar');
  if (bar && total) bar.style.width = Math.round(done / total * 100) + '%';
  var ringLbl = cardEl.querySelector('.tp-day-progress-ringlabel');
  if (ringLbl) ringLbl.textContent = done + '/' + total;
  var ring = cardEl.querySelector('.tp-day-progress-ring');
  if (ring && total) {
    var circ = 144; // 2 * PI * 23, matches dasharray
    ring.setAttribute('stroke-dashoffset', Math.round(circ * (1 - done / total)));
  }
}

function updateTrainingStatTile() {
  var card = document.getElementById('today-training-card');
  if (!card) return;
  var total = card.querySelectorAll('.tp-ex-card').length;
  var done = card.querySelectorAll('.tp-ex-card .tp-ex-header .ex-ios-done.done').length;
  var tile = document.getElementById('today-training-stat-card');
  if (!tile) return;
  var d = tile.querySelector('.tp-stat-done');
  var t = tile.querySelector('.tp-stat-total');
  if (d) d.textContent = done;
  if (t) t.textContent = total;
}

function todaySessionCheck(checkEl) {
  var session = checkEl.closest('.tp-session');
  if (!session) return;
  var turningOn = !checkEl.classList.contains('done');
  session.querySelectorAll('.tp-ex-card .tp-ex-header .ex-ios-done').forEach(function(c) {
    c.classList.toggle('done', turningOn);
    c.textContent = turningOn ? '\u2713' : '';
  });
  updateTrainingProgress(session.closest('#today-training-card'));
  updateTrainingStatTile();
}

function todaySectionCheck(checkEl) {
  var section = checkEl.closest('.tp-section');
  if (!section) return;
  var turningOn = !checkEl.classList.contains('done');
  section.querySelectorAll('.tp-ex-card .tp-ex-header .ex-ios-done').forEach(function(c) {
    c.classList.toggle('done', turningOn);
    c.textContent = turningOn ? '\u2713' : '';
  });
  updateTrainingProgress(section.closest('#today-training-card'));
  updateTrainingStatTile();
}

function markWholeTrainingDone(btn) {
  var card = btn.closest('.ios-card');
  if (!card) return;
  card.querySelectorAll('.tp-ex-card .tp-ex-header .ex-ios-done').forEach(function(c) {
    c.classList.add('done');
    c.textContent = '\u2713';
  });
  updateTrainingProgress(card);
  updateTrainingStatTile();
}

// ── FOOD / RECIPE DETAIL: i18n ──────────────────────────
var _fdLang = 'cs';
var _fdTranslations = {
  cs: {
    'food-detail-label':'Detail potraviny','recipe-detail-label':'Detail receptu',
    'food-detail-nav':'Snídaně','recipe-nav':'Večeře',
    'food-name':'Ovesná kaše s proteinem','food-category':'Obiloviny',
    'macros-title':'Nutriční hodnoty','macro-protein':'Bílkoviny','macro-carbs':'Sacharidy',
    'macro-fat':'Tuky','macro-fiber':'Vláknina','nutrient-sugar':'Cukry',
    'nutrient-saturated':'Nasycené tuky','nutrient-salt':'Sůl',
    'per-100g-title':'Na 100 g','per100-energy':'Energie',
    'servings-title':'Běžné porce','serving-planned':'Dle plánu (110 g)',
    'serving-small':'Malá porce (80 g)','serving-large':'Velká porce (150 g)',
    'allergens-title':'Alergeny','allergen-gluten':'Lepek','allergen-milk':'Mléko',
    'trainer-note-label':'Poznámka trenéra',
    'food-note':'Použij jemné vločky, lépe se připraví. Můžeš přidat lžíci arašídového másla navíc pro vyšší tuky.',
    'barcode-label':'Čárový kód',
    'recipe-name':'Losos s quinoou a grilovanou zeleninou','recipe-badge':'Recept',
    'recipe-servings':'1× porce','recipe-macros-title':'Celkové hodnoty',
    'ingredients-title':'Ingredience',
    'ing-salmon':'Losos filet','ing-quinoa':'Quinoa','ing-zucchini':'Cuketa',
    'ing-pepper':'Paprika','ing-olive-oil':'Olivový olej','ing-lemon':'Citrón',
    'steps-title':'Postup přípravy',
    'step-1':'Quinou propláchni a vař 15 minut ve dvojnásobku vody. Nech odpočinout pod pokličkou.',
    'step-2':'Lososa osoľ, opepři a potři olivovým olejem. Griluj na pánvi z každé strany 4 minuty.',
    'step-3':'Cuketu a papriku nakrájej na plátky, griluj na pánvi 3–4 minuty z každé strany.',
    'step-4':'Servíruj lososa na lůžku z quinoy s grilovanou zeleninou. Zakápni citrónem.',
    'recipe-note':'Lososa nekupuj farmového — ideálně divoký aljašský. Pokud nemáš quinou, nahraď bulghurem.',
    'description-title':'Popis',
    'recipe-description':'Vyvážené jídlo bohaté na omega-3 mastné kyseliny a kvalitní bílkoviny. Ideální po tréninku pro regeneraci svalů.'
  },
  en: {
    'food-detail-label':'Food Detail','recipe-detail-label':'Recipe Detail',
    'food-detail-nav':'Breakfast','recipe-nav':'Dinner',
    'food-name':'Protein Oat Porridge','food-category':'Grains',
    'macros-title':'Nutritional Values','macro-protein':'Protein','macro-carbs':'Carbs',
    'macro-fat':'Fat','macro-fiber':'Fiber','nutrient-sugar':'Sugars',
    'nutrient-saturated':'Saturated Fat','nutrient-salt':'Salt',
    'per-100g-title':'Per 100 g','per100-energy':'Energy',
    'servings-title':'Common Servings','serving-planned':'As planned (110 g)',
    'serving-small':'Small serving (80 g)','serving-large':'Large serving (150 g)',
    'allergens-title':'Allergens','allergen-gluten':'Gluten','allergen-milk':'Milk',
    'trainer-note-label':'Trainer\'s Note',
    'food-note':'Use fine oats — they cook faster. You can add a spoon of peanut butter for extra fats.',
    'barcode-label':'Barcode',
    'recipe-name':'Salmon with Quinoa & Grilled Vegetables','recipe-badge':'Recipe',
    'recipe-servings':'1× serving','recipe-macros-title':'Total Values',
    'ingredients-title':'Ingredients',
    'ing-salmon':'Salmon fillet','ing-quinoa':'Quinoa','ing-zucchini':'Zucchini',
    'ing-pepper':'Bell pepper','ing-olive-oil':'Olive oil','ing-lemon':'Lemon',
    'steps-title':'Preparation Steps',
    'step-1':'Rinse quinoa and cook for 15 minutes in double the water. Let it rest covered.',
    'step-2':'Season the salmon, brush with olive oil. Grill on a pan 4 minutes per side.',
    'step-3':'Slice zucchini and pepper, grill on a pan for 3–4 minutes per side.',
    'step-4':'Serve salmon on a bed of quinoa with grilled vegetables. Finish with a squeeze of lemon.',
    'recipe-note':'Go for wild Alaskan salmon, not farmed. If you don\'t have quinoa, use bulgur instead.',
    'description-title':'Description',
    'recipe-description':'A balanced meal rich in omega-3 fatty acids and high-quality protein. Ideal post-workout for muscle recovery.'
  },
  de: {
    'food-detail-label':'Lebensmittel-Detail','recipe-detail-label':'Rezept-Detail',
    'food-detail-nav':'Frühstück','recipe-nav':'Abendessen',
    'food-name':'Protein-Haferbrei','food-category':'Getreide',
    'macros-title':'Nährwerte','macro-protein':'Eiweiß','macro-carbs':'Kohlenhydrate',
    'macro-fat':'Fett','macro-fiber':'Ballaststoffe','nutrient-sugar':'Zucker',
    'nutrient-saturated':'Gesättigte Fette','nutrient-salt':'Salz',
    'per-100g-title':'Pro 100 g','per100-energy':'Energie',
    'servings-title':'Übliche Portionen','serving-planned':'Laut Plan (110 g)',
    'serving-small':'Kleine Portion (80 g)','serving-large':'Große Portion (150 g)',
    'allergens-title':'Allergene','allergen-gluten':'Gluten','allergen-milk':'Milch',
    'trainer-note-label':'Trainer-Hinweis',
    'food-note':'Verwende feine Haferflocken — sie kochen schneller. Du kannst einen Löffel Erdnussbutter für mehr Fett hinzufügen.',
    'barcode-label':'Barcode',
    'recipe-name':'Lachs mit Quinoa & gegrilltem Gemüse','recipe-badge':'Rezept',
    'recipe-servings':'1× Portion','recipe-macros-title':'Gesamtwerte',
    'ingredients-title':'Zutaten',
    'ing-salmon':'Lachsfilet','ing-quinoa':'Quinoa','ing-zucchini':'Zucchini',
    'ing-pepper':'Paprika','ing-olive-oil':'Olivenöl','ing-lemon':'Zitrone',
    'steps-title':'Zubereitung',
    'step-1':'Quinoa abspülen und 15 Minuten in doppelter Menge Wasser kochen. Zugedeckt ruhen lassen.',
    'step-2':'Lachs würzen und mit Olivenöl bestreichen. In der Pfanne je 4 Minuten pro Seite braten.',
    'step-3':'Zucchini und Paprika in Scheiben schneiden, 3–4 Minuten pro Seite grillen.',
    'step-4':'Lachs auf einem Bett aus Quinoa mit gegrilltem Gemüse servieren. Mit Zitrone beträufeln.',
    'recipe-note':'Kaufe Wildlachs aus Alaska, keinen Zuchtlachs. Falls du keine Quinoa hast, nimm Bulgur.',
    'description-title':'Beschreibung',
    'recipe-description':'Eine ausgewogene Mahlzeit reich an Omega-3-Fettsäuren und hochwertigem Protein. Ideal nach dem Training für die Muskelregeneration.'
  }
};

function setFdLang(lang, btn) {
  _fdLang = lang;
  // Update active state on all lang buttons (both screens)
  document.querySelectorAll('.fd-lang-btn').forEach(function(b) {
    b.classList.toggle('active', b.textContent.trim().toLowerCase() === lang);
  });
  // Apply translations
  var t = _fdTranslations[lang] || _fdTranslations.cs;
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
}

