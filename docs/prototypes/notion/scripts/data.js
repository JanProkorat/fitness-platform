
// ── DATA ─────────────────────────────────────────────────────────────────────
var CLIENTS = [
  {id:1,name:'Petra Horáková',initials:'PH',av:'av-pink',goal:'Hubnutí',tag:'tag-blue',compliance:95,streak:21,kcal:1640,kcalGoal:1700,trains:4,trainsGoal:4,last:'dnes',lastColor:'var(--green)'},
  {id:2,name:'Tomáš Novák',initials:'TN',av:'av-teal',goal:'Nabírání',tag:'tag-purple',compliance:87,streak:12,kcal:2840,kcalGoal:2900,trains:3,trainsGoal:4,last:'dnes',lastColor:'var(--green)'},
  {id:3,name:'Lucie Procházková',initials:'LP',av:'av-green',goal:'Zdraví',tag:'tag-green',compliance:100,streak:34,kcal:1890,kcalGoal:1900,trains:3,trainsGoal:3,last:'dnes',lastColor:'var(--green)'},
  {id:4,name:'Jakub Malý',initials:'JM',av:'av-purple',goal:'Výkonnost',tag:'tag-orange',compliance:52,streak:4,kcal:3100,kcalGoal:3200,trains:2,trainsGoal:5,last:'3 dny',lastColor:'var(--t3)'},
  {id:5,name:'Martin Červenka',initials:'MC',av:'av-orange',goal:'Síla',tag:'tag-gray',compliance:35,streak:2,kcal:2650,kcalGoal:2800,trains:1,trainsGoal:4,last:'5 dní',lastColor:'var(--red)'},
];

var FOODS_DB = [
  {name:'Kuřecí prsa',cat:'Proteiny',catTag:'tag-blue',kcal:115,p:21.5,c:0,f:2.5,fi:0,note:'Libové, bez vidit. tuku',src:'OFF',custom:false},
  {name:'Ovesné vločky',cat:'Sacharidy',catTag:'tag-orange',kcal:370,p:13,c:64,f:7,fi:10,note:'Jemné, ne instantní',src:'OFF',custom:false},
  {name:'Losos',cat:'Proteiny',catTag:'tag-blue',kcal:206,p:20,c:0,f:13,fi:0,note:'Divoký aljašský',src:'OFF',custom:false},
  {name:'Řecký jogurt 0%',cat:'Mléčné',catTag:'tag-gray',kcal:59,p:10,c:5,f:0.5,fi:0,note:null,src:'OFF',custom:false},
  {name:'Protein WPC 80',cat:'Suplementy',catTag:'tag-purple',kcal:113,p:24,c:3,f:1.5,fi:0,note:'Vanilka',src:'Vlastní',custom:true},
  {name:'Batáty',cat:'Sacharidy',catTag:'tag-orange',kcal:86,p:1.6,c:20,f:0.1,fi:3,note:null,src:'OFF',custom:false},
  {name:'Vejce L',cat:'Proteiny',catTag:'tag-blue',kcal:155,p:13,c:1.1,f:11,fi:0,note:null,src:'OFF',custom:false},
  {name:'Avokádo',cat:'Tuky',catTag:'tag-green',kcal:160,p:2,c:9,f:15,fi:7,note:null,src:'OFF',custom:false},
  {name:'Borůvky',cat:'Ovoce',catTag:'tag-green',kcal:57,p:0.7,c:14,f:0.3,fi:2.4,note:null,src:'OFF',custom:false},
  {name:'Brokolice',cat:'Zelenina',catTag:'tag-green',kcal:34,p:3,c:5,f:0.4,fi:2.6,note:'Syrová',src:'OFF',custom:false},
  {name:'Tvaroh 0%',cat:'Mléčné',catTag:'tag-gray',kcal:73,p:12,c:4,f:0.6,fi:0,note:null,src:'OFF',custom:false},
  {name:'Banán',cat:'Ovoce',catTag:'tag-green',kcal:89,p:1.1,c:23,f:0.3,fi:2.6,note:null,src:'OFF',custom:false},
  {name:'Hnědá rýže',cat:'Sacharidy',catTag:'tag-orange',kcal:360,p:7.5,c:75,f:2.5,fi:3.4,note:null,src:'OFF',custom:false},
];

var EXERCISES_DB = [
  {name:'Bench press s činkou',muscle:'Prsa',equip:'Osa',diff:'Střední'},
  {name:'Vojenský tlak',muscle:'Ramena',equip:'Osa',diff:'Střední'},
  {name:'Přítahy na hrazdě',muscle:'Záda',equip:'Vlastní váha',diff:'Střední'},
  {name:'Dřep',muscle:'Nohy',equip:'Osa',diff:'Střední'},
  {name:'Mrtvý tah',muscle:'Záda',equip:'Osa',diff:'Pokročilý'},
  {name:'Kliky na bradlech',muscle:'Prsa',equip:'Vlastní váha',diff:'Střední'},
  {name:'Bicepsový zdvih',muscle:'Paže',equip:'Jednoručky',diff:'Začátečník'},
  {name:'Leg press',muscle:'Nohy',equip:'Stroj',diff:'Začátečník'},
  {name:'Přítahy na kladce',muscle:'Záda',equip:'Kladka',diff:'Začátečník'},
  {name:'Seated row',muscle:'Záda',equip:'Kladka',diff:'Začátečník'},
  {name:'Šikmý bench press',muscle:'Prsa',equip:'Osa',diff:'Střední'},
  {name:'Tricepsový pushdown',muscle:'Paže',equip:'Kladka',diff:'Začátečník'},
  {name:'Rumunský mrtvý tah',muscle:'Nohy',equip:'Osa',diff:'Pokročilý'},
];

var RECIPES = [
  {name:'Kuřecí bowl s rýží',kcal:520,p:45,c:40,f:12},
  {name:'Ovesná kaše s ovocem',kcal:380,p:18,c:62,f:8},
  {name:'Losos s batáty',kcal:490,p:38,c:36,f:20},
  {name:'Tvarohový dezert',kcal:220,p:22,c:24,f:4},
  {name:'Řecký salát s tuňákem',kcal:310,p:32,c:12,f:15},
];

var NUTRITION = {
  goals:{kcal:1700,p:130,c:180,f:55},
  totalWeeks:12,
  currentWeek:0,
  currentDay:0,
  weeks:[],
};

function tmplMeals(){
  return [
    {name:'Snídaně',time:'07:30',open:true,foods:[{name:'Ovesné vločky',amt:80},{name:'Řecký jogurt 0%',amt:150},{name:'Borůvky',amt:80}]},
    {name:'Oběd',time:'13:00',open:true,foods:[{name:'Kuřecí prsa',amt:160},{name:'Hnědá rýže',amt:80},{name:'Brokolice',amt:150}]},
    {name:'Svačina',time:'16:30',open:false,foods:[{name:'Tvaroh 0%',amt:150},{name:'Banán',amt:100}]},
    {name:'Večeře',time:'19:00',open:false,foods:[{name:'Losos',amt:180},{name:'Batáty',amt:180}]},
  ];
}

var SECTION_TEMPLATES_DB = [
  { name:'Klasický rozcvičkový blok', type:'Strength',     desc:'Dynamická mobilizace kloubů a aktivace svalových skupin před silovým blokem.', exercises:5, durationMin:5,  configSummary:'—',                 used:12 },
  { name:'5×5 dřepy + tlak',          type:'Strength',     desc:'Klasický silový 5×5 blok — dřep s velkou činkou a tlak na lavici.',          exercises:2, durationMin:25, configSummary:'5×5 reps',            used:8  },
  { name:'12-min AMRAP — Push',       type:'AMRAP',        desc:'Pull-ups / Push-ups / Sit-ups — max kol za 12 minut.',                       exercises:3, durationMin:12, configSummary:'12 min · ∞ kol',       used:6  },
  { name:'EMOM 10 — Burpees',         type:'EMOM',         desc:'10 kol, každou minutu 10 burpees. Zbývající čas = odpočinek.',                exercises:1, durationMin:10, configSummary:'10×60s · 1 cvik',      used:4  },
  { name:'Tabata — vlastní váha',     type:'Tabata',       desc:'8 kol, 20s práce / 10s pauza. Cvik: Burpees.',                                exercises:1, durationMin:4,  configSummary:'8 × 20s/10s',           used:9  },
  { name:'ForTime 21-15-9',           type:'ForTime',      desc:'Klasický „Fran" — 21-15-9 thrusters & pull-ups na čas.',                       exercises:2, durationMin:8,  configSummary:'time cap 8 min',        used:3  },
  { name:'Klidný cooldown',           type:'Conditioning', desc:'Chůze + strečink hrudníku. Dechová obnova po intenzivním tréninku.',         exercises:2, durationMin:6,  configSummary:'—',                 used:11 },
  { name:'Veslařská výzva 2 km',      type:'Conditioning', desc:'Veslo na 2 km nebo 8 minut, podle toho co dřív.',                            exercises:1, durationMin:8,  configSummary:'cap 8 min · 2 000 m', used:2  },
];

function sectionTypeColor(t){
  switch(t){
    case 'Strength':     return '#007aff';
    case 'Conditioning': return '#34c759';
    case 'AMRAP':        return 'var(--acc)';
    case 'EMOM':         return '#af52de';
    case 'Tabata':       return '#ff3b30';
    case 'ForTime':      return '#ff9f0a';
    default:             return '#8e8e93';
  }
}

