// ── DASHBOARD ─────────────────────────────────────────────────────────────────
var _dashView='table';
var _foodsFilter='all';

function switchDashView(v){
  _dashView=v;
  ['table','list','cards'].forEach(function(x){
    document.getElementById('view-'+x).style.display=x===v?'block':'none';
    document.getElementById('dv-'+x).classList.toggle('active',x===v);
  });
  renderDashboard();
}

function renderDashboard(){
  renderClientsTable();
  renderClientsList();
  renderClientsCards();
}

function complianceColor(c){return c>=80?'var(--green)':c>=60?'var(--orange)':'var(--red)';}
function trainsColor(t,g){return t>=g?'var(--green)':t>=g/2?'var(--orange)':'var(--red)';}

function renderClientsTable(){
  var el=document.getElementById('clients-tbody'); if(!el) return;
  var html='';
  CLIENTS.forEach(function(cl){
    var cc=complianceColor(cl.compliance);
    var tc=trainsColor(cl.trains,cl.trainsGoal);
    var trainTag=cl.trains>=cl.trainsGoal?'tag-green':cl.trains>=cl.trainsGoal/2?'tag-orange':'tag-red';
    html+='<tr onclick="showScreen(\'s-client\')" style="cursor:pointer"><td><span class="row-title">'+cl.name+'</span></td>';
    html+='<td><span class="tag '+cl.tag+'">'+cl.goal+'</span></td>';
    html+='<td><div style="display:flex;align-items:center;gap:8px"><div class="pbar" style="width:60px;height:5px"><div class="pfill" style="width:'+cl.compliance+'%;background:'+cc+'"></div></div><span style="font-size:12px;color:var(--t2)">'+cl.compliance+' %</span></div></td>';
    html+='<td><span style="font-size:13px">🔥 '+cl.streak+'d</span></td>';
    html+='<td><div style="display:flex;align-items:center;gap:6px"><div class="pbar" style="width:50px;height:4px"><div class="pfill" style="width:'+pct(cl.kcal,cl.kcalGoal)+'%;background:var(--acc)"></div></div><span style="font-size:12px;color:var(--t2)">'+cl.kcal+'</span></div></td>';
    html+='<td><span class="tag '+trainTag+'">'+cl.trains+'/'+cl.trainsGoal+'</span></td>';
    html+='<td><span style="color:'+cl.lastColor+';font-size:12px">'+cl.last+'</span></td>';
    html+='<td><div class="row-acts"><button onclick="showScreen(\'s-client\');event.stopPropagation()">Otevřít</button><button onclick="showScreen(\'s-messages\');event.stopPropagation()">Zpráva</button></div></td></tr>';
  });
  el.innerHTML=html;
}

function renderClientsList(){
  var el=document.getElementById('clients-list-wrap'); if(!el) return;
  var html='';
  CLIENTS.forEach(function(cl){
    var cc=complianceColor(cl.compliance);
    html+='<div class="list-item" onclick="showScreen(\'s-client\')">';
    html+='<div class="list-avatar '+cl.av+'">'+cl.initials+'</div>';
    html+='<div class="list-info"><div class="list-name">'+cl.name+'</div><div class="list-meta"><span class="tag '+cl.tag+'" style="font-size:11px;padding:1px 6px">'+cl.goal+'</span></div></div>';
    html+='<div class="list-right">';
    html+='<div style="text-align:right"><div style="font-size:12px;font-weight:600;color:'+cc+'">'+cl.compliance+' %</div><div style="font-size:11px;color:var(--t3)">compliance</div></div>';
    html+='<div style="text-align:right"><div style="font-size:12px;color:var(--t2)">🔥 '+cl.streak+'d</div></div>';
    html+='<div class="row-acts"><button>Otevřít</button><button>Zpráva</button></div>';
    html+='</div></div>';
  });
  html+='<div class="db-add" onclick="openDialog(\'dlg-new-client\')"><span>+</span><span>Přidat klienta</span></div>';
  el.innerHTML=html;
}

function renderClientsCards(){
  var el=document.getElementById('clients-cards-wrap'); if(!el) return;
  var html='';
  CLIENTS.forEach(function(cl){
    var cc=complianceColor(cl.compliance);
    html+='<div class="n-card" onclick="showScreen(\'s-client\')">';
    html+='<div class="card-cover"><div class="card-pattern"></div>';
    html+='<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div class="list-avatar '+cl.av+'" style="width:44px;height:44px;font-size:16px">'+cl.initials+'</div></div></div>';
    html+='<div class="card-body"><div class="card-title">'+cl.name+'</div>';
    html+='<div class="card-prop"><span class="tag '+cl.tag+'" style="font-size:11px">'+cl.goal+'</span></div>';
    html+='<div class="card-prop"><span class="card-prop-val" style="color:'+cc+';font-weight:600">'+cl.compliance+' %</span><span>compliance · 🔥'+cl.streak+'d</span></div>';
    html+='<div class="card-prop"><span>Tréninky:</span><span class="card-prop-val">'+cl.trains+'/'+cl.trainsGoal+'</span></div>';
    html+='</div></div>';
  });
  el.innerHTML=html;
}

function addClient(){
  closeDialog('dlg-new-client');
  showToast('Klient vytvořen, pozvánka odeslána');
}

// ── FOODS ─────────────────────────────────────────────────────────────────────
var _foodsSort={key:'name',dir:'asc'};
var _recipesSort={key:'name',dir:'asc'};

function switchFoodsView(v){
  var tbl=document.getElementById('foods-table-view');
  var lst=document.getElementById('foods-list-view');
  var crd=document.getElementById('foods-cards-view');
  if(tbl) tbl.style.display=v==='table'?'block':'none';
  if(lst) lst.style.display=v==='list' ?'block':'none';
  if(crd) crd.style.display=v==='cards'?'block':'none';
  ['table','list','cards'].forEach(function(id){
    var el=document.getElementById('fv-'+id); if(el) el.classList.toggle('active',id===v);
  });
  renderFoods();
}

function filterFoods(cat,el){
  _foodsFilter=cat;
  document.querySelectorAll('#s-foods .chip').forEach(function(c){c.classList.remove('active');});
  if(el) el.classList.add('active');
  renderFoods();
}

function selectFoodCategory(value){
  // select-driven filter; maps to same _foodsFilter values renderFoods() understands
  _foodsFilter=value==='all'?'all':value;
  renderFoods();
}

function toggleFoodsSortMenu(btn){
  var menu=document.getElementById('foods-sort-menu'); if(!menu) return;
  var open=menu.style.display==='block';
  menu.style.display=open?'none':'block';
}

function setFoodsSort(key,el){
  if(_foodsSort.key===key) _foodsSort.dir=_foodsSort.dir==='asc'?'desc':'asc';
  else { _foodsSort.key=key; _foodsSort.dir='asc'; }
  document.querySelectorAll('#foods-sort-menu .sort-opt').forEach(function(o){o.classList.remove('active');o.style.color='var(--t)';});
  if(el){ el.classList.add('active'); el.style.color='var(--acc)'; }
  document.getElementById('foods-sort-menu').style.display='none';
  renderFoods();
}

function renderFoods(){
  var q=(document.getElementById('foods-search')||{value:''}).value.toLowerCase();
  var list=FOODS_DB.filter(function(f){
    if(_foodsFilter==='custom') return f.custom;
    if(_foodsFilter==='protein') return f.cat==='Proteiny';
    if(_foodsFilter==='carbs') return f.cat==='Sacharidy';
    if(_foodsFilter==='veg'||_foodsFilter==='vegetables') return f.cat==='Zelenina';
    if(_foodsFilter==='fruit') return f.cat==='Ovoce';
    if(_foodsFilter==='fat') return f.cat==='Tuky';
    if(_foodsFilter==='dairy') return f.cat==='Mléčné';
    if(_foodsFilter==='beverages') return f.cat==='Nápoje';
    if(_foodsFilter==='other') return f.cat==='Ostatní';
    return true;
  }).filter(function(f){return !q||f.name.toLowerCase().includes(q);});

  // Sort
  var dir=_foodsSort.dir==='asc'?1:-1;
  list.sort(function(a,b){
    var cmp=0;
    switch(_foodsSort.key){
      case 'name': cmp=a.name.localeCompare(b.name); break;
      case 'kcal': cmp=a.kcal-b.kcal; break;
      case 'protein': cmp=a.p-b.p; break;
      case 'carbs': cmp=a.c-b.c; break;
      case 'fat': cmp=a.f-b.f; break;
      case 'fiber': cmp=(a.fi||0)-(b.fi||0); break;
      case 'category': cmp=(a.cat||'').localeCompare(b.cat||''); break;
    }
    return cmp*dir;
  });

  var deleteBtn='<button class="row-act-btn" title="Smazat" onclick="event.stopPropagation();showToast(\'Potravina smazána\')" style="background:none;border:none;padding:4px;color:var(--t3);cursor:pointer">🗑</button>';

  // table
  var tb=document.getElementById('foods-tbody');
  if(tb){
    var html='';
    list.forEach(function(f){
      var note=f.note||'—';
      html+='<tr onclick="openFoodDetail(\''+f.name+'\')" style="cursor:pointer">';
      html+='<td><span class="row-title">'+f.name+'</span></td>';
      html+='<td style="color:var(--t3);font-style:italic;font-size:12px">'+note+'</td>';
      html+='<td class="tabular-nums">'+f.kcal+'</td>';
      html+='<td class="tabular-nums" style="color:var(--blue)">'+f.p+'g</td>';
      html+='<td class="tabular-nums" style="color:var(--orange)">'+f.c+'g</td>';
      html+='<td class="tabular-nums" style="color:var(--purple)">'+f.f+'g</td>';
      html+='<td class="tabular-nums" style="color:var(--green)">'+(f.fi||0)+'g</td>';
      html+='<td><span class="tag '+f.catTag+'" style="font-size:11px">'+f.cat+'</span></td>';
      html+='<td>'+deleteBtn+'</td></tr>';
    });
    tb.innerHTML=html;
  }

  // list
  var lv=document.getElementById('foods-list');
  if(lv){
    var html='';
    list.forEach(function(f){
      html+='<div onclick="openFoodDetail(\''+f.name+'\')" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--br);border-radius:var(--rm);cursor:pointer">';
      html+='<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:rgba(201,168,76,.12);color:var(--acc);flex-shrink:0">'+f.name.charAt(0).toUpperCase()+'</div>';
      html+='<div style="flex:1;min-width:0">';
      html+='<div style="font-size:13px;font-weight:500;color:var(--t);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+f.name+'</div>';
      html+='<div style="font-size:11px;color:var(--t3);display:flex;align-items:center;gap:8px;margin-top:2px"><span class="tag '+f.catTag+'" style="font-size:10px">'+f.cat+'</span><span class="tabular-nums">'+f.kcal+' kcal/100g</span></div>';
      html+='</div>';
      html+='<div style="display:flex;gap:4px;font-size:11px" class="tabular-nums">';
      html+='<span style="color:var(--blue)">B '+f.p+'g</span><span style="color:var(--orange)">S '+f.c+'g</span><span style="color:var(--purple)">T '+f.f+'g</span><span style="color:var(--green)">Vl '+(f.fi||0)+'g</span>';
      html+='</div>';
      html+='<div style="margin-left:6px">'+deleteBtn+'</div>';
      html+='</div>';
    });
    lv.innerHTML=html;
  }

  // cards
  var cg=document.getElementById('foods-cards-grid');
  if(cg){
    var html='';
    list.forEach(function(f){
      html+='<div class="n-card" onclick="openFoodDetail(\''+f.name+'\')" style="cursor:pointer"><div class="card-cover" style="height:80px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:28px;opacity:.5">📦</div><div class="card-body">';
      html+='<div class="card-title" style="font-size:13px;font-weight:500;margin-bottom:6px">'+f.name+'</div>';
      html+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--t3);margin-bottom:3px"><span>kcal</span><span class="tabular-nums" style="color:var(--t);font-weight:600">'+f.kcal+'</span></div>';
      html+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--t3);margin-bottom:3px"><span>B / S / T / Vl</span><span class="tabular-nums"><span style="color:var(--blue)">'+f.p+'</span> <span style="color:var(--orange)">'+f.c+'</span> <span style="color:var(--purple)">'+f.f+'</span> <span style="color:var(--green)">'+(f.fi||0)+'</span></span></div>';
      html+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--t3)"><span>Kategorie</span><span class="tag '+f.catTag+'" style="font-size:10px">'+f.cat+'</span></div>';
      html+='</div></div>';
    });
    cg.innerHTML=html;
  }
}

// ── FOOD DETAIL DIALOG ────────────────────────────────────────────────────────
function openFoodDetail(name){
  var f = FOODS_DB.find(function(x){return x.name===name;});
  if(!f) return;
  // Hero + header
  var heroName = document.getElementById('food-dlg-hero-name'); if(heroName) heroName.textContent = f.name;
  var heroCat = document.getElementById('food-dlg-hero-cat'); if(heroCat){ heroCat.textContent = f.cat; heroCat.className = 'tag '+f.catTag; heroCat.style.fontSize = '10px'; }
  var title = document.getElementById('food-dlg-title'); if(title) title.textContent = f.name;
  var subtitle = document.getElementById('food-dlg-subtitle'); if(subtitle) subtitle.textContent = f.note || '';
  // Macros
  ['kcal','p','c','f','fi'].forEach(function(k){
    var el = document.getElementById('food-dlg-'+k); if(!el) return;
    var val = f[k] || 0;
    el.textContent = k==='kcal' ? val : val+'g';
  });
  // Note
  var noteBlock = document.getElementById('food-dlg-note');
  var noteText = document.getElementById('food-dlg-note-text');
  if(noteBlock && noteText){
    if(f.note){ noteBlock.style.display = 'flex'; noteText.textContent = f.note; }
    else { noteBlock.style.display = 'none'; }
  }
  // Default to view mode
  setFoodDlgMode('view');
  openDialog('dlg-food-detail');
}

function setFoodDlgMode(mode){
  var view = document.getElementById('food-dlg-view');
  var edit = document.getElementById('food-dlg-edit');
  var inner = document.getElementById('food-dlg-detail-inner') || document.getElementById('dlg-food-detail-inner');
  var back = document.getElementById('food-dlg-footer-back');
  var actions = document.getElementById('food-dlg-footer-actions');
  if(view) view.style.display = mode==='view' ? '' : 'none';
  if(edit) edit.style.display = mode==='edit' ? '' : 'none';
  if(inner) inner.style.maxWidth = mode==='edit' ? '560px' : '500px';
  if(back){
    back.innerHTML = mode==='edit'
      ? '<button class="btn" onclick="setFoodDlgMode(\'view\')">← Zahodit změny</button>'
      : '';
  }
  if(actions){
    actions.innerHTML = mode==='view'
      ? '<button class="btn" onclick="closeDialog(\'dlg-food-detail\')">Zavřít</button>'
        +'<button class="btn primary" onclick="setFoodDlgMode(\'edit\')">✏ Upravit</button>'
      : '<button class="btn" onclick="closeDialog(\'dlg-food-detail\')">Zrušit</button>'
        +'<button class="btn primary" onclick="showToast(\'Potravina uložena\');setFoodDlgMode(\'view\')">Uložit změny</button>';
  }
}

// ── RECIPE DETAIL DIALOG ──────────────────────────────────────────────────────
function openRecipeDetail(recipeId){
  var r = (typeof RECIPES_DB !== 'undefined') ? RECIPES_DB.find(function(x){return x.recipeId===recipeId;}) : null;
  if(!r) return;
  var heroName = document.getElementById('recipe-dlg-hero-name'); if(heroName) heroName.textContent = r.name;
  var heroMeta = document.getElementById('recipe-dlg-hero-meta'); if(heroMeta) heroMeta.textContent = r.foodCount+' ingrediencí · '+(r.prepTime||'—')+' min';
  var title = document.getElementById('recipe-dlg-title'); if(title) title.textContent = r.name;
  var subtitle = document.getElementById('recipe-dlg-subtitle'); if(subtitle) subtitle.textContent = r.foodCount+' ingrediencí · '+(r.prepTime||'—')+' min';
  ['kcal','p','c','f','fi'].forEach(function(k){
    var el = document.getElementById('recipe-dlg-'+k); if(!el) return;
    var val = r[k] || 0;
    el.textContent = k==='kcal' ? val : val+'g';
  });
  openDialog('dlg-recipe-detail');
}

// ── RECIPES DATABASE ──────────────────────────────────────────────────────────
var RECIPES_DB = [
  { recipeId:'r1', name:'Losos s quinoou a grilovanou zeleninou', foodCount:6, prepTime:25, kcal:485, p:38, c:36, f:18, fi:6 },
  { recipeId:'r2', name:'Kuřecí salát Caesar', foodCount:8, prepTime:15, kcal:420, p:42, c:22, f:19, fi:4 },
  { recipeId:'r3', name:'Ovesná kaše s ovocem a oříšky', foodCount:5, prepTime:10, kcal:390, p:18, c:58, f:12, fi:8 },
  { recipeId:'r4', name:'Ryžové misky s tofu a zeleninou', foodCount:7, prepTime:20, kcal:510, p:28, c:72, f:14, fi:7 },
  { recipeId:'r5', name:'Tuňákové tortilly', foodCount:6, prepTime:12, kcal:450, p:35, c:44, f:15, fi:5 },
  { recipeId:'r6', name:'Vaječná omeleta se špenátem', foodCount:4, prepTime:8, kcal:310, p:26, c:8, f:20, fi:3 },
  { recipeId:'r7', name:'Tvarohový dezert s lesním ovocem', foodCount:4, prepTime:5, kcal:220, p:25, c:22, f:4, fi:4 },
  { recipeId:'r8', name:'Hovězí guláš s knedlíkem', foodCount:9, prepTime:90, kcal:620, p:38, c:58, f:24, fi:5 }
];

function switchRecipesView(v){
  var tbl=document.getElementById('recipes-table-view');
  var lst=document.getElementById('recipes-list-view');
  var crd=document.getElementById('recipes-cards-view');
  if(tbl) tbl.style.display=v==='table'?'block':'none';
  if(lst) lst.style.display=v==='list' ?'block':'none';
  if(crd) crd.style.display=v==='cards'?'block':'none';
  ['table','list','cards'].forEach(function(id){
    var el=document.getElementById('rv-'+id); if(el) el.classList.toggle('active',id===v);
  });
  renderRecipesGrid();
}

function toggleRecipesSortMenu(btn){
  var menu=document.getElementById('recipes-sort-menu'); if(!menu) return;
  menu.style.display=menu.style.display==='block'?'none':'block';
}

function setRecipesSort(key,el){
  if(_recipesSort.key===key) _recipesSort.dir=_recipesSort.dir==='asc'?'desc':'asc';
  else { _recipesSort.key=key; _recipesSort.dir='asc'; }
  document.querySelectorAll('#recipes-sort-menu .sort-opt').forEach(function(o){o.classList.remove('active');o.style.color='var(--t)';});
  if(el){ el.classList.add('active'); el.style.color='var(--acc)'; }
  document.getElementById('recipes-sort-menu').style.display='none';
  renderRecipesGrid();
}

function renderRecipesGrid(){
  var q=(document.getElementById('recipes-search')||{value:''}).value.toLowerCase();
  var list=RECIPES_DB.filter(function(r){return !q||r.name.toLowerCase().includes(q);});

  var dir=_recipesSort.dir==='asc'?1:-1;
  list.sort(function(a,b){
    var cmp=0;
    switch(_recipesSort.key){
      case 'name': cmp=a.name.localeCompare(b.name); break;
      case 'kcal': cmp=a.kcal-b.kcal; break;
      case 'protein': cmp=a.p-b.p; break;
      case 'carbs': cmp=a.c-b.c; break;
      case 'fat': cmp=a.f-b.f; break;
      case 'fiber': cmp=(a.fi||0)-(b.fi||0); break;
      case 'foodCount': cmp=a.foodCount-b.foodCount; break;
      case 'prepTime': cmp=(a.prepTime||0)-(b.prepTime||0); break;
    }
    return cmp*dir;
  });

  var deleteBtn='<button title="Smazat" onclick="event.stopPropagation();showToast(\'Recept smazán\')" style="background:none;border:none;padding:4px;color:var(--t3);cursor:pointer">🗑</button>';

  // table
  var tb=document.getElementById('recipes-tbody');
  if(tb){
    var html='';
    list.forEach(function(r){
      html+='<tr onclick="openRecipeDetail(\''+r.recipeId+'\')" style="cursor:pointer">';
      html+='<td><span class="row-title">'+r.name+'</span></td>';
      html+='<td class="tabular-nums" style="color:var(--t2)">'+r.foodCount+'</td>';
      html+='<td class="tabular-nums" style="color:var(--t3)">'+(r.prepTime?r.prepTime+' min':'—')+'</td>';
      html+='<td class="tabular-nums">'+r.kcal+'</td>';
      html+='<td class="tabular-nums" style="color:var(--blue)">'+r.p+'g</td>';
      html+='<td class="tabular-nums" style="color:var(--orange)">'+r.c+'g</td>';
      html+='<td class="tabular-nums" style="color:var(--purple)">'+r.f+'g</td>';
      html+='<td class="tabular-nums" style="color:var(--green)">'+(r.fi||0)+'g</td>';
      html+='<td>'+deleteBtn+'</td></tr>';
    });
    tb.innerHTML=html;
  }

  // list
  var lv=document.getElementById('recipes-list');
  if(lv){
    var html='';
    list.forEach(function(r){
      html+='<div onclick="openRecipeDetail(\''+r.recipeId+'\')" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--br);border-radius:var(--rm);cursor:pointer">';
      html+='<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;background:var(--acc-bg);color:var(--acc);flex-shrink:0">📖</div>';
      html+='<div style="flex:1;min-width:0">';
      html+='<div style="font-size:13px;font-weight:500;color:var(--t);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+r.name+'</div>';
      html+='<div style="font-size:11px;color:var(--t3);display:flex;align-items:center;gap:8px;margin-top:2px"><span>'+r.foodCount+' ingrediencí</span>'+(r.prepTime?'<span>· '+r.prepTime+' min</span>':'')+'<span class="tabular-nums">· '+r.kcal+' kcal</span></div>';
      html+='</div>';
      html+='<div style="display:flex;gap:4px;font-size:11px" class="tabular-nums">';
      html+='<span style="color:var(--blue)">B '+r.p+'g</span><span style="color:var(--orange)">S '+r.c+'g</span><span style="color:var(--purple)">T '+r.f+'g</span><span style="color:var(--green)">Vl '+(r.fi||0)+'g</span>';
      html+='</div>';
      html+='<div style="margin-left:6px">'+deleteBtn+'</div>';
      html+='</div>';
    });
    lv.innerHTML=html;
  }

  // cards
  var cg=document.getElementById('recipes-cards-grid');
  if(cg){
    var html='';
    list.forEach(function(r){
      html+='<div class="n-card" onclick="openRecipeDetail(\''+r.recipeId+'\')" style="cursor:pointer"><div class="card-cover" style="height:90px;background:linear-gradient(135deg,var(--acc-bg),var(--bg3));display:flex;align-items:center;justify-content:center;font-size:32px;opacity:.7">📖</div><div class="card-body">';
      html+='<div class="card-title" style="font-size:13px;font-weight:500;margin-bottom:6px">'+r.name+'</div>';
      html+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--t3);margin-bottom:3px"><span>kcal</span><span class="tabular-nums" style="color:var(--t);font-weight:600">'+r.kcal+'</span></div>';
      html+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--t3);margin-bottom:3px"><span>B / S / T / Vl</span><span class="tabular-nums"><span style="color:var(--blue)">'+r.p+'</span> <span style="color:var(--orange)">'+r.c+'</span> <span style="color:var(--purple)">'+r.f+'</span> <span style="color:var(--green)">'+(r.fi||0)+'</span></span></div>';
      html+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--t3);margin-bottom:3px"><span>Ingredience</span><span class="tabular-nums" style="color:var(--t)">'+r.foodCount+'</span></div>';
      if(r.prepTime){ html+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--t3)"><span>Doba</span><span class="tabular-nums" style="color:var(--t)">'+r.prepTime+' min</span></div>'; }
      html+='</div></div>';
    });
    cg.innerHTML=html;
  }
}

// ── PLAN FOOD DIALOG ──────────────────────────────────────────────────────────
var _selectedFood=null;
var _planFoodTab='foods';

function setSelectedFood(name){
  _selectedFood=name;
  renderPlanFoodSearch(document.getElementById('plan-food-search').value);
}
function setPlanFoodTab(tab,el){
  _planFoodTab=tab;
  document.querySelectorAll('#dlg-add-food-to-plan .chip').forEach(function(c){c.classList.remove('active');});
  el.classList.add('active');
  renderPlanFoodSearch('');
}
function filterPlanFoods(q){renderPlanFoodSearch(q);}
function renderPlanFoodSearch(q){
  var el=document.getElementById('plan-food-results'); if(!el) return;
  var list;
  if(_planFoodTab==='recipes'){
    list=RECIPES.filter(function(r){return !q||r.name.toLowerCase().includes(q.toLowerCase());});
    var html='';
    list.forEach(function(r){
      html+='<div class="food-opt" onclick="selectPlanItem(\''+r.name+'\','+r.kcal+','+r.p+','+r.c+','+r.f+')"><span>'+r.name+'</span><span class="food-opt-meta">'+r.kcal+' kcal · Recept</span></div>';
    });
    el.innerHTML=html||'<div style="padding:12px;text-align:center;font-size:13px;color:var(--t3)">Žádné recepty</div>';
    return;
  }
  if(_planFoodTab==='recent'){
    list=[FOODS_DB[0],FOODS_DB[1],FOODS_DB[2],FOODS_DB[10]];
  } else {
    list=FOODS_DB.filter(function(f){return !q||f.name.toLowerCase().includes(q.toLowerCase());});
  }
  var html='';
  list.forEach(function(f){
    var sel=_selectedFood===f.name;
    html+='<div class="food-opt" style="'+(sel?'background:var(--bga)':'')+'" onclick="selectPlanItem(\''+f.name+'\','+f.kcal+','+f.p+','+f.c+','+f.f+')"><span>'+(sel?'✓ ':'')+f.name+'</span><span class="food-opt-meta">'+f.kcal+' kcal/100g | B'+f.p+' S'+f.c+' T'+f.f+'</span></div>';
  });
  el.innerHTML=html||'<div style="padding:12px;text-align:center;font-size:13px;color:var(--t3)">Žádné výsledky</div>';
}
function selectPlanItem(name,kcal,p,c,f){
  _selectedFood=name;
  document.getElementById('plan-food-sel-name').textContent=name;
  document.getElementById('plan-food-selected').style.display='block';
  document.getElementById('plan-food-add-btn').disabled=false;
  updateFoodPreview();
  renderPlanFoodSearch(document.getElementById('plan-food-search').value);
}
function updateFoodPreview(){
  if(!_selectedFood) return;
  var fd=FOODS_DB.find(function(f){return f.name===_selectedFood;});
  if(!fd) return;
  var amt=parseInt(document.getElementById('plan-food-amt').value)||100;
  var r=amt/100;
  document.getElementById('plan-food-kcal').value=Math.round(fd.kcal*r)+' kcal';
  document.getElementById('plan-food-p').value=Math.round(fd.p*r*10)/10+' g';
  document.getElementById('plan-food-c').value=Math.round(fd.c*r*10)/10+' g';
  document.getElementById('plan-food-f').value=Math.round(fd.f*r*10)/10+' g';
}
function confirmAddFoodToPlan(){
  if(!_selectedFood) return;
  var amt=parseInt(document.getElementById('plan-food-amt').value)||100;
  currentMeals()[0].foods.push({name:_selectedFood,amt:amt});
  closeDialog('dlg-add-food-to-plan');
  renderNutrMeals();updateNutrSidebar();
  showToast(_selectedFood+' přidáno');
  _selectedFood=null;
  document.getElementById('plan-food-selected').style.display='none';
  document.getElementById('plan-food-add-btn').disabled=true;
}

// ── RECIPE SEARCH ─────────────────────────────────────────────────────────────
function searchRecipes(q){renderRecipeSearch(q);}
function renderRecipeSearch(q){
  var el=document.getElementById('recipe-results'); if(!el) return;
  var list=RECIPES.filter(function(r){return !q||r.name.toLowerCase().includes(q.toLowerCase());});
  var html='';
  list.forEach(function(r){
    html+='<div class="food-opt" onclick="selectRecipe(\''+r.name+'\')"><span>'+r.name+'</span><span class="food-opt-meta">'+r.kcal+' kcal · B'+r.p+' S'+r.c+' T'+r.f+'</span></div>';
  });
  el.innerHTML=html;
}
function selectRecipe(name){
  closeDialog('dlg-add-meal');showToast('Jídlo "'+name+'" přidáno');
}
function addMealToPlan(){
  closeDialog('dlg-add-meal');showToast('Jídlo přidáno do plánu');
}

// ── EXERCISE SEARCH ───────────────────────────────────────────────────────────
function searchExercises(q){renderExerciseSearch(q);}
function renderExerciseSearch(q){
  var el=document.getElementById('ex-search-results'); if(!el) return;
  var q2=(q||'').toLowerCase();
  var list=EXERCISES_DB.filter(function(e){return !q2||e.name.toLowerCase().includes(q2)||e.muscle.toLowerCase().includes(q2);});
  var html='';
  list.forEach(function(e){
    html+='<div class="food-opt" onclick="selectExercise(\''+e.name+'\')"><span>'+e.name+'</span><span class="food-opt-meta">'+e.muscle+' · '+e.equip+' · '+e.diff+'</span></div>';
  });
  el.innerHTML=html||'<div style="padding:12px;text-align:center;font-size:13px;color:var(--t3)">Nic nenalezeno</div>';
}
var _selectedEx=null;
function selectExercise(name){
  _selectedEx=name;
  document.querySelectorAll('#ex-search-results .food-opt').forEach(function(o){o.style.background='';});
  var opts=document.querySelectorAll('#ex-search-results .food-opt');
  opts.forEach(function(o){if(o.querySelector('span').textContent===name) o.style.background='var(--bga)';});
}
function addExercise(){
  if(!_selectedEx){showToast('Vyberte cvik'); return;}
  var sets=document.getElementById('ex-sets').value;
  var reps=document.getElementById('ex-reps').value;
  var weight=document.getElementById('ex-weight').value||'BW';
  var rest=document.getElementById('ex-rest').value;
  _trainingExercises.push({name:_selectedEx,sets:parseInt(sets),reps:reps,weight:weight,rest:parseInt(rest),open:false});
  closeDialog('dlg-add-exercise');
  renderTrainingExercises();
  showToast(_selectedEx+' přidán');
  _selectedEx=null;
}

// ── TRAINING EXERCISES ────────────────────────────────────────────────────────
var _trainingExercises=[
  {name:'Bench press s činkou',sets:4,reps:'8–10',weight:'80 kg',rest:90,open:true},
  {name:'Vojenský tlak',sets:3,reps:'10–12',weight:'55 kg',rest:90,open:false},
  {name:'Kliky na bradlech',sets:3,reps:'12',weight:'BW',rest:60,open:false},
];
function renderTrainingExercises(){
  var el=document.getElementById('training-exercises'); if(!el) return;
  var html='';
  _trainingExercises.forEach(function(ex,i){
    html+='<div class="ex-block"><div class="ex-hdr" onclick="toggleEx(this)">';
    html+='<span class="ex-chev'+(ex.open?' open':'')+'">▶</span>';
    html+='<span class="ex-name">'+ex.name+'</span>';
    html+='<span class="ex-meta">'+ex.sets+'×'+ex.reps+' · '+ex.weight+' · odpočinek '+ex.rest+'s</span>';
    html+='</div>';
    html+='<div class="ex-body'+(ex.open?' open':'')+'"><div class="ex-sets-hdr"><span>Série</span><span>Váha (kg)</span><span>Opak.</span><span>RPE</span><span>Poznámka</span></div>';
    for(var s=1;s<=ex.sets;s++){
      html+='<div class="ex-set-row"><span style="color:var(--t3)">'+s+'</span><span class="editable-val">'+ex.weight.replace(' kg','')+'</span><span class="editable-val">'+ex.reps+'</span><span class="editable-val">7</span><span class="editable-val" style="color:var(--t3)">—</span></div>';
    }
    html+='</div></div>';
  });
  el.innerHTML=html;
}
function toggleEx(hdr){
  var chev=hdr.querySelector('.ex-chev');
  var body=hdr.nextElementSibling;
  var isOpen=body.classList.contains('open');
  body.classList.toggle('open',!isOpen);
  if(chev) chev.classList.toggle('open',!isOpen);
}

// ── MESSAGES ─────────────────────────────────────────────────────────────────
var _messages=[
  {from:'client',name:'Petra Horáková',av:'av-pink',initials:'PH',text:'Ahoj Marku! Nový tréninkový plán vypadá skvěle 💪',time:'13:48'},
  {from:'trainer',name:'Marek Trenér',av:'',initials:'MT',text:'Díky Petro! Jak se cítíš po prvním tréninku?',time:'13:52'},
  {from:'client',name:'Petra Horáková',av:'av-pink',initials:'PH',text:'Super! Mám otázku ohledně jídelníčku – 80 g rýže je suchá nebo uvařená?',time:'14:11'},
  {from:'trainer',name:'Marek Trenér',av:'',initials:'MT',text:'Vždy suchá gramáž 😊 Uvařená váží přibližně 2,5× více.',time:'14:22'},
];
function renderMessages(){
  var el=document.getElementById('msg-list'); if(!el) return;
  var html='';
  _messages.forEach(function(m){
    var isT=m.from==='trainer';
    html+='<div class="msg-item"><div class="msg-av '+(isT?'':''+m.av)+'" style="'+(isT?'background:var(--t)':'')+'">'+m.initials+'</div>';
    html+='<div class="msg-body"><div class="msg-meta"><span class="msg-name">'+m.name+'</span><span class="msg-time">'+m.time+'</span></div>';
    html+='<div class="msg-text">'+m.text+'</div></div></div>';
  });
  el.innerHTML=html;
  el.scrollTop=el.scrollHeight;
}
function sendMsg(){
  var inp=document.getElementById('msg-inp');
  var txt=inp.value.trim(); if(!txt) return;
  _messages.push({from:'trainer',name:'Marek Trenér',av:'',initials:'MT',text:txt,time:new Date().getHours()+':'+String(new Date().getMinutes()).padStart(2,'0')});
  inp.value='';
  renderMessages();
}

// ── NUTRITION INIT ────────────────────────────────────────────────────────────
function initNutrition(){
  NUTRITION.weeks=[];
  for(var w=0;w<NUTRITION.totalWeeks;w++){
    var days=[];
    for(var d=0;d<7;d++) days.push({meals:JSON.parse(JSON.stringify(tmplMeals()))});
    NUTRITION.weeks.push({days:days,fromTemplate:w>0});
  }
}

// ── NUTRITION RENDER ──────────────────────────────────────────────────────────
function renderNutrWeekTabs(){
  var el=document.getElementById('nutr-week-tabs'); if(!el) return;
  var html='';
  for(var w=0;w<NUTRITION.totalWeeks;w++){
    var isAct=w===NUTRITION.currentWeek;
    var isTmpl=w===0;
    var avg=weekAvgKcal(w);
    html+='<div class="wtab'+(isAct?' active':'')+(isTmpl?' tmpl':'')+'" onclick="nutrSwitchWeek('+w+')">';
    html+='<span>Týden '+(w+1)+'</span><span class="wb">'+(isTmpl?'šablona':avg?avg+' kcal':'—')+'</span></div>';
  }
  el.innerHTML=html;
}
function weekAvgKcal(w){
  var t=0,c=0;
  for(var d=0;d<7;d++){var k=calcDay(w,d).kcal;if(k>0){t+=k;c++;}}
  return c?Math.round(t/c):0;
}
function renderNutrDayTabs(){
  var el=document.getElementById('nutr-day-tabs'); if(!el) return;
  var days=['Po','Út','St','Čt','Pá','So','Ne'];
  var html='';
  days.forEach(function(d,i){
    var k=calcDay(NUTRITION.currentWeek,i).kcal;
    var isAct=i===NUTRITION.currentDay;
    html+='<div class="dtab'+(isAct?' active':'')+'" onclick="nutrSwitchDay('+i+')"><span>'+d+'</span><span class="dk">'+(k||'—')+'</span></div>';
  });
  el.innerHTML=html;
}
function nutrSwitchWeek(w){NUTRITION.currentWeek=w;NUTRITION.currentDay=0;renderNutrWeekTabs();renderNutrDayTabs();renderNutrMeals();updateNutrSidebar();}
function nutrSwitchDay(d){NUTRITION.currentDay=d;renderNutrDayTabs();renderNutrMeals();updateNutrSidebar();}

function renderNutrMeals(){
  var el=document.getElementById('nutr-meals'); if(!el) return;
  var html='';
  currentMeals().forEach(function(meal,mi){
    var tot=calcMeal(meal);
    html+='<div class="food-section">';
    html+='<div class="food-sec-hdr"><span style="font-size:10px;color:var(--t3);cursor:pointer;margin-right:2px" onclick="toggleMeal('+mi+')">▶</span>';
    html+='<span class="food-sec-title">'+meal.name+' <span style="font-weight:400;color:var(--t3);font-size:12px">'+meal.time+'</span></span>';
    html+='<span class="food-sec-total">'+tot.kcal+' kcal · B'+tot.p+' S'+tot.c+' T'+tot.f+'</span></div>';
    if(meal.open){
      html+='<div class="food-col-hdr"><span>Potravina</span><span style="text-align:left">Množství</span><span>kcal</span><span>B</span><span>S</span><span>T</span><span></span></div>';
      meal.foods.forEach(function(fd,fi){
        var n=calcFood(fd.name,fd.amt);
        html+='<div class="food-row"><span class="fd-name">'+fd.name+'</span>';
        html+='<span class="fd-amt"><span class="fd-editable" contenteditable="true" data-mi="'+mi+'" data-fi="'+fi+'">'+fd.amt+'</span> g</span>';
        html+='<span class="fd-num">'+n.kcal+'</span>';
        html+='<span class="fd-num" style="color:var(--blue)">'+n.p+'</span>';
        html+='<span class="fd-num" style="color:var(--orange)">'+n.c+'</span>';
        html+='<span class="fd-num" style="color:var(--purple)">'+n.f+'</span>';
        html+='<span class="fd-del" data-mi="'+mi+'" data-fi="'+fi+'">✕</span></div>';
      });
      html+='<div class="food-add-row"><span style="color:var(--t4)">+</span><input class="food-add-inp" placeholder="Přidat potravinu..." data-mi="'+mi+'" oninput="nutrFoodSearch(this)"><div class="food-dropdown" data-dmi="'+mi+'"></div></div>';
    }
    html+='</div>';
  });
  el.innerHTML=html;
  // Bind editable events
  el.querySelectorAll('.fd-editable').forEach(function(e){
    e.addEventListener('blur',function(){
      var v=parseInt(this.textContent)||0;
      var mi=parseInt(this.dataset.mi),fi=parseInt(this.dataset.fi);
      currentMeals()[mi].foods[fi].amt=v;
      nutrMarkUnsaved();renderNutrMeals();updateNutrSidebar();renderNutrDayTabs();
    });
    e.addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();this.blur();}});
  });
  el.querySelectorAll('.fd-del').forEach(function(e){
    e.addEventListener('click',function(ev){
      ev.stopPropagation();
      currentMeals()[parseInt(this.dataset.mi)].foods.splice(parseInt(this.dataset.fi),1);
      nutrMarkUnsaved();renderNutrMeals();updateNutrSidebar();renderNutrDayTabs();
    });
  });
}

function toggleMeal(mi){currentMeals()[mi].open=!currentMeals()[mi].open;renderNutrMeals();}

function nutrFoodSearch(inp){
  var q=inp.value.toLowerCase().trim();
  var mi=parseInt(inp.dataset.mi);
  var dd=inp.parentElement.querySelector('.food-dropdown');
  if(!q){dd.classList.remove('open');return;}
  var res=FOODS_DB.filter(function(f){return f.name.toLowerCase().includes(q);}).slice(0,8);
  var html='';
  res.forEach(function(f){
    html+='<div class="food-opt" onmousedown="nutrAddFood(event,\''+f.name+'\','+mi+',this)"><span>'+f.name+'</span><span class="food-opt-meta">'+f.kcal+' kcal/100g</span></div>';
  });
  dd.innerHTML=html;
  dd.classList.toggle('open',res.length>0);
  inp.addEventListener('blur',function(){setTimeout(function(){dd.classList.remove('open');},120);},{once:true});
}
function nutrAddFood(ev,name,mi,el){
  ev.preventDefault();
  currentMeals()[mi].foods.push({name:name,amt:100});
  el.closest('.food-dropdown').classList.remove('open');
  nutrMarkUnsaved();renderNutrMeals();updateNutrSidebar();renderNutrDayTabs();renderNutrWeekTabs();
  showToast(name+' přidáno');
}

var _nutrSaveTimer;
function nutrMarkUnsaved(){
  var el=document.getElementById('nutr-save-ind'); if(!el) return;
  el.textContent='Ukládám...'; el.style.color='var(--t3)';
  clearTimeout(_nutrSaveTimer);
  _nutrSaveTimer=setTimeout(function(){var e=document.getElementById('nutr-save-ind');if(e){e.textContent='Uloženo';e.style.color='var(--green)';}},900);
}

function updateNutrSidebar(){
  var d=calcDay();
  var g=NUTRITION.goals;
  var el=document.getElementById('nutr-kcal-big'); if(!el) return;
  el.textContent=d.kcal.toLocaleString('cs');
  var rem=g.kcal-d.kcal;
  var remEl=document.getElementById('nutr-kcal-rem');
  remEl.textContent=rem>=0?'Zbývá '+rem+' kcal':'Překročeno o '+Math.abs(rem)+' kcal';
  remEl.style.color=rem>=0?'var(--green)':'var(--red)';
  var pk=pct(d.kcal,g.kcal);
  var pbk=document.getElementById('nutr-pb-kcal');
  pbk.style.width=pk+'%'; pbk.style.background=pk>100?'var(--red)':'var(--acc)';
  document.getElementById('nutr-protein').textContent=d.p+'g';
  document.getElementById('nutr-pb-p').style.width=pct(d.p,g.p)+'%';
  document.getElementById('nutr-carbs').textContent=d.c+'g';
  document.getElementById('nutr-pb-c').style.width=pct(d.c,g.c)+'%';
  document.getElementById('nutr-fat').textContent=d.f+'g';
  document.getElementById('nutr-pb-f').style.width=pct(d.f,g.f)+'%';
  var total=d.p*4+d.c*4+d.f*9||1;
  document.getElementById('nutr-sb-p').style.width=Math.round(d.p*4/total*100)+'%';
  document.getElementById('nutr-sb-c').style.width=Math.round(d.c*4/total*100)+'%';
  document.getElementById('nutr-sb-f').style.width=Math.round(d.f*9/total*100)+'%';
}

function publishPlan(){showToast('Plán publikován — Petra Horáková ho uvidí v mobilní aplikaci');}
function completePlan(){
  closeDialog('dlg-complete-plan');
  // Update status tag in training screen
  var tTag=document.querySelector('#s-training .tag.tag-green');
  if(tTag){tTag.className='tag tag-acc';tTag.textContent='Dokončený';}
  // Update client detail plan mentions
  var plansRow=document.querySelector('#s-client .prop-val .mention');
  // Show toast
  showToast('Plán označen jako dokončený — klient byl informován');
}

// ── SHOPPING LIST ─────────────────────────────────────────────────────────────
function renderShoppingList(){
  var el=document.getElementById('shopping-list-content'); if(!el) return;
  var items={};
  for(var w=0;w<2;w++){
    NUTRITION.weeks[w].days.forEach(function(day){
      day.meals.forEach(function(meal){
        meal.foods.forEach(function(fd){items[fd.name]=(items[fd.name]||0)+fd.amt;});
      });
    });
  }
  var cats={Proteiny:[],Sacharidy:[],Zelenina:[],Ovoce:[],Mléčné:[],Tuky:[],Ostatní:[]};
  Object.keys(items).forEach(function(name){
    var fd=FOODS_DB.find(function(f){return f.name===name;})||{cat:'Ostatní'};
    var c=cats[fd.cat]||cats['Ostatní'];
    c.push({name:name,amt:items[name]});
  });
  var html='';
  Object.keys(cats).forEach(function(cat){
    if(!cats[cat].length) return;
    html+='<div style="font-size:12px;font-weight:600;color:var(--t);margin:10px 0 4px">'+cat+'</div>';
    cats[cat].forEach(function(it){
      html+='<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--br);font-size:13px">';
      html+='<div style="width:16px;height:16px;border:1px solid var(--brm);border-radius:3px;flex-shrink:0;cursor:pointer" onclick="this.innerHTML=this.innerHTML?\'\':(\'✓\');this.style.background=this.innerHTML?\'var(--green)\':\'\'"></div>';
      html+='<span style="flex:1">'+it.name+'</span><span style="color:var(--t3);font-size:12px">'+it.amt+' g</span></div>';
    });
  });
  el.innerHTML=html;
}
function exportShoppingList(){closeDialog('dlg-shopping-list');showToast('PDF nákupní seznam stažen');}

// ── NEW FOOD CHECK ─────────────────────────────────────────────────────────────
function calcNewFoodCheck(){
  var kcal=parseFloat(document.getElementById('new-food-kcal').value)||0;
  var p=parseFloat(document.getElementById('new-food-p').value)||0;
  var c=parseFloat(document.getElementById('new-food-c').value)||0;
  var f=parseFloat(document.getElementById('new-food-f').value)||0;
  var calc=Math.round(p*4+c*4+f*9);
  var el=document.getElementById('new-food-check'); if(!el) return;
  if(!kcal||!calc){el.textContent='';return;}
  var diff=Math.abs(kcal-calc);
  var ok=diff/Math.max(kcal,1)<0.1;
  el.textContent=ok?'✓ Makra sedí ('+calc+' kcal)':'⚠ Nesedí ('+calc+' kcal)';
  el.style.color=ok?'var(--green)':'var(--orange)';
}
function saveNewFood(){
  var name=document.getElementById('new-food-name').value.trim();
  if(!name){showToast('Zadejte název');return;}
  var cat=document.getElementById('new-food-cat').value;
  var kcal=parseFloat(document.getElementById('new-food-kcal').value)||0;
  var p=parseFloat(document.getElementById('new-food-p').value)||0;
  var c=parseFloat(document.getElementById('new-food-c').value)||0;
  var f=parseFloat(document.getElementById('new-food-f').value)||0;
  FOODS_DB.unshift({name:name,cat:cat,catTag:'tag-acc',kcal:kcal,p:p,c:c,f:f,src:'Vlastní',custom:true});
  closeDialog('dlg-add-food');
  renderFoods();
  showToast('"'+name+'" uložena do databáze');
}

function saveGoals(){showToast('Cíle a makra uloženy');}

// ── INIT ──────────────────────────────────────────────────────────────────────
// ── AUTH ─────────────────────────────────────────────────────────────────────
var _selectedRole = null;
var _regStep = 1;

function togglePassword(id, btn) {
  var inp = document.getElementById(id);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? 'Zobrazit' : 'Skrýt';
}

function checkPwReqs(val, prefix) {
  prefix = prefix || '';
  var map = {
    'req-len':   val.length >= 8,
    'req-upper': /[A-Z]/.test(val),
    'req-lower': /[a-z]/.test(val),
    'req-num':   /[0-9]/.test(val),
  };
  var fmap = {
    'freq-len':   val.length >= 8,
    'freq-upper': /[A-Z]/.test(val),
    'freq-lower': /[a-z]/.test(val),
    'freq-num':   /[0-9]/.test(val),
  };
  var target = prefix === 'f' ? fmap : map;
  Object.keys(target).forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('met', target[id]);
  });
}

function toggleCheck(wrap) {
  var cb = wrap.querySelector('.auth-checkbox');
  if (!cb) return;
  cb.classList.toggle('checked');
  cb.textContent = cb.classList.contains('checked') ? '✓' : '';
}

function selectRole(role) {
  _selectedRole = role;
  ['trainer','nutritionist','both','client'].forEach(function(r) {
    var el = document.getElementById('role-' + r);
    if (el) el.classList.toggle('selected', r === role);
  });
}

function checkStrength(val) {
  var bars = ['sb1','sb2','sb3','sb4'];
  var fbars = ['fsb1','fsb2','fsb3','fsb4'];
  var score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  var labels = ['', 'Slabé', 'Průměrné', 'Silné', 'Velmi silné'];
  var cls = ['', 'weak', 'medium', 'strong', 'strong'];
  // primary bars
  bars.forEach(function(id, i) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'strength-bar' + (i < score ? ' ' + cls[score] : '');
  });
  // forgot bars
  fbars.forEach(function(id, i) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'strength-bar' + (i < score ? ' ' + cls[score] : '');
  });
  var lbl = document.getElementById('strength-label');
  if (lbl) { lbl.textContent = val ? labels[score] : ''; lbl.style.color = score <= 1 ? 'var(--red)' : score === 2 ? 'var(--orange)' : 'var(--green)'; }
}

function regNext(step) {
  if (step === 1) {
    if (!_selectedRole) { showToast('Vyberte svou roli'); return; }
    document.getElementById('reg-s1').style.display = 'none';
    document.getElementById('reg-s2').style.display = '';
    document.getElementById('reg-step-1').className = 'auth-step done';
    document.getElementById('reg-step-1').textContent = '✓';
    document.getElementById('reg-step-2').className = 'auth-step active';
    _regStep = 2;
  } else if (step === 2) {
    var email = (document.getElementById('reg-email')||{}).value || '';
    var pass  = (document.getElementById('reg-password')||{}).value || '';
    var pass2 = (document.getElementById('reg-password2')||{}).value || '';
    if (!email || !pass) { showToast('Vyplňte email a heslo'); return; }
    if (pass.length < 8) { showToast('Heslo musí mít alespoň 8 znaků'); return; }
    if (pass !== pass2) { showToast('Hesla se neshodují'); return; }
    document.getElementById('reg-s2').style.display = 'none';
    document.getElementById('reg-s3').style.display = '';
    document.getElementById('reg-step-2').className = 'auth-step done';
    document.getElementById('reg-step-2').textContent = '✓';
    document.getElementById('reg-step-3').className = 'auth-step active';
    _regStep = 3;
  }
}

function regBack(step) {
  if (step === 2) {
    document.getElementById('reg-s2').style.display = 'none';
    document.getElementById('reg-s1').style.display = '';
    document.getElementById('reg-step-1').className = 'auth-step active';
    document.getElementById('reg-step-1').textContent = '1';
    document.getElementById('reg-step-2').className = 'auth-step';
    document.getElementById('reg-step-2').textContent = '2';
    _regStep = 1;
  } else if (step === 3) {
    document.getElementById('reg-s3').style.display = 'none';
    document.getElementById('reg-s2').style.display = '';
    document.getElementById('reg-step-2').className = 'auth-step active';
    document.getElementById('reg-step-2').textContent = '2';
    document.getElementById('reg-step-3').className = 'auth-step';
    document.getElementById('reg-step-3').textContent = '3';
    _regStep = 2;
  }
}

function finishRegister() {
  var cb1 = document.getElementById('consent-terms');
  var cb2 = document.getElementById('consent-health');
  if (!cb1 || !cb1.classList.contains('checked')) { showToast('Potvrďte obchodní podmínky'); return; }
  if (!cb2 || !cb2.classList.contains('checked')) { showToast('Potvrďte souhlas se zpracováním zdravotních dat'); return; }
  var email = (document.getElementById('reg-email')||{}).value || 'vas@email.cz';
  document.getElementById('reg-s3').style.display = 'none';
  document.getElementById('reg-s4').style.display = '';
  document.getElementById('reg-step-3').className = 'auth-step done';
  document.getElementById('reg-step-3').textContent = '✓';
  var ce = document.getElementById('reg-confirm-email');
  if (ce) ce.textContent = email;
}

function doLogin() {
  var email = (document.getElementById('login-email')||{}).value || '';
  var pass  = (document.getElementById('login-password')||{}).value || '';
  if (!email || !pass) { showToast('Vyplňte email a heslo'); return; }
  showToast('Přihlašování...');
  setTimeout(function() { showScreen('s-dashboard'); showToast('Vítejte zpět!'); }, 800);
}

function doForgot() {
  var email = (document.getElementById('forgot-email')||{}).value || '';
  if (!email) { showToast('Zadejte email'); return; }
  showForgotStep(2);
  var ce = document.getElementById('forgot-confirm-email');
  if (ce) ce.textContent = email;
}

function showForgotStep(n) {
  [1,2,3].forEach(function(i) {
    var el = document.getElementById('forgot-s' + i);
    if (el) el.style.display = i === n ? '' : 'none';
  });
}

function doResetPassword() {
  var p1 = (document.getElementById('new-password')||{}).value || '';
  var p2 = (document.getElementById('new-password2')||{}).value || '';
  if (!p1 || p1.length < 8) { showToast('Heslo musí mít alespoň 8 znaků'); return; }
  if (p1 !== p2) { showToast('Hesla se neshodují'); return; }
  showToast('Heslo bylo změněno!');
  setTimeout(function() { showScreen('s-login'); }, 900);
}

buildSidebar('sb-dashboard','s-dashboard');

// ── Section templates ──────────────────────────────────────────────────────────
var _tplView='table';
var _tplFilter='all';
var _tplSearch='';

function switchTemplatesView(v){
  _tplView=v;
  document.querySelectorAll('#templates-table-view,#templates-list-view,#templates-cards-view').forEach(function(el){el.style.display='none';});
  document.getElementById('templates-'+v+'-view').style.display='';
  document.querySelectorAll('#tv-table,#tv-list,#tv-cards').forEach(function(el){el.classList.remove('active');});
  document.getElementById('tv-'+v).classList.add('active');
  renderSectionTemplates();
}

function filterTemplates(t){
  _tplFilter=t;
  renderSectionTemplates();
}

function searchTemplates(q){_tplSearch=(q||'').toLowerCase();renderSectionTemplates();}

function renderSectionTemplates(){
  if(typeof SECTION_TEMPLATES_DB==='undefined') return;
  var list = SECTION_TEMPLATES_DB.filter(function(t){
    if(_tplFilter!=='all' && t.type!==_tplFilter) return false;
    if(_tplSearch && !t.name.toLowerCase().includes(_tplSearch) && !t.desc.toLowerCase().includes(_tplSearch)) return false;
    return true;
  });
  // Table
  var tbody = document.getElementById('templates-tbody'); if(tbody){
    tbody.innerHTML = list.map(function(t){
      var clr = sectionTypeColor(t.type);
      var pillStyle = clr.indexOf('var(')===0
        ? 'background:var(--acc-bg);color:var(--acc);border:1px solid var(--acc-br)'
        : 'background:'+clr+'1f;color:'+clr+';border:1px solid '+clr+'4d';
      return '<tr class="db-row" onclick="openDialog(\'dlg-section-template\')">'
        +'<td><div style="font-weight:600;color:var(--t)">'+t.name+'</div><div style="font-size:11px;color:var(--t3);margin-top:1px">'+t.desc+'</div></td>'
        +'<td><span class="tag" style="'+pillStyle+'">'+t.type+'</span></td>'
        +'<td>'+t.exercises+'</td>'
        +'<td>~'+t.durationMin+' min</td>'
        +'<td style="color:var(--t2)">'+t.configSummary+'</td>'
        +'<td style="color:var(--t3)">'+t.used+'×</td>'
        +'<td style="text-align:right"><button class="btn" style="font-size:12px;padding:4px 10px" onclick="event.stopPropagation();showToast(\'Šablona vložena do plánu\')">Použít</button></td>'
        +'</tr>';
    }).join('');
  }
  // List view
  var listEl = document.getElementById('templates-list'); if(listEl){
    listEl.innerHTML = list.map(function(t){
      var clr = sectionTypeColor(t.type);
      var pillStyle = clr.indexOf('var(')===0
        ? 'background:var(--acc-bg);color:var(--acc);border:1px solid var(--acc-br)'
        : 'background:'+clr+'1f;color:'+clr+';border:1px solid '+clr+'4d';
      return '<div onclick="openDialog(\'dlg-section-template\')" style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:var(--bg2);border:1px solid var(--br);border-radius:8px;cursor:pointer">'
        +'<span class="tag" style="'+pillStyle+';flex-shrink:0">'+t.type+'</span>'
        +'<div style="flex:1;min-width:0"><div style="font-weight:600;color:var(--t)">'+t.name+'</div><div style="font-size:12px;color:var(--t3);margin-top:1px">'+t.desc+'</div></div>'
        +'<div style="text-align:right;color:var(--t3);font-size:12px;flex-shrink:0">'+t.exercises+' cv. · ~'+t.durationMin+' min<br><span>'+t.configSummary+'</span></div>'
        +'<button class="btn" style="font-size:12px;padding:5px 12px" onclick="event.stopPropagation();showToast(\'Šablona vložena do plánu\')">Použít</button>'
        +'</div>';
    }).join('');
  }
  // Cards view
  var grid = document.getElementById('templates-cards-grid'); if(grid){
    grid.innerHTML = list.map(function(t){
      var clr = sectionTypeColor(t.type);
      var pillStyle = clr.indexOf('var(')===0
        ? 'background:var(--acc-bg);color:var(--acc);border:1px solid var(--acc-br)'
        : 'background:'+clr+'1f;color:'+clr+';border:1px solid '+clr+'4d';
      return '<div onclick="openDialog(\'dlg-section-template\')" style="background:var(--bg2);border:1px solid var(--br);border-radius:10px;padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:10px">'
        +'<div style="display:flex;align-items:center;justify-content:space-between"><span class="tag" style="'+pillStyle+'">'+t.type+'</span><span style="font-size:11px;color:var(--t3)">Použito '+t.used+'×</span></div>'
        +'<div><div style="font-weight:700;color:var(--t)">'+t.name+'</div><div style="font-size:12px;color:var(--t3);margin-top:3px;line-height:1.4">'+t.desc+'</div></div>'
        +'<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--t3);padding-top:8px;border-top:1px solid var(--br)"><span>'+t.exercises+' cviků · ~'+t.durationMin+' min</span><span style="color:var(--t)">'+t.configSummary+'</span></div>'
        +'<button class="btn" style="font-size:12px;padding:6px;width:100%;margin-top:2px" onclick="event.stopPropagation();showToast(\'Šablona vložena do plánu\')">Použít</button>'
        +'</div>';
    }).join('');
  }
}

function dlgTemplateOnTypeChange(sel){
  var v=sel.value;
  var cfg=document.getElementById('dlg-tpl-config');
  if(cfg) cfg.style.display=(v==='Strength'||v==='Conditioning')?'none':'';
}
renderDashboard();
