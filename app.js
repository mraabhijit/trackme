(function(){
'use strict';
/* Open Food Facts (opt-in online search; nothing is requested unless the user taps the button) */
var OFF_PRIMARY='https://world.openfoodfacts.org/cgi/search.pl';
var OFF_FALLBACK='https://search.openfoodfacts.org/search';
var OFF_THIRD='https://in.openfoodfacts.org/cgi/search.pl';   /* same API as OFF_PRIMARY, a different (India) server: world.* is often 'temporarily unavailable' (503) */
var OFF_FIELDS='code,product_name,brands,nutriments,serving_size,serving_quantity';
var OFF_TIMEOUT=12000,OFF_COOLDOWN=6000,OFF_SLOW=5000;
/* ---------- tiny DOM helpers (textContent only; no innerHTML anywhere) ---------- */
function h(tag,props){
  var el=document.createElement(tag),k,v;
  props=props||{};
  for(k in props){v=props[k];if(v==null||v===false&&typeof v!=='boolean')continue;
    if(k==='class')el.className=v;
    else if(k==='text')el.textContent=v;
    else if(k.slice(0,2)==='on')el.addEventListener(k.slice(2),v);
    else if(k==='value')el.value=v;
    else if(typeof v==='boolean'){if(k in el)el[k]=v;else if(v)el.setAttribute(k,'')}
    else el.setAttribute(k,v);}
  for(var i=2;i<arguments.length;i++)add(el,arguments[i]);
  return el;
}
function add(el,c){if(c==null||c===false)return;if(Array.isArray(c)){c.forEach(function(x){add(el,x)});return}
  el.appendChild(c.nodeType?c:document.createTextNode(String(c)))}
var NSV='http://www.w3.org/2000/svg';
function s(tag,props){
  var el=document.createElementNS(NSV,tag),k;props=props||{};
  for(k in props){if(props[k]==null)continue;if(k==='text')el.textContent=props[k];else el.setAttribute(k,props[k])}
  for(var i=2;i<arguments.length;i++)add(el,arguments[i]);return el;
}
function $(sel){return document.querySelector(sel)}


/* ---------- dates / numbers ---------- */
function pad(n){return String(n).padStart(2,'0')}
function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function parseD(x){var a=x.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])}
function addDays(x,n){var d=parseD(x);d.setDate(d.getDate()+n);return ymd(d)}
function todayStr(){return ymd(new Date())}
function fmtDate(x){return parseD(x).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}
function fmtDateLong(x){return parseD(x).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
function nowTime(){var d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes())}
/* '20:05' -> '8:05 PM' (same format everywhere, independent of the device locale) */
function fmt12(hhmm){var m=/^(\d\d):(\d\d)$/.exec(hhmm||'');if(!m)return String(hhmm||'');var h24=+m[1];return ((h24%12)||12)+':'+m[2]+' '+(h24>=12?'PM':'AM')}
/* Reusable 12-hour time control: hour, minute, AM/PM, minute -/+ (5 min), Now. Stores/returns 'HH:MM' (24h). */
function timePicker(o){
  var id=o.idPrefix||'tp',ap='AM',api={};
  var hIn=h('input',{type:'text',id:id+'-h',class:'tp-in',inputmode:'numeric',pattern:'[0-9]*',maxlength:'2',autocomplete:'off','aria-label':'Hour, 1 to 12'});
  var mIn=h('input',{type:'text',id:id+'-m',class:'tp-in',inputmode:'numeric',pattern:'[0-9]*',maxlength:'2',autocomplete:'off','aria-label':'Minute, 00 to 59'});
  var err=h('p',{class:'err tp-err',role:'alert',id:id+'-err'});
  function read(){
    if(hIn.value===''||mIn.value==='')return {err:'Enter hour 1-12 and minute 0-59.'};
    var hv=+hIn.value,mv=+mIn.value;
    if(!(hv>=1&&hv<=12))return {err:'Enter hour 1-12.'};
    if(!(mv>=0&&mv<=59))return {err:'Enter minute 0-59.'};
    return {v:pad((hv%12)+(ap==='PM'?12:0))+':'+pad(mv)};
  }
  function showErr(all){
    var r=read();
    if(!r.err){err.textContent='';return}
    var hv=hIn.value,mv=mIn.value,bad=(hv.length===2&&!(+hv>=1&&+hv<=12))||(hv.length===1&&+hv===0&&all)||(mv.length===2&&+mv>59);
    err.textContent=(all||bad)?r.err:'';
  }
  function changed(all){showErr(all);if(o.onChange){var r=read();o.onChange(r.v||null)}}
  function syncAp(){amB.setAttribute('aria-pressed',ap==='AM'?'true':'false');pmB.setAttribute('aria-pressed',ap==='PM'?'true':'false')}
  var amB=h('button',{type:'button',class:'btn tp-ap',id:id+'-am',text:'AM','aria-label':'AM',onclick:function(){ap='AM';syncAp();changed(true)}});
  var pmB=h('button',{type:'button',class:'btn tp-ap',id:id+'-pm',text:'PM','aria-label':'PM',onclick:function(){ap='PM';syncAp();changed(true)}});
  api.set=function(v){
    var m=/^(\d\d):(\d\d)$/.exec(v||'');if(!m)return;var h24=+m[1];
    ap=h24>=12?'PM':'AM';hIn.value=String((h24%12)||12);mIn.value=m[2];syncAp();err.textContent='';
  };
  api.get=function(){return read().v||null};
  api.validate=function(){showErr(true);return read().err||null};
  api.focus=function(){hIn.focus();hIn.select()};
  function step(dir){
    var r=read(),t0;
    if(r.v)t0=(+r.v.slice(0,2))*60+(+r.v.slice(3));else{var n=nowTime();t0=(+n.slice(0,2))*60+(+n.slice(3))}
    var t1=dir>0?Math.min(1439,Math.floor(t0/5)*5+5):Math.max(0,Math.ceil(t0/5)*5-5);
    api.set(pad(Math.floor(t1/60))+':'+pad(t1%60));changed(true);
  }
  function keys(ev){if(ev.key==='Enter'){ev.preventDefault();if(o.onEnter)o.onEnter()}else if(ev.key==='Escape'&&o.onEscape){ev.preventDefault();o.onEscape()}}
  hIn.addEventListener('input',function(){
    var d=hIn.value.replace(/\D/g,'').slice(0,2);hIn.value=d;
    if(d.length===2||(d.length===1&&+d>=2)){changed(false);mIn.focus();mIn.select();return}
    changed(false);
  });
  mIn.addEventListener('input',function(){mIn.value=mIn.value.replace(/\D/g,'').slice(0,2);changed(false)});
  mIn.addEventListener('blur',function(){if(mIn.value.length===1)mIn.value=pad(+mIn.value);changed(false)});
  hIn.addEventListener('blur',function(){if(hIn.value!==''&&!(+hIn.value>=1&&+hIn.value<=12))err.textContent='Enter hour 1-12.'});
  hIn.addEventListener('keydown',keys);mIn.addEventListener('keydown',function(ev){
    if(ev.key==='Backspace'&&mIn.value===''){ev.preventDefault();hIn.focus();return}keys(ev)});
  /* Paste '9:45 pm', '09:45PM', '21:45' or '945pm' into either box: fills hour, minute and AM/PM */
  function onPaste(ev){
    var txt=(ev.clipboardData||window.clipboardData);txt=txt?String(txt.getData('text')||''):'';
    var m=/^\s*(\d{1,2})\s*[:.h]\s*(\d{2})\s*([ap])?\.?\s*(m)?\.?\s*$/i.exec(txt)||/^\s*(\d{1,2})(\d{2})\s*([ap])\.?\s*(m)?\.?\s*$/i.exec(txt);
    if(!m)return;
    var hv=+m[1],mv=+m[2],a=m[3]?m[3].toUpperCase()+'M':null;
    if(mv>59)return;
    if(a){if(hv<1||hv>12)return}else{if(hv>23)return;a=hv>=12?'PM':'AM';hv=hv%12||12}
    ev.preventDefault();api.set(pad(((hv%12)+(a==='PM'?12:0)))+':'+pad(mv));changed(true);
  }
  hIn.addEventListener('paste',onPaste);mIn.addEventListener('paste',onPaste);
  /* Tapping a box selects its content so typing replaces it; typing into a full or impossible value starts afresh */
  function selectAll(el){
    var fresh0=false;
    el.addEventListener('focus',function(){try{el.select()}catch(e){}fresh0=true});
    el.addEventListener('mouseup',function(ev){if(fresh0){ev.preventDefault();fresh0=false}});
    el.addEventListener('touchend',function(){fresh0=false});
  }
  selectAll(hIn);selectAll(mIn);
  function fresh(el,isHour){
    el.addEventListener('keydown',function(ev){
      if(!/^\d$/.test(ev.key)||ev.ctrlKey||ev.metaKey||ev.altKey)return;
      if(el.selectionStart!==el.selectionEnd)return;
      var cur=el.value,nx=+(cur+ev.key);
      if(cur.length>=2||(cur.length===1&&(isHour?(cur==='0'?false:!(nx>=1&&nx<=12)):+cur>5)))el.value='';
    });
  }
  fresh(hIn,true);fresh(mIn,false);
  api.el=h('div',{class:'tp',role:'group','aria-label':o.label||'Time'},
    h('div',{class:'tp-row'},hIn,h('span',{class:'tp-colon','aria-hidden':'true',text:':'}),mIn,
      h('button',{type:'button',class:'btn icon',id:id+'-mdown','aria-label':'Minutes down 5',text:'\u2212',onclick:function(){step(-1)}}),
      h('button',{type:'button',class:'btn icon',id:id+'-mup','aria-label':'Minutes up 5',text:'+',onclick:function(){step(1)}})),
    h('div',{class:'tp-row',style:'margin-top:6px'},amB,pmB,h('button',{type:'button',class:'btn',id:id+'-now',text:'Now',onclick:function(){api.set(nowTime());changed(true)}})),err);
  api.set(o.value||nowTime());
  return api;
}
function r0(n){return Math.round(n)}
function r1(n){return Math.round(n*10)/10}
function fmt2(n){return String(Math.round(n*100)/100)}
function isDate(x){return typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(parseD(x).getTime())&&ymd(parseD(x))===x}
function ageOn(dob,date){var a=dob.split('-').map(Number),b=date.split('-').map(Number),age=b[0]-a[0];if(b[1]<a[1]||(b[1]===a[1]&&b[2]<a[2]))age--;return age}
function uuid(){try{if(crypto&&crypto.randomUUID)return crypto.randomUUID()}catch(e){}return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,10)}
/* Meal slots are per profile, user-managed and have no fixed times. */
function defaultSlots(){return [{id:'s_breakfast',name:'Breakfast'},{id:'s_midmorning',name:'Mid-morning snack'},{id:'s_lunch',name:'Lunch'},{id:'s_evening',name:'Evening snack'},{id:'s_dinner',name:'Dinner'},{id:'s_latenight',name:'Late-night snack'}]}
var LEGACY={breakfast:['s_breakfast','Breakfast'],lunch:['s_lunch','Lunch'],snacks:['s_evening','Evening snack'],dinner:['s_dinner','Dinner'],other:['s_other','Other']};
function normName(n){return String(n==null?'':n).replace(/\s+/g,' ').trim()}
function slotNameError(name,slots,exceptId){
  name=normName(name);
  if(!name)return 'Give the meal slot a name.';
  if(name.length>30)return 'Meal slot names can be up to 30 characters.';
  if(slots.some(function(s){return s.id!==exceptId&&s.name.toLowerCase()===name.toLowerCase()}))return 'You already have a meal slot with that name.';
  return null;
}
function cleanSlots(arr){
  var out=[],ids={},names={};
  (Array.isArray(arr)?arr:[]).forEach(function(s){
    if(!s||!safeId(s.id)||typeof s.name!=='string')return;var n=normName(s.name).slice(0,30);
    if(!n||ids[s.id]||names[n.toLowerCase()])return;ids[s.id]=1;names[n.toLowerCase()]=1;out.push({id:s.id,name:n});
  });
  return out.slice(0,60);
}
/* Map old fixed slots (breakfast, lunch, snacks, dinner, other) to slot ids; adds an "Other" slot to prof only if needed. */
function migrateEntries(list,prof){
  var changed=false;
  list.forEach(function(e){
    var m=LEGACY[String(e.slot).toLowerCase()];if(!m)return;changed=true;var id=m[0],name=m[1];
    if(String(e.slot).toLowerCase()==='other'){
      var have=prof.slots.filter(function(s){return s.id==='s_other'||s.name.toLowerCase()==='other'})[0];
      if(!have){have={id:'s_other',name:'Other'};prof.slots.push(have)}
      id=have.id;name=have.name;
    }
    e.slot=id;e.slotName=name;
  });
  return changed;
}
function slotNameOf(p,e){
  var s=p.slots.filter(function(x){return x.id===e.slot})[0];
  return s?s.name:(e.slotName||(LEGACY[e.slot]&&LEGACY[e.slot][1])||'Other meal');
}
function saveSlots(slots){var np=Object.assign({},S.profile,{slots:slots,updatedAt:Date.now()});saveProfile(np);S.profile=np;return np}
function newSlotId(){return 's_'+uuid().replace(/[^\w]/g,'').slice(0,10)}
var MAX_SLOTS=30;
/* Default meal for the Add form: the slot of the entry most recently ADDED on that date (not the next slot in order). */
function nextSlotId(p,date){
  var all=loadMonth(p.id,date.slice(0,7)).filter(function(e){return e.date===date}),best=null,bi=-1;
  all.forEach(function(e,i){var c=e.createdAt||e.updatedAt||0;if(!best||c>=(best.createdAt||best.updatedAt||0)){best=e;bi=i}});
  if(best&&p.slots.some(function(s){return s.id===best.slot}))return best.slot;
  return p.slots[0].id;
}
/* Create a slot (shared by Profile and the Add form). Reuses the id of a removed slot that still has entries under the same name. */
function createSlot(name){
  var slots=S.profile.slots;
  if(slots.length>=MAX_SLOTS)return {err:'You can have up to '+MAX_SLOTS+' meal slots. Delete one you do not use first.'};
  var bad=slotNameError(name,slots,null);if(bad)return {err:bad};
  name=normName(name);var id=null,low=name.toLowerCase();
  allEntries(S.profile.id).forEach(function(e){if(!id&&e.slotName&&e.slotName.toLowerCase()===low&&!slots.some(function(s){return s.id===e.slot}))id=e.slot});
  var ns={id:id||newSlotId(),name:name};saveSlots(slots.concat([ns]));return {slot:ns};
}
function renameSlotEntries(id,name){
  monthsOf(S.profile.id).forEach(function(ym){
    var a=loadMonth(S.profile.id,ym),ch=false;a.forEach(function(e){if(e.slot===id&&e.slotName!==name){e.slotName=name;ch=true}});
    if(ch)saveMonth(S.profile.id,ym,a);
  });
}
/* Activity multipliers (model 2). These already include workouts: do not add workout calories on top. */
var ACTIVITY=[[1.2,'Sedentary (desk job, little exercise)'],[1.3,'Lightly active (on your feet part of the day, housework / homemaking, or 1-2 light workouts a week)'],[1.4,'Moderately active (workout 3-4 times a week)'],[1.55,'Very active (workout 5-6 times a week, or on your feet most of the day)'],[1.7,'Extremely active (heavy manual work like construction, farm work or loading, or hard daily training)']];
/* Activity multipliers (model 3): everyday life only. Workouts you log are added on top (when "count workouts" is on). */
var EVERYDAY=[[1.2,'Mostly sitting (desk job, little walking)'],[1.3,'Some moving (housework, errands, on your feet part of the day)'],[1.45,'On your feet most of the day (shop, teaching, nursing)'],[1.6,'Heavy physical work (construction, farm, loading)']];
var TO_EVERYDAY={1.2:1.2,1.3:1.3,1.4:1.2,1.55:1.3,1.7:1.6};
/* Profiles saved before activityModel 2 used the old scale; map each old value to the new level. */
var OLD_ACTIVITY={1.2:1.2,1.375:1.3,1.55:1.4,1.725:1.55,1.9:1.7};
function nearestOf(v,arr){var best=arr[0];arr.forEach(function(x){if(Math.abs(x-v)<Math.abs(best-v))best=x});return best}
function levelName(v){var a=ACTIVITY.concat(EVERYDAY).filter(function(x){return x[0]===v})[0];return a?a[1].replace(/\s*\(.*$/,''):''}


/* ---------- storage ---------- */
var NS='dt:v1:',storageOK=true,mem={},writeFailed=false;
(function probe(){try{var k=NS+'probe';localStorage.setItem(k,'1');localStorage.removeItem(k)}catch(e){storageOK=false}})();
function sget(k){if(!storageOK)return k in mem?mem[k]:null;try{return localStorage.getItem(k)}catch(e){return null}}
function sset(k,v){if(!storageOK){mem[k]=v;return true}try{localStorage.setItem(k,v);return true}catch(e){writeFailed=true;showBanners();return false}}
function sdel(k){if(!storageOK){delete mem[k];return}try{localStorage.removeItem(k)}catch(e){}}
function skeys(prefix){var out=[],i,k;if(!storageOK){for(k in mem)if(k.indexOf(prefix)===0)out.push(k);return out}
  try{for(i=0;i<localStorage.length;i++){k=localStorage.key(i);if(k&&k.indexOf(prefix)===0)out.push(k)}}catch(e){}return out}
function jget(k,def){var t=sget(k);if(t==null)return def;try{var v=JSON.parse(t);return v==null?def:v}catch(e){return def}}
function jset(k,v){return sset(k,JSON.stringify(v))}

var blocked={};
function readJSON(key){var raw=sget(key);if(raw==null)return {v:null};try{return {v:JSON.parse(raw),raw:raw}}catch(e){return {bad:true,raw:raw}}}
/* Keep a copy of anything we could not fully read, so it is never silently overwritten. */
function protect(key,raw){
  if(blocked[key]!==undefined)return;
  var pre=NS+'corrupt:'+key.slice(NS.length)+':',have=skeys(pre).some(function(k){return sget(k)===raw});
  blocked[key]=have?false:!sset(pre+Date.now(),raw);
}
function loadList(key,cleaner){
  var r=readJSON(key);if(r.v==null&&!r.bad)return [];
  if(r.bad||!Array.isArray(r.v)){protect(key,r.raw);return []}
  var out=[];r.v.forEach(function(x){var c=cleaner(x);if(c)out.push(c)});
  if(out.length!==r.v.length)protect(key,r.raw);return out;
}
function saveList(key,arr){
  if(blocked[key]===true){writeFailed=true;showBanners();return false}
  var ok=arr.length||/:(weights|foods)$/.test(key)?jset(key,arr):(sdel(key),true);if(ok)delete blocked[key];return ok;
}
var meta=(function(){
  var r=readJSON(NS+'meta'),m=r.v&&typeof r.v==='object'&&!Array.isArray(r.v)?r.v:{};
  if(r.bad)protect(NS+'meta',r.raw);
  var ids=(Array.isArray(m.profileIds)?m.profileIds:[]).filter(safeId);
  skeys(NS+'p:').forEach(function(k){var mm=/^dt:v1:p:([\w-]{1,64}):profile$/.exec(k);if(mm&&ids.indexOf(mm[1])<0)ids.push(mm[1])});
  ids=ids.filter(function(id,i){return ids.indexOf(id)===i&&!!loadProfile(id)});
  return {schema:1,profileIds:ids,lastExport:typeof m.lastExport==='number'?m.lastExport:null,
    activeProfileId:ids.indexOf(m.activeProfileId)>=0?m.activeProfileId:(ids[0]||null)};
})();
function pk(pid,what){return NS+'p:'+pid+':'+what}
/* Profiles saved before meal slots / activityModel 2 are upgraded once (old record backed up first). */
meta.profileIds.forEach(function(pid){
  var r=readJSON(pk(pid,'profile'));
  if(r.v&&typeof r.v==='object'&&(!Array.isArray(r.v.slots)||!(Number(r.v.activityModel)>=2))){var p=loadProfile(pid);if(p&&sset(NS+'backup:profile:'+pid+':'+Date.now(),r.raw))saveProfile(p)}
});
function saveMeta(){jset(NS+'meta',meta)}
function loadProfile(pid){
  var key=pk(pid,'profile'),r=readJSON(key);if(r.v==null&&!r.bad)return null;
  var p=r.bad?null:cleanProfile(r.v);if(!p||p.id!==pid){protect(key,r.raw);return null}return p;
}
function saveProfile(p){jset(pk(p.id,'profile'),p)}
function listProfiles(){return meta.profileIds.map(loadProfile).filter(Boolean)}
function monthsOf(pid){var pre=pk(pid,'entries:');return skeys(pre).map(function(k){return k.slice(pre.length)}).filter(function(m){return /^\d{4}-\d{2}$/.test(m)}).sort()}
function loadMonth(pid,ym){
  var key=pk(pid,'entries:'+ym),list=loadList(key,cleanEntryFull);
  if(list.some(function(e){return LEGACY[String(e.slot).toLowerCase()]}))list=migrateShard(pid,key,list);
  return list;
}
/* Old entries used fixed slots. Convert in memory always; write back only after the old shard is safely backed up. */
function migrateShard(pid,key,list){
  var prof=loadProfile(pid);if(!prof)return list;
  var raw=sget(key),before=JSON.stringify(prof.slots);
  migrateEntries(list,prof);
  if(raw!=null&&sset(NS+'backup:slots:'+key.slice(NS.length)+':'+Date.now(),raw)){
    if(JSON.stringify(prof.slots)!==before){saveProfile(prof);if(S&&S.profile&&S.profile.id===pid)S.profile=prof}
    saveList(key,list);
  }
  return list;
}
function saveMonth(pid,ym,arr){var r=saveList(pk(pid,'entries:'+ym),arr);try{askPersist()}catch(e){}return r}
function entriesOn(pid,date){return loadMonth(pid,date.slice(0,7)).filter(function(e){return e.date===date}).sort(function(a,b){return a.time<b.time?-1:a.time>b.time?1:0})}
function putEntry(pid,e){var ym=e.date.slice(0,7),a=loadMonth(pid,ym).filter(function(x){return x.id!==e.id});a.push(e);saveMonth(pid,ym,a)}
function removeEntry(pid,id,date){var ym=date.slice(0,7),a=loadMonth(pid,ym),f=null;
  saveMonth(pid,ym,a.filter(function(x){if(x.id===id){f=x;return false}return true}));return f}
function loadWeights(pid){return loadList(pk(pid,'weights'),cleanWeight).sort(function(x,y){return x.date<y.date?-1:1})}
function saveWeights(pid,a){saveList(pk(pid,'weights'),a)}
function loadCustom(pid){return loadList(pk(pid,'foods'),cleanFood)}
function saveCustom(pid,a){saveList(pk(pid,'foods'),a)}
function allEntries(pid){var out=[];monthsOf(pid).forEach(function(ym){out=out.concat(loadMonth(pid,ym))});return out}


/* ---------- raw log text (what the user typed in the quick-log box), stored per month ---------- */
function cleanLog(l){
  if(!l||typeof l!=='object'||!safeId(l.id)||!isDate(l.date)||typeof l.text!=='string')return null;
  var t=l.text.slice(0,500);if(!t.trim())return null;
  return {id:l.id,date:l.date,time:/^\d\d:\d\d$/.test(l.time||'')?l.time:'00:00',text:t,
    updatedAt:numIn(l.updatedAt,0,9e15)?l.updatedAt:0,createdAt:numIn(l.createdAt,0,9e15)?l.createdAt:0};
}
function monthsOfLogs(pid){var pre=pk(pid,'logs:');return skeys(pre).map(function(k){return k.slice(pre.length)}).filter(function(m){return /^\d{4}-\d{2}$/.test(m)}).sort()}
function loadLogs(pid,ym){return loadList(pk(pid,'logs:'+ym),cleanLog)}
function saveLogs(pid,ym,arr){return saveList(pk(pid,'logs:'+ym),arr)}
function putLog(pid,l){var ym=l.date.slice(0,7),a=loadLogs(pid,ym).filter(function(x){return x.id!==l.id});a.push(l);saveLogs(pid,ym,a)}
function removeLog(pid,id,date){var ym=date.slice(0,7),a=loadLogs(pid,ym),f=null;saveLogs(pid,ym,a.filter(function(x){if(x.id===id){f=x;return false}return true}));return f}
/* find a log by id: first in the month of the entry, then anywhere (an entry's date may have been changed later) */
function findLog(pid,id,date){
  var a=loadLogs(pid,date.slice(0,7)).filter(function(x){return x.id===id})[0];if(a)return a;
  var ms=monthsOfLogs(pid);for(var i=0;i<ms.length;i++){a=loadLogs(pid,ms[i]).filter(function(x){return x.id===id})[0];if(a)return a}
  return null;
}

/* ---------- food database ---------- */
/* ---------- exercise entries (monthly shards: exercise:<YYYY-MM>) ---------- */
function cleanEx(x){
  if(!x||typeof x!=='object'||!safeId(x.id)||!isDate(x.date)||!/^\d\d:\d\d$/.test(x.time||''))return null;
  if(!numIn(x.minutes,0.1,1440)||!numIn(x.met,0.5,25)||!numIn(x.kgUsed,20,300)||!numIn(x.kcal,0,20000))return null;
  var o={id:x.id,date:x.date,time:x.time,actKey:typeof x.actKey==='string'&&/^[\w-]{1,30}$/.test(x.actKey)?x.actKey:'other',
    label:normName(typeof x.label==='string'?x.label:'').slice(0,40)||'Exercise',minutes:x.minutes,met:x.met,kgUsed:x.kgUsed,kcal:x.kcal,
    updatedAt:numIn(x.updatedAt,0,9e15)?x.updatedAt:0,createdAt:numIn(x.createdAt,0,9e15)?x.createdAt:0};
  if(numIn(x.distanceKm,0,1000))o.distanceKm=x.distanceKm;
  if(numIn(x.kcalAdj,0,20000))o.kcalAdj=x.kcalAdj;
  if(typeof x.logId==='string'&&safeId(x.logId))o.logId=x.logId;
  return o;
}
function exKcal(x){return x.kcalAdj!=null?x.kcalAdj:x.kcal}
function monthsOfEx(pid){var pre=pk(pid,'exercise:');return skeys(pre).map(function(k){return k.slice(pre.length)}).filter(function(m){return /^\d{4}-\d{2}$/.test(m)}).sort()}
function loadEx(pid,ym){return loadList(pk(pid,'exercise:'+ym),cleanEx)}
function saveEx(pid,ym,arr){var r=saveList(pk(pid,'exercise:'+ym),arr);try{askPersist()}catch(e){}return r}
function putEx(pid,x){var ym=x.date.slice(0,7),a=loadEx(pid,ym).filter(function(y){return y.id!==x.id});a.push(x);saveEx(pid,ym,a)}
function removeEx(pid,id,date){var ym=date.slice(0,7),a=loadEx(pid,ym),f=null;saveEx(pid,ym,a.filter(function(y){if(y.id===id){f=y;return false}return true}));return f}
function exOn(pid,date){return loadEx(pid,date.slice(0,7)).filter(function(x){return x.date===date}).sort(function(a,b){return a.time<b.time?-1:a.time>b.time?1:0})}
function allEx(pid){var out=[];monthsOfEx(pid).forEach(function(ym){out=out.concat(loadEx(pid,ym))});return out}
function freshEx(x){return loadEx(S.profile.id,x.date.slice(0,7)).filter(function(y){return y.id===x.id})[0]||x}
/* ---------- water: one map per person, { 'YYYY-MM-DD': {cups, updatedAt} } ---------- */
function cleanWaterMap(o){
  var out={};if(!o||typeof o!=='object'||Array.isArray(o))return out;
  Object.keys(o).forEach(function(k){var v=o[k];if(isDate(k)&&v&&typeof v==='object'&&numIn(v.cups,0,100))out[k]={cups:Math.round(v.cups),updatedAt:numIn(v.updatedAt,0,9e15)?v.updatedAt:0}});
  return out;
}
function loadWater(pid){var r=readJSON(pk(pid,'water'));if(r.bad){protect(pk(pid,'water'),r.raw);return {}}return cleanWaterMap(r.v)}
function saveWater(pid,m){if(Object.keys(m).length)jset(pk(pid,'water'),m);else sdel(pk(pid,'water'))}
function cupsOn(pid,date){var w=loadWater(pid)[date];return w?w.cups:0}
function setCups(pid,date,n){var m=loadWater(pid);n=Math.max(0,Math.min(100,Math.round(n)));if(n===0&&!m[date])return 0;m[date]={cups:n,updatedAt:Date.now()};saveWater(pid,m);return n}
/* ---------- saved entries: [{id,name,items:[food or exercise snapshots],updatedAt}] ---------- */
function cleanSavedItem(it){
  if(!it||typeof it!=='object')return null;
  if(it.type==='exercise'){
    if(!numIn(it.minutes,0.1,1440)||!numIn(it.met,0.5,25))return null;
    var o={type:'exercise',actKey:typeof it.actKey==='string'&&/^[\w-]{1,30}$/.test(it.actKey)?it.actKey:'other',label:normName(typeof it.label==='string'?it.label:'').slice(0,40)||'Exercise',minutes:it.minutes,met:it.met};
    if(numIn(it.distanceKm,0,1000))o.distanceKm=it.distanceKm;if(numIn(it.kcalAdj,0,20000))o.kcalAdj=it.kcalAdj;return o;
  }
  if(typeof it.foodId!=='string'||typeof it.foodName!=='string'||!it.foodName||!it.per100||!numIn(it.qty,0.0001,1e6)||!numIn(it.grams,0.0001,5000))return null;
  var n=it.per100,per={};for(var k of ['kcal','p','c','f','fib']){if(!numIn(n[k],0,1000))return null;per[k]=n[k]}
  var o2={type:'food',foodId:it.foodId.slice(0,80),foodName:it.foodName.slice(0,120),qty:it.qty,unit:typeof it.unit==='string'?it.unit.slice(0,20):'g',unitLabel:typeof it.unitLabel==='string'?it.unitLabel.slice(0,80):'g',
    unitG:numIn(it.unitG,0.0001,5000)?it.unitG:1,grams:it.grams,per100:per};
  var a=it.adj;if(a&&typeof a==='object'&&numIn(a.kcal,0,20000)&&numIn(a.p,0,20000)&&numIn(a.c,0,20000)&&numIn(a.f,0,20000))o2.adj={kcal:a.kcal,p:a.p,c:a.c,f:a.f};
  if(typeof it.slot==='string'&&/^[\w-]{1,40}$/.test(it.slot))o2.slot=it.slot;
  if(it.est==='ai')o2.est='ai';
  return o2;
}
function cleanSaved(x){
  if(!x||typeof x!=='object'||!safeId(x.id))return null;
  var name=normName(typeof x.name==='string'?x.name:'').slice(0,40);if(!name)return null;
  var items=(Array.isArray(x.items)?x.items:[]).map(cleanSavedItem).filter(Boolean).slice(0,40);if(!items.length)return null;
  return {id:x.id,name:name,items:items,updatedAt:numIn(x.updatedAt,0,9e15)?x.updatedAt:0,createdAt:numIn(x.createdAt,0,9e15)?x.createdAt:0};
}
function loadSaved(pid){return loadList(pk(pid,'saved'),cleanSaved)}
function saveSaved(pid,a){return saveList(pk(pid,'saved'),a)}
var FOODS=JSON.parse($('#foods').textContent).map(function(r){
  var est=!!r[7];
  var o={id:r[0],name:r[1],per100:{kcal:r[2],p:r[3],c:r[4],f:r[5],fib:r[6]},est:est,group:r[8],alias:r[9]||'',kind:r[12]?'dish':'raw',
    units:r[10]?r[10].map(function(m){return {label:m[0],grams:m[1]}}):[],pop:!!r[11],
    density:r[13]||0,liquid:r[14]===1,src:r[15]==='U'?'':r[15]||'',usda:r[15]==='U'||r[15]==='USDA'}; /* density g/ml (0 = unknown); liquid = stored per ml; src = USDA / EST for cooked rows */
  return prep(o);
});
function prep(o){var base=o.name.toLowerCase().split('(')[0];o.lc=o.name.toLowerCase();o.base=base.trim();
  o.words=base.split(/[^a-z0-9]+/).filter(Boolean);o.awords=(o.alias||'').split(/\s+/).filter(Boolean);return o}
var FOODBYID=Object.create(null);FOODS.forEach(function(f){FOODBYID[f.id]=f});
function unitKind(label){var l=label.toLowerCase();
  return /katori/.test(l)?'katori':/glass/.test(l)?'glass':/tbsp/.test(l)?'tbsp':/tsp/.test(l)?'tsp':/cup/.test(l)?'cup':/plate/.test(l)?'plate':/bottle/.test(l)?'bottle':/\bcan\b/.test(l)?'can':/\bshot\b/.test(l)?'shot':/\bpint\b/.test(l)?'pint':'piece'}
function unitsFor(food){
  var list=[{kind:'g',label:'g',grams:1}];
  (food.units||[]).forEach(function(m){var lab=String(m.label).replace(/^1\s+/,'');list.push({kind:unitKind(m.label),label:lab,grams:m.grams})});
  if(food.liquid&&food.density)list.push({kind:'g',label:'ml',grams:food.density});   /* explicit ml choice for liquids; last, so the default unit stays the first household one */
  return list;
}
function customToFood(c){return prep({id:c.id,name:c.name,per100:c.per100,est:false,group:'Custom',alias:'',kind:'custom',units:c.units||[],pop:false})}
/* ---------- shared food store (device-wide, travels in food packs) ---------- */
var KSF=NS+'sharedfoods',KPM=NS+'packmeta',SFCACHE=null;
var SF_SOURCES=['custom','openfoodfacts','pack','override'];
var UNIT_ORDER=['katori','glass','piece','serving','cup','plate','tbsp','tsp'];
function cleanSharedFood(f){
  if(!f||typeof f!=='object'||typeof f.id!=='string'||!/^[\w.-]{1,64}$/.test(f.id))return null;
  var del=f.deleted===true,name=normName(f.name).slice(0,80);
  if(!name){if(!del)return null;name='(removed food)'}
  var n=f.per100&&typeof f.per100==='object'?f.per100:{},per={},lim={kcal:900,p:100,c:100,f:100,fib:100};
  for(var k in lim){var v=n[k];if(typeof v!=='number'||!isFinite(v)||v<0||v>lim[k]){if(del)v=0;else return null}per[k]=v}
  var units={},cnt=0;
  if(f.units&&typeof f.units==='object'&&!Array.isArray(f.units))Object.keys(f.units).forEach(function(k){
    var g=f.units[k];if(cnt<12&&/^[a-z][a-z0-9_]{0,19}$/.test(k)&&typeof g==='number'&&isFinite(g)&&g>=0.1&&g<=5000){units[k]=g;cnt++}});
  var aliases=(Array.isArray(f.aliases)?f.aliases:[]).filter(function(a){return typeof a==='string'}).map(function(a){return normName(a).slice(0,30)}).filter(Boolean).slice(0,10);
  var src=SF_SOURCES.indexOf(f.source)>=0?f.source:'pack',ov=null;
  if(typeof f.overrides==='string'&&f.overrides===f.id&&FOODBYID[f.id])ov=f.id;
  if(src==='override'&&!ov)src='pack';
  var out={id:f.id,name:name,aliases:aliases,per100:per,units:units,source:src,updatedAt:numIn(f.updatedAt,0,9e15)?f.updatedAt:0};
  if(ov)out.overrides=ov;if(del)out.deleted=true;if(f.origin==='pack')out.origin='pack';if(f.check===true)out.check=true;return out;
}
function loadShared(){
  if(SFCACHE)return SFCACHE;
  var r=readJSON(KSF),m=Object.create(null);
  if(r.bad||(r.v!=null&&(typeof r.v!=='object'||Array.isArray(r.v)))){protect(KSF,r.raw)}
  else if(r.v){Object.keys(r.v).forEach(function(k){var c=cleanSharedFood(r.v[k]);if(c&&c.id===k)m[k]=c;else protect(KSF,r.raw)})}
  SFCACHE=m;return m;
}
function saveShared(m){
  if(blocked[KSF]===true){writeFailed=true;showBanners();return false}
  var ok=jset(KSF,m);if(ok)SFCACHE=m;return ok;
}
function copyShared(){var m=Object.create(null),s=loadShared();Object.keys(s).forEach(function(k){m[k]=s[k]});return m}
function putShared(food){var m=copyShared();m[food.id]=food;return saveShared(m)}
/* newer updatedAt wins; tombstones delete; returns counts */
function mergeSharedInto(m,list){
  var st={added:0,updated:0,removed:0,older:0};
  list.forEach(function(c){
    var cur=m[c.id];
    if(!cur){m[c.id]=c;if(!c.deleted)st.added++;return}
    if(c.updatedAt>cur.updatedAt){if(c.deleted&&!cur.deleted)st.removed++;else if(!c.deleted)st.updated++;m[c.id]=c}
    else st.older++;
  });
  return st;
}
function sharedList(){var m=loadShared();return Object.keys(m).map(function(k){return m[k]}).filter(function(c){return !c.deleted}).sort(function(a,b){return a.name.toLowerCase()<b.name.toLowerCase()?-1:1})}
function unitLabel(k,g){var names={katori:'katori',glass:'glass',piece:'piece',tbsp:'tbsp',tsp:'tsp',cup:'cup',plate:'plate',serving:'serving'};return (names[k]||k.replace(/_/g,' '))+' ('+fmt2(g)+' g)'}
function unitsMapToArr(m){
  var keys=Object.keys(m||{}).sort(function(a,b){var x=UNIT_ORDER.indexOf(a),y=UNIT_ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y)||(a<b?-1:1)});
  return keys.map(function(k){return {label:unitLabel(k,m[k]),grams:m[k]}});
}
function unitsArrToMap(arr){
  var m={};(arr||[]).forEach(function(u){
    var k=unitKind(u.label);if(k==='piece'&&!/piece|egg|roti|idli|slice|biscuit|pav|samosa|banana|apple|orange|dosa|paratha|puri|chilla|thepla|uttapam|almonds|handful/i.test(u.label)){k=null}
    if(!k||m[k]){k=String(u.label).toLowerCase().replace(/\(.*$/,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/^\d+_?/,'').slice(0,18);if(!/^[a-z]/.test(k))k='unit'}
    if(!m[k]&&u.grams>=0.1&&u.grams<=5000)m[k]=u.grams;
  });
  return m;
}
var SRC_TAG={custom:'My food',override:'My food',openfoodfacts:'Open Food Facts',pack:'Shared pack'};
function srcTag(c){return c.origin==='pack'?'Shared pack':(SRC_TAG[c.source]||'My food')}
function sharedToFood(c){
  return prep({id:c.id,name:c.name,per100:c.per100,est:false,group:srcTag(c),alias:(c.aliases||[]).join(' '),kind:'shared',source:c.source,check:!!c.check,units:unitsMapToArr(c.units),pop:false});
}
function allFoods(){
  var m=loadShared(),out=[],over=Object.create(null);
  Object.keys(m).forEach(function(k){var c=m[k];if(c.deleted)return;if(c.overrides)over[c.overrides]=1;out.push(sharedToFood(c))});
  loadCustom(S.profile.id).forEach(function(c){if(!m[c.id])out.push(customToFood(c))});
  FOODS.forEach(function(f){if(!over[f.id])out.push(f)});
  return out;
}
function findFood(id){
  var m=loadShared();if(m[id]&&!m[id].deleted)return sharedToFood(m[id]);
  if(FOODBYID[id])return FOODBYID[id];
  var c=loadCustom(S.profile.id).filter(function(x){return x.id===id})[0];return c?customToFood(c):null;
}
/* Copy per-profile custom foods into the shared list (old keys are left untouched as the backup). */
function migrateCustom(){
  var m=copyShared(),n=0;
  meta.profileIds.forEach(function(pid){loadCustom(pid).forEach(function(c){
    if(m[c.id])return;var u=unitsArrToMap(c.units);
    m[c.id]={id:c.id,name:c.name,aliases:[],per100:c.per100,units:u,source:'custom',updatedAt:c.updatedAt||Date.now()};n++})});
  if(n)saveShared(m);return n;
}
function loadPackMeta(){
  var r=readJSON(KPM).v,o=r&&typeof r==='object'&&!Array.isArray(r)?r:{};
  var li=o.lastPackImport&&typeof o.lastPackImport==='object'?o.lastPackImport:null;
  return {packName:normName(o.packName||'My foods').slice(0,40)||'My foods',revision:numIn(o.revision,0,1e9)?Math.floor(o.revision):0,
    lastPackImport:li?{packName:normName(li.packName||'').slice(0,40),revision:numIn(li.revision,0,1e9)?Math.floor(li.revision):0,exportedAt:typeof li.exportedAt==='string'?li.exportedAt.slice(0,40):''}:null};
}
function savePackMeta(m){jset(KPM,m)}
function recentIds(pid,n){
  var d=todayStr(),ym=[d.slice(0,7),addDays(d.slice(0,7)+'-01',-1).slice(0,7)],all=[];
  ym.forEach(function(m){all=all.concat(loadMonth(pid,m))});
  all.sort(function(a,b){var x=a.date+a.time,y=b.date+b.time;return x<y?1:x>y?-1:0});
  var seen=Object.create(null),out=[];all.forEach(function(e){if(!seen[e.foodId]&&out.length<n){seen[e.foodId]=1;out.push(e.foodId)}});return out;
}

/* search: tokens are ANDed; tier 0 = name starts with it, 1 = a name word starts with it, 2 = inside the name, 3 = alias */
function searchTokens(tokens,pid){
  var rec=recentIds(pid,30),out=[];
  allFoods().forEach(function(f){
    var worst=-1,ok=true;
    for(var i=0;i<tokens.length;i++){var t=tokens[i],tier;
      if(f.kind==='raw'&&f.awords.some(function(w){return w===t}))tier=-1;   /* an exact alias (til, jeera) beats a mere prefix (Tilapia) */
      else if(f.base.indexOf(t)===0)tier=0;
      else if(f.words.some(function(w){return w.indexOf(t)===0}))tier=1;
      else if(f.base.indexOf(t)>=0)tier=2;
      else if(f.awords.some(function(w){return w===t||(t.length>=4&&w.indexOf(t)===0)}))tier=3;
      else{ok=false;break}
      if(tier>worst)worst=tier}
    if(ok)out.push({f:f,k:[(f.kind==='shared'||f.kind==='custom')?0:1,f.kind==='raw'?1:f.src?2:0,f.pop?0:1,worst,rec.indexOf(f.id)>=0?0:1,f.base.length]});
  });
  out.sort(function(a,b){for(var i=0;i<6;i++)if(a.k[i]!==b.k[i])return a.k[i]-b.k[i];return a.f.name<b.f.name?-1:1});
  return out;
}
function searchScored(q,pid){return searchTokens(q.toLowerCase().split(/[^a-z0-9\u0900-\u097f]+/).filter(Boolean),pid)}
function search(q,pid){return searchScored(q,pid).map(function(x){return x.f})}

/* ---------- calculations ---------- */
function weightOn(pid,p,date){var w=loadWeights(pid),kg=p.startKg;w.forEach(function(x){if(x.date<=date)kg=x.kg});return kg}
function calc(p,kg,date){
  var age=ageOn(p.dob,date),bmr=10*kg+6.25*p.heightCm-5*age+(p.sex==='m'?5:-161),tdee=bmr*p.activity;
  var rate=p.rateKgWk||0.5,delta=p.goal==='lose'?-rate*7700/7:p.goal==='gain'?rate*7700/7:0;
  var target=tdee+delta,clamped=false,floor=Math.max(bmr,p.sex==='f'?1200:1500);
  if(delta<0&&target<floor){target=floor;clamped=true}
  var ov=p.override||{};function has(v,min){return typeof v==='number'&&isFinite(v)&&v>=min}
  if(has(ov.kcal,1))target=ov.kcal;
  var P=has(ov.p,0)?ov.p:p.proteinGPerKg*kg,F=has(ov.f,0)?ov.f:target*p.fatPct/100/9;
  var C=has(ov.c,0)?ov.c:Math.max(0,(target-4*P-9*F)/4);
  return {age:age,kg:kg,bmr:bmr,tdee:tdee,delta:delta,target:target,clamped:clamped,floor:floor,p:P,c:C,f:F};
}
function nut(e){var g=e.grams/100,n=e.per100;return {kcal:n.kcal*g,p:n.p*g,c:n.c*g,f:n.f*g,fib:n.fib*g}}
/* an entry's calories and macros: the hand-adjusted totals when present, else calculated from grams */
function entryNut(e){var n=nut(e);if(e.adj){n.kcal=e.adj.kcal;n.p=e.adj.p;n.c=e.adj.c;n.f=e.adj.f}return n}
function sumEntries(list){var t={kcal:0,p:0,c:0,f:0,fib:0};list.forEach(function(e){var n=entryNut(e);for(var k in t)t[k]+=n[k]});return t}
function sumEx(list){return list.reduce(function(a,x){return a+exKcal(x)},0)}
/* workout calories that count toward the day: only when the person has chosen to count them separately */
function dayInfo(p,date){
  var ents=entriesOn(p.id,date),tot=sumEntries(ents),c=calc(p,weightOn(p.id,p,date),date),exs=exOn(p.id,date),exT=sumEx(exs),counted=p.exerciseAdds?exT:0;
  return {ents:ents,tot:tot,c:c,exs:exs,exTotal:exT,counted:counted,left:c.target-tot.kcal+counted,deficit:c.tdee+counted-tot.kcal};
}

/* ---------- device settings (not part of backups): theme ---------- */
var UIK=NS+'ui';
var FONT_SIZES=[['small','Small',13],['medium','Medium',14],['large','Large',16],['xlarge','Extra large',18]];
var UI=(function(){var o=jget(UIK,{});o=o&&typeof o==='object'?o:{};return {fontSize:FONT_SIZES.some(function(f){return f[0]===o.fontSize})?o.fontSize:'medium',theme:['system','light','dark'].indexOf(o.theme)>=0?o.theme:'system',voiceOk:o.voiceOk===true,voiceLang:o.voiceLang==='hi-IN'?'hi-IN':'en-IN',backupReminder:o.backupReminder!==false,llmOn:o.llmOn===true,modelId:typeof o.modelId==='string'&&/^[\w.\-]{1,60}$/.test(o.modelId)?o.modelId:null}})();
function saveUI(){jset(UIK,UI)}
function applyTheme(){
  var r=document.documentElement;
  if(UI.theme==='system'){r.removeAttribute('data-theme');r.style.colorScheme='light dark'}
  else{r.setAttribute('data-theme',UI.theme);r.style.colorScheme=UI.theme}
}
applyTheme();
/* text size: the root font size (the whole layout is rem based); early.js applies the saved value before first paint */
function fontPx(k){var f=FONT_SIZES.filter(function(x){return x[0]===k})[0];return f?f[2]:14}
function applyFontSize(){document.documentElement.style.fontSize=fontPx(UI.fontSize)+'px'}
applyFontSize();

/* ---------- state ---------- */
var S={myFoods:null,tab:'today',profile:meta.activeProfileId?loadProfile(meta.activeProfileId):null,today:todayStr(),viewDate:todayStr(),add:null,range:30,newPerson:false,importState:null,exportedSinceDelete:false,persisted:null,pending:null};
function setProfile(pid){S.pending=null;meta.activeProfileId=pid;saveMeta();S.profile=loadProfile(pid);S.viewDate=S.today;S.add=null;S.myFoods=null;S.importState=null;S.exportedSinceDelete=false}

/* ---------- icons (own simple line icons) ---------- */
function icon(paths,cls){return s('svg',{viewBox:'0 0 24 24',class:'ico'+(cls?' '+cls:''),'aria-hidden':'true'},paths.map(function(d){return s('path',{d:d})}))}
var ICONS={
  back:['M19 12H5','M11 6l-6 6l6 6'],
  menu:['M4 6h16','M4 12h16','M4 18h16'],
  today:['M12 3v2','M12 19v2','M3 12h2','M19 12h2','M5.6 5.6L7 7','M17 17l1.4 1.4','M5.6 18.4L7 17','M17 7l1.4-1.4','M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z'],
  goals:['M5 21V4','M5 4h11l-2 4l2 4H5'],
  weekly:['M5 20V11','M12 20V4','M19 20v-6'],
  weight:['M4 5h16v14H4z','M9 10a3 3 0 0 0 6 0'],
  water:['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z'],
  saved:['M6 3h12v18l-6-4l-6 4z'],
  myfoods:['M3 11h18a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z','M8 7c0-2 2-2 2-4','M13 7c0-2 2-2 2-4'],
  history:['M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16z','M12 8v4l3 2'],
  backup:['M12 3v12','M7 10l5 5l5-5','M4 20h16'],
  settings:['M4 7h10','M18 7h2','M4 17h2','M10 17h10','M14 5v4','M6 15v4'],
  about:['M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16z','M12 11v5','M12 8v.5'],
  more:['M12 5v.01','M12 12v.01','M12 19v.01'],
  send:['M4 12l16-8l-6 16l-3-7z'],
  plus:['M12 5v14','M5 12h14'],
  close:['M6 6l12 12','M18 6L6 18'],
  edit:['M4 20h4L19 9l-4-4L4 16z','M13 7l4 4'],
  adjust:['M4 7h8','M16 7h4','M4 17h4','M12 17h8','M12 5v4','M8 15v4'],
  clock:['M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16z','M12 8v4l3 2'],
  trash:['M5 7h14','M10 7V4h4v3','M7 7l1 13h8l1-13'],
  mic:['M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3z','M6 11a6 6 0 0 0 12 0','M12 17v3'],
  ai:['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z','M18 16l.7 1.8L20.5 18.5l-1.8.7L18 21l-.7-1.8l-1.8-.7l1.8-.7z'],
  phone:['M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z','M11 18h2'],
  chevL:['M15 6l-6 6l6 6'],chevR:['M9 6l6 6l-6 6']
};
function brandIcon(size){
  return s('svg',{viewBox:'0 0 64 64',width:size,height:size,class:'brand','aria-hidden':'true'},
    s('rect',{width:64,height:64,rx:14,class:'brand-bg'}),
    s('path',{d:'M12 31h40a20 17 0 0 1-20 17A20 17 0 0 1 12 31z',class:'brand-bowl'}),
    s('path',{d:'M31 28C29 17 36 10 49 10c1 12-6 18-18 18z',class:'brand-leaf'}),
    s('path',{d:'M32 27c4-6 9-10 14-13',class:'brand-vein',fill:'none'}));
}

/* ---------- toast / banners ---------- */
var toastTimer=null;
function toast(msg,undoLabel,undoFn){
  var box=$('#toasts');box.replaceChildren();clearTimeout(toastTimer);
  var wide=UI.fontSize==='large'||UI.fontSize==='xlarge',t=h('div',{class:'toast'+(wide?' wide':'')},h('span',{text:msg}));
  if(undoFn)t.appendChild(h('button',{type:'button',text:undoLabel||'Undo',onclick:function(){box.replaceChildren();clearTimeout(toastTimer);undoFn()}}));
  /* Large / Extra large text: sit just above the quick-log bar (full width, at most 2 lines: see .toast.wide) */
  var qb=$('#qbar');if(wide)box.style.setProperty('--toast-bottom',(qb&&qb.offsetHeight?Math.round(window.innerHeight-qb.getBoundingClientRect().top+8):88)+'px');
  box.appendChild(t);toastTimer=setTimeout(function(){box.replaceChildren()},undoFn?5000:3500);
}

/* ---------- bottom sheets (one at a time) ---------- */
var sheetState=null;
function closeSheet(refocus){
  if(!sheetState)return;
  var st=sheetState;sheetState=null;
  $('#sheets').replaceChildren();document.body.classList.remove('sheet-open');
  document.removeEventListener('keydown',st.key,true);
  if(st.onClose)st.onClose();
  if(refocus!==false&&st.opener&&st.opener.isConnected){try{st.opener.focus()}catch(e){}}
}
/* o: {title, build(body, close), footer, opener, dismiss (default true), onClose, id} */
function openSheet(o){
  if(sheetState)closeSheet(false);
  var opener=o.opener||document.activeElement,dismiss=o.dismiss!==false;
  var body=h('div',{class:'sheet-body'}),close=function(r){closeSheet(r)};
  var x=h('button',{type:'button',class:'icon-btn sheet-x','aria-label':'Close',onclick:function(){close()}},icon(ICONS.close));
  var sheet=h('div',{class:'sheet'+(o.tall?' tall':''),role:'dialog','aria-modal':'true','aria-labelledby':'sheet-title',id:o.id||'sheet'},
    h('div',{class:'sheet-head'},h('span',{class:'grab','aria-hidden':'true'}),h('h2',{id:'sheet-title',class:'sheet-title',text:o.title||''}),x),body);
  var scrim=h('div',{class:'scrim sheet-scrim',onclick:function(){if(dismiss)close()}});
  var wrap=h('div',{class:'sheet-wrap'},scrim,sheet);
  var key=function(ev){
    if(ev.key==='Escape'&&dismiss){ev.stopPropagation();close();return}
    if(ev.key==='Tab'){
      var f=[].slice.call(sheet.querySelectorAll('button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')).filter(function(e){return e.offsetParent!==null});
      if(!f.length)return;var a=f[0],z=f[f.length-1];
      if(ev.shiftKey&&document.activeElement===a){ev.preventDefault();z.focus()}
      else if(!ev.shiftKey&&document.activeElement===z){ev.preventDefault();a.focus()}
    }
  };
  sheetState={key:key,opener:opener,onClose:o.onClose};
  document.addEventListener('keydown',key,true);
  $('#sheets').replaceChildren(wrap);document.body.classList.add('sheet-open');
  o.build(body,close,sheet);
  if(o.footer){var ft=typeof o.footer==='function'?o.footer(close):o.footer;if(ft)sheet.appendChild(h('div',{class:'sheet-foot'},ft))}
  var first=body.querySelector('[data-autofocus]')||x;try{first.focus({preventScroll:true})}catch(e){}
  return {close:close,body:body,sheet:sheet};
}

/* ---------- drawer ---------- */
var NAV=[['backup','Backup & restore','backup'],['today','Today','today'],['goals','Daily goals','goals'],['weekly','Weekly summary','weekly'],['weight','Weight tracker','weight'],['water','Water tracker','water'],
  ['saved','Saved entries','saved'],['myfoods','My foods','myfoods'],['history','History','history'],['ai','On-device AI','ai'],['phone','Check my phone','phone'],['settings','Settings','settings'],['about','About','about']];
var TITLES={today:'Today',add:'Add food',history:'History',weight:'Weight tracker',goals:'Daily goals',backup:'Backup & restore',settings:'Settings',myfoods:'My foods',weekly:'Weekly summary',water:'Water tracker',saved:'Saved entries',about:'About',ai:'On-device AI',phone:'Check my phone',meal:'Meal'};
function drawerOpen(){return $('#drawer').classList.contains('open')}
function openDrawer(){
  buildDrawer();var d=$('#drawer');d.classList.add('open');d.removeAttribute('inert');$('#drawer-scrim').hidden=false;
  $('#menu-btn').setAttribute('aria-expanded','true');
  var f=d.querySelector('button:not([disabled]),select');if(f)f.focus();
}
function closeDrawer(refocus){
  var d=$('#drawer');if(!d.classList.contains('open'))return;
  d.classList.remove('open');d.setAttribute('inert','');$('#drawer-scrim').hidden=true;$('#menu-btn').setAttribute('aria-expanded','false');
  if(refocus!==false)$('#menu-btn').focus();
}
function goto(view){
  closeDrawer(false);closeSheet(false);S.pending=null;S.aiRedraw=null;
  if(view==='goals')S.newPerson=false;
  if(view==='myfoods')S.myFoods={mode:'list'};
  if(view==='weekly')S.weekIdx=0;
  if(view==='add')S.add=null;
  if(view==='today')S.viewDate=S.viewDate||S.today;
  S.tab=view;render(true);
}
function buildDrawer(){
  var d=$('#drawer');d.replaceChildren();
  d.appendChild(h('div',{class:'drawer-brand'},brandIcon(36),h('span',{class:'brand-name',text:'TrackMe'})));
  if(S.profile){
    var ps=listProfiles();
    var sel=h('select',{id:'p-switch','aria-label':'Person',onchange:function(){S.newPerson=false;setProfile(sel.value);closeDrawer(false);S.tab='today';render(true)}});
    ps.forEach(function(p){sel.appendChild(h('option',{value:p.id,text:p.name,selected:p.id===S.profile.id}))});
    d.appendChild(h('div',{class:'drawer-people'},h('label',{for:'p-switch',class:'sr-only'},'Person'),h('div',{class:'row'},h('div',{class:'grow'},sel),
      h('button',{type:'button',id:'add-person',class:'btn',text:'Add person',onclick:function(){closeDrawer(false);S.newPerson=true;S.tab='goals';render(true)}}))));
  }
  var ul=h('ul',{class:'plain nav-list'});
  NAV.forEach(function(n){
    var off=!S.profile&&n[0]!=='goals'&&n[0]!=='about';
    ul.appendChild(h('li',null,h('button',{type:'button',class:'nav-item','data-view':n[0],'aria-current':S.tab===n[0]&&!S.newPerson?'page':null,disabled:off,title:off?'Create your profile first':null,onclick:function(){goto(n[0])}},icon(ICONS[n[2]]),h('span',{text:n[1]}))));
  });
  d.appendChild(ul);
}
function titleFor(){
  if(S.tab==='goals'){return !S.profile?'Welcome':S.newPerson?'Add a person':'Daily goals'}
  if(S.tab==='add')return S.add&&S.add.editId?'Edit entry':'Add food';
  if(S.tab==='today')return S.viewDate===S.today?'Today':fmtDate(S.viewDate);
  if(S.tab==='meal'&&S.meal)return S.meal.name||'Meal';
  return TITLES[S.tab]||'TrackMe';
}
function buildShell(){
  var t=$('#title'),isToday=S.tab==='today'&&!!S.profile;
  t.replaceChildren();
  if(isToday){t.appendChild(h('button',{type:'button',id:'date-btn',class:'title-btn','aria-haspopup':'dialog','aria-expanded':'false',onclick:function(){openCalendar($('#date-btn'))}},titleFor()))}
  else t.textContent=titleFor();
  var showBar=isToday;
  $('#qbar').hidden=!showBar;document.body.classList.toggle('has-qbar',showBar);if(showBar&&typeof autoGrow==='function')try{autoGrow()}catch(e){}
  buildDrawer();
}
function render(focusHeading){
  var root=$('#view');
  try{
    showBanners();
    if(!S.profile&&S.tab!=='goals'&&S.tab!=='about')S.tab='goals';
    buildShell();pinMetrics();if(S.tab!=='today')document.documentElement.style.scrollPaddingTop='';
    root.replaceChildren();
    ({today:viewToday,add:viewAdd,history:viewHistory,weight:viewWeight,goals:viewGoals,backup:viewBackup,settings:viewSettings,myfoods:viewMyFoods,weekly:viewWeekly,meal:viewMeal,water:viewWater,saved:viewSaved,about:viewAbout,ai:viewAI,phone:viewPhone})[S.tab](root);
    updateCredit();
  }catch(err){
    root.replaceChildren(h('section',{class:'card',role:'alert',id:'crash'},h('h2',{text:'Something went wrong'}),
      h('p',{text:'This screen could not be shown. Your saved data has not been changed. You can download a raw copy of everything stored by this app, then reload.'}),
      h('p',{class:'muted small',text:String(err&&err.message||err).slice(0,200)}),
      h('div',{class:'row'},h('button',{type:'button',class:'btn primary',id:'export-raw',text:'Export raw data',onclick:exportRaw}),
        h('button',{type:'button',class:'btn',text:'Reload',onclick:function(){location.reload()}}))));
    try{buildShell()}catch(e2){try{buildDrawer()}catch(e3){}}
    return;
  }
  if(focusHeading){var hd=$('#title');if(hd){hd.setAttribute('tabindex','-1');hd.focus({preventScroll:true});window.scrollTo(0,0)}}
}
function exportRaw(){
  var o={app:'diet-tracker-raw',exportedAt:new Date().toISOString(),keys:{}};
  skeys(NS).forEach(function(k){o.keys[k]=sget(k)});download(o,'trackme-raw-'+todayStr()+'.json');
}
function setTab(t){if(!S.profile&&t!=='goals')t='goals';goto(t)}

var SAVE_NOTICE='Save this file to your phone (Downloads) and open it in Chrome or Safari, not inside WhatsApp or Gmail, otherwise your log may not be saved.';
function showBanners(){
  if(!S)return;
  var b=$('#banners');b.replaceChildren();
  if(!storageOK)b.appendChild(h('div',{class:'banner error',role:'alert',id:'storage-banner'},h('b',{text:'Your data cannot be saved. '}),SAVE_NOTICE+' This browser is blocking storage for this file, so everything will be lost when you close the page.'));
  else if(!S.profile&&sget(NS+'notice1')!=='1'){
    var n=h('div',{class:'banner info',id:'save-notice'},h('p',{style:'margin:0 0 6px',text:SAVE_NOTICE}),
      h('button',{type:'button',class:'btn sm',text:'Got it',onclick:function(){sset(NS+'notice1','1');n.remove()}}));
    b.appendChild(n);
  }
  if(S.updateWorker)b.appendChild(h('div',{class:'banner info',id:'update-banner',role:'status'},h('b',{text:'Update ready. '}),h('button',{type:'button',class:'btn sm',id:'update-chip',text:'Reload to update',onclick:applyUpdate})));
  if(writeFailed)b.appendChild(h('div',{class:'banner error',role:'alert'},'The last change could not be saved (storage may be full, or a damaged record is being protected). Export a backup now.'));
  if(S.profile&&storageOK){
    var ref=meta.lastExport||S.profile.createdAt||Date.now();
    if(UI.backupReminder&&Date.now()-ref>7*864e5&&allEntries(S.profile.id).length)
      b.appendChild(h('div',{class:'banner info'},'Time for a backup: last export was more than 7 days ago. ',h('button',{type:'button',class:'btn sm',onclick:function(){goto('backup')},text:'Go to backup'})));
  }
}

/* ---------- TODAY ---------- */
function mondayOf(d){return addDays(d,-((parseD(d).getDay()+6)%7))}
function fmtRem(n){n=r0(n);if(n===0)n=0;return (n>=0?'+':'-')+Math.abs(n)}
/* per-day food total and remaining for the given dates; only days with entries are included */
function daySummaries(p,dates){
  var cache={},xcache={},ws=loadWeights(p.id),out={};
  function month(ym){return cache[ym]||(cache[ym]=loadMonth(p.id,ym))}
  function xmonth(ym){return xcache[ym]||(xcache[ym]=loadEx(p.id,ym))}
  dates.forEach(function(d){
    var ents=month(d.slice(0,7)).filter(function(e){return e.date===d});if(!ents.length)return;
    var kg=p.startKg;ws.forEach(function(w){if(w.date<=d)kg=w.kg});
    var exT=sumEx(xmonth(d.slice(0,7)).filter(function(x){return x.date===d})),counted=p.exerciseAdds?exT:0;
    var c=calc(p,kg,d),food=sumEntries(ents).kcal;out[d]={n:ents.length,food:food,target:c.target,exercise:exT,counted:counted,rem:c.target-food+counted};
  });
  return out;
}
function weekStrip(sel){
  var mon=mondayOf(sel),days=[],i;for(i=0;i<7;i++)days.push(addDays(mon,i));
  var sums=daySummaries(S.profile,days);
  var wrap=h('div',{class:'strip',id:'week-strip',role:'group','aria-label':'Pick a day this week'});
  days.forEach(function(day){
    var dt=parseD(day),fut=day>S.today,logged=!!sums[day];
    wrap.appendChild(h('button',{type:'button','data-date':day,class:logged?'logged':'','aria-pressed':day===sel?'true':'false',disabled:fut,
      'aria-label':fmtDate(day)+(logged?', logged':''),onclick:function(){S.viewDate=day;render()}},
      h('span',{text:dt.toLocaleDateString(undefined,{weekday:'short'})}),h('b',{text:String(dt.getDate())})));
  });
  return wrap;
}
function bar(frac,over){return h('div',{class:'pbar','aria-hidden':'true'},h('i',{class:over?'over':'',style:'width:'+Math.max(0,Math.min(100,frac*100))+'%'}))}
function macroCol(label,id,val,goal){
  var over=goal>0&&val>goal*1.0001&&label!=='Protein';
  return h('div',{class:'mcol'+(over?' over':'')},h('span',{class:'mlabel',text:label+' (g)'}),bar(goal>0?val/goal:0,over),
    h('span',{class:'mval',id:id,text:r0(val)+' / '+r0(goal)+(over?' (over)':'')}));
}
function chipsFor(n,adjusted){
  var c=function(t){return h('span',{class:'nchip',text:t})};
  return h('div',{class:'nchips'},c('Calories: '+r0(n.kcal)),c('Carbs: '+r0(n.c)+'g'),c('Protein: '+r0(n.p)+'g'),c('Fat: '+r0(n.f)+'g'),adjusted?h('span',{class:'tag',text:'adjusted'}):null);
}
/* "2 × katori (300 g)", "100 × g", "200 ml": the unit is shown the way it was typed */
function isCountU(e){return e.unit==='piece'&&COUNT_LAB.test(shortUnit(e))}
/* a liquid is shown in ml, never in grams (its saved grams stay as they are; ml = grams / density of today's table row) */
function amtG(e){var f=FOODBYID[e.foodId];return f&&f.liquid&&f.density?r0(e.grams/f.density)+' ml':r0(e.grams)+' g'}
function qtyText(e){var s=shortUnit(e);if(isCountU(e))return fmtQty(e.qty)+' '+s;return e.unit==='g'?fmtQty(e.qty)+' '+s:fmtQty(e.qty)+' × '+s+' ('+amtG(e)+')'}
/* compact pinned summary: Remaining + carbs / protein / fat, each consumed / goal with a thin bar */
function compactBar(tot,c,left,counted,eaten){
  function col(label,id,val,goal,over,extra){
    return h('div',{class:'cc'+(over?' over':'')},h('span',{class:'cl',id:id+'-label',text:label}),bar(goal>0?val/goal:0,over),h('span',{class:'cv',id:id,text:extra!==undefined?extra:r0(val)+' / '+r0(goal)}));
  }
  var tgt=c.target+counted,neg=left<0;
  return h('div',{class:'sum-cmp',id:'sum-compact',role:'group','aria-label':'Summary: calories remaining and macros'},
    h('div',{class:'cols4c'},
      h('div',{class:'cc'+(neg?' over':'')},h('span',{class:'cl',id:'c-remaining-label',text:neg?'Over by':'Remaining'}),bar(tgt>0?eaten/tgt:0,neg),h('span',{class:'cv strong'+(neg?' bad':''),id:'c-remaining',text:neg?'-'+r0(-left)+' kcal':r0(left)+' kcal'})),
      col('Carbs','c-carbs',tot.c,c.c,c.c>0&&tot.c>c.c*1.0001),col('Protein','c-protein',tot.p,c.p,false),col('Fat','c-fat',tot.f,c.f,c.f>0&&tot.f>c.f*1.0001)));
}
/* collapse once scrolled past ~60 px, expand again near the top (hysteresis); never when the page is too short to scroll */
var PIN={collapsed:false,lockUntil:0};
function pinMetrics(){var hd=$('#hdr');document.documentElement.style.setProperty('--hdr-h',(hd?hd.offsetHeight:56)+'px')}
function pinScroll(initial){
  var pin=$('#today-pin');
  if(!pin||S.tab!=='today')return;
  var y=window.scrollY||0,now=Date.now();
  if(!initial&&now<PIN.lockUntil)return;
  var want=PIN.collapsed;
  if(!PIN.collapsed){
    if(y>60){
      var strip=pin.querySelector('.strip'),hc=(strip?strip.offsetHeight+10:62)+78,D=Math.max(0,pin.offsetHeight-hc),room=document.documentElement.scrollHeight-window.innerHeight;
      if(room-D>100)want=true;   /* collapsing shortens the page: only if it can still scroll afterwards, otherwise it would flip back and forth */
    }
  }else if(y<=20)want=false;
  if(want!==PIN.collapsed){
    PIN.collapsed=want;pin.classList.toggle('collapsed',want);PIN.lockUntil=now+350;
  }
  clearTimeout(PIN.padT);
  PIN.padT=setTimeout(function(){var pn=$('#today-pin');if(pn)document.documentElement.style.scrollPaddingTop=(($('#hdr')||{offsetHeight:56}).offsetHeight+(PIN.collapsed?pn.offsetHeight:((pn.querySelector('.strip')||{offsetHeight:52}).offsetHeight+88))+8)+'px'},260);
}
/* swipe between days on Today: right = previous day, left = next day (never into the future) */
var SW={id:null,x:0,y:0,ok:false};
function swipeBlocked(t){
  if(!t||!t.closest)return true;
  if(t.closest('textarea,input,select,#qbar,#sheet,.sheet,[role=dialog],dialog,#drawer,.scroll-x,.tbl-wrap,table,.wk-wrap'))return true;
  return false;
}
function swipeDay(dir){
  var nd=addDays(S.viewDate,dir);
  if(nd>S.today){
    var v=$('#view');if(v&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)){v.classList.remove('bounce');void v.offsetWidth;v.classList.add('bounce');setTimeout(function(){v.classList.remove('bounce')},400)}
    return false;
  }
  S.viewDate=nd;render();return true;
}
document.addEventListener('pointerdown',function(ev){
  SW.ok=false;
  if(S.tab!=='today'||!S.profile||sheetState||document.body.classList.contains('sheet-open'))return;
  if(ev.pointerType==='mouse'&&ev.button!==0)return;
  var dr=$('#drawer');if(dr&&dr.classList.contains('open'))return;
  if(swipeBlocked(ev.target))return;
  try{var sel0=window.getSelection();if(sel0&&String(sel0).length>0)return}catch(e){}   /* leave an existing text selection alone */
  SW={id:ev.pointerId,x:ev.clientX,y:ev.clientY,ok:true};
},true);
var SWQ=0;
document.addEventListener('click',function(ev){if(Date.now()<SWQ){ev.stopPropagation();ev.preventDefault()}},true);   /* a mouse drag is not a tap */
document.addEventListener('pointerup',function(ev){
  if(!SW.ok||ev.pointerId!==SW.id)return;SW.ok=false;
  var dx=ev.clientX-SW.x,dy=ev.clientY-SW.y;
  if(ev.pointerType==='mouse'&&Math.abs(dx)+Math.abs(dy)>12)SWQ=Date.now()+300;
  if(Math.abs(dx)<=60||Math.abs(dx)<=1.5*Math.abs(dy))return;
  if(S.tab!=='today'||sheetState)return;
  try{window.getSelection().removeAllRanges()}catch(e){}
  swipeDay(dx>0?-1:1);
},true);
document.addEventListener('pointercancel',function(){SW.ok=false},true);
window.addEventListener('scroll',function(){pinScroll(false)},{passive:true});
window.addEventListener('resize',function(){pinMetrics();pinScroll(true)});
function viewToday(root){
  var p=S.profile,d=S.viewDate,info=dayInfo(p,d),c=info.c,tot=info.tot,eaten=tot.kcal,isToday=d===S.today;
  /* the week strip, the date line and the Calories/Macros card are pinned under the header; the big card collapses to one compact bar when you scroll */
  var pin=h('div',{class:'today-pin noanim',id:'today-pin'});root.appendChild(pin);
  pin.appendChild(weekStrip(d));
  pin.appendChild(h('p',{class:'muted small date-long',id:'date-long',text:p.name+' - '+fmtDateLong(d)}));
  /* one-time notice for profiles moved to the new activity scale */
  var an=p.activityNote;
  if(an&&!an.dismissed&&an.from!==an.to){
    var kgN=weightOn(p.id,p,d),cOld=calc(Object.assign({},p,{activity:an.from}),kgN,d),cNew=calc(p,kgN,d);
    var tgtTxt=r0(cOld.target)===r0(cNew.target)?'your target stays at '+r0(cNew.target)+' kcal':'your target from '+r0(cOld.target)+' to '+r0(cNew.target)+' kcal';
    var nb=h('div',{class:'banner info',id:'activity-notice',role:'note'},
      h('p',{style:'margin:0 0 6px',text:'We made the daily burn estimate more realistic. Your daily burn changed from '+r0(cOld.tdee)+' to '+r0(cNew.tdee)+' kcal and '+tgtTxt+'. If you work out 5+ times a week, choose Very active in Daily goals.'}),
      h('button',{type:'button',class:'btn sm',id:'activity-notice-ok',text:'Got it',onclick:function(){var np=Object.assign({},S.profile,{activityNote:Object.assign({},an,{dismissed:true}),updatedAt:Date.now()});saveProfile(np);S.profile=np;nb.remove()}}));
    root.appendChild(nb);
  }
  var m3=m3Card(p,d);if(m3)root.appendChild(m3);
  /* Calories + macros */
  var exercise=info.exTotal,counted=info.counted,left=info.left,note=targetNote(c,p);
  var cmpEl=compactBar(tot,c,left,counted,eaten);
  pin.appendChild(h('section',{class:'card cal-card',id:'cal-card','aria-label':'Calories and macros'},h('div',{class:'sum-exp'},
    h('h2',{class:'cardhead'},icon(ICONS.today,'hico'),'Calories'),
    h('div',{class:'pbar big',id:'t-bar',role:'progressbar','aria-valuemin':'0','aria-valuemax':String(r0(c.target+counted)),'aria-valuenow':String(r0(eaten)),'aria-label':'Calories eaten of daily target'},h('i',{class:eaten>c.target+counted?'over':'',style:'width:'+Math.min(100,(c.target+counted)>0?eaten/(c.target+counted)*100:0)+'%'})),
    h('div',{class:'cols3'},
      h('div',null,h('span',{class:'clabel',text:'Food'}),h('span',{class:'cval',id:'t-kcal',text:String(r0(eaten))})),
      h('div',null,h('span',{class:'clabel',text:'Exercise'}),h('span',{class:'cval',id:'t-exercise',text:String(r0(exercise))})),
      h('div',null,h('span',{class:'clabel',id:'t-remaining-label',text:left>=0?'Remaining':'Over by'}),h('span',{class:'cval strong'+(left<0?' bad':''),id:'t-remaining',text:String(left>=0?r0(left):'-'+r0(-left))}))),
    exercise>0&&!p.exerciseAdds?h('p',{class:'small muted',id:'ex-note',text:'Exercise: not added, your activity level already includes workouts.'}):null,
    h('h2',{class:'cardhead'},icon(ICONS.weekly,'hico'),'Macros'),
    h('div',{class:'cols3 macros'},macroCol('Carbs','t-c',tot.c,c.c),macroCol('Protein','t-p',tot.p,c.p),macroCol('Fat','t-f',tot.f,c.f))),cmpEl));
  PIN.collapsed=false;requestAnimationFrame(function(){pinScroll(true);requestAnimationFrame(function(){pin.classList.remove('noanim')})});
  root.appendChild(waterCard(p,d));
  /* meals */
  var bySlot={},order=[];
  info.ents.forEach(function(e){if(!bySlot[e.slot]){bySlot[e.slot]=[];order.push(e.slot)}bySlot[e.slot].push(e)});
  var liveIds=p.slots.map(function(s){return s.id}),groups=[];
  p.slots.forEach(function(s){if(bySlot[s.id])groups.push({id:s.id,name:s.name,list:bySlot[s.id]})});
  order.forEach(function(id){if(liveIds.indexOf(id)<0)groups.push({id:id,name:slotNameOf(p,bySlot[id][0]),list:bySlot[id],removed:true})});
  var logCache={};
  function logOf(e){if(!e.logId)return null;if(!(e.logId in logCache))logCache[e.logId]=findLog(p.id,e.logId,e.date);return logCache[e.logId]}
  groups.forEach(function(g){
    var list=g.list,sub=sumEntries(list).kcal;
    var card=h('section',{class:'card slot tappable','aria-label':g.name,'data-slot':g.id,onclick:function(ev){if(ev.target.closest('button,a,input,select,textarea'))return;openMeal(d,g)}},
      h('h3',null,h('button',{type:'button',class:'slot-title-btn','aria-label':'Open details for '+g.name,onclick:function(){openMeal(d,g)}},g.name),h('span',{class:'slot-kcal',text:r0(sub)+' kcal'}),
        h('button',{type:'button',class:'icon-btn slot-menu-btn','aria-label':'Options for '+g.name,'aria-haspopup':'dialog',onclick:function(ev){openSlotMenu(g,ev.currentTarget)}},icon(ICONS.more))));
    var ul=h('ul',{class:'plain'}),lastLog=null;
    list.forEach(function(e){
      var n=entryNut(e),lg=logOf(e);
      if(lg&&e.logId!==lastLog){
        var txt=h('button',{type:'button',class:'logtext','aria-expanded':'false','aria-label':'What you typed: '+lg.text+'. Tap to show all or fewer lines.',onclick:function(){var o=txt.classList.toggle('open');txt.setAttribute('aria-expanded',o?'true':'false')}});
        txt.appendChild(h('span',{class:'logtext-in',text:lg.text}));
        ul.appendChild(h('li',{class:'logline'},txt));
      }
      lastLog=e.logId||null;
      var li=h('li',{class:'entry col','data-time':e.time,'data-id':e.id});
      var menuBtn=h('button',{type:'button',class:'icon-btn menu-btn','aria-label':'Options for '+e.foodName,'aria-haspopup':'dialog',onclick:function(){openEntryMenu(e,menuBtn)}},icon(ICONS.more));
      li.appendChild(h('div',{class:'top'},h('div',{class:'grow'},h('b',{text:e.foodName}),' ',h('span',{class:'qty-text',text:'('+qtyText(e)+')'}),e.est==='ai'&&!e.adj?h('span',null,' ',h('span',{class:'tag ai',title:'Calories and macros estimated by AI','aria-label':'Estimated by AI',text:'AI'})):null),menuBtn));
      li.appendChild(h('div',{class:'muted small'},h('span',{class:'time-text',text:fmt12(e.time)})));
      li.appendChild(chipsFor(n,!!e.adj));
      ul.appendChild(li);
    });
    card.appendChild(ul);
    if(!g.removed)card.appendChild(h('button',{type:'button',class:'btn sm',style:'margin-top:6px',text:'Add to '+g.name,onclick:function(){S.add=newAddCtx({date:d,slot:g.id});S.tab='add';render(true)}}));
    root.appendChild(card);
  });
  if(info.exs.length)root.appendChild(exerciseCard(p,info,logOf));
}

/* ---------- MEAL DETAIL: items, totals, nutrition facts, on-demand AI analysis ---------- */
var MEAL_AN={};   /* in-memory cache of AI analyses, keyed by the meal's numbers; never stored */
function openMeal(d,g){S.meal={date:d,slot:g.id,name:g.name};S.tab='meal';render(true)}
function mealFacts(list){
  /* sums only the nutrients the food table really has: carbs, fibre, protein, fat. Fibre is partial when some items have none. */
  var t={c:0,p:0,f:0,fib:0},fibN=0;
  list.forEach(function(e){
    var n=entryNut(e);t.c+=n.c;t.p+=n.p;t.f+=n.f;
    var known=e.est!=='ai'&&!(e.per100.fib===0&&/^(c_|off_|ai_|rp_)/.test(e.foodId||''));
    if(known){t.fib+=nut(e).fib;fibN++}
  });
  t.fibN=fibN;t.n=list.length;return t;
}
function mealKey(list){return list.map(function(e){var n=entryNut(e);return e.id+':'+r1(n.kcal)+'/'+r1(n.p)+'/'+r1(n.c)+'/'+r1(n.f)}).join('|')}
function mealPrompt(name,list,tot,fact){
  var L=['Meal: '+name+'.'];
  list.forEach(function(e){var n=entryNut(e);L.push('- '+e.foodName+' ('+qtyText(e)+'): '+r0(n.kcal)+' kcal, protein '+r1(n.p)+' g, carbs '+r1(n.c)+' g, fat '+r1(n.f)+' g')});
  L.push('Total: '+r0(tot.kcal)+' kcal, protein '+r1(tot.p)+' g, carbs '+r1(tot.c)+' g, fat '+r1(tot.f)+' g'+(fact.fibN?', fibre '+r1(fact.fib)+' g'+(fact.fibN<fact.n?' (from '+fact.fibN+' of '+fact.n+' items)':''):'')+'.');
  return L.join('\n');
}
/* one plain-text generation (temperature 0, short), with timeout and Cancel; resolves {text,reason} */
function llmAnalyse(prompt){
  return new Promise(function(resolve){
    var done=false,job={};LLM.job=job;
    function fin(text,reason){if(done)return;done=true;clearTimeout(tm);if(LLM.job===job)LLM.job=null;if(LLM.state==='ready')llmTouch();resolve({text:text,reason:reason})}
    var tm=setTimeout(function(){llmInterrupt();fin(null,'timeout')},window.__llmTimeoutMs||30000);
    job.cancel=function(){llmInterrupt();fin(null,'cancelled')};
    llmEnsure().then(function(ok){
      if(done)return;if(!ok){fin(null,'error');return}
      var mk=llmMock();
      if(mk&&mk.analyse)return Promise.resolve(mk.analyse(prompt));
      if(mk)return Promise.reject(new Error('no analyse'));
      var eng=LLM.engine,model=llmModel(LLM.modelId);if(!eng)return Promise.reject(new Error('no engine'));
      var req={messages:[{role:'system',content:'You write a short note about one meal for the person who ate it. Use only the numbers given. Write 2 or 3 plain sentences about the mix of protein, fibre, fat and sugar. No lists, no medical advice, no diagnoses.'},{role:'user',content:prompt+(model&&model.qwen?' /no_think':'')}],temperature:0,max_tokens:140};
      if(model&&model.qwen)req.extra_body={enable_thinking:false};
      return eng.chat.completions.create(req).then(function(r){return r&&r.choices&&r.choices[0]&&r.choices[0].message&&r.choices[0].message.content});
    }).then(function(t){if(done)return;t=typeof t==='string'?t.replace(/\s+/g,' ').trim().slice(0,600):'';fin(t||null,t?'ok':'bad')},function(){fin(null,'error')});
  });
}
function viewMeal(root){
  var p=S.profile,m=S.meal;
  var list=m?entriesOn(p.id,m.date).filter(function(e){return e.slot===m.slot}):[];
  if(!list.length){S.tab='today';S.meal=null;S.viewDate=m?m.date:S.viewDate;viewToday(root);return}
  var d=m.date,info=dayInfo(p,d),c=info.c,tot=sumEntries(list),fact=mealFacts(list);
  var live=p.slots.filter(function(x){return x.id===m.slot})[0],name=live?live.name:slotNameOf(p,list[0]);m.name=name;
  var g={id:m.slot,name:name,list:list,removed:!live};
  var t=$('#title');if(t)t.textContent=name;
  root.appendChild(h('div',{class:'row',style:'margin-bottom:8px'},h('button',{type:'button',class:'icon-btn',id:'meal-back','aria-label':'Back to the day',onclick:function(){S.tab='today';S.viewDate=d;S.meal=null;render(true)}},icon(ICONS.back)),
    h('span',{class:'muted small grow',text:p.name+' - '+fmtDateLong(d)})));
  var card=h('section',{class:'card meal-card',id:'meal-card','aria-label':name+' details'});
  var ul=h('ul',{class:'plain'});
  list.forEach(function(e){
    var n=entryNut(e);
    var mb=h('button',{type:'button',class:'icon-btn menu-btn','aria-label':'Options for '+e.foodName,'aria-haspopup':'dialog',onclick:function(){openEntryMenu(e,mb)}},icon(ICONS.more));
    var li=h('li',{class:'entry col','data-id':e.id});
    li.appendChild(h('div',{class:'top'},h('div',{class:'grow'},h('b',{text:e.foodName}),' ',h('span',{class:'qty-text',text:'('+qtyText(e)+')'}),e.est==='ai'&&!e.adj?h('span',null,' ',h('span',{class:'tag ai','aria-label':'Estimated by AI',title:'Calories and macros estimated by AI',text:'AI'})):null),mb));
    li.appendChild(chipsFor(n,!!e.adj));ul.appendChild(li);
  });
  card.appendChild(ul);
  function tcol(label,id,val,goal,unit){
    var pc=goal>0?val/goal*100:0;
    return h('div',{class:'tc'+(pc>100?' over':'')},h('span',{class:'cl',text:label}),h('span',{class:'cv',id:id,text:r0(val)+unit}),bar(goal>0?val/goal:0,pc>100),h('span',{class:'cp',id:id+'-pct',text:r0(pc)+'%'+(pc>100?' (over)':'')}));
  }
  card.appendChild(h('div',{class:'cols4c meal-totals',id:'meal-totals','aria-label':'Meal totals and share of the daily goal'},
    tcol('Calories','mt-kcal',tot.kcal,c.target+info.counted,''),tcol('Carbs','mt-c',tot.c,c.c,'g'),tcol('Protein','mt-p',tot.p,c.p,'g'),tcol('Fat','mt-f',tot.f,c.f,'g')));
  card.appendChild(h('p',{class:'muted small',style:'margin:2px 0 6px',text:'Share of your daily goal for the day.'}));
  card.appendChild(h('div',{class:'row meal-foot'},h('span',{class:'muted time-text',id:'meal-time',text:fmt12(list[0].time)}),h('span',{class:'grow'}),
    h('button',{type:'button',class:'btn sm',id:'meal-add',text:'Add to '+name,onclick:function(){S.add=newAddCtx({date:d,slot:m.slot});S.tab='add';render(true)}}),
    h('button',{type:'button',class:'icon-btn slot-menu-btn',id:'meal-menu','aria-label':'Options for '+name,'aria-haspopup':'dialog',onclick:function(ev){openSlotMenu(g,ev.currentTarget)}},icon(ICONS.more))));
  root.appendChild(card);
  /* health analysis: on demand, AI only */
  var key=mealKey(list),an=h('section',{class:'card',id:'health-card','aria-label':'Health analysis'}),out=h('p',{id:'an-text',class:'an-text'}),note=h('p',{class:'muted small',id:'an-note'}),btnRow=h('div',{class:'row'});
  an.appendChild(h('h2',{class:'cardhead'},'Health analysis'));
  function drawAn(){
    out.textContent=MEAL_AN[key]||'';btnRow.replaceChildren();
    var on=aiEnabled();
    if(MEAL_AN[key])note.textContent='AI-written, not medical advice. Made from this meal\'s numbers on your phone and not saved.';
    else if(!on)note.textContent='Turn on the on-device AI (Settings, then On-device AI) to get a short written analysis of this meal.';
    else note.textContent='A short note on the mix of protein, fibre, fat and sugar, written by the on-device AI. Not medical advice.';
    btnRow.appendChild(h('button',{type:'button',class:'btn',id:'an-btn',disabled:!on,text:MEAL_AN[key]?'Analyse again':'Analyse this meal',onclick:run}));
  }
  function run(){
    btnRow.replaceChildren(h('span',{class:'muted',id:'an-busy',role:'status',text:'Analysing...'}),h('button',{type:'button',class:'btn',id:'an-cancel',text:'Cancel',onclick:function(){if(LLM.job&&LLM.job.cancel)LLM.job.cancel()}}));
    llmAnalyse(mealPrompt(name,list,tot,fact)).then(function(r){
      if(!out.isConnected)return;
      if(r.text){MEAL_AN[key]=r.text;drawAn()}
      else{drawAn();note.textContent=r.reason==='cancelled'?'Cancelled.':r.reason==='timeout'?'That took too long, so it was stopped. You can try again.':'The AI could not write an analysis this time.'}
    });
  }
  an.appendChild(out);an.appendChild(btnRow);an.appendChild(note);drawAn();root.appendChild(an);
  /* nutrition facts: only what the food table has */
  var nf=h('section',{class:'card',id:'nf-card','aria-label':'Nutrition facts'});nf.appendChild(h('h2',{class:'cardhead'},'Nutrition facts'));
  function row(id,label,val,unit,sub,partial){
    var r=h('div',{class:'nf-row'+(sub?' sub':''),id:id},h('span',{class:'nf-l'},label,partial?h('small',{class:'muted nf-partial',text:'partial: from '+fact.fibN+' of '+fact.n+' items'}):null),h('span',{class:'nf-v',text:r1(val)+' '+unit}));return r;
  }
  nf.appendChild(h('p',{class:'muted small',id:'nf-basis',text:'For the whole meal: '+list.length+(list.length===1?' item':' items')+', about '+r0(list.reduce(function(a,e){return a+e.grams},0))+' g eaten.'}));
  nf.appendChild(row('nf-carbs','Total carbohydrates',fact.c,'g'));
  if(fact.fibN>0)nf.appendChild(row('nf-fibre','Dietary fibre',fact.fib,'g',true,fact.fibN<fact.n));
  nf.appendChild(row('nf-protein','Protein',fact.p,'g'));
  nf.appendChild(row('nf-fat','Total fat',fact.f,'g'));
  nf.appendChild(h('p',{class:'muted small',id:'nf-note',text:'Only the nutrients in the built-in food table are shown. Sugars, fat types, minerals and vitamins are not in it, so they are left out rather than guessed.'+(list.some(function(e){return e.est==='ai'})?' AI-estimated items add only calories, carbs, protein and fat.':'')}));
  root.appendChild(nf);
}

/* ---------- model 3 choice card, water card, exercise card ---------- */
function m3Card(p,d){
  if(p.activityModel>=3||p.m3Dismissed)return null;
  var an=p.activityNote;if(an&&!an.dismissed&&an.from!==an.to)return null;   /* show the scale notice first */
  var map=TO_EVERYDAY[p.activity]||nearestOf(p.activity,EVERYDAY.map(function(a){return a[0]})),kg=weightOn(p.id,p,d);
  var cOld=calc(p,kg,d),box=h('section',{class:'card m3-card',id:'m3-card','aria-label':'Count workouts separately'});
  var sel=h('select',{id:'m3-level','aria-label':'Everyday activity level'});
  EVERYDAY.forEach(function(a){sel.appendChild(h('option',{value:String(a[0]),selected:a[0]===map,text:a[1]}))});
  var nums=h('p',{id:'m3-numbers',class:'small'});
  function upd(){
    var cNew=calc(Object.assign({},p,{activity:parseFloat(sel.value)}),kg,d);
    nums.textContent='Daily target now: '+r0(cOld.target)+' kcal (burn '+r0(cOld.tdee)+'). Counting workouts separately: '+r0(cNew.target)+' kcal (burn '+r0(cNew.tdee)+'), plus the calories of each workout you log.';
  }
  sel.addEventListener('change',upd);
  box.appendChild(h('h2',{text:'Count workouts separately?'}));
  box.appendChild(h('p',{class:'muted',text:'Your activity level now includes your workouts. You can instead pick an everyday level (without workouts) and add each workout you log, so a day with exercise gives you more to eat.'}));
  box.appendChild(h('label',{for:'m3-level'},'Everyday level'));box.appendChild(sel);box.appendChild(nums);
  box.appendChild(h('div',{class:'row',style:'margin-top:8px'},
    h('button',{type:'button',class:'btn primary',id:'m3-accept',text:'Accept',onclick:function(){
      var np=Object.assign({},S.profile,{activity:parseFloat(sel.value),activityModel:3,exerciseAdds:true,activityNote:null,m3Dismissed:false,updatedAt:Date.now()});
      saveProfile(np);S.profile=np;render();toast('Workouts are now counted separately');}}),
    h('button',{type:'button',class:'btn',id:'m3-keep',text:'Keep as is',onclick:function(){
      var np=Object.assign({},S.profile,{m3Dismissed:true,updatedAt:Date.now()});saveProfile(np);S.profile=np;render();}})));
  upd();return box;
}
function fmtWater(ml){return ml>=1000?(Math.round(ml/10)/100)+' L':Math.round(ml)+' ml'}
function waterCard(p,d){
  var box=h('section',{class:'card water-card',id:'water-card','aria-label':'Water'});
  function draw(){
    var cups=cupsOn(p.id,d),goal=p.waterGoalCups||8,ml=p.cupMl||250,left=goal-cups;
    box.replaceChildren(
      h('h2',{class:'cardhead'},icon(ICONS.water,'hico'),h('span',{id:'w-total',text:'Water: '+fmtWater(cups*ml)})),
      h('div',{class:'water-row'},
        h('button',{type:'button',class:'btn round',id:'w-minus','aria-label':'One cup less',disabled:cups<=0,text:'−',onclick:function(){setCups(p.id,d,cups-1);draw()}}),
        h('span',{class:'water-mid',id:'w-cups',text:cups+(cups===1?' cup':' cups')+' · '+(left>0?left+' to go':'goal reached')}),
        h('button',{type:'button',class:'btn round',id:'w-plus','aria-label':'One cup more',text:'+',onclick:function(){setCups(p.id,d,cups+1);draw()}})));
  }
  draw();return box;
}
function exerciseCard(p,info,logOf){
  var card=h('section',{class:'card slot ex-card',id:'ex-card','aria-label':'Exercise'},
    h('h3',null,h('span',{text:'Exercise'}),h('span',{class:'slot-kcal',id:'ex-burned',text:'Burned '+r0(info.exTotal)})));
  var ul=h('ul',{class:'plain'}),lastLog=null;
  info.exs.forEach(function(x){
    var lg=x.logId?logOf({logId:x.logId,date:x.date}):null;
    if(lg&&x.logId!==lastLog){
      var txt=h('button',{type:'button',class:'logtext','aria-expanded':'false','aria-label':'What you typed: '+lg.text+'. Tap to show all or fewer lines.',onclick:function(){var o=txt.classList.toggle('open');txt.setAttribute('aria-expanded',o?'true':'false')}});
      txt.appendChild(h('span',{class:'logtext-in',text:lg.text}));ul.appendChild(h('li',{class:'logline'},txt));
    }
    lastLog=x.logId||null;
    var li=h('li',{class:'ex-row col','data-time':x.time,'data-id':x.id});
    var mb=h('button',{type:'button',class:'icon-btn menu-btn','aria-label':'Options for '+x.label,'aria-haspopup':'dialog',onclick:function(){openExMenu(x,mb)}},icon(ICONS.more));
    li.appendChild(h('div',{class:'top'},h('div',{class:'grow'},h('b',{text:x.label}),' ',h('span',{class:'qty-text',text:'('+exQtyText(x)+')'})),mb));
    li.appendChild(h('div',{class:'muted small'},h('span',{class:'time-text',text:fmt12(x.time)})));
    li.appendChild(h('div',{class:'nchips'},h('span',{class:'nchip',text:'Burned: '+r0(exKcal(x))+' kcal'}),x.kcalAdj!=null?h('span',{class:'tag',text:'adjusted'}):null));
    ul.appendChild(li);
  });
  card.appendChild(ul);
  if(!p.exerciseAdds)card.appendChild(h('p',{class:'small muted',id:'ex-card-note',text:'Not added, your activity level already includes workouts.'}));
  return card;
}
function exQtyText(x){return fmtQty(x.minutes)+' min'+(x.distanceKm?', '+fmtQty(x.distanceKm)+' km':'')}
function exSnap(x){var o={type:'exercise',actKey:x.actKey,label:x.label,minutes:x.minutes,met:x.met};if(x.distanceKm)o.distanceKm=x.distanceKm;if(x.kcalAdj!=null)o.kcalAdj=x.kcalAdj;return o}
function foodSnap(e){var o={type:'food',foodId:e.foodId,foodName:e.foodName,qty:e.qty,unit:e.unit,unitLabel:e.unitLabel,unitG:e.unitG,grams:e.grams,per100:e.per100,slot:e.slot};if(e.adj)o.adj=e.adj;if(e.est)o.est=e.est;return o}

/* ---------- exercise row menu and its sheets ---------- */
function openExMenu(x0,opener){
  var x=freshEx(x0);
  openSheet({title:x.label,opener:opener,id:'ex-menu',build:function(body,close){
    var ul=h('ul',{class:'plain menu-list'});
    function item(id,label,ic,fn,o){o=o||{};ul.appendChild(h('li',null,h('button',{type:'button',id:id,class:'menu-item'+(o.danger?' danger':''),onclick:fn},icon(ICONS[ic]),h('span',{class:'grow',text:label}))))}
    item('ex-edit','Edit exercise','edit',function(){close(false);openExEdit(x,opener)});
    item('ex-adjust','Adjust calories burned','adjust',function(){close(false);openExAdjust(x,opener)});
    item('ex-datetime','Change date & time','clock',function(){close(false);openExDT(x,opener)});
    item('ex-save','Add to saved entries','saved',function(){close(false);openSaveName([exSnap(x)],x.label,opener)});
    item('ex-delete','Delete','trash',function(){close(false);deleteEx(x)},{danger:true});
    body.appendChild(ul);ul.querySelector('button').setAttribute('data-autofocus','1');
  }});
}
function deleteEx(x){
  var p=S.profile,gone=removeEx(p.id,x.id,x.date),lg=null;
  if(x.logId&&!allEntries(p.id).some(function(e){return e.logId===x.logId})&&!allEx(p.id).some(function(y){return y.logId===x.logId})){var l0=findLog(p.id,x.logId,x.date);if(l0)lg=removeLog(p.id,l0.id,l0.date)}
  render();
  toast('Deleted '+x.label,'Undo',function(){if(gone){putEx(p.id,gone);if(lg)putLog(p.id,lg);render()}});
}
function openExEdit(x,opener){
  openSheet({title:'Edit exercise',opener:opener,id:'ex-edit-sheet',build:function(body,close){
    var err=h('p',{class:'err',role:'alert',id:'exe-err'});
    var sel=h('select',{id:'exe-act','aria-label':'Activity'});
    MET.activities.forEach(function(a){sel.appendChild(h('option',{value:a.key,selected:a.key===x.actKey,text:a.label+' (MET '+a.met+')'}))});
    var mins=h('input',{type:'number',id:'exe-min',inputmode:'decimal',step:'any',min:'1',max:'600',value:String(x.minutes),'aria-label':'Minutes'});
    var info=h('p',{class:'muted small',id:'exe-info'});
    function upd(){var a=EXBYKEY[sel.value],m=parseFloat(mins.value);info.textContent=a&&m>0?'About '+r0(a.met*x.kgUsed*m/60)+' kcal ('+a.met+' MET x '+fmt2(x.kgUsed)+' kg x '+fmtQty(m)+' min / 60).':''}
    sel.addEventListener('change',upd);mins.addEventListener('input',upd);
    var tinp=h('input',{type:'text',id:'exe-text',maxlength:'120',autocomplete:'off','aria-label':'Edit as text',value:fmtQty(x.minutes)+' min '+String(x.label||'').toLowerCase(),placeholder:'e.g. 45 min brisk walk'}),tlive=h('p',{class:'small muted',id:'exe-text-live',role:'status','aria-live':'polite'});
    tinp.addEventListener('input',function(){
      tlive.textContent='';var t=tinp.value.trim();if(!t)return;
      var r=parseExercise(t,x.kgUsed);
      if(!r){tlive.textContent='No exercise found in those words. Try "45 min brisk walk".';return}
      sel.value=r.actKey;mins.value=String(r.minutes);upd();
      tlive.textContent='Read as '+r.label+', '+fmtQty(r.minutes)+' min'+(r.assumed?' (30 min assumed, no time was given)':'')+'.';
    });
    body.appendChild(h('label',{for:'exe-text',style:'margin-top:0'},'Edit as text'));body.appendChild(tinp);body.appendChild(tlive);
    body.appendChild(h('label',{for:'exe-act'},'Activity'));body.appendChild(sel);
    body.appendChild(h('label',{for:'exe-min'},'Minutes'));body.appendChild(mins);body.appendChild(info);body.appendChild(err);
    body.appendChild(h('div',{class:'row',style:'margin-top:12px'},h('button',{type:'button',id:'exe-save',class:'btn primary grow',text:'Save',onclick:function(){
      var m=parseFloat(mins.value);if(!isFinite(m)||m<1||m>600){err.textContent='Enter minutes from 1 to 600.';mins.focus();return}
      var rec=freshEx(x),a=EXBYKEY[sel.value]||{met:rec.met,label:rec.label};
      rec.actKey=sel.value;rec.label=a.label;rec.met=a.met;rec.minutes=Math.round(m*10)/10;rec.kcal=rec.met*rec.kgUsed*rec.minutes/60;delete rec.kcalAdj;rec.updatedAt=Date.now();
      putEx(S.profile.id,rec);close(false);render();toast('Exercise saved')}}),
      h('button',{type:'button',class:'btn',text:'Cancel',onclick:function(){close()}})));
    upd();sel.setAttribute('data-autofocus','1');
  }});
}
function openExAdjust(x,opener){
  openSheet({title:'Adjust calories burned',opener:opener,id:'ex-adjust-sheet',build:function(body,close){
    var err=h('p',{class:'err',role:'alert',id:'exa-err'});
    var inp=h('input',{type:'number',id:'exa-kcal',inputmode:'decimal',step:'any',min:'0',value:String(Math.round(exKcal(x)*10)/10),'aria-label':'Calories burned'});
    body.appendChild(h('p',{class:'muted small',text:'Calculated: '+r0(x.kcal)+' kcal ('+x.met+' MET x '+fmt2(x.kgUsed)+' kg x '+fmtQty(x.minutes)+' min / 60). Type your own number if a watch or machine shows something else.'}));
    body.appendChild(h('label',{for:'exa-kcal'},'Calories burned (kcal)'));body.appendChild(inp);body.appendChild(err);
    body.appendChild(h('div',{class:'row',style:'margin-top:12px'},
      h('button',{type:'button',id:'exa-save',class:'btn primary grow',text:'Save',onclick:function(){
        var v=parseFloat(inp.value);if(!isFinite(v)||v<0||v>20000){err.textContent='Enter a number from 0 to 20000.';inp.focus();return}
        var rec=freshEx(x);if(Math.abs(v-rec.kcal)<0.5)delete rec.kcalAdj;else rec.kcalAdj=v;rec.updatedAt=Date.now();putEx(S.profile.id,rec);close(false);render();toast('Calories burned saved')}}),
      x.kcalAdj!=null?h('button',{type:'button',id:'exa-reset',class:'btn',text:'Reset to calculated',onclick:function(){var rec=freshEx(x);delete rec.kcalAdj;rec.updatedAt=Date.now();putEx(S.profile.id,rec);close(false);render();toast('Reset to calculated value')}}):null,
      h('button',{type:'button',class:'btn',text:'Cancel',onclick:function(){close()}})));
    inp.setAttribute('data-autofocus','1');
  }});
}
function openExDT(x,opener){
  openSheet({title:'Change date & time',opener:opener,id:'datetime-sheet',build:function(body,close){
    var st={date:x.date,time:x.time},err=h('p',{class:'err',role:'alert',id:'cd-err'});
    var date=h('input',{type:'date',id:'cd-date',value:x.date,max:S.today});
    var tp=timePicker({value:x.time,label:'Time',idPrefix:'q',onChange:function(v){st.time=v||''},onEnter:done,onEscape:function(){close()}});
    function done(){
      err.textContent='';var v=tp.get();if(!v){tp.validate();return}
      if(!isDate(date.value)||date.value>S.today){err.textContent='Pick a valid date that is not in the future.';return}
      var rec=freshEx(x),old=rec.date;rec.date=date.value;rec.time=v;rec.updatedAt=Date.now();
      if(old!==rec.date)removeEx(S.profile.id,rec.id,old);putEx(S.profile.id,rec);close(false);S.viewDate=rec.date;render();toast('Saved: '+fmtDate(rec.date)+', '+fmt12(rec.time));
    }
    body.appendChild(h('label',{for:'cd-date',style:'margin-top:0'},'Date'));body.appendChild(date);body.appendChild(h('label',null,'Time'));body.appendChild(tp.el);body.appendChild(err);
    body.appendChild(h('div',{class:'row',style:'margin-top:12px'},h('button',{type:'button',id:'q-done',class:'btn primary grow',text:'Save',onclick:done}),h('button',{type:'button',id:'q-cancel',class:'btn',text:'Cancel',onclick:function(){close()}})));
    date.setAttribute('data-autofocus','1');
  }});
}

/* ---------- saved entries ---------- */
/* "Edit as text" for a whole meal: its items back as one line each (or what you originally typed), re-read and saved over the old ones */
function editMealAsText(g,opener){
  var p=S.profile,first=g.list[0],lg=first.logId?findLog(p.id,first.logId,first.date):null;
  var lines=g.list.map(function(e){return fmtQty(e.qty)+' '+shortUnit(e)+' '+e.foodName.replace(/\s*\([^)]*\)/g,'').replace(/,.*$/,'')}).join('\n');
  var txt=lg&&lg.text&&g.list.every(function(e){return e.logId===first.logId})?lg.text:lines;
  openSheet({title:'Edit as text',opener:opener,id:'et-sheet',build:function(body,close){
    var ta=h('textarea',{id:'et-text',rows:'6',maxlength:'500','aria-label':'Meal as text, one item per line'});ta.value=txt;
    body.appendChild(h('p',{class:'muted small',text:'One item per line. Date, time and meal stay as they are. You check the result before it replaces this meal.'}));
    body.appendChild(ta);
    body.appendChild(h('div',{class:'row',style:'margin-top:10px'},h('button',{type:'button',class:'btn primary grow',id:'et-go',text:'Read and check',onclick:function(){
      var v=ta.value.trim();if(!v)return;close(false);openPreview(v,null,{date:first.date,time:first.time,slot:g.id,replace:g.list.map(function(e){return {id:e.id,date:e.date}})});
    }}),h('button',{type:'button',class:'btn',text:'Cancel',onclick:function(){close()}})));
    ta.focus();
  }});
}
function openSlotMenu(g,opener){
  openSheet({title:g.name,opener:opener,id:'slot-menu',build:function(body,close){
    var ul=h('ul',{class:'plain menu-list'});
    if(!g.removed)ul.appendChild(h('li',null,h('button',{type:'button',id:'sm-text',class:'menu-item',onclick:function(){close(false);editMealAsText(g,opener)}},icon(ICONS.edit),h('span',{class:'grow',text:'Edit as text'}))));
    ul.appendChild(h('li',null,h('button',{type:'button',id:'sm-save',class:'menu-item',onclick:function(){close(false);openSaveName(g.list.map(foodSnap),g.name,opener)}},icon(ICONS.saved),h('span',{class:'grow',text:'Save this meal'}))));
    body.appendChild(ul);ul.querySelector('button').setAttribute('data-autofocus','1');
  }});
}
function openSaveName(items,defName,opener){
  openSheet({title:'Add to saved entries',opener:opener,id:'save-sheet',build:function(body,close){
    var err=h('p',{class:'err',role:'alert',id:'sv-err'});
    var inp=h('input',{type:'text',id:'sv-name',maxlength:'40',autocomplete:'off',value:String(defName||'').slice(0,40),'aria-label':'Name',
      onkeydown:function(ev){if(ev.key==='Enter'){ev.preventDefault();go()}}});
    function go(){
      err.textContent='';var nm=normName(inp.value);
      if(!nm){err.textContent='Give it a name.';inp.focus();return}
      if(nm.length>40){err.textContent='Names can be up to 40 characters.';return}
      var list=loadSaved(S.profile.id);
      if(list.some(function(x){return savedKey(x.name)===savedKey(nm)})){err.textContent='You already have a saved entry with that name. Pick another name.';inp.focus();return}
      var now=Date.now();list.push({id:'sv'+uuid().replace(/[^\w]/g,'').slice(0,20),name:nm,items:items,updatedAt:now,createdAt:now});
      saveSaved(S.profile.id,list);close(false);toast('Saved as "'+nm+'"');
    }
    body.appendChild(h('p',{class:'muted small',text:items.length===1?'Save this so you can add it again with one tap, or by typing its name in the log box.':'Save these '+items.length+' items together. Add them again with one tap, or by typing the name in the log box.'}));
    body.appendChild(h('label',{for:'sv-name',style:'margin-top:0'},'Name'));body.appendChild(inp);body.appendChild(err);
    body.appendChild(h('div',{class:'row',style:'margin-top:12px'},h('button',{type:'button',id:'sv-save',class:'btn primary grow',text:'Save',onclick:go}),h('button',{type:'button',class:'btn',id:'sv-cancel',text:'Cancel',onclick:function(){close()}})));
    inp.setAttribute('data-autofocus','1');
  }});
}
/* put a saved entry's items on a day; returns the number of rows added */
function addSavedTo(sv,date){
  var p=S.profile,now=Date.now(),time=date===S.today?nowTime():'12:00',n=0,kg=weightOn(p.id,p,date);
  var logId='l'+uuid().replace(/[^\w]/g,'').slice(0,20);
  sv.items.forEach(function(s){
    if(s.type==='exercise'){
      var a=EXBYKEY[s.actKey],met=a?a.met:s.met,x={id:uuid(),date:date,time:time,actKey:s.actKey,label:a?a.label:s.label,minutes:s.minutes,met:met,kgUsed:kg,kcal:met*kg*s.minutes/60,logId:logId,updatedAt:now,createdAt:now};
      if(s.distanceKm)x.distanceKm=s.distanceKm;if(s.kcalAdj!=null)x.kcalAdj=s.kcalAdj;putEx(p.id,x);n++;
    }else{
      var live=p.slots.some(function(q){return q.id===s.slot}),slot=live?s.slot:nextSlotId(p,date),sl=p.slots.filter(function(q){return q.id===slot})[0]||p.slots[0];
      var e={id:uuid(),date:date,time:time,slot:sl.id,slotName:sl.name,foodId:s.foodId,foodName:s.foodName,qty:s.qty,unit:s.unit,unitLabel:s.unitLabel,unitG:s.unitG,grams:s.grams,per100:s.per100,logId:logId,updatedAt:now,createdAt:now};
      if(s.adj)e.adj=s.adj;if(s.est)e.est=s.est;putEntry(p.id,e);n++;
    }
  });
  if(n)putLog(p.id,{id:logId,date:date,time:time,text:sv.name,updatedAt:now,createdAt:now});
  return n;
}

/* ---------- calendar sheet ---------- */
function openCalendar(opener){
  var p=S.profile;
  S.calMonth=S.viewDate.slice(0,7);
  var db=$('#date-btn');if(db)db.setAttribute('aria-expanded','true');
  openSheet({title:'Pick a day',opener:opener,id:'cal-sheet',tall:true,onClose:function(){var b=$('#date-btn');if(b)b.setAttribute('aria-expanded','false')},build:function(body,close){
    var host=h('div',{id:'cal'});body.appendChild(host);
    function draw(){
      host.replaceChildren();
      var ym=S.calMonth,first=ym+'-01',gridStart=mondayOf(first),mdt=parseD(first);
      var lastDay=addDays(addDays(first,32).slice(0,7)+'-01',-1),gridEnd=addDays(mondayOf(lastDay),6);
      var days=[],x=gridStart;while(x<=gridEnd){days.push(x);x=addDays(x,1)}
      var sums=daySummaries(p,days),selMon=mondayOf(S.viewDate);
      var nextOk=addDays(lastDay,1)<=S.today;
      host.appendChild(h('div',{class:'cal-head'},
        h('h3',{id:'cal-month',text:mdt.toLocaleDateString(undefined,{month:'long',year:'numeric'})}),
        h('div',{class:'row',style:'flex-wrap:nowrap'},
          h('button',{type:'button',class:'icon-btn',id:'cal-prev','aria-label':'Previous month',onclick:function(){S.calMonth=addDays(first,-1).slice(0,7);draw()}},icon(ICONS.chevL)),
          h('button',{type:'button',class:'icon-btn',id:'cal-next','aria-label':'Next month',disabled:!nextOk,onclick:function(){S.calMonth=addDays(lastDay,1).slice(0,7);draw()}},icon(ICONS.chevR)))));
      var dow=h('div',{class:'cal-dow','aria-hidden':'true'});['M','T','W','T','F','S','S'].forEach(function(l){dow.appendChild(h('span',{text:l}))});host.appendChild(dow);
      for(var w=0;w<days.length;w+=7){
        var wk=days.slice(w,w+7),isSel=wk[0]===selMon;
        var row=h('div',{class:'cal-week'+(isSel?' selweek':''),role:'group','aria-label':'Week of '+fmtDate(wk[0])+(isSel?', selected':'')});
        wk.forEach(function(day){
          var sm=sums[day],fut=day>S.today,inM=day.slice(0,7)===ym;
          var cell=h('button',{type:'button',class:'cal-day'+(inM?'':' other')+(sm?' logged':'')+(day===S.viewDate?' cur':'')+(day===S.today?' today':''),'data-date':day,disabled:fut,
            'aria-pressed':day===S.viewDate?'true':'false','aria-label':fmtDate(day)+(sm?', '+fmtRem(sm.rem)+' kcal remaining':''),onclick:function(){S.viewDate=day;close(false);render(true)}},
            h('span',{class:'cal-n',text:String(parseD(day).getDate())}),sm?h('span',{class:'cal-rem'+(sm.rem<0?' neg':''),text:fmtRem(sm.rem)}):null);
          row.appendChild(cell);
        });
        host.appendChild(row);
        if(isSel){
          var logged=wk.filter(function(day){return sums[day]}),avg=logged.length?logged.reduce(function(a,day){return a+sums[day].rem},0)/logged.length:null;
          host.appendChild(h('div',{class:'cal-sum',id:'cal-summary'},
            avg===null?h('span',{class:'muted',id:'cal-goal',text:'No days logged this week'}):h('span',{class:'goal '+(avg>=0?'under':'over'),id:'cal-goal',text:avg>=0?'Under goal':'Over goal'}),
            avg===null?null:h('span',{class:'cal-avg'},h('span',{class:'muted small',text:'Average remaining'}),h('b',{id:'cal-avg',class:avg>=0?'':'bad',text:fmtRem(avg)+' kcal/day'}))));
        }
      }
      host.appendChild(h('p',{class:'muted small',style:'margin-top:10px',text:'Numbers show calories remaining for each logged day (+ under your target, - over).'}));
    }
    draw();
    var cur=host.querySelector('.cal-day.cur');if(cur)cur.setAttribute('data-autofocus','1');
  }});
}

/* ---------- entry menu and its sub-sheets ---------- */
function freshEntry(e){return loadMonth(S.profile.id,e.date.slice(0,7)).filter(function(x){return x.id===e.id})[0]||e}
function openEntryMenu(e0,opener){
  var e=freshEntry(e0);
  openSheet({title:e.foodName,opener:opener,id:'entry-menu',build:function(body,close){
    var ul=h('ul',{class:'plain menu-list'});
    function item(id,label,ic,fn,o){
      o=o||{};
      ul.appendChild(h('li',null,h('button',{type:'button',id:id,class:'menu-item'+(o.danger?' danger':''),disabled:!!o.disabled,onclick:fn},icon(ICONS[ic]),h('span',{class:'grow',text:label}),o.note?h('span',{class:'muted small',text:o.note}):null)));
    }
    item('em-edit','Edit entry','edit',function(){close(false);S.add=newAddCtx({entry:e});S.tab='add';render(true)});
    item('em-adjust','Adjust calories & macros','adjust',function(){close(false);openAdjust(e,opener)});
    item('em-datetime','Change date & time','clock',function(){close(false);openChangeDT(e,opener)});
    item('em-save','Add to saved entries','saved',function(){close(false);openSaveName([foodSnap(e)],e.foodName,opener)});
    item('em-delete','Delete','trash',function(){close(false);deleteEntry(e)},{danger:true});
    body.appendChild(ul);
    ul.querySelector('button:not([disabled])').setAttribute('data-autofocus','1');
  }});
}
function deleteEntry(e){
  var p=S.profile,gone=removeEntry(p.id,e.id,e.date),lg=null;
  if(e.logId&&!allEntries(p.id).some(function(x){return x.logId===e.logId})&&!allEx(p.id).some(function(x){return x.logId===e.logId})){var l0=findLog(p.id,e.logId,e.date);if(l0)lg=removeLog(p.id,l0.id,l0.date)}
  render();
  toast('Deleted '+e.foodName,'Undo',function(){if(gone){putEntry(p.id,gone);if(lg)putLog(p.id,lg);render()}});
}
function openAdjust(e,opener){
  var n=nut(e),cur=entryNut(e);
  openSheet({title:'Adjust calories & macros',opener:opener,id:'adjust-sheet',build:function(body,close){
    var err=h('p',{class:'err',role:'alert',id:'adj-err'}),F={};
    function num(id,label,val){var i=h('input',{type:'number',id:'adj-'+id,inputmode:'decimal',step:'any',min:'0',value:String(Math.round(val*10)/10)});F[id]=i;return h('div',null,h('label',{for:'adj-'+id},label),i)}
    body.appendChild(h('p',{class:'muted small',text:'Use this when the numbers on the pack or in a restaurant differ from the calculated ones. These totals are for the whole entry ('+qtyText(e)+').'}));
    body.appendChild(h('div',{class:'field-grid'},num('kcal','Calories (kcal)',cur.kcal),num('c','Carbs (g)',cur.c),num('p','Protein (g)',cur.p),num('f','Fat (g)',cur.f)));
    body.appendChild(err);
    var row=h('div',{class:'row',style:'margin-top:12px'},
      h('button',{type:'button',id:'adj-save',class:'btn primary grow',text:'Save',onclick:function(){
        err.textContent='';var v={};
        for(var k of ['kcal','c','p','f']){var t=F[k].value.trim(),x=parseFloat(t);if(t===''||!isFinite(x)||x<0||x>20000){err.textContent='Enter a number from 0 to 20000 in every box.';F[k].focus();return}v[k]=x}
        var rec=freshEntry(e);
        var same=Math.abs(v.kcal-n.kcal)<0.5&&Math.abs(v.c-n.c)<0.05&&Math.abs(v.p-n.p)<0.05&&Math.abs(v.f-n.f)<0.05;
        if(same)delete rec.adj;else rec.adj={kcal:v.kcal,p:v.p,c:v.c,f:v.f};
        rec.updatedAt=Date.now();putEntry(S.profile.id,rec);close(false);render();toast(same?'Back to calculated values':'Calories and macros adjusted');
      }}),
      e.adj?h('button',{type:'button',id:'adj-reset',class:'btn',text:'Reset to calculated',onclick:function(){var rec=freshEntry(e);delete rec.adj;rec.updatedAt=Date.now();putEntry(S.profile.id,rec);close(false);render();toast('Reset to calculated values')}}):null,
      h('button',{type:'button',class:'btn',id:'adj-cancel',text:'Cancel',onclick:function(){close()}}));
    body.appendChild(row);
    F.kcal.setAttribute('data-autofocus','1');
  }});
}
function openChangeDT(e,opener){
  openSheet({title:'Change date & time',opener:opener,id:'datetime-sheet',build:function(body,close){
    var st={date:e.date,time:e.time,slot:e.slot,slotName:e.slotName},err=h('p',{class:'err',role:'alert',id:'cd-err'});
    var date=h('input',{type:'date',id:'cd-date',value:e.date,max:S.today,onchange:function(){if(isDate(date.value))st.date=date.value}});
    var tp=timePicker({value:e.time,label:'Time',idPrefix:'q',onChange:function(v){st.time=v||''},onEnter:done,onEscape:function(){close()}});
    var slotBox=h('div',{class:'chips',role:'group','aria-label':'Meal',id:'cd-slots'});
    function drawSlots(){
      slotBox.replaceChildren();var live=S.profile.slots;
      if(!live.some(function(s){return s.id===st.slot}))slotBox.appendChild(h('button',{type:'button',class:'chip','aria-pressed':'true','data-slot':st.slot,text:(st.slotName||'Other meal')+' (removed)'}));
      live.forEach(function(s){slotBox.appendChild(h('button',{type:'button',class:'chip','data-slot':s.id,'aria-pressed':s.id===st.slot?'true':'false',text:s.name,onclick:function(){st.slot=s.id;st.slotName=s.name;drawSlots()}}))});
    }
    function done(){
      err.textContent='';
      var v=tp.get();if(!v){tp.validate();return}
      if(!isDate(date.value)||date.value>S.today){err.textContent='Pick a valid date that is not in the future.';return}
      st.date=date.value;st.time=v;
      var rec=freshEntry(e),oldDate=rec.date;
      rec.date=st.date;rec.time=st.time;rec.slot=st.slot;rec.slotName=(S.profile.slots.filter(function(s){return s.id===st.slot})[0]||{name:st.slotName||rec.slotName}).name;rec.updatedAt=Date.now();
      if(oldDate!==rec.date)removeEntry(S.profile.id,rec.id,oldDate);
      putEntry(S.profile.id,rec);
      close(false);S.viewDate=rec.date;render();toast('Saved: '+fmtDate(rec.date)+', '+fmt12(rec.time));
      var b=$('li.entry[data-id="'+rec.id+'"] .menu-btn');if(b)b.focus();
    }
    body.appendChild(h('label',{for:'cd-date',style:'margin-top:0'},'Date'));body.appendChild(date);
    body.appendChild(h('label',null,'Time'));body.appendChild(tp.el);
    body.appendChild(h('label',null,'Meal'));body.appendChild(slotBox);
    body.appendChild(err);
    body.appendChild(h('div',{class:'row',style:'margin-top:12px'},h('button',{type:'button',id:'q-done',class:'btn primary grow',text:'Save',onclick:done}),h('button',{type:'button',id:'q-cancel',class:'btn',text:'Cancel',onclick:function(){close()}})));
    drawSlots();date.setAttribute('data-autofocus','1');
  }});
}

function targetNote(c,p){
  var ov=p.override||{};
  if(typeof ov.kcal==='number'&&ov.kcal>0){
    if(ov.kcal<c.floor)return {warn:true,text:'Your own target ('+r0(ov.kcal)+' kcal) is below the usual safe minimum of about '+r0(c.floor)+' kcal (your resting burn, and at least 1200 kcal for women or 1500 kcal for men). Eating this little for a long time can be harmful, so please check with a doctor or dietitian.'};
    return null;
  }
  if(c.clamped){
    var pace=(c.tdee-c.target)*7/7700,paceTxt=pace>=0.01?' At this target you\'d lose about '+(Math.round(pace*100)/100)+' kg a week.':' At this target you would not lose weight.';
    return {text:'Your target was raised to a safe minimum of '+r0(c.floor)+' kcal (never below your resting burn, 1200 kcal for women or 1500 kcal for men).'+(p.goal==='lose'?paceTxt:'')};
  }
  return null;
}
function noteEl(n){return n?h('p',{class:'small'+(n.warn?' err':' muted'),id:'target-note',role:n.warn?'alert':null,text:n.text}):null}
function kv(label,id,val,bad){return h('div',null,h('dt',{text:label}),h('dd',{id:id,class:bad?'bad':null,text:val}))}
function fmtQty(q){return String(Math.round(q*100)/100)}
function shortUnit(e){return (e.unitLabel||e.unit||'g').replace(/\s*\(.*$/,'')}

/* ---------- quick-log bar and the "Check before saving" sheet ---------- */
function autoGrow(){
  var ta=$('#ql');ta.style.height='auto';
  var cs=getComputedStyle(ta),lh=parseFloat(cs.lineHeight)||22,pad2=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);
  var max=lh*5+pad2;ta.style.height=Math.min(ta.scrollHeight,max)+'px';ta.style.overflowY=ta.scrollHeight>max?'auto':'hidden';
  var qb=$('#qbar');if(qb&&!qb.hidden)document.documentElement.style.setProperty('--qbar-h',qb.offsetHeight+'px');
}
function initQuickBar(){
  var ta=$('#ql');
  ta.addEventListener('input',autoGrow);initMic();
  ta.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();submitQuick()}});
  $('#qbar').addEventListener('submit',function(ev){ev.preventDefault();submitQuick()});
  $('#ql-plus').addEventListener('click',function(){if(!S.profile)return;S.add=newAddCtx({date:S.viewDate});S.tab='add';render(true)});
  $('#ai-chip').addEventListener('click',function(){if(S.profile)goto('ai');else toast('On-device AI can be set up after you create your profile.')});
}
/* ---- voice typing (browser speech recognition; text is only filled in, never sent) ---- */
var voiceRec=null;
function speechApi(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
function initMic(){
  var mic=$('#ql-mic');if(!speechApi()){mic.hidden=true;return}
  mic.hidden=false;mic.setAttribute('aria-label','Speak what you ate');mic.setAttribute('aria-pressed','false');mic.replaceChildren(icon(ICONS.mic));
  mic.addEventListener('click',function(){
    if(voiceRec){try{voiceRec.stop()}catch(e){}return}
    if(!UI.voiceOk){openVoiceDisclosure(mic);return}
    startVoice();
  });
}
function openVoiceDisclosure(opener){
  openSheet({title:'Voice typing',opener:opener,id:'voice-sheet',build:function(body,close){
    body.appendChild(h('p',{id:'voice-text',text:'Voice typing here sends your audio to Google to turn it into text. For a private option, tap the text box and use your keyboard\'s mic.'}));
    body.appendChild(h('div',{class:'row',style:'margin-top:12px'},
      h('button',{type:'button',id:'voice-use',class:'btn primary grow',text:'Use it',onclick:function(){UI.voiceOk=true;saveUI();close(false);startVoice()}}),
      h('button',{type:'button',id:'voice-kbd',class:'btn grow',text:'Use keyboard',onclick:function(){close(false);$('#ql').focus()}})));
    body.querySelector('#voice-use').setAttribute('data-autofocus','1');
  }});
}
function startVoice(){
  var SR=speechApi(),mic=$('#ql-mic'),ta=$('#ql');if(!SR)return;
  var rec;try{rec=new SR()}catch(e){toast('Voice typing is not available here. Use your keyboard\'s mic instead.');return}
  voiceRec=rec;rec.lang=UI.voiceLang;rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=1;
  function done(){voiceRec=null;mic.classList.remove('listening');mic.setAttribute('aria-pressed','false')}
  rec.onresult=function(ev){
    var t='';try{for(var i=ev.resultIndex||0;i<ev.results.length;i++)t+=ev.results[i][0].transcript+' '}catch(e){}
    t=t.trim().slice(0,300);if(!t)return;
    ta.value=(ta.value.trim()?ta.value.trim()+' ':'')+t;autoGrow();ta.focus();
  };
  rec.onerror=function(ev){done();toast(ev&&ev.error==='not-allowed'?'Microphone is blocked. Allow it in the browser, or use your keyboard\'s mic.':'Voice typing did not work. You can type instead.')};
  rec.onend=done;
  mic.classList.add('listening');mic.setAttribute('aria-pressed','true');
  try{rec.start()}catch(e){done()}
}
function submitQuick(){
  var ta=$('#ql'),t=ta.value.trim();
  if(!S.profile||!t)return;
  openPreview(t);
}
function slotOfId(id){return S.profile.slots.filter(function(s){return s.id===id})[0]}
function amountText(it){var sh=shortUnit(it);if(isCountU(it))return fmtQty(it.qty)+' '+sh+' ('+r0(it.grams)+' g)';if(it.unit==='g')return sh==='g'?r0(it.grams)+' g':sh==='ml'?fmtQty(it.qty)+' ml':fmtQty(it.qty)+' '+sh+' ('+amtG(it)+')';return fmtQty(it.qty)+' × '+it.unitLabel.replace(/\s*\(.*$/,'')+' ('+amtG(it)+')'}
function rowItemsFor(txt,date){
  var kg=weightOn(S.profile.id,S.profile,date),sv=savedFor(txt,loadSaved(S.profile.id));
  if(sv)return savedItems(sv,kg);
  return buildItems(normText(foldFractions(normText(txt))),kg);
}
function openPreview(text,restore,opts){
  var st;
  if(restore){st=restore;text=st.text;st.waitAI=false}
  else{
    /* AI on: the model reads the text first (rows appear when it answers); AI off or unavailable: the built-in rules read it */
    var useAI=aiEnabled(),lineMap=[],blocks=splitTimeBlocks(text,S.profile.slots,S.today,lineMap),res=parseLog(blocks[0],{viewDate:S.viewDate,metaOnly:useAI});
    if(blocks.length>1){   /* distinct times: later blocks are their own groups inside the same sheet */
      var gd=parseLog(text,{viewDate:S.viewDate,metaOnly:true}).date;
      res=parseLog(blocks[0],{viewDate:gd,metaOnly:useAI});
      if(!useAI)for(var bi=1;bi<blocks.length;bi++){var rb=parseLog(blocks[bi],{viewDate:gd});rb.items.forEach(function(it){it.gt=rb.time;it.gs=rb.slotId;res.items.push(it)})}
    }
    st={text:text,date:res.date,time:res.time,slot:res.slotId,touched:res.timeExplicit,items:res.items,panel:null,timeExplicit:res.timeExplicit,mealExplicit:res.slotExplicit,dateExplicit:res.dateExplicit,rule:res,waitAI:useAI,blocks:blocks,lineMap:lineMap};
  }
  if(opts){st.date=opts.date;st.time=opts.time;st.slot=opts.slot;st.touched=true;st.timeExplicit=true;st.mealExplicit=true;st.dateExplicit=true;st.replace=opts.replace}
  var opener=$('#ql-send');
  var rowsBox,saveBtn,chipBox,panelBox,tp=null;
  function isFoodRow(i){return i.type==='food'&&i.foodId}
  function nFood(){return st.items.filter(isFoodRow).length}
  function nEx(){return st.items.filter(function(i){return i.type==='exercise'}).length}
  function updSave(){var n=nFood()+nEx();saveBtn.textContent=n?'Save all ('+n+')':'Nothing to save yet';saveBtn.disabled=n===0;
    var skipped=st.items.length-n;noteBox.textContent=skipped?skipped+(skipped===1?' row':' rows')+' not found will not be saved.':''}
  var noteBox=h('p',{class:'muted small',id:'pv-note',role:'status'});
  function dateLabel(){return st.date===S.today?'Today':st.date===addDays(S.today,-1)?'Yesterday':fmtDate(st.date)}
  function reKg(){var kg=weightOn(S.profile.id,S.profile,st.date);st.items.forEach(function(it){if(it.type==='exercise'){it.kg=kg;recalcExercise(it)}})}
  function drawChips(){
    chipBox.replaceChildren();
    function chip(id,label,key){chipBox.appendChild(h('button',{type:'button',id:id,class:'chip pv-chip','aria-pressed':st.panel===key?'true':'false','aria-expanded':st.panel===key?'true':'false',text:label,onclick:function(){st.panel=st.panel===key?null:key;drawChips();drawPanel()}}))}
    chip('pv-date-chip','Date: '+dateLabel(),'date');chip('pv-meal-chip','Meal: '+(slotOfId(st.slot)?slotOfId(st.slot).name:'Other'),'meal');chip('pv-time-chip','Time: '+fmt12(st.time),'time');
  }
  function drawPanel(){
    panelBox.replaceChildren();tp=null;
    if(st.panel==='date'){
      var di=h('input',{type:'date',id:'pv-date','aria-label':'Date',value:st.date,max:S.today,onchange:function(){if(isDate(di.value)&&di.value<=S.today){st.date=di.value;if(!st.touched&&!st.timeExplicit)st.time=st.date===S.today?nowTime():pastDefaultTime(S.profile.slots,st.slot,st.mealExplicit);reKg();drawChips();drawRows()}}});
      panelBox.appendChild(h('div',{class:'pv-panel'},di));
    }else if(st.panel==='meal'){
      var cs=h('div',{class:'chips',role:'group','aria-label':'Meal'});
      S.profile.slots.forEach(function(s){cs.appendChild(h('button',{type:'button',class:'chip','data-slot':s.id,'aria-pressed':s.id===st.slot?'true':'false',text:s.name,onclick:function(){st.slot=s.id;st.mealExplicit=true;if(!st.touched&&!st.timeExplicit&&st.date!==S.today)st.time=pastDefaultTime(S.profile.slots,st.slot,true);drawChips();drawPanel()}}))});
      panelBox.appendChild(h('div',{class:'pv-panel'},cs));
    }else if(st.panel==='time'){
      tp=timePicker({value:st.time,label:'Time you ate',idPrefix:'ptime',onChange:function(v){if(v){st.time=v;st.touched=true;var c=$('#pv-time-chip');if(c)c.textContent='Time: '+fmt12(v)}}});
      panelBox.appendChild(h('div',{class:'pv-panel'},tp.el));
    }
  }
  function drawRows(){
    rowsBox.replaceChildren();
    if(nFood()+nEx()===0&&!st.waitAI){
      var nb=h('div',{class:'banner info',id:'pv-empty',role:'status'},h('b',{text:'Couldn\'t find any food or exercise. '}),st.items.length?'Fix the words in the rows below, or choose what to do.':'Try a few words like "2 roti and dal".');
      var nr=h('div',{class:'row',style:'margin-top:8px'});
      if(aiEnabled())nr.appendChild(h('button',{type:'button',class:'btn sm',id:'pv-tryai',text:'Try AI',onclick:function(){runAI()}}));
      nr.appendChild(h('button',{type:'button',class:'btn sm',id:'pv-manual',text:'Add food manually',onclick:function(){S.pending=null;closeSheet(false);S.add=newAddCtx({date:st.date,slot:st.slot});S.tab='add';render(true)}}));
      nb.appendChild(nr);rowsBox.appendChild(nb);
    }
    var multi=st.items.some(function(i){return i.gt}),lastKey=null;
    st.items.forEach(function(it,idx){
      if(multi){
        var gk=(it.gt||st.time)+'|'+(it.gs||st.slot);
        if(gk!==lastKey){lastKey=gk;var gsl=slotOfId(it.gs||st.slot);rowsBox.appendChild(h('div',{class:'pv-group',role:'heading','aria-level':'3',text:(gsl?gsl.name:'Meal')+', '+fmt12(it.gt||st.time)}))}
      }
      rowsBox.appendChild(pvRow(it,idx))});
    updSave();
  }
  function pvRow(it){
    var box=h('div',{class:'pv-row'+(it.type==='exercise'?' pv-exrow':'')}),status=h('div',{class:'pv-status'}),tools=h('div',{class:'pv-tools'}),panel=h('div',{class:'pv-alts',hidden:true});
    var inp=h('input',{type:'text',class:'pv-text',maxlength:'120','aria-label':'Item text, change it to re-read this row',value:it.text,
      onchange:function(){
        var arr=rowItemsFor(inp.value,st.date);
        if(!arr.length){it.type='unmatched';it.foodId=null;it.text=inp.value;it.cands=[];it.flag='none';it.score=0;draw();updSave();return}
        var gt0=it.gt,gs0=it.gs;arr.forEach(function(a){if(gt0){a.gt=gt0;a.gs=gs0}});
        if(arr.length===1){Object.keys(it).forEach(function(k){delete it[k]});Object.assign(it,arr[0]);drawRows();return}
        var at=st.items.indexOf(it);[].splice.apply(st.items,[at,1].concat(arr));drawRows();
      }});
    function setFood(fid){var f=findFood(fid);if(!f)return;it.type='food';it.q=it.q||{qty:null,unit:null,size:null};fillItem(it,f);it.flag='none';it.score=1;it.cands=it.cands||[];panel.hidden=true;draw();updSave()}
    function remove(){var at=st.items.indexOf(it);if(at>=0)st.items.splice(at,1);drawRows()}
    function leaveTo(mode){
      var phrase=it.phrase||it.text;
      S.pending={st:st,it:it};
      closeSheet(false);S.add=newAddCtx({date:st.date,slot:st.slot});S.add.query=phrase;S.add.fromPreview=true;
      if(mode==='custom')S.add.mode='custom';if(mode==='online')S.add.autoOnline=true;S.tab='add';render(true);
    }
    function altsPanel(){
      panel.replaceChildren();
      var cur=it.foodId,list=(it.cands||[]).filter(function(c){return c.id!==cur}).slice(0,3);
      list.forEach(function(c){var f=findFood(c.id);if(!f)return;
        panel.appendChild(h('button',{type:'button',class:'btn pv-alt',onclick:function(){setFood(c.id)}},h('span',{class:'grow',style:'text-align:left'},h('b',{text:f.name}),h('span',{class:'muted small',style:'display:block',text:perText(f)}))))});
      var res=h('div',{class:'pv-results'}),si=h('input',{type:'search',class:'pv-search','aria-label':'Search all foods',placeholder:'Search all foods',autocomplete:'off',oninput:function(){
        res.replaceChildren();var q=si.value.trim();if(q.length<2)return;
        search(q,S.profile.id).slice(0,8).forEach(function(f){res.appendChild(h('button',{type:'button',class:'btn pv-alt',onclick:function(){setFood(f.id)}},h('span',{class:'grow',style:'text-align:left'},h('b',{text:f.name}),h('span',{class:'muted small',style:'display:block',text:perText(f)}))))});
      }});
      panel.appendChild(si);panel.appendChild(res);
      if(it.type==='food'&&it.foodId)panel.appendChild(h('div',{class:'row',style:'margin-top:6px'},h('button',{type:'button',class:'btn sm pv-online',text:'Search online',onclick:function(){leaveTo('online')}}),h('button',{type:'button',class:'btn sm pv-custom',text:'Make custom food',onclick:function(){leaveTo('custom')}})));
    }
    function draw(){
      status.replaceChildren();tools.replaceChildren();inp.value=it.text;
      if(it.type==='exercise'){
        status.appendChild(h('div',{class:'pv-line'},h('b',{class:'pv-food pv-exname',text:it.label}),' ',it.flag==='check'?h('span',{class:'tag pv-flag',text:'Check'}):null,it.assumed?h('span',{class:'tag pv-assumed',text:'30 min assumed'}):null));
        status.appendChild(h('div',{class:'muted small pv-amount'},exQtyText(it)+' - '+it.met+' MET x '+fmt2(it.kg)+' kg'));
        var ki=h('input',{type:'number',class:'pv-ex-kcal',inputmode:'decimal',step:'any',min:'0','aria-label':'Calories burned',value:String(Math.round((it.kcalAdj!=null?it.kcalAdj:it.kcal)*10)/10),
          onchange:function(){var v=parseFloat(ki.value);if(!isFinite(v)||v<0||v>20000){ki.value=String(Math.round((it.kcalAdj!=null?it.kcalAdj:it.kcal)*10)/10);return}if(Math.abs(v-it.kcal)<0.5)delete it.kcalAdj;else it.kcalAdj=v}});
        status.appendChild(h('label',{class:'pv-kcal-label'},h('span',{class:'small muted',text:'Calories burned (kcal)'}),ki));
        if(!S.profile.exerciseAdds)status.appendChild(h('p',{class:'small muted pv-ex-note',text:'Not added to your day: your activity level already includes workouts.'}));
      }else if(it.type==='food'&&it.foodId){
        status.appendChild(h('div',{class:'pv-line'},h('b',{class:'pv-food',text:it.foodName}),' ',
          it.est==='ai'?h('span',{class:'tag ai pv-ai-tag',title:'Calories and macros estimated by AI','aria-label':'Estimated by AI',text:'AI'}):null,
          it.flag==='check'?h('span',{class:'tag pv-flag',text:'Check'}):null,it.assumed?h('span',{class:'tag pv-assumed',text:'amount assumed'}):null,it.fromSaved?h('span',{class:'tag alt',text:'saved'}):null));
        status.appendChild(h('div',{class:'muted small pv-amount'},amountText(it)+' - ',h('b',{class:'pv-kcal',text:r0(it.kcal)+' kcal'}),it.est==='ai'?' - P '+r0(it.p)+' / C '+r0(it.c)+' / F '+r0(it.f)+' g':null));
        if(it.est==='ai')status.appendChild(h('p',{class:'small muted pv-est-note',text:'Not in the food list: these numbers are the AI\'s estimate. Please check them.'}));
        tools.appendChild(h('button',{type:'button',class:'btn sm pv-notthis',text:'Change item',onclick:function(){panel.hidden=!panel.hidden;if(!panel.hidden)altsPanel()}}));
      }else{
        status.appendChild(h('div',{class:'pv-line pv-none'},h('span',{class:'tag pv-notfound',text:'Not found'}),' ',h('span',{text:'No food matched these words. Change the words above, or choose an action.'})));
        tools.appendChild(h('button',{type:'button',class:'btn sm pv-findall',text:'Search all foods',onclick:function(){panel.hidden=false;altsPanel();var s0=panel.querySelector('.pv-search');if(s0)s0.focus()}}));
        tools.appendChild(h('button',{type:'button',class:'btn sm pv-online',text:'Search online',onclick:function(){leaveTo('online')}}));
        tools.appendChild(h('button',{type:'button',class:'btn sm pv-custom',text:'Make custom food',onclick:function(){leaveTo('custom')}}));
      }
      tools.appendChild(h('button',{type:'button',class:'btn sm pv-remove','aria-label':'Remove this row',text:'Remove',onclick:remove}));
    }
    box.appendChild(inp);box.appendChild(status);box.appendChild(tools);box.appendChild(panel);
    draw();
    return box;
  }
  function save(){
    var ents=[],exs=[],now=Date.now(),date=st.date,time0=st.time;
    if(!st.touched&&!st.timeExplicit&&date===S.today)time0=nowTime();
    var time=time0,slot0=slotOfId(st.slot)||S.profile.slots[0],slot=slot0,logId='l'+uuid().replace(/[^\w]/g,'').slice(0,20);
    st.items.forEach(function(it){
      var time=it.gt||time0,slot=(it.gs&&slotOfId(it.gs))||slot0;
      if(it.type==='exercise'){
        var x={id:uuid(),date:date,time:time,actKey:it.actKey,label:it.label,minutes:it.minutes,met:it.met,kgUsed:it.kg,kcal:it.met*it.kg*it.minutes/60,logId:logId,updatedAt:now,createdAt:now};
        if(it.distanceKm)x.distanceKm=it.distanceKm;if(it.kcalAdj!=null)x.kcalAdj=it.kcalAdj;exs.push(x);return;
      }
      if(!isFoodRow(it))return;var f=findFood(it.foodId),per=it.per100||(f&&f.per100);if(!per)return;
      var e={id:uuid(),date:date,time:time,slot:slot.id,slotName:slot.name,foodId:it.foodId,foodName:it.foodName,qty:it.qty,unit:it.unit,unitLabel:it.unitLabel,unitG:it.unitG,grams:it.grams,
        per100:{kcal:per.kcal,p:per.p,c:per.c,f:per.f,fib:per.fib||0},updatedAt:now,createdAt:now,logId:logId};
      if(it.adj)e.adj=it.adj;if(it.est==='ai')e.est='ai';ents.push(e);
    });
    if(!ents.length&&!exs.length)return;
    putLog(S.profile.id,{id:logId,date:date,time:time,text:st.text.slice(0,500),updatedAt:now,createdAt:now});
    if(st.replace)st.replace.forEach(function(o){removeEntry(S.profile.id,o.id,o.date)});
    ents.forEach(function(e){putEntry(S.profile.id,e)});exs.forEach(function(x){putEx(S.profile.id,x)});
    closeSheet(false);S.pending=null;if(!st.replace){$('#ql').value='';autoGrow()}S.viewDate=date;S.tab='today';render(true);
    var msg=ents.length?'Saved '+ents.length+(ents.length===1?' item':' items')+' to '+slot.name:'';
    if(exs.length)msg+=(msg?' and ':'Saved ')+exs.length+(exs.length===1?' exercise':' exercises');
    toast(msg);
  }
  /* optional on-device AI re-read: always starts from, and falls back to, the rule result */
  var aiBox=h('div',{id:'pv-ai',class:'pv-ai',role:'status','aria-live':'polite'}),dirty=false;
  function aiLine(msg,busy,retry){
    aiBox.replaceChildren();
    if(busy){aiBox.appendChild(h('span',{class:'pv-ai-msg',id:'pv-ai-busy',text:msg}));aiBox.appendChild(h('button',{type:'button',class:'btn sm',id:'pv-ai-cancel',text:'Cancel',onclick:function(){if(LLM.state==='loading'||LLM.state==='downloading')llmCancel();else if(LLM.job&&LLM.job.cancel)LLM.job.cancel()}}))}
    else{
      if(msg)aiBox.appendChild(h('span',{class:'pv-ai-msg small muted',id:'pv-ai-msg',text:msg+' '}));
      if(retry)aiBox.appendChild(h('button',{type:'button',class:'btn sm',id:'pv-ai-retry',text:'Retry',onclick:function(){runAI()}}));
      if(aiEnabled()&&nFood()+nEx()>0)aiBox.appendChild(h('button',{type:'button',class:'btn sm',id:'pv-reread',text:'Re-read with AI',onclick:function(){runAI()}}));
    }
  }
  /* AI on: ONE model call for the WHOLE text (all lines). With several distinct times the rules only decide which line belongs to which time group
     (the model's items are matched back to their line), so the groups are still separate entries. The rules read the text by themselves only as the Basic fallback. */
  function aiBlocksRun(onPhase){
    var blocks=st.blocks||[st.text];
    if(blocks.length<2)return parseLogAI(st.text,{viewDate:S.viewDate},{onPhase:onPhase});
    var gd=parseLog(st.text,{viewDate:S.viewDate,metaOnly:true}).date;
    return parseLogAI(st.text,{viewDate:gd,metaText:blocks[0]},{onPhase:onPhase}).then(function(r){
      var metas=blocks.map(function(b){return parseLog(b,{viewDate:gd,metaOnly:true})}),items=[];
      if(!r.used){   /* Basic fallback: the rules read each time group */
        blocks.forEach(function(b,i){var rb=parseLog(b,{viewDate:gd});rb.items.forEach(function(it){if(i>0){it.gt=rb.time;it.gs=rb.slotId}items.push(it)})});
        return {res:Object.assign({},r.res,{items:items}),used:false,reason:r.reason,detail:r.detail};
      }
      var by=blocks.map(function(){return []});
      r.res.items.forEach(function(it){var bi=it.line!=null&&st.lineMap&&st.lineMap[it.line]>=0?st.lineMap[it.line]:0;by[bi].push(it)});
      by.forEach(function(arr,bi){arr.forEach(function(it){if(bi>0){it.gt=metas[bi].time;it.gs=metas[bi].slotId}items.push(it)})});
      return {res:Object.assign({},r.res,{items:items}),used:true,reason:'ok',perLine:r.perLine,badLines:r.badLines,nLines:r.nLines};
    });
  }
  function onPhase(ph,n,k){
    if(!aiBox.isConnected)return;
    aiLine(ph==='load'?(LLM.state==='ready'?'Reading with on-device AI...':'Loading the on-device AI (first use can take a minute)...'):ph==='read'?'Reading '+n+(n===1?' line':' lines')+' with on-device AI...':'Retrying line '+n+' of '+k+'...',true);
  }
  function runAI(){
    st.aiTried=true;st.waitAI=true;aiLine(LLM.state==='ready'?'Reading with on-device AI...':'Starting on-device AI...',true);drawRows();
    aiBlocksRun(onPhase).then(function(r){
      st.waitAI=false;
      if(!aiBox.isConnected)return;
      var m=r.res;st.items=m.items;
      if(!r.used){
        drawRows();
        if(r.reason==='cancelled')aiLine('AI read cancelled, using the built-in rules.');
        else aiLine('AI could not read this: '+aiReasonText(r.reason,r.detail)+'. Using the built-in rules.',false,true);
        return;
      }
      if(m.dateAi&&!st.dateExplicit){st.date=m.date;if(!st.touched&&!st.timeExplicit)st.time=st.date===S.today?nowTime():pastDefaultTime(S.profile.slots,st.slot,st.mealExplicit);reKg()}
      if(m.timeAi&&!st.touched){st.time=m.time}
      if(m.slotAi&&!st.mealExplicit){st.slot=m.slotId;st.mealExplicit=true}
      drawChips();drawRows();
      if(r.badLines){drawChips();drawRows();aiLine('The AI read '+(r.nLines-r.badLines)+' of '+r.nLines+' lines (line by line); '+r.badLines+' used the built-in rules ('+aiReasonText(LLM.last&&LLM.last.reason,'')+'). Please check the rows.',false,true);return}
      aiLine('Read with on-device AI'+(r.perLine?' (line by line)':'')+(m.aiDropped?' ('+m.aiDropped+' invented item'+(m.aiDropped===1?'':'s')+' ignored)':'')+'. Please check the rows.');
    });
  }
  openSheet({title:'Check before saving',opener:opener,id:'pv-sheet',tall:true,dismiss:false,build:function(body){
    body.appendChild(h('p',{class:'logtext-static',id:'pv-raw',text:text}));
    chipBox=h('div',{class:'chips',id:'pv-chips'});panelBox=h('div',{id:'pv-panelbox'});rowsBox=h('div',{id:'pv-rows'});
    body.appendChild(chipBox);body.appendChild(panelBox);body.appendChild(aiBox);body.appendChild(rowsBox);body.appendChild(noteBox);
    rowsBox.addEventListener('input',function(){dirty=true});rowsBox.addEventListener('click',function(){dirty=true});
    drawChips();drawPanel();
  },footer:function(close){
    saveBtn=h('button',{type:'button',id:'pv-save',class:'btn primary grow',text:'Save all',onclick:save});
    return h('div',{class:'row'},saveBtn,h('button',{type:'button',id:'pv-cancel',class:'btn',text:'Cancel',onclick:function(){S.pending=null;close()}}));
  }});
  drawRows();
  var f0=$('#pv-sheet .pv-text');if(f0){try{f0.focus({preventScroll:true})}catch(e){}}
  if(st.waitAI&&!restore)runAI();else aiLine('',false);
}

/* =====================================================================
   Text to food entries (rule based parser). Entry point: parseLog(text, ctx).
   A later update can add an on-device AI step in front of this; the rule result is always the fallback.
   ===================================================================== */
var NUMW={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,couple:2,
  ek:1,do:2,teen:3,char:4,chaar:4,paanch:5,panch:5,chhe:6,chhah:6,che:6,saat:7,aath:8,nau:9,das:10,
  dedh:1.5,dhai:2.5,aadha:0.5,aadhi:0.5,adha:0.5,half:0.5,quarter:0.25,paav:0.25,pao:0.25};
var UNITW={katori:'katori',katoris:'katori',katora:'katori',vati:'katori',bowl:'katori',bowls:'katori',
  glass:'glass',glasses:'glass',gilas:'glass',cup:'cup',cups:'cup',plate:'plate',plates:'plate',
  piece:'piece',pieces:'piece',pc:'piece',pcs:'piece',nos:'piece',no:'piece',slice:'slice',slices:'slice',
  tbsp:'tbsp',tablespoon:'tbsp',tablespoons:'tbsp',tsp:'tsp',teaspoon:'tsp',teaspoons:'tsp',spoon:'tsp',spoons:'tsp',
  chammach:'tsp',chamach:'tsp',chamcha:'tsp',chammache:'tsp',g:'g',gm:'g',gms:'g',gram:'g',grams:'g',gr:'g',kg:'kg',
  ml:'ml',l:'l',litre:'l',liter:'l',litres:'l',liters:'l',handful:'handful',mutthi:'handful',muthi:'handful',serving:'serving',servings:'serving',
  bottle:'bottle',bottles:'bottle',can:'can',cans:'can',shot:'shot',shots:'shot',pint:'pint',pints:'pint'};
/* the unit exactly as the person typed it (spelling variants folded): shown and stored as typed, never relabelled */
var UNIT_SHOW={katori:'katori',katoris:'katori',katora:'katori',vati:'katori',bowl:'bowl',bowls:'bowl',glass:'glass',glasses:'glass',gilas:'glass',cup:'cup',cups:'cup',plate:'plate',plates:'plate',
  piece:'piece',pieces:'piece',pc:'piece',pcs:'piece',nos:'piece',no:'piece',slice:'slice',slices:'slice',tbsp:'tbsp',tablespoon:'tbsp',tablespoons:'tbsp',tsp:'tsp',teaspoon:'tsp',teaspoons:'tsp',spoon:'spoon',spoons:'spoon',
  chammach:'tsp',chamach:'tsp',chamcha:'tsp',chammache:'tsp',g:'g',gm:'g',gms:'g',gram:'g',grams:'g',gr:'g',kg:'kg',ml:'ml',l:'l',litre:'l',liter:'l',litres:'l',liters:'l',handful:'handful',mutthi:'handful',muthi:'handful',serving:'serving',servings:'serving',
  bottle:'bottle',bottles:'bottle',can:'can',cans:'can',shot:'shot',shots:'shot',pint:'pint',pints:'pint'};
var SINGLE_UNIT={g:1,l:1,no:1,gr:1,can:1,cans:1,shot:1,shots:1,bottle:1,bottles:1,pint:1,pints:1};   /* these only count as units right after a number */
var SIZEW={small:0.75,chhota:0.75,chhoti:0.75,chota:0.75,mini:0.75,large:1.3,bada:1.3,badi:1.3,big:1.3,bit:0.5,thoda:0.5,thodi:0.5,little:0.5,medium:1};
var STOPW={};('of ki ka ke ko wala wali wale plain some the my i had ate eat eaten eating have having took take drank drink drunk for in at on me mein mai ne khaya khayi khaye khai piya piyi pi liya li lia is was just about around approx approximately like also too only to hai tha thi x subah dopahar shaam raat morning afternoon evening night then aaj today yesterday kal').split(' ').forEach(function(w){STOPW[w]=1});
var FILLER={white:1,fresh:1,homemade:1,home:1,style:1,regular:1,normal:1,sabzi:1,sabji:1,subzi:1,bhaji:1,curry:1,hot:1,boiled:1,cooked:1,steamed:1,grilled:1,roasted:1,leaves:1,leave:1,leaf:1,soaked:1,soak:1,dried:1,dry:1,raw:1,peeled:1,chopped:1,sliced:1,toasted:1,unsalted:1,salted:1,whole:1,mashed:1,overnight:1,sprouted:1,shelled:1};
/* words that only describe the food before them: "Anjeer, soaked (2 figs)" is ONE item */
var DESCW={};'soaked soak dried dry raw cooked boiled roasted fried fresh chopped peeled sliced steamed grilled toasted unsalted salted whole mashed overnight sprouted shelled homemade'.split(' ').forEach(function(w){DESCW[w]=1});
/* count nouns: "(4 nuts)", "(2 figs)" are counts of pieces, shown as typed */
var COUNTN={nut:1,nuts:1,fig:1,figs:1,date:1,dates:1};
var COUNT_LAB=/^(nuts?|figs?|dates?|cashews?|walnuts?|pistachios?|raisins?|almonds?)$/;
/* weight of ONE piece for foods the table has only per 100 g (calibrated: 4 cashews 35 kcal, 2 figs 42, 2 dates 40) */
var HSIZE={"tsp":5,"tbsp":15,"cup":150,"katori_s":100,"katori":150,"katori_l":200,"bowl":275,"glass":250}; // household volumes in ml (tsp, tbsp, cup, katori_s, katori, katori_l, bowl, glass); from table household_sizes
var COUNTG=[[/cashew/,'cashew',1.5],[/^figs?\b/,'fig',25.5],[/^dates?\b/,'date',7],[/walnut/,'walnut',4],[/pistachio/,'pistachio',0.7],[/raisin/,'raisin',0.5]];
function countG(food){var n=String(food.name||'').toLowerCase();for(var i=0;i<COUNTG.length;i++)if(COUNTG[i][0].test(n))return {noun:COUNTG[i][1],g:COUNTG[i][2]};return null}
var EXERCISEW={walk:1,walked:1,walking:1,run:1,ran:1,running:1,jog:1,jogged:1,jogging:1,gym:1,workout:1,weights:1,yoga:1,cycling:1,cycled:1,cycle:1,bike:1,biked:1,swim:1,swam:1,swimming:1,badminton:1,steps:1,exercise:1,exercised:1,chala:1,tehla:1,tehle:1,daud:1,dauda:1,treadmill:1,pushups:1,squats:1};
/* ---- exercise table (data/met.json, inlined at build) ---- */
var MET=(function(){try{return JSON.parse($('#met').textContent)}catch(e){return {activities:[],brisk:[],stepM:0.75,defaultMinutes:30}}})();
var EXBYKEY={},EXKW={},EXBRISK={};
MET.activities.forEach(function(a){EXBYKEY[a.key]=a;a.kw.forEach(function(w){EXKW[w]=a.key;EXERCISEW[w]=1})});
MET.brisk.forEach(function(w){EXBRISK[w]=1});EXERCISEW.steps=1;EXERCISEW.step=1;
function metOf(key){return EXBYKEY[key]?EXBYKEY[key].met:null}
var MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
var WEEKDAYS={monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,sunday:0,mon:1,tue:2,tues:2,wed:3,thu:4,thur:4,thurs:4,fri:5,sat:6,sun:0};
var SIZE_MAX_G=5000;

/* collapse spaces but keep line breaks (one per line break): several lines are several pieces of one entry */
function squash(t){return t.replace(/\r\n?/g,'\n').replace(/[^\S\n]+/g,' ').replace(/ ?\n[ \n]*/g,'\n').trim()}
function normText(t){
  var FR={'\u00bd':'.5','\u00bc':'.25','\u00be':'.75','\u2153':'.33','\u2154':'.67'};
  t=String(t==null?'':t).replace(/(\d)?\s*([\u00bd\u00bc\u00be\u2153\u2154])/g,function(m,d,f){return d?d+FR[f]:' 0'+FR[f]});   /* "rice ½ bowl" -> "rice 0.5 bowl" (the space before a lone fraction is kept) */
  try{t=t.normalize('NFKC')}catch(e){}
  t=t.replace(/(\d),(\d{3})(?!\d)/g,'$1$2');
  return squash(t.toLowerCase().replace(/\u2044/g,'/').replace(/[\u2018\u2019]/g,"'"));
}
function ymdAdd(date,n){return addDays(date,n)}
/* ---- date ---- */
function extractDate(t,today){
  var r={date:null,text:t,meal:null,adjusted:false},m,y,mo,dd;
  function cut(re){var x=re.exec(r.text);if(x){r.text=squash(r.text.slice(0,x.index)+' '+r.text.slice(x.index+x[0].length))}return x}
  function mk(Y,M,D){var s0=Y+'-'+pad(M)+'-'+pad(D);return isDate(s0)?s0:null}
  function pastOf(M,D,Yexp){
    var Y=Yexp||+today.slice(0,4),s0=mk(Y,M,D);if(!s0)return null;
    if(!Yexp&&s0>today){Y--;r.adjusted=true;s0=mk(Y,M,D)}
    else if(s0>today){r.adjusted=true;return today}
    return s0;
  }
  if((m=cut(/\b(?:the\s+)?day before yesterday\b|\bparsons?\b|\bparso\b/))){r.date=addDays(today,-2);return r}
  if((m=cut(/\blast night\b/))){r.date=addDays(today,-1);r.meal='dinner';return r}
  if((m=cut(/\byesterday\b|\bkal\b/))){r.date=addDays(today,-1);return r}
  if((m=cut(/\btonight\b/))){r.date=today;r.meal='dinner';return r}
  if((m=cut(/\btoday\b|\baaj\b/))){r.date=today;return r}
  /* 3 nov, 3rd november 2026, on 3 nov */
  var mre='(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  var re1=new RegExp('\\b(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?'+mre+'\\b(?:\\s+(\\d{4}))?');
  var re2=new RegExp('\\b(?:on\\s+)?'+mre+'\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s+(\\d{4}))?');
  if((m=re1.exec(r.text))){var dd1=+m[1],mo1=MONTHS[m[2].slice(0,3)];cut(re1);var v1=pastOf(mo1,dd1,m[3]?+m[3]:0);if(v1){r.date=v1;return r}}
  else if((m=re2.exec(r.text))){var dd2=+m[2],mo2=MONTHS[m[1].slice(0,3)];cut(re2);var v2=pastOf(mo2,dd2,m[3]?+m[3]:0);if(v2){r.date=v2;return r}}
  /* 3/11 (day/month); "1/2" style small fractions are quantities, unless written "on 1/2" */
  var re3=/\b(on\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/;
  if((m=re3.exec(r.text))){
    var a=+m[2],b=+m[3],isFrac=!m[1]&&!m[4]&&a<b&&b<=8&&/\//.test(m[0]);
    if(!isFrac&&a>=1&&a<=31&&b>=1&&b<=12){
      var Y=m[4]?(m[4].length===2?2000+(+m[4]):+m[4]):0;cut(re3);var v3=pastOf(b,a,Y);if(v3){r.date=v3;return r}
    }
  }
  /* weekdays: the most recent one in the past (never today, never the future) */
  var re4=/\b(?:last\s+|on\s+(?:last\s+)?)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/;
  var re5=/\bon\s+(?:last\s+)?(mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b/;
  var which=re4;m=re4.exec(r.text);if(!m){which=re5;m=re5.exec(r.text)}
  if(m){
    var wd=WEEKDAYS[m[1]],cur=parseD(today).getDay(),back=(cur-wd+7)%7;if(back===0)back=7;
    cut(which);r.date=addDays(today,-back);return r;
  }
  return r;
}
/* ---- time ---- */
function extractTime(t){
  var r={time:null,text:t,explicit:false},m,pm=/\b(raat|night|shaam|evening|dopahar|afternoon)\b/.test(t),am=/\b(subah|morning)\b/.test(t);
  function cut(x){r.text=squash(r.text.slice(0,x.index)+' '+r.text.slice(x.index+x[0].length))}
  function bare(h12,mm,hasAmPm){
    var H=h12;
    if(hasAmPm==='am')H=h12%12;else if(hasAmPm==='pm')H=h12%12+12;
    else if(h12>=13)H=h12;
    else if(h12===0)H=0;
    else if(h12===12)H=pm?12:12;
    else if(pm&&h12<12)H=h12+12;
    else if(am)H=h12;
    else H=h12<=6?h12+12:h12;
    return pad(H)+':'+pad(mm);
  }
  /* 1:30 pm, 13:30, 1:30 */
  if((m=/(?:\bat\s+)?\b(\d{1,2}):(\d{2})\s*([ap])\.?m?\.?(?![a-z])/.exec(t))){
    var h1=+m[1],mi=+m[2];if(h1>=1&&h1<=12&&mi<60){r.time=bare(h1,mi,m[3]==='a'?'am':'pm');r.explicit=true;cut(m);return r}
  }
  if((m=/(?:\bat\s+)?\b(\d{1,2}):(\d{2})\b(?!\s*(?:g|ml|kg))/.exec(t))){
    var h2=+m[1],m2=+m[2];if(h2<=23&&m2<60){r.time=bare(h2,m2,null);r.explicit=true;cut(m);return r}
  }
  /* 1pm, 1.30 pm, 1 pm */
  if((m=/(?:\bat\s+)?\b(\d{1,2})(?:\.(\d{2}))?\s*([ap])\.?m\.?(?![a-z])/.exec(t))){
    var h3=+m[1],m3=m[2]?+m[2]:0;if(h3>=1&&h3<=12&&m3<60){r.time=bare(h3,m3,m[3]==='a'?'am':'pm');r.explicit=true;cut(m);return r}
  }
  /* 1 baje, 1:30 baje */
  if((m=/\b(\d{1,2})(?:[:.](\d{2}))?\s*baje\b/.exec(t))){
    var h4=+m[1],m4=m[2]?+m[2]:0;if(h4<=23&&m4<60){r.time=bare(h4,m4,null);r.explicit=true;cut(m);return r}
  }
  /* at 1, at 13 */
  if((m=/\bat\s+(\d{1,2})(?!\d|\s*(?:g|gm|ml|kg|katori|glass|cup|piece|pcs|slice|tbsp|tsp|bowl|plate))\b/.exec(t))){
    var h5=+m[1];if(h5<=23){r.time=bare(h5,0,null);r.explicit=true;cut(m);return r}
  }
  return r;
}
/* ---- meal ---- */
var MEALRX=[
  ['latenight',/(?:\b(?:for|at|in|during|as)\s+)?\b(?:late[- ]night|midnight)(?:\s+snacks?)?\b/],
  ['midmorning',/(?:\b(?:for|at|in|during|as)\s+)?\b(?:mid[- ]?morning|brunch)(?:\s+snacks?)?\b/],
  ['breakfast',/(?:\b(?:for|at|in|during|as)\s+)?\b(?:breakfast|brekfast|nashta|nasta|naashta)(?:\s+(?:me|mein|mai|ke liye))?\b/],
  ['lunch',/(?:\b(?:for|at|in|during|as)\s+)?\b(?:lunch|dopahar ka khana|dopahar ke khane)(?:\s+(?:me|mein|mai|ke liye))?\b/],
  ['dinner',/(?:\b(?:for|at|in|during|as)\s+)?\b(?:dinner|supper|raat ka khana|raat ke khane|raat me|raat mein|raat ko|raat)(?:\s+(?:me|mein|mai|ke liye))?\b/],
  ['evening',/(?:\b(?:for|at|in|during|as)\s+)?\b(?:evening|shaam)(?:\s+(?:me|mein|mai|ke liye|ko))?(?:\s+snacks?)?\b/],
  ['snack',/(?:\b(?:for|at|in|during|as)\s+)?\b(?:snacks?|tiffin)\b/]
];
function slotForKey(slots,key){
  function has(sub){return slots.filter(function(s){return s.name.toLowerCase().indexOf(sub)>=0})}
  var x;
  if(key==='latenight')x=has('late')[0]||has('night')[0];
  else if(key==='midmorning')x=has('morning')[0]||has('mid')[0];
  else if(key==='breakfast')x=has('breakfast')[0];
  else if(key==='lunch')x=has('lunch')[0];
  else if(key==='dinner')x=has('dinner')[0]||has('supper')[0];
  else if(key==='evening')x=has('evening')[0]||has('snack')[0];
  else if(key==='snack')x=slots.filter(function(s){return /^snacks?$/i.test(s.name)})[0]||has('evening')[0]||has('snack')[0];
  return x||null;
}
function extractMeal(t,slots,hint){
  var r={slot:null,text:t,found:false},i,m;
  function cut(x){r.text=squash(r.text.slice(0,x.index)+' '+r.text.slice(x.index+x[0].length))}
  /* 1. the user's own slot names, longest first */
  var byLen=slots.slice().sort(function(a,b){return b.name.length-a.name.length});
  for(i=0;i<byLen.length;i++){
    var nm=byLen[i].name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/[- ]+/g,'[- ]');
    if(nm.length<3)continue;
    m=new RegExp('(?:\\b(?:for|at|in|during|as)\\s+)?\\b'+nm+'\\b').exec(r.text);
    if(m){r.slot=byLen[i];r.found=true;cut(m);return r}
  }
  /* 2. common words, mapped onto the user's slots when one fits */
  for(i=0;i<MEALRX.length;i++){
    m=MEALRX[i][1].exec(r.text);
    if(m){var sl=slotForKey(slots,MEALRX[i][0]);cut(m);r.found=true;if(sl){r.slot=sl}return r}
  }
  if(hint){var sh=slotForKey(slots,hint);if(sh){r.slot=sh;r.found=true}}
  return r;
}
/* ---- one segment: quantity, unit, size, food words ---- */
function isNumTok(t){return /^\d+(\.\d+)?$/.test(t)||(NUMW[t]!==undefined)}
function numVal(t){return /^\d/.test(t)?parseFloat(t):NUMW[t]}
/* eggs -> egg, oats -> oat (search matches by prefix, so the singular still finds plural names) */
function sing(w){
  if(w.length<=3||/[^a-z]/.test(w))return w;
  if(/oes$/.test(w))return w.slice(0,-2);
  if(/(ss|us|is)$/.test(w))return w;
  return /s$/.test(w)?w.slice(0,-1):w;
}
function tokenizeSeg(seg){
  seg=String(seg).replace(/(\d)([a-z\u0900-\u097f]+)/g,'$1 $2').replace(/(\d)\s*\/\s*(\d)/g,function(m,a,b){return b!=='0'?String(Math.round(a/b*1000)/1000):m});
  seg=seg.replace(/[^a-z0-9.\u0900-\u097f\s]/g,' ');
  return seg.split(/\s+/).map(function(w){return w.replace(/^\.+|\.+$/g,'')}).filter(Boolean);
}
/* "1 1/2" -> 1.5 ; "1 and a half" -> 1.5 (done on the whole text, before splitting) */
function foldFractions(t){
  t=t.replace(/\b(\d+)\s+and\s+a\s+half\b/g,function(m,a){return String(+a+0.5)});
  t=t.replace(/\b(one|ek)\s+(?:and|aur)\s+(?:a\s+)?(?:half|aadha)\b/g,'1.5').replace(/\b(two|do)\s+(?:and|aur)\s+(?:a\s+)?(?:half|aadha)\b/g,'2.5');
  t=t.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g,function(m,a,b,c){return +c?String(+a+(+b)/(+c)):m});
  return t;
}
function parseSegment(seg){
  var toks=tokenizeSeg(seg),qty=null,unit=null,uw=null,size=null,sizeW=null,words=[],prevNum=false,pend=0,i,t,v,nx;
  for(i=0;i<toks.length;i++){
    t=toks[i];nx=toks[i+1];
    if(t==='sawa'||t==='sade'){pend=t==='sawa'?0.25:0.5;if(!(nx&&isNumTok(nx))&&qty===null){qty=(t==='sawa'?1:0)+pend;pend=0}prevNum=true;continue}
    if((t==='a'||t==='an')){if(qty===null&&words.length===0){qty=1;prevNum=true}continue}
    if(t==='couple'){qty=2;prevNum=true;continue}
    if(isNumTok(t)){
      v=numVal(t);
      if(qty===null){qty=v+pend;pend=0}
      else if(prevNum&&v<1&&qty>=1&&Math.floor(qty)===qty)qty+=v;
      prevNum=true;continue;
    }
    if((t==='bada'||t==='badi'||t==='chhota'||t==='chhoti')&&nx&&UNITW[nx]==='tsp'){unit=(t[0]==='b')?'tbsp':'tsp';uw=unit;i++;prevNum=false;continue}
    if(COUNTN[t]&&prevNum&&unit===null&&words.length>0){unit='piece';uw=t;prevNum=false;continue}   /* "almonds soaked 3 nuts": nuts is the unit */
    if(UNITW[t]){
      if((SINGLE_UNIT[t]&&!prevNum)||(t==='bottle'&&nx==='gourd')){words.push(t);prevNum=false;continue}
      if(unit===null){unit=UNITW[t];uw=UNIT_SHOW[t]||UNITW[t]}
      prevNum=false;continue;
    }
    if(SIZEW[t]!==undefined){if(size===null){size=SIZEW[t];sizeW=t}prevNum=false;continue}
    if(STOPW[t]){prevNum=false;continue}
    words.push(t);prevNum=false;
  }
  words=words.map(sing);
  return {qty:qty,unit:unit,unitWord:uw,size:size,sizeWord:sizeW,words:words,phrase:words.join(' '),tokens:toks};
}
/* break "2 roti 1 katori dal" or "roti 2 dal 3" where a new amount starts after food words */
function cutByNumbers(seg){
  var toks=tokenizeSeg(seg),out=[],cur=[],seenNum=false,wordAfter=false,prevNum=false,i,t;
  for(i=0;i<toks.length;i++){
    t=toks[i];
    var isN=isNumTok(t)&&t!=='half'&&t!=='quarter'&&t!=='couple'&&t!=='aadha'&&t!=='aadhi'&&t!=='adha'&&t!=='paav'&&t!=='pao';
    if(isN){
      if(seenNum&&wordAfter&&!(prevNum&&numVal(t)<1)){out.push(cur.join(' '));cur=[];seenNum=false;wordAfter=false}
      seenNum=true;prevNum=true;cur.push(t);continue;
    }
    if(!UNITW[t]&&!STOPW[t]&&SIZEW[t]===undefined&&seenNum)wordAfter=true;
    prevNum=false;cur.push(t);
  }
  if(cur.length)out.push(cur.join(' '));
  return out;
}

/* ---- matching a phrase to a food ---- */
function exactKeys(f){
  if(f._ex)return f._ex;
  var out=[f.words.map(sing).join(' ')];
  if(f.kind!=='raw'&&!f.src){f.base.split('/')   /* cooked rows: "Cabbage, boiled" must not own the plain word "cabbage" (the raw item keeps it) */.forEach(function(p){var w=p.split(',')[0].split(/[^a-z0-9]+/).filter(Boolean).map(sing).join(' ');if(w&&out.indexOf(w)<0)out.push(w)})}
  if(f.liquid&&f.kind==='dish'&&f.base.indexOf(',')>0){var q=f.base.split(',').map(function(x){return x.trim()}).reverse().join(' ');if(out.indexOf(q)<0)out.push(q)}   /* "Juice, orange" is also "orange juice" */
  f._ex=out;return out;
}
/* 1 = the phrase is the food's own name (or a one-word alias) and the food is a popular/own one; 0.97 = same for other foods */
function scoreStrict(f,tokens,worst){
  var core=tokens.join(' '),top=(f.pop||f.kind==='shared'||f.kind==='custom')?1:0.97;
  if(exactKeys(f).indexOf(core)>=0)return top;
  if(tokens.length===1&&!f.src&&f.awords.some(function(a){return sing(a)===tokens[0]}))return top;   /* a cooked row's alias (tinda, methi) never outranks the raw item */
  if(worst<=1)return f.group==='Beverages and liquids'?0.8:0.85;   /* a one-word hit (mango) leaves the raw item ahead of "Juice, mango" */
  if(worst===3&&tokens.every(function(t){return f.words.some(function(w){return sing(w)===t})||f.awords.some(function(w){return sing(w)===t})}))return 0.85;
  return 0.7;
}
function strictList(tokens){
  return searchTokens(tokens,S.profile.id).map(function(h,i){return {f:h.f,score:scoreStrict(h.f,tokens,h.k[3]),ord:i}});
}
function dlDist(a,b){   /* optimal string alignment distance */
  var la=a.length,lb=b.length,d=[],i,j;
  for(i=0;i<=la;i++){d[i]=[i]}for(j=0;j<=lb;j++)d[0][j]=j;
  for(i=1;i<=la;i++)for(j=1;j<=lb;j++){
    var c=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }
  return d[la][lb];
}
function fuzzyTokens(tokens){
  var vocab=Object.create(null);
  allFoods().forEach(function(f){f.words.forEach(function(w){vocab[w]=1});f.awords.forEach(function(w){vocab[w]=1})});
  var changed=false,out=tokens.map(function(t){
    if(vocab[t]||t.length<5||/\d/.test(t))return t;   /* 4-letter words are too short to guess (beer is not beet, coke is not cooked) */
    var lim=t.length>=8?2:1,best=null,bd=9;
    Object.keys(vocab).forEach(function(w){if(Math.abs(w.length-t.length)>lim||w[0]!==t[0])return;var d=dlDist(t,w);   /* same first letter: a guess must not jump to an unrelated food */if(d<=lim&&(d<bd||(d===bd&&w.length<best.length))){best=w;bd=d}});
    if(best){changed=true;return best}return t;
  });
  return changed?out:null;
}
/* describing words that never stand alone as a second food (so "green tea" is not "green" + "tea") */
var MODW={};'masala green red black white brown yellow fresh hot cold iced plain sweet sour spicy fried dry raw ginger lemon'.split(' ').forEach(function(w){MODW[w]=1});
function mergeInto(map,list,cap,ordBase){
  list.forEach(function(x){var s0=Math.min(x.score,cap),o=ordBase+x.ord,cur=map[x.f.id];if(!cur||s0>cur.score||(s0===cur.score&&o<cur.ord))map[x.f.id]={f:x.f,score:s0,ord:o}});
}
/* returns {list:[{f,score,ord}] sorted, via, split?} */
function matchTokens(tokens,noSplit){
  var list=[],via='strict',i,core;
  if(!tokens.length)return {list:[],via:'none'};
  list=strictList(tokens);
  if(!list.length){
    core=tokens.filter(function(t){return !FILLER[t]});
    if(core.length&&core.length<tokens.length){list=strictList(core);via='filler'}
  }
  if(!list.length&&tokens.length>=2&&!noSplit){
    for(i=1;i<tokens.length;i++){
      if(tokens.slice(0,i).every(function(t){return MODW[t]})||tokens.slice(i).every(function(t){return MODW[t]}))continue;
      var A=matchTokens(tokens.slice(0,i),true),B=matchTokens(tokens.slice(i),true);
      if(A.list.length&&B.list.length&&sortList(A.list)[0].score>=0.97&&sortList(B.list)[0].score>=0.97){
        return {list:A.list,via:'split',split:[tokens.slice(0,i),tokens.slice(i)]};
      }
    }
  }
  if(!list.length&&tokens.length>=2){
    var map={};
    for(i=0;i<tokens.length;i++){var sub=tokens.slice(0,i).concat(tokens.slice(i+1));if(sub.length&&!(sub.length===1&&sub[0]==='protein')&&sub.some(function(t){return !FILLER[t]}))mergeInto(map,strictList(sub),0.65,i*100000)}
    list=Object.keys(map).map(function(k){return map[k]});via='drop';
  }
  if(!list.length){
    var ft=fuzzyTokens(tokens);
    if(ft){var map2={};mergeInto(map2,strictList(ft),0.55,0);list=Object.keys(map2).map(function(k){return map2[k]});via='fuzzy'}
  }
  return {list:list,via:via};
}
function sortList(list){return list.slice().sort(function(a,b){return b.score-a.score||a.ord-b.ord})}
function candOf(x){return {id:x.f.id,name:x.f.name,score:x.score}}
/* Public: match a phrase (quantity words are ignored) to the food list. */
function matchFood(phrase){
  var seg=parseSegment(normText(phrase));
  return matchSeg(seg);
}
function matchSeg(seg){
  var r=matchTokens(seg.words),sorted=sortList(r.list),top=sorted[0];
  var out={phrase:seg.phrase,via:r.via,cands:sorted.slice(0,4).map(candOf),foodId:null,foodName:null,score:top?top.score:0,flag:'none'};
  if(r.split)out.split=r.split.map(function(a){return a.join(' ')});
  if(top&&top.score>=0.5){out.foodId=top.f.id;out.foodName=top.f.name;out.flag=top.score>=0.8?'ok':'check'}
  return out;
}

/* ---- grams ---- */
var LIQML={bottle:500,can:330,shot:30,pint:568};   /* ml of a bottle, can or shot when the food has no row of its own */
var SIZE_NOTE={small:0.75,large:1.3,bit:0.5};
function isFatFood(f){return f.group==='Fats and oils'||/\b(oil|ghee|butter|vanaspati|margarine)\b/i.test(f.name)}
function roundq(x){return Math.round(x*100)/100}
/* q: {qty, unit, size, hasQty} -> {qty, unit, unitLabel, unitG, grams, assumed} */
function resolveAmount(food,q){
  var us=unitsFor(food).map(function(x){
    /* a label like "10 almonds (~12 g)" is the weight of 10 pieces: turn it into a per-piece unit */
    var mm=/^(\d+)\s+(.*)$/.exec(x.label);
    if(mm&&+mm[1]>1&&x.kind!=='g')return {kind:x.kind,label:mm[2].replace(/\s*\(~[^)]*\)\s*$/,'')||mm[2],grams:x.grams/(+mm[1])};
    return x});
  var gU=us[0],qty=q.qty,unit=q.unit,m=q.size||1,assumed=false,u=null,i;
  var firstNonG=null;for(i=0;i<us.length;i++)if(us[i].kind!=='g'){firstNonG=us[i];break}
  function pick(kind,rx){var best=null;us.forEach(function(x){if(x.kind===kind&&!best)best=x;if(rx&&rx.test(x.label)&&x.kind!=='g'&&!(best&&rx.test(best.label)))best=x});return best}
  if(unit==='g'){
    return fin(gU,qty===null?100:qty,false,1);
  }
  if(unit==='ml'||unit==='kg'||unit==='l'){
    /* ml, l and kg stay as typed: the amount is shown in that unit and converted to grams (ml and l use the food's density, 1 g/ml when unknown) */
    var dn=food.density||1,per=unit==='ml'?dn:unit==='l'?1000*dn:1000,qv=qty===null?(unit==='ml'?100:1):qty;
    if(!(qv>0))qv=unit==='ml'?1:0.01;
    var gm=qv*per;if(gm>SIZE_MAX_G){qv=SIZE_MAX_G/per;gm=SIZE_MAX_G}
    return {qty:roundq(qv),unit:'g',unitLabel:unit,unitG:per,grams:roundq(qv*per),assumed:qty===null};
  }
  var cw=countG(food);
  if(cw&&!us.some(function(x){return x.kind==='piece'&&x.grams!==cw.g})&&(unit==='piece'||(!unit&&qty!==null&&qty<=(cw.g<=20?200:19)))){
    var cq=qty===null?1:qty,cn=q.word&&COUNT_LAB.test(q.word)?q.word:cw.noun+(cq===1?'':'s'),cg=Math.min(cq*cw.g*m,SIZE_MAX_G);
    return {qty:roundq(cq),unit:'piece',unitLabel:cn+' ('+fmt2(cw.g)+' g)',unitG:cw.g,grams:roundq(cg),assumed:qty===null};
  }
  if(unit){
    var kind=unit==='slice'?'piece':unit;
    if(qty===null){qty=1;assumed=true}
    if(unit==='serving')u=firstNonG;
    else if(unit==='katori')u=pick('katori',/bowl/i);
    else if(unit==='slice')u=pick('piece',/slice/i);
    else if(unit==='handful')u=pick('piece',/handful/i);
    else u=pick(kind);
    if(unit==='handful'&&u&&!/handful/i.test(u.label))u=null;
    /* sizes: "bowl" is 275 ml against the 150 ml katori (a food's own bowl row wins: pick above); "small katori" 100 ml, "large katori" 200 ml. shortcut: "large bowl" still multiplies 1.3 */
    var isBowl=unit==='katori'&&q.word&&/^bowls?$/.test(q.word);
    if(isBowl&&u&&u.kind==='katori'&&!/bowl/i.test(u.label))u={kind:'katori',label:'bowl',grams:u.grams*HSIZE.bowl/HSIZE.katori};
    if(!u){
      var dd=food.density||1,vg=function(k){return Math.round(HSIZE[k]*dd*10)/10};
      var lq=food.liquid&&food.density,g=LIQML[unit]&&lq?Math.round(LIQML[unit]*dd*10)/10:unit==='katori'?vg('katori'):unit==='glass'?vg('glass'):unit==='cup'?vg('cup'):unit==='plate'?250:unit==='handful'?30:unit==='tbsp'?(isFatFood(food)&&!food.density?13:vg('tbsp')):unit==='tsp'?(isFatFood(food)&&!food.density?4.5:vg('tsp')):
        unit==='serving'?100:(firstNonG&&(unit==='piece'||unit==='slice')?firstNonG.grams:30);
      var lab=unit==='slice'?'piece':unit;
      u={kind:(unit==='slice'?'piece':unit),label:lab+' ('+(lq?Math.round(g/dd)+' ml':g+' g')+')',grams:g};
    }
    /* "small katori" is its own 100 ml unit and "large katori" 200 ml, shown as typed (not "0.67 x katori") */
    if(unit==='katori'&&!isBowl&&(m===0.75||m===1.3)){u={kind:'katori',label:(m<1?'small':'large')+' katori',grams:Math.round(u.grams*HSIZE[m<1?'katori_s':'katori_l']/HSIZE.katori*10)/10};m=1}
    return fin(u,qty,assumed,m);
  }
  if(qty===null){
    if(firstNonG)return fin(firstNonG,1,true,m);
    return fin(gU,100,true,1);
  }
  /* a small countable piece (grape, almond, peanut, chilli: up to 20 g) keeps a typed count up to 200 as pieces; other foods read 20 or more as grams */
  var smallPc=firstNonG&&firstNonG.kind==='piece'&&firstNonG.grams<=20&&qty<=200;
  if(!smallPc&&(qty>=20||!firstNonG)){return fin(gU,qty>=20?qty:qty*100,false,1)}
  return fin(firstNonG,qty,false,m);
  function fin(u0,qv,asm,mult){
    var qe=qv*(u0.kind==='g'?1:mult);
    if(!(qe>0))qe=u0.kind==='g'?1:0.1;
    var gram=qe*u0.grams;
    if(gram>SIZE_MAX_G){qe=SIZE_MAX_G/u0.grams;gram=SIZE_MAX_G}
    var lab=u0.label;
    /* keep the word the person typed (bowl, slice, serving...) when the food's own unit is named differently */
    if(q.word&&u0.kind!=='g'&&lab.toLowerCase().indexOf(q.word)!==0&&!/^(small|large) katori$/.test(lab))lab=q.word+' ('+(food.liquid&&food.density?fmt2(u0.grams/food.density)+' ml':fmt2(u0.grams)+' g')+')';
    return {qty:roundq(qe),unit:u0.kind,unitLabel:lab,unitG:u0.grams,grams:roundq(gram),assumed:asm};
  }
}
function fillItem(it,food){
  delete it.est;
  var a=resolveAmount(food,it.q);
  it.type='food';it.foodId=food.id;it.foodName=food.name;
  it.qty=a.qty;it.unit=a.unit;it.unitLabel=a.unitLabel;it.unitG=a.unitG;it.grams=a.grams;it.assumed=a.assumed;
  var g=a.grams/100;it.per100=food.per100;it.kcal=food.per100.kcal*g;it.p=food.per100.p*g;it.c=food.per100.c*g;it.f=food.per100.f*g;
  return it;
}
/* a plain count of a countable noun ("5 bhindi", "2 country eggs", "2 green chillies"): when the best match has no piece portion (a dish, a cooked
   variant), the raw ingredient that has one is used. Not when the words name a dish (sabzi, curry, omelette ...) or give a unit. */
var DISHW={};'sabzi sabji subzi curry masala omelette omlet omlette fry fried bhurji gravy sambar dry roast roasted'.split(' ').forEach(function(w){DISHW[w]=1});
function countPick(ps,f){
  if(ps.qty===null||ps.unit||ps.qty>=20||ps.words.some(function(w){return DISHW[w]}))return null;
  function pc(x){var u=unitsFor(x)[1];return u&&u.kind==='piece'}
  if(pc(f))return null;
  var l=sortList(matchTokens(ps.words).list);
  for(var i=0;i<l.length;i++)if(l[i].score>=0.85&&l[i].f.kind==='raw'&&pc(l[i].f))return l[i].f;
  return null;
}
/* One text segment -> list of items (usually one; two when the words are two foods, e.g. "dal chawal"). */
function buildItems(seg,kg){
  var out=[],exTok=tokenizeSeg(seg);
  if(exTok.some(function(t){return EXERCISEW[t]})){
    var ex=parseExercise(seg,kg);
    if(ex){out.push(ex);return out}
    out.push({type:'unmatched',text:seg.trim(),phrase:seg.trim(),score:0,flag:'none',cands:[],q:{qty:null,unit:null,size:null},via:'none'});return out;
  }
  var parts=cutByNumbers(seg);
  parts.forEach(function(ptxt){
    var ps=parseSegment(ptxt),text=ptxt.trim();
    if(!text)return;
    if(!ps.words.length)return;
    var q={qty:ps.qty,unit:ps.unit,size:ps.size,word:ps.unitWord};
    var m=matchSeg(ps);
    if(m.split){
      /* a quantity before a pair ("half plate rajma chawal") applies to both parts */
      var foodWords={};m.split.forEach(function(ph){ph.split(' ').forEach(function(w){foodWords[w]=1})});
      var prefix=tokenizeSeg(text).filter(function(w){return !foodWords[sing(w)]&&!foodWords[w]}).join(' ');
      m.split.forEach(function(ph){
        var m2=matchFood(ph),it={type:'unmatched',text:(prefix+' '+ph).trim(),phrase:ph,score:m2.score,flag:m2.flag,cands:m2.cands,q:{qty:q.qty,unit:q.unit,size:q.size,word:q.word},via:'split'};
        var f=m2.foodId&&findFood(m2.foodId);if(f)fillItem(it,f);out.push(it);
      });
      return;
    }
    var it={type:'unmatched',text:text,phrase:ps.phrase,score:m.score,flag:m.flag,cands:m.cands,q:q,via:m.via};
    var f=m.foodId&&findFood(m.foodId);
    if(f)f=countPick(ps,f)||f;
    if(f){
      var oc=ownCountHit(f,ps.tokens);
      if(oc){it.q={qty:oc.countable?oc.qty/oc.n:null,unit:null,size:ps.size,word:null};if(!oc.countable)it.flag='check'}
      else if((m.via==='drop'||m.via==='fuzzy')&&(ps.unit==='slice'||ps.unit==='piece')){it.q={qty:null,unit:null,size:ps.size}}
      fillItem(it,f);
    }
    out.push(it);
  });
  return out;
}
/* ---- exercise phrases: "brisk walk 45 min", "ran 5 km", "8000 steps", "badminton 1 ghanta" ---- */
var EXNUMW={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,ek:1,do:2,teen:3,char:4,chaar:4,paanch:5,panch:5,chhe:6,saat:7,aath:8,nau:9,das:10,dedh:1.5,dhai:2.5,aadha:0.5,aadhi:0.5,adha:0.5,half:0.5,quarter:0.25,an:1,a:1};
function exDuration(t){
  t=t.replace(/\b(?:half an|half a|aadha|aadhe|adha)\s+(?:hour|hr|ghanta|ghante|ghantey)\b/g,'30 min');
  t=t.replace(/\b(an|a|one|ek)\s+(hour|hr|ghanta)\b/g,'1 $2');
  t=t.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|chaar|paanch|panch|chhe|saat|aath|nau|das|dedh|dhai|aadha|aadhi|half|quarter)\s+(?=(?:min|hour|hr|ghant))/g,function(m,w){return EXNUMW[w]+' '});
  var mins=0,found=false,m,re=/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|ghanta|ghante|ghantey)\b/g;
  while((m=re.exec(t))){mins+=parseFloat(m[1])*60;found=true}
  re=/(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|minat|mnts?)\b/g;
  while((m=re.exec(t))){mins+=parseFloat(m[1]);found=true}
  return found?mins:null;
}
function parseExercise(text,kg){
  var t=normText(foldFractions(normText(text))),toks=tokenizeSeg(t),key=null,brisk=false,i;
  for(i=0;i<toks.length;i++){if(EXKW[toks[i]]&&!key)key=EXKW[toks[i]];if(EXBRISK[toks[i]])brisk=true}
  var stepsM=/(\d+(?:\.\d+)?)\s*(k\s+)?steps?\b/.exec(t),steps=stepsM?parseFloat(stepsM[1])*(stepsM[2]?1000:1):null;
  if(!key&&steps!==null)key='walk';
  if(!key)return null;
  if(brisk&&key==='walk')key='brisk_walk';
  var a=EXBYKEY[key],mins=exDuration(t),dist=null,assumed=false,dm=/(\d+(?:\.\d+)?)\s*(?:km|kms|kilometers?|kilometres?|k)\b/.exec(t.replace(/(\d+(?:\.\d+)?)\s*k\s+steps?/,''));
  if(dm)dist=parseFloat(dm[1]);
  if(steps!==null&&dist===null)dist=steps*MET.stepM/1000;
  if(mins===null){
    if(dist!==null&&a.kmh)mins=dist/a.kmh*60;
    else{mins=MET.defaultMinutes;assumed=true}
  }
  mins=Math.max(1,Math.min(600,Math.round(mins*10)/10));
  kg=kg>0?kg:70;
  return {type:'exercise',text:text.trim(),phrase:text.trim(),actKey:key,label:a.label,met:a.met,minutes:mins,distanceKm:dist!==null?Math.round(dist*100)/100:null,steps:steps,
    assumed:assumed,kg:kg,kcal:a.met*kg*mins/60,flag:assumed?'check':'none',score:1,cands:[],q:null};
}
function recalcExercise(it){it.met=EXBYKEY[it.actKey]?EXBYKEY[it.actKey].met:it.met;it.label=EXBYKEY[it.actKey]?EXBYKEY[it.actKey].label:it.label;it.kcal=it.met*it.kg*it.minutes/60;return it}
/* ---- saved entries by name ---- */
function savedKey(t){return normText(t).replace(/[^a-z0-9ऀ-ॿ ]/g,' ').replace(/\s+/g,' ').trim()}
function savedFor(text,list){
  var k=savedKey(text);if(k.length<3||!list||!list.length)return null;
  var best=null,bd=9;
  list.forEach(function(sv){var n=savedKey(sv.name);if(!n)return;var d=n===k?0:(n.length>=4&&k.length>=4?dlDist(n,k):9);if(d<=1&&d<bd){best=sv;bd=d}});
  return best;
}
function savedItems(sv,kg){
  var out=[];
  (sv.items||[]).forEach(function(s){
    if(s.type==='exercise'){
      var a=EXBYKEY[s.actKey],met=a?a.met:s.met,k=kg>0?kg:70,mins=s.minutes;
      out.push({type:'exercise',text:sv.name,phrase:sv.name,actKey:s.actKey,label:a?a.label:s.label,met:met,minutes:mins,distanceKm:s.distanceKm||null,steps:null,assumed:false,kg:k,
        kcal:s.kcalAdj!=null?s.kcalAdj:met*k*mins/60,kcalAdj:s.kcalAdj!=null?s.kcalAdj:null,flag:'none',score:1,cands:[],q:null,fromSaved:sv.name});
    }else{
      var g=s.grams/100,n=s.per100||{kcal:0,p:0,c:0,f:0,fib:0};
      var it={type:'food',text:sv.name,phrase:sv.name,foodId:s.foodId,foodName:s.foodName,qty:s.qty,unit:s.unit,unitLabel:s.unitLabel,unitG:s.unitG,grams:s.grams,per100:n,
        kcal:n.kcal*g,p:n.p*g,c:n.c*g,f:n.f*g,flag:'none',score:1,cands:[],assumed:false,q:{qty:s.qty,unit:s.unit,size:null},fromSaved:sv.name,slotHint:s.slot||null};
      if(s.adj){it.adj=s.adj;it.kcal=s.adj.kcal;it.p=s.adj.p;it.c=s.adj.c;it.f=s.adj.f}
      if(s.est)it.est=s.est;
      out.push(it);
    }
  });
  return out;
}
/* "2 egg omelette", "egg omelette 2 eggs": a count whose noun is an ingredient written in the dish name is not a number of dishes */
function ownCounts(f){
  if(f._oc)return f._oc;
  var out=[];(f.name.match(/\([^)]*\)/g)||[]).forEach(function(par){
    var re=/(\d+(?:\.\d+)?)\s*(tsp|tbsp)?\s+([a-z]+)/g,m;
    while((m=re.exec(par))){if(['g','kg','ml','kcal','fat','percent'].indexOf(m[3])>=0)continue;if(par.charAt(m.index+m[0].length-m[3].length-1)===':')continue;out.push({n:parseFloat(m[1]),unit:m[2]||null,noun:sing(m[3])})}
  });
  f._oc=out;return out;
}
function ownCountHit(f,toks){
  var oc=ownCounts(f);if(!oc.length)return null;
  for(var i=0;i<toks.length;i++){
    if(!isNumTok(toks[i]))continue;
    var j=i+1,u=null;if(UNITW[toks[j]]&&UNITW[toks[j]]!=='g'){u=UNITW[toks[j]];j++}
    var nn=toks[j]&&sing(toks[j]);if(!nn)continue;
    for(var k=0;k<oc.length;k++)if(oc[k].noun===nn&&(oc[k].unit||null)===u)return {n:oc[k].n,countable:!u,qty:numVal(toks[i])};
  }
  return null;
}
/* ---- the entry point ---- */
/* Typical clock times for a meal on a PAST day (used only when the words name a meal and give no time). */
var TYPICAL={s_breakfast:'08:00',s_lunch:'13:00',s_evening:'17:00',s_dinner:'20:00',s_latenight:'23:00'};
function hmMin(x){return (+x.slice(0,2))*60+(+x.slice(3,5))}
function minHm(m){m=Math.max(0,Math.min(1439,Math.round(m)));return pad(Math.floor(m/60))+':'+pad(m%60)}
function typicalTime(slots,slotId){
  if(!slotId)return null;
  if(TYPICAL[slotId])return TYPICAL[slotId];
  /* mid-morning snack and the user's own slots: between the nearest slots with a typical time, else 12:00 */
  var i=-1,k;for(k=0;k<slots.length;k++)if(slots[k].id===slotId)i=k;
  if(i<0)return null;
  var before=null,after=null;
  for(k=i-1;k>=0;k--)if(TYPICAL[slots[k].id]){before=hmMin(TYPICAL[slots[k].id]);break}
  for(k=i+1;k<slots.length;k++)if(TYPICAL[slots[k].id]){after=hmMin(TYPICAL[slots[k].id]);break}
  if(before!=null&&after!=null)return minHm((before+after)/2);
  if(before!=null)return minHm(before+60);
  if(after!=null)return minHm(after-60);
  return null;
}
function pastDefaultTime(slots,slotId,mealExplicit){return (mealExplicit&&typicalTime(slots,slotId))||'12:00'}
/* Several lines with different explicit times become separate groups (entries), one per time.
   A line that is only a time/meal marker ("lunch 1pm") applies to the lines after it; a line with its own time stands alone;
   other lines follow the marker above, or else the first time given. One time (or none) means one group: the whole text. */
function splitTimeBlocks(text,slots,today,lineMap){
  var lines=String(text).replace(/\r\n?/g,'\n').split('\n').map(function(l){return l.trim()}).filter(Boolean);
  if(lines.length<2){if(lineMap)lineMap.push(0);return [String(text)]}
  var info=lines.map(function(l){
    var d=extractDate(normText(l),today),tm=extractTime(d.text),rest=extractMeal(tm.text,slots,d.meal).text;
    return {l:l,time:tm.explicit?tm.time:null,marker:!/[a-z0-9]/i.test(foldFractions(rest))};
  });
  var times=[];info.forEach(function(x){if(x.time&&times.indexOf(x.time)<0)times.push(x.time)});
  if(times.length<2){if(lineMap)lines.forEach(function(){lineMap.push(0)});return [String(text)]}
  var groups=[],byKey={},cur=null,first=times[0];
  function add(key,line){if(!byKey[key]){byKey[key]=[];groups.push(key)}byKey[key].push(line)}
  var mk=0,lineKeys=[];
  info.forEach(function(x){
    if(x.marker){cur=x.time||('m'+(mk++));add(cur,x.l);lineKeys.push(cur);return}
    if(x.time){add(x.time,x.l);lineKeys.push(x.time);return}
    add(cur||first,x.l);lineKeys.push(cur||first);
  });
  if(lineMap)lineKeys.forEach(function(k){lineMap.push(groups.indexOf(k))});
  return groups.map(function(k){return byKey[k].join('\n')});
}
function parseLog(text,ctx){
  ctx=ctx||{};
  var today=ctx.today||S.today,now=ctx.now||nowTime(),slots=ctx.slots||(S.profile?S.profile.slots:defaultSlots());
  var t=normText(text).slice(0,500);
  var d=extractDate(t,today);t=d.text;
  var date=d.date||ctx.viewDate||today;
  var tm=extractTime(t);t=tm.text;
  /* saved entries are matched by name (whole input or one piece) before the meal word is cut out */
  var saved=ctx.saved||(S.profile?loadSaved(S.profile.id):[]),svMap={};
  function svKey(sv){var k='qqsv'+Object.keys(svMap).length+'qq';svMap[k]=sv;return k}
  if(saved.length){
    t=t.split(/([\n,;+&]+)/).map(function(h0,i){
      if(i%2)return h0;
      var sv=savedFor(h0,saved);if(sv)return svKey(sv);
      return h0.split(/(\s+(?:and|aur|with|n|then|phir|along with|plus)\s+)/).map(function(x,j){if(j%2)return x;var s2=savedFor(x,saved);return s2?svKey(s2):x}).join('');
    }).join('');
  }
  var ml=extractMeal(t,slots,d.meal);t=ml.text;
  t=foldFractions(t);
  var slot=ml.slot;
  if(!slot){
    var nid=ctx.nextSlot?ctx.nextSlot(date):(S.profile?nextSlotId(S.profile,date):slots[0].id);
    slot=slots.filter(function(s){return s.id===nid})[0]||slots[0];
  }
  var time=tm.time||(date===today?now:pastDefaultTime(slots,slot.id,ml.found&&!!ml.slot));
  var kg=ctx.kg>0?ctx.kg:(S.profile?weightOn(S.profile.id,S.profile,date):70);
  if(ctx.metaOnly)return {text:String(text).slice(0,500),date:date,dateExplicit:!!d.date,dateAdjusted:d.adjusted,time:time,timeExplicit:tm.explicit,slotId:slot.id,slotName:slot.name,slotExplicit:ml.found&&!!ml.slot,items:[],rule:false};
  /* split: hard separators always; soft words only when the whole phrase is not one known food */
  /* a comma splits items ("rice, dal") in single- and multi-line text, except a fragment that is only a descriptor ("soaked", "soaked (2 figs)"):
     it belongs to the item before it on the same line, so "Anjeer, soaked (2 figs)" is ONE item */
  var items=[],hard=[];
  t.split(/[\n;+&]+/).forEach(function(l){var hm=[];l.split(',').forEach(function(f0){var pw=parseSegment(f0).words;if(hm.length&&pw.length&&pw.every(function(w){return DESCW[w]}))hm[hm.length-1]+=' '+f0;else hm.push(f0)});hard=hard.concat(hm)});
  function expand(seg){
    var m=/qqsv\d+qq/g.exec(seg);if(!m)return false;
    seg.replace(/qqsv\d+qq/g,function(k){savedItems(svMap[k],kg).forEach(function(it){items.push(it)});return k});return true;
  }
  hard.forEach(function(h0){
    h0=h0.trim();if(!h0)return;
    var hasEx=tokenizeSeg(h0).some(function(w){return EXERCISEW[w]});
    var soft=h0.split(hasEx?/\s+(?:and|aur|then|phir|along with|plus)\s+/:/\s+(?:and|aur|with|n|then|phir|along with|plus)\s+/);
    if(soft.length>1&&!/qqsv\d+qq/.test(h0)){
      var ps=parseSegment(h0),whole=ps.words.length>=2?matchSeg(ps):null;
      if(whole&&whole.score>=0.85&&!whole.split&&whole.via==='strict'&&!hasEx)soft=[h0];
    }
    soft.forEach(function(s0){
      if(expand(s0))return;
      buildItems(s0,kg).forEach(function(it){items.push(it)});
    });
  });
  return {text:String(text).slice(0,500),date:date,dateExplicit:!!d.date,dateAdjusted:d.adjusted,time:time,timeExplicit:tm.explicit,
    slotId:slot.id,slotName:slot.name,slotExplicit:ml.found&&!!ml.slot,items:items.slice(0,40),rule:true};
}
/* =====================================================================
   On-device AI (optional). The rule parser above always runs first and is always the fallback.
   WebLLM is loaded lazily (dynamic import) only when the user turns AI on or downloads a model.
   The model extracts foods, amounts, units, time and meal. Calories come from the food list; the model's own estimate is used only for foods the list does not have (tagged AI).
   Test seam: window.__llmMock = {extract(text), [load(id,onProgress)], [has(id)], [remove(id)], [cancel()]}
   ===================================================================== */
var LLM_MODELS=[
  {id:'Qwen3-0.6B-q4f16_1-MLC',fam:'q06',f16:true,name:'Qwen3 0.6B',sizeText:'about 335 MB',note:'Fastest',lib:'Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm',vramMB:1403,qwen:true},
  {id:'Qwen3-0.6B-q4f32_1-MLC',fam:'q06',f16:false,name:'Qwen3 0.6B',sizeText:'about 335 MB',note:'Fastest (compatible version)',lib:'Qwen3-0.6B-q4f32_1_cs1k-webgpu.wasm',vramMB:1925,qwen:true},
  {id:'Qwen3-1.7B-q4f16_1-MLC',fam:'q17',f16:true,name:'Qwen3 1.7B',sizeText:'about 1 GB or more',note:'Understands more, slower',lib:'Qwen3-1.7B-q4f16_1_cs1k-webgpu.wasm',vramMB:2037,qwen:true},
  {id:'Llama-3.2-1B-Instruct-q4f16_1-MLC',fam:'l1',f16:true,name:'Llama 3.2 1B',sizeText:'about 0.7 GB',note:'Better with long sentences',lib:'Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm',vramMB:879,qwen:false},
  {id:'Llama-3.2-1B-Instruct-q4f32_1-MLC',fam:'l1',f16:false,name:'Llama 3.2 1B',sizeText:'about 0.7 GB',note:'Better with long sentences (compatible version)',lib:'Llama-3.2-1B-Instruct-q4f32_1_cs1k-webgpu.wasm',vramMB:1129,qwen:false}
];
var LLM_FAMS=['q06','q17','l1'];
var MIN_BUF=268435456,MIN_STORAGE_BUFS=10;   /* the limits WebLLM itself checks */
function llmModel(id){return LLM_MODELS.filter(function(m){return m.id===id})[0]||null}
var LLM={last:null,loadMs:null,state:'idle',pct:0,text:'',modelId:null,engine:null,worker:null,err:'',webllm:null,token:0,cached:{},job:null,gpu:null,gpuP:null,calls:0,loading:null,idleT:null};
/* what the GPU can do: shader-f16 decides which model variants are offered */
function llmProbe(){
  if(LLM.gpu)return Promise.resolve(LLM.gpu);
  if(LLM.gpuP)return LLM.gpuP;
  function fin(o){LLM.gpu=o;LLM.gpuP=null;if(S&&S.tab==='ai'&&S.aiRedraw&&!sheetState)S.aiRedraw();return o}
  var g=navigator.gpu;
  if(!g)return Promise.resolve(fin(llmMock()?{ok:true,f16:true,assumed:true}:{ok:false,f16:false,why:'nogpu'}));
  LLM.gpuP=Promise.resolve().then(function(){return g.requestAdapter()}).then(function(ad){
    if(!ad)return fin({ok:false,f16:false,why:'noadapter'});
    var lim=ad.limits||{},f16=!!(ad.features&&ad.features.has&&ad.features.has('shader-f16'));
    var low=(lim.maxBufferSize!=null&&lim.maxBufferSize<MIN_BUF)||(lim.maxStorageBuffersPerShaderStage!=null&&lim.maxStorageBuffersPerShaderStage<MIN_STORAGE_BUFS);
    return fin({ok:!low,f16:f16,why:low?'limits':null,maxBuf:lim.maxBufferSize,maxStorage:lim.maxStorageBuffersPerShaderStage});
  }).catch(function(){return fin({ok:false,f16:false,why:'noadapter'})});
  return LLM.gpuP;
}
/* the model variant offered for a family on this GPU (null: none usable) */
function llmVariant(fam){
  var g=LLM.gpu||{ok:true,f16:true};
  if(!g.ok)return null;
  return LLM_MODELS.filter(function(m){return m.fam===fam&&m.f16===g.f16})[0]||null;
}
function llmMock(){return window.__llmMock||null}
function llmAvail(){
  if(llmMock())return {ok:true};
  if(location.protocol==='file:')return {ok:false,reason:'This copy of the app was opened as a file. On-device AI works in the installed web app, opened from its https address.'};
  if(!window.isSecureContext)return {ok:false,reason:'This page is not on a secure (https) address, which the AI needs.'};
  if(typeof Worker==='undefined')return {ok:false,reason:'This browser cannot run background workers.'};
  if(!navigator.gpu)return {ok:false,reason:'This browser does not offer WebGPU, which the AI needs. Recent Chrome on Android 12 or newer usually has it.'};
  return {ok:true};
}
function aiEnabled(){return UI.llmOn===true&&!!UI.modelId&&llmAvail().ok&&LLM.state!=='error'&&(LLM.state==='ready'||LLM.cached[UI.modelId]===true)}
function aiActive(){return aiEnabled()}
/* header chip: exactly 'AI ready' (a model is downloaded and switched on, including while it loads on first use) or 'Basic'.
   Progress, errors and other states are shown only on the On-device AI screen. */
function chipLabel(){return aiEnabled()?'AI ready':'Basic'}
function updateChip(){
  var c=$('#ai-chip');if(!c)return;var t=chipLabel(),on=t==='AI ready';
  c.textContent=t;c.setAttribute('aria-label',on?'AI ready: on-device AI reads what you type. Tap for on-device AI settings.':'Basic: the built-in rules read what you type. Tap to set up on-device AI.');c.classList.toggle('ai-on',on);
}
function refreshAI(){updateChip();var be=$('#pv-ai-busy');if(be&&LLM.state==='loading')be.textContent='Starting on-device AI '+(LLM.pct||0)+'%...';if(S&&S.tab==='ai'&&S.aiRedraw&&!sheetState)S.aiRedraw()}
function llmImport(){
  if(LLM.webllm)return Promise.resolve(LLM.webllm);
  return import('./vendor/web-llm/web-llm.js').then(function(m){LLM.webllm=m;return m});
}
function llmAppConfig(m){
  var base=new URL('./vendor/web-llm/libs/',location.href).href,list=[];
  LLM_MODELS.forEach(function(d){
    var pre=(m.prebuiltAppConfig.model_list||[]).filter(function(x){return x.model_id===d.id})[0];if(!pre)return;
    var o=Object.assign({},pre);o.model_lib=base+d.lib;if(d.f16)o.required_features=['shader-f16'];else delete o.required_features;list.push(o);
  });
  return {model_list:list};
}
function llmHas(id){
  var mk=llmMock();if(mk)return Promise.resolve(mk.has?!!mk.has(id):!!LLM.cached[id]);
  if(!llmAvail().ok)return Promise.resolve(false);
  return llmImport().then(function(m){return m.hasModelInCache(id,llmAppConfig(m))}).catch(function(){return false});
}
function llmFreeEngine(){
  try{if(LLM.engine&&LLM.engine.unload)LLM.engine.unload().catch(function(){})}catch(e){}
  try{if(LLM.worker)LLM.worker.terminate()}catch(e){}
  LLM.engine=null;LLM.worker=null;
}
function llmErrorText(e,id){
  var m=String(e&&(e.message||e.name)||e||'').toLowerCase(),d=llmModel(id),small=d&&d.fam!=='q06'?' Try the smaller model (Qwen3 0.6B).':'';
  if(/shader-f16|\bf16\b|float16|half.?precision/.test(m))return 'This phone\'s GPU does not support 16-bit shader maths (shader-f16), which the fast models need. Open On-device AI again: the compatible model is offered instead.';
  if(/maxstoragebuffer|maxbuffersize|buffer size|limit/.test(m)&&!/memory/.test(m))return 'This phone\'s GPU limits are too low for that model.'+small;
  if(/memory|alloc|oom|device.*lost|out of/.test(m))return 'There is not enough free memory on this phone for that model.'+(small||' Close other apps and try again.');
  if(/adapter|webgpu|gpu/.test(m))return 'This phone\'s browser could not start the GPU (no usable WebGPU adapter).'+small;
  if(/quota|storage|full/.test(m))return 'There is not enough free storage on this phone for the download. Free some space and try again.';
  if(/fetch|network|load failed|timeout|offline|connection/.test(m))return 'The download was interrupted by the network. Your progress is kept: connect to Wi-Fi and tap Download again.';
  return 'The model could not be started ('+String(e&&(e.message||e)||'unknown error').slice(0,120)+').'+small;
}
/* download (when not cached) and load a model into memory; resolves when ready */
function llmLoad(id,opts){
  opts=opts||{};var mk=llmMock(),tok=++LLM.token,d=llmModel(id);
  llmFreeEngine();
  LLM.state=opts.cached?'loading':'downloading';LLM.pct=0;LLM.err='';LLM.modelId=id;refreshAI();
  function prog(p,text){if(tok!==LLM.token)return;LLM.pct=Math.max(0,Math.min(100,Math.round(p*100)));LLM.text=text||'';refreshAI()}
  var job;
  if(mk){
    job=mk.load?Promise.resolve(mk.load(id,function(p,t){prog(p,t)})):Promise.resolve();
    job=job.then(function(){LLM.cached[id]=true;return null});
  }else{
    job=llmImport().then(function(m){
      if(tok!==LLM.token)throw new Error('cancelled');
      var w=new Worker(new URL('./llm-worker.js',location.href),{type:'module'});LLM.worker=w;
      return m.CreateWebWorkerMLCEngine(w,id,{appConfig:llmAppConfig(m),initProgressCallback:function(r){prog(r&&r.progress||0,r&&r.text)}});
    }).then(function(eng){if(tok!==LLM.token){try{eng.unload()}catch(e){}throw new Error('cancelled')}LLM.engine=eng;return null});
  }
  var cancelP=new Promise(function(res){LLM.cancelRes=res});
  job=Promise.race([job,cancelP.then(function(){throw new Error('cancelled')})]);
  return job.then(function(){
    if(tok!==LLM.token)return false;
    LLM.state='ready';LLM.pct=100;LLM.cached[id]=true;LLM.calls=0;UI.modelId=id;saveUI();llmTouch();refreshAI();return true;
  },function(e){
    if(tok!==LLM.token||(e&&e.message==='cancelled'))return false;
    llmFreeEngine();LLM.state='error';LLM.err=llmErrorText(e,id);LLM.pct=0;refreshAI();return false;
  });
}
function llmCancel(){
  LLM.token++;if(LLM.cancelRes){LLM.cancelRes();LLM.cancelRes=null}
  var mk=llmMock();if(mk&&mk.cancelLoad)try{mk.cancelLoad()}catch(e){}
  llmFreeEngine();LLM.state='idle';LLM.pct=0;LLM.err='';refreshAI();
}
function llmUnloadOnly(){LLM.token++;clearTimeout(LLM.idleT);llmFreeEngine();LLM.state='idle';LLM.pct=0;refreshAI()}
/* the model is loaded on first use and let go again after 5 idle minutes */
function llmTouch(){clearTimeout(LLM.idleT);LLM.idleT=setTimeout(function(){if(LLM.state==='ready'&&!LLM.job)llmUnloadOnly();else if(LLM.state==='ready')llmTouch()},window.__llmIdleMs||300000)}
function llmEnsure(){
  if(LLM.state==='ready'){llmTouch();return Promise.resolve(true)}
  if(LLM.loading)return LLM.loading;
  if(!UI.modelId)return Promise.resolve(false);
  var id=UI.modelId;
  LLM.loading=llmHas(id).then(function(has){
    if(!has){LLM.cached[id]=false;LLM.state='error';LLM.err='The model files are no longer on this phone (the browser may have cleared them). Open On-device AI and download it again.';refreshAI();return false}
    var t0=Date.now();return llmLoad(id,{cached:true}).then(function(ok){if(ok)LLM.loadMs=Date.now()-t0;return ok});
  }).then(function(ok){LLM.loading=null;return ok},function(){LLM.loading=null;return false});
  return LLM.loading;
}
function llmDelete(id){
  var mk=llmMock(),wasActive=LLM.modelId===id;
  if(wasActive)llmUnloadOnly();
  function done(){
    LLM.cached[id]=false;
    if(UI.modelId===id){UI.modelId=null;UI.llmOn=false;saveUI()}
    if(wasActive)LLM.modelId=null;
    refreshAI();
  }
  if(mk)return Promise.resolve(mk.remove?mk.remove(id):null).then(done);
  return llmImport().then(function(m){return m.deleteModelAllInfoInCache(id,llmAppConfig(m))}).then(done,function(){done()});
}
/* ---- the extraction call ---- */
var LLM_UNITS=['g','ml','l','kg','piece','katori','bowl','glass','cup','plate','tbsp','tsp','slice','handful','serving'];
function llmSchema(){
  var num={type:['number','null']};
  return {type:'object',properties:{
    items:{type:'array',items:{type:'object',properties:{
      type:{enum:['food','exercise']},text:{type:'string'},name:{type:'string'},qty:num,
      unit:{enum:LLM_UNITS.concat([null])},size:{enum:['small','medium','large','bit',null]},
      kcal:num,protein:num,carbs:num,fat:num,grams:num,estimated:{type:'boolean'},
      activity:{enum:MET.activities.map(function(a){return a.key}).concat([null])},minutes:num,distance_km:num},
      required:['type','text','name','qty','unit','size','kcal','protein','carbs','fat','grams','estimated','activity','minutes','distance_km']}},
    date:{type:['string','null']},time:{type:['string','null']},meal:{type:['string','null']}},required:['items','date','time','meal']};
}
var LLM_SYSTEM='Extract what the user ate or did. The text may have several lines: every line is part of the same meal, so return every food from every line. Copy each item\'s words exactly into text, and keep the unit word the user typed (ml, glass, bowl, cup, tbsp, piece, g). name = the plain English food name. For food also estimate, for the amount the user stated: kcal, protein, carbs and fat (grams) and the weight in grams, and set estimated true. Hindi/Hinglish allowed. JSON only.';
function fshot(type,text,name,qty,unit,n){return Object.assign({type:type,text:text,name:name,qty:qty,unit:unit,size:null,kcal:null,protein:null,carbs:null,fat:null,grams:null,estimated:false,activity:null,minutes:null,distance_km:null},n||{})}
var LLM_SHOTS=[
  ['2 roti, dal aur ek katori dahi at 1pm',{items:[fshot('food','2 roti','roti',2,'piece',{kcal:210,protein:7,carbs:42,fat:2,grams:80,estimated:true}),fshot('food','dal','dal',null,null,{kcal:150,protein:8,carbs:20,fat:4,grams:150,estimated:true}),fshot('food','ek katori dahi','curd',1,'katori',{kcal:95,protein:5,carbs:7,fat:5,grams:150,estimated:true})],date:null,time:'13:00',meal:null}],
  ['walked 40 min then had a glass of chai and 2 biscuits',{items:[fshot('exercise','walked 40 min','walking',null,null,{activity:'walk',minutes:40}),fshot('food','glass of chai','tea',1,'glass',{kcal:120,protein:4,carbs:16,fat:4,grams:250,estimated:true}),fshot('food','2 biscuits','biscuit',2,'piece',{kcal:90,protein:1,carbs:14,fat:3,grams:20,estimated:true})],date:null,time:null,meal:null}],
];
function llmMessages(text,model,today){
  var qwen=model&&model.qwen,msgs=[{role:'system',content:LLM_SYSTEM+' Today is '+today+'.'}];
  LLM_SHOTS.forEach(function(s){msgs.push({role:'user',content:s[0]+(qwen?' /no_think':'')});msgs.push({role:'assistant',content:JSON.stringify(s[1])})});
  msgs.push({role:'user',content:text+(qwen?' /no_think':'')});
  return msgs;
}
function llmGenerate(text,today){
  var mk=llmMock();
  if(mk&&mk.extract){LLM.lastUsage=mk.usage||null;return Promise.resolve(mk.extract(text))}
  var eng=LLM.engine,model=llmModel(LLM.modelId);
  if(!eng)return Promise.reject(new Error('no engine'));
  var req={messages:llmMessages(text,model,today),temperature:0,max_tokens:800,response_format:{type:'json_object',schema:JSON.stringify(llmSchema())}};
  if(model&&model.qwen)req.extra_body={enable_thinking:false};
  return eng.chat.completions.create(req).then(function(r){
    var c=r&&r.choices&&r.choices[0]&&r.choices[0].message&&r.choices[0].message.content;
    LLM.lastUsage=r&&r.usage||null;return c;
  });
}
function llmInterrupt(){
  try{var mk=llmMock();if(mk){if(mk.cancel)mk.cancel();return}if(LLM.engine&&LLM.engine.interruptGenerate)LLM.engine.interruptGenerate()}catch(e){}
}
function llmParseJSON(raw){
  if(raw&&typeof raw==='object')return raw;
  if(typeof raw!=='string')return null;
  var t=raw.replace(/<think>[\s\S]*?<\/think>/g,'').trim(),a=t.indexOf('{'),b=t.lastIndexOf('}');
  if(a<0||b<a)return null;
  t=t.slice(a,b+1);
  try{var o=JSON.parse(t);return o&&typeof o==='object'?o:null}catch(e){}
  try{o=JSON.parse(t.replace(/,\s*([}\]])/g,'$1'));return o&&typeof o==='object'?o:null}catch(e){return null}   /* small models leave trailing commas */
}
/* GENERATE phase only (the model is already loaded): timeout grows with the number of lines (+20 s for the very first call: GPU shader compile).
   Always resolves {data,reason,detail,ms} (reason: ok | timeout | cancelled | bad | error). */
function llmTimeout(lines){return window.__llmTimeoutMs||(15000+9000*Math.max(1,lines||1)+(LLM.calls===0?20000:0))}
function llmRun(text,today,lines){
  return new Promise(function(resolve){
    var done=false,job={},t0=Date.now();LLM.job=job;
    function fin(data,reason,detail){if(done)return;done=true;clearTimeout(tm);if(LLM.job===job)LLM.job=null;if(LLM.state==='ready')llmTouch();resolve({data:data,reason:reason,detail:detail||'',ms:Date.now()-t0})}
    var to=llmTimeout(lines),tm=setTimeout(function(){llmInterrupt();fin(null,'timeout','no answer after '+Math.round(to/1000)+' s')},to);LLM.calls++;
    job.cancel=function(){llmInterrupt();fin(null,'cancelled')};
    var p;try{p=llmGenerate(text,today)}catch(e){fin(null,'error',String(e&&e.message||e).slice(0,160));return}
    p.then(function(raw){var o=llmParseJSON(raw);fin(o,o?'ok':'bad',o?'':'the answer was not valid JSON: '+String(raw).slice(0,60))},function(e){fin(null,'error',String(e&&e.message||e).slice(0,160))});
  });
}
/* the plain-words reason shown in the check sheet and kept for the 'Last AI problem' report */
function aiReasonText(r,detail){
  var d=detail?' ('+detail+')':'';
  return r==='timeout'?'the AI took too long'+d:r==='cancelled'?'cancelled':r==='loadfail'?'the AI could not start'+(LLM.err?' ('+LLM.err+')':''):r==='bad'?'the AI gave an answer that could not be read'+d:r==='empty'?'the AI named no food that is in your text'+d:r==='error'?'the AI stopped with an error'+d:r;
}
function aiRecord(reason,detail,extra){
  if(reason==='ok'||reason==='cancelled'||reason==='off')return;
  var m=llmModel(UI.modelId||LLM.modelId);
  LLM.last=Object.assign({when:new Date().toISOString(),model:m?m.name:(UI.modelId||'?'),loadMs:LLM.loadMs||null,genMs:null,tokens:(LLM.lastUsage&&LLM.lastUsage.completion_tokens)||null,reason:reason,detail:aiReasonText(reason,detail),input:null},extra||{});
}
/* ---- validation and mapping into the rule pipeline ---- */
function lowConf(it){return it.type==='unmatched'||(it.type==='food'&&(it.score==null?false:it.score<0.8))}
function llmClampQty(q,unit){
  q=typeof q==='number'?q:parseFloat(q);if(!isFinite(q)||q<=0)return null;
  if(unit==='g'||unit==='ml')return Math.max(1,Math.min(2000,q));
  if(!unit&&q>50)return Math.min(2000,q);
  return Math.max(0.1,Math.min(50,q));
}
function cleanSeg(t,today,slots){
  var d=extractDate(t,today);t=d.text;var tm=extractTime(t);t=tm.text;var ml=extractMeal(t,slots,d.meal);t=ml.text;
  return foldFractions(t).replace(/\s+/g,' ').trim();
}
var LLM_GLUE={and:1,aur:1,with:1,n:1,then:1,phir:1,plus:1,along:1,at:1,for:1,in:1,on:1,the:1,a:1,an:1,of:1,i:1,had:1,ate:1,have:1,my:1,some:1,ki:1,ka:1,ke:1,ko:1,me:1,mein:1,after:1,before:1,so:1,then:1,also:1,today:1,aaj:1};
function llmNum(x,lo,hi){x=typeof x==='number'?x:(typeof x==='string'&&x.trim()!==''?parseFloat(x):NaN);if(!isFinite(x)||x<lo)return null;return Math.min(hi,x)}
var AI_UNIT_G={katori:HSIZE.katori,bowl:HSIZE.bowl,glass:HSIZE.glass,cup:HSIZE.cup,plate:250,tbsp:HSIZE.tbsp,tsp:HSIZE.tsp,piece:50,slice:30,handful:30,serving:100};
/* The model's nutrition guess for the amount the user stated -> {kcal,p,c,f,grams,...} or null.
   Every number is range-checked and clamped; a guess that does not add up (calories vs macros, more than 9 kcal or more macros than grams) is corrected and flagged. */
function llmEstimate(r,q,word){
  var k=llmNum(r.kcal,0,5000),p=llmNum(r.protein,0,500),c=llmNum(r.carbs,0,800),f=llmNum(r.fat,0,500);
  if(k===null&&p===null&&c===null&&f===null)return null;
  var fix=false,P=p||0,C=c||0,F=f||0;
  /* weight of the stated amount */
  var unit=q.unit,qty=q.qty,grams=null,assumed=false,uw=1,lab='g',kind='g';
  if(unit==='g'||unit==='ml'||unit==='l'||unit==='kg'){
    var per=unit==='l'||unit==='kg'?1000:1;qty=qty>0?qty:(unit==='l'||unit==='kg'?1:100);assumed=!(q.qty>0);
    grams=Math.min(5000,qty*per);qty=grams/per;uw=per;lab=unit==='g'?'g':unit;
  }else{
    var gAi=llmNum(r.grams,1,5000);
    if(unit){
      qty=qty>0?qty:1;assumed=!(q.qty>0);
      var dg=AI_UNIT_G[word||unit]||AI_UNIT_G[unit]||50,ug=gAi!==null?Math.min(3*dg,q.qty>0?gAi/qty:gAi):dg;if(gAi>3*dg*qty)fix=true;
      grams=Math.min(5000,qty*ug);qty=roundq(qty);uw=grams/qty;kind=UNITW[word||unit]||unit;lab=(word||unit)+' ('+fmt2(uw)+' g)';
    }else{grams=gAi!==null?gAi:100;assumed=true;qty=grams;uw=1}
  }
  grams=Math.max(1,grams);
  var sum=P+C+F;if(sum>grams){var sc=grams/sum;P*=sc;C*=sc;F*=sc;fix=true}
  var atw=4*P+4*C+9*F;
  if(k===null){k=atw;fix=true}
  else if(sum>0&&Math.abs(k-atw)>0.35*Math.max(k,atw)+60){k=atw;fix=true}
  if(k>(sum>0?9.2:4)*grams){k=(sum>0?9.2:4)*grams;fix=true}   /* no macros given: at most 4 kcal/g */
  return {kcal:k,p:P,c:C,f:F,grams:roundq(grams),qty:roundq(qty),unit:kind,unitLabel:lab,unitG:roundq(uw),assumed:assumed,fixed:fix};
}
/* Build the preview rows from the model's answer. The model only names the foods, amounts, units, time and meal.
   Nutrition: the food list is searched with the NAME the model gave; only when nothing matches is the model's own estimate used (tagged 'AI'). */
function llmBuild(rule,data,text,ctx){
  if(!data||!Array.isArray(data.items))return null;
  var today=ctx.today||S.today,slots=ctx.slots||S.profile.slots,kg=ctx.kg>0?ctx.kg:weightOn(S.profile.id,S.profile,rule.date);
  var nt=normText(text),out=[],rest=nt.replace(/[()\[\]{}]/g,' '),dropped=0,saved=ctx.saved||(S.profile?loadSaved(S.profile.id):[]);
  /* tolerant lookup of the model's words in the remaining input: brackets, case and punctuation do not matter; if that fails, the food words alone
     (without modifier words, numbers, units) may be separated by modifier words ('almonds (3 nuts)' vs 'almonds soaked (3 nuts)') */
  function findWords(rt){
    var SEP='[^a-z0-9\\u0900-\\u097f]+',esc=function(w){return w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')};
    var toks=rt.replace(/[()\[\]{}]/g,' ').split(/[^a-z0-9.\u0900-\u097f]+/).map(function(w){return w.replace(/^\.+|\.+$/g,'')}).filter(Boolean);
    function go(t,gap){
      if(!t.length)return null;
      var mid=gap?'(?:'+SEP+'(?:'+Object.keys(DESCW).join('|')+'))*'+SEP:SEP;
      var m=new RegExp('(^|[^a-z0-9\\u0900-\\u097f])('+t.map(esc).join(mid)+')(?=$|[^a-z0-9\\u0900-\\u097f])').exec(rest);
      return m?{at:m.index+m[1].length,len:m[2].length}:null;
    }
    var hit=go(toks,false);if(hit)return hit;
    var food=toks.filter(function(w){return !DESCW[w]&&!isNumTok(w)&&!UNITW[w]&&!COUNTN[w]&&w.length>=2});
    if(!food.length)food=toks.filter(function(w,i){return !DESCW[w]&&!isNumTok(w)&&!UNITW[w]&&w.length>=2&&toks.indexOf(w)===i});   /* only a count noun left ("dates (2 dates)"): it is the food */
    return food.length?go(food,true):null;
  }
  /* the model's text often leaves out the typed amount ("Cashews" for "Cashews (4 nuts)", "milk" for "200 ml milk"): the span grows over the amount
     next to it on the same line (and over a descriptor-only comma fragment), so units stay as typed; another food's words are never taken */
  function withAmount(at,len){
    var s=at,B=/[\n;+&\u0001,]/,ok=function(x,cnt){var p=parseSegment(cleanSeg(x,today,slots));return p.words.every(function(w){return DESCW[w]||cnt&&COUNTN[w]})};
    while(s>0&&!B.test(rest[s-1]))s--;
    if(!ok(rest.slice(s,at),false))s=at;
    var tl=rest.slice(at+len).split(/[\n;+&\u0001]/)[0].split(','),k=0;
    while(k<tl.length&&ok(tl[k],k===0))k++;
    return {s:s,e:at+len+tl.slice(0,k).join(',').length};
  }
  function unmatched(rt,name,m){return {type:'unmatched',text:rt,phrase:name||rt,score:m?m.score:0,flag:'none',cands:m?m.cands:[],q:{qty:null,unit:null,size:null,word:null},via:'ai'}}
  var srcLine=null;   /* which non-blank line of the text an item came from (used to split a multi-time text after the one model call) */
  function oneItem(r){
    if(!r||typeof r!=='object'){dropped++;return}
    var ty=String(r.type==null?'food':r.type).toLowerCase(),type=ty==='exercise'?'exercise':ty==='food'?'food':null,rt=typeof r.text==='string'?normText(r.text):'';
    /* item words must be in the input (whole words); each piece used once */
    if(!type||!rt||rt.replace(/[^a-z0-9ऀ-ॿ]/g,'').length<2){dropped++;return}
    var m0=findWords(rt);
    if(!m0){dropped++;return}
    var wa=withAmount(m0.at,m0.len),at0=wa.s,typed=rest.slice(wa.s,wa.e);srcLine=rest.slice(0,at0).split('\n').slice(0,-1).filter(function(l){return l.trim()}).length;rest=rest.slice(0,at0)+' \u0001 '+rest.slice(wa.e);
    var svh=null;
    if(saved.length){[rt,extractTime(extractDate(rt,today).text).text.trim()].forEach(function(c){if(!svh&&c)svh=savedFor(c,saved)})}
    if(svh){savedItems(svh,kg).forEach(function(x){out.push(x)});return}
    var seg=cleanSeg(typed,today,slots)||cleanSeg(rt,today,slots);if(!seg)seg=rt;
    if(type==='exercise'){
      var rx=parseExercise(seg,kg),key=rx?rx.actKey:(EXBYKEY[r.activity]?r.activity:null),exChanged=!rx;
      if(!key){out.push(unmatched(rt,rt,null));return}
      var a=EXBYKEY[key],mins=null,dist=rx&&rx.distanceKm!=null?rx.distanceKm:null,assumed=false;
      if(rx&&!rx.assumed)mins=rx.minutes;                      /* a duration typed in the words always wins */
      else if(typeof r.minutes==='number'&&isFinite(r.minutes)&&r.minutes>0){mins=Math.max(1,Math.min(600,Math.round(r.minutes*10)/10));exChanged=true}
      if(dist===null&&typeof r.distance_km==='number'&&r.distance_km>0&&r.distance_km<=1000){dist=r.distance_km;exChanged=true}
      if(mins===null){if(dist!==null&&a.kmh)mins=Math.max(1,Math.min(600,Math.round(dist/a.kmh*600)/10));else{mins=MET.defaultMinutes;assumed=true}}
      out.push({type:'exercise',text:rt,phrase:rt,actKey:key,label:a.label,met:a.met,minutes:mins,distanceKm:dist,steps:rx?rx.steps:null,assumed:assumed,kg:kg,kcal:a.met*kg*mins/60,flag:assumed?'check':'none',score:1,cands:[],q:null,via:'ai'});
      return;
    }
    /* typed amount/unit win; the model only fills what is missing */
    var ps=parseSegment(seg),aiUnit=LLM_UNITS.indexOf(String(r.unit||'').toLowerCase())>=0?String(r.unit).toLowerCase():null,lq=llmClampQty(r.qty,aiUnit);
    var q={qty:null,unit:null,size:null,word:null};
    q.qty=ps.qty!==null?ps.qty:lq;
    if(ps.unit){q.unit=ps.unit;q.word=ps.unitWord}
    else if(ps.qty===null&&aiUnit){q.unit=UNITW[aiUnit]||aiUnit;q.word=UNIT_SHOW[aiUnit]||aiUnit}
    q.size=ps.size!==null?ps.size:({small:0.75,large:1.3,bit:0.5,medium:1}[r.size]||null);
    var name=typeof r.name==='string'&&r.name.trim()?r.name.trim().slice(0,60):(ps.phrase||seg);
    var m=matchFood(name),mu=ps.phrase?matchFood(ps.phrase):m;
    if(mu.foodId&&mu.score>=0.8&&mu.foodId!==m.foodId){if(m.foodId)m.flag='check';else if(!m.split)m=mu}
    if(m.split){
      m.split.forEach(function(ph){
        var m2=matchFood(ph),it2=Object.assign(unmatched(rt,ph,m2),{score:m2.score,flag:m2.flag,cands:m2.cands,q:{qty:q.qty,unit:q.unit,size:q.size,word:q.word}});
        var f2=m2.foodId&&findFood(m2.foodId);if(f2)fillItem(it2,f2);out.push(it2);
      });
      return;
    }
    var it=Object.assign(unmatched(rt,m.phrase||name,m),{flag:m.flag,q:q}),f=m.foodId&&findFood(m.foodId);
    if(f&&!(m.score>=0.8)&&llmEstimate(r,q,q.word))f=null;   /* a weak table match (score < 0.8) loses to the AI estimate; it stays under 'Change item' */
    if(f){
      var oc=ownCountHit(f,ps.tokens);   /* "egg omelette 2 eggs": the 2 counts the eggs inside one omelette, not omelettes */
      if(oc){it.q={qty:oc.countable?oc.qty/oc.n:null,unit:null,size:q.size,word:null};if(!oc.countable)it.flag='check'}
      else if((m.via==='drop'||m.via==='fuzzy')&&(ps.unit==='slice'||ps.unit==='piece'))it.q={qty:null,unit:null,size:q.size,word:null};
      fillItem(it,f);out.push(it);return;
    }
    /* not in the food list: use the model's estimate (never saved without the confirm sheet) */
    var es=llmEstimate(r,q,q.word);
    if(es){
      var nm=name.replace(/\s+/g,' ');nm=nm.charAt(0).toUpperCase()+nm.slice(1);
      it.type='food';it.foodId='ai_'+nm.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,40);it.foodName=nm.slice(0,120);
      it.qty=es.qty;it.unit=es.unit;it.unitLabel=es.unitLabel;it.unitG=es.unitG;it.grams=es.grams;it.assumed=es.assumed;
      it.per100={kcal:es.kcal*100/es.grams,p:es.p*100/es.grams,c:es.c*100/es.grams,f:es.f*100/es.grams,fib:0};
      it.kcal=es.kcal;it.p=es.p;it.c=es.c;it.f=es.f;it.est='ai';it.flag='check';it.score=0.5;it.estFixed=es.fixed;
    }
    out.push(it);
  }
  data.items.slice(0,20).forEach(function(r){var n0=out.length;srcLine=null;oneItem(r);for(var k=n0;k<out.length;k++)if(srcLine!==null)out[k].line=srcLine});
  if(!out.length)return null;
  /* anything the user wrote that no valid item covers stays visible as a "not found" row */
  rest=rest.split('\n').map(function(l){return cleanSeg(l,today,slots)}).join(' ').replace(/[^a-zऀ-ॿ ]+/g,' ');   /* line by line: each line may carry its own time / meal word */
  var left=rest.split(/\s+/).filter(function(w){return w.length>=2&&!LLM_GLUE[w]&&!STOPW[w]&&!UNITW[w]&&!NUMW[w]&&!SIZEW[w]&&!DESCW[w]&&!COUNTN[w]});
  if(left.length)out.push(unmatched(left.join(' '),left.join(' '),null));
  var res=Object.assign({},rule,{items:out.slice(0,40),ai:true,aiDropped:dropped});
  if(!rule.dateExplicit&&typeof data.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(data.date)&&isDate(data.date)&&data.date<=today&&data.date>=addDays(today,-60)){res.date=data.date;res.dateAi=true}
  if(!rule.timeExplicit&&typeof data.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)){res.time=data.time;res.timeAi=true}
  if(!rule.slotExplicit&&typeof data.meal==='string'){
    var mw=normText(data.meal),sl=slots.filter(function(s){return s.name.toLowerCase()===mw})[0];
    if(sl){res.slotId=sl.id;res.slotName=sl.name;res.slotAi=true}
  }
  return res;
}
/* AI first: with a model downloaded and switched on, every typed or spoken log goes to the model. The built-in rule parser is only the fallback
   (no model, switched off, load error, timeout, cancel, unusable answer). In AI mode the sentence itself is never looked up in the food list. */
function parseLogAI(text,ctx,opts){
  ctx=ctx||{};opts=opts||{};
  function phase(p,n,k){if(opts.onPhase)try{opts.onPhase(p,n,k)}catch(e){}}
  function fallback(reason,detail){aiRecord(reason,detail,{input:String(text).slice(0,300)});return {res:parseLog(text,ctx),rule:null,used:false,reason:reason,detail:detail||''}}
  if(!aiEnabled())return Promise.resolve(fallback('off'));
  var meta=parseLog(ctx.metaText||text,Object.assign({},ctx,{metaOnly:true})),src=String(text).slice(0,500),today=ctx.today||S.today;
  var lines=src.split(/\r?\n/).map(function(l){return l.trim()}).filter(Boolean);
  function build(data,t){var m=null;try{m=llmBuild(meta,data,t,ctx)}catch(e){m=null}return m}
  /* LOAD phase (progress + Cancel, no timeout), then GENERATE phase (timeout scaled to the lines) */
  phase('load');
  return llmEnsure().then(function(ok){
    if(!ok)return fallback(LLM.state==='error'?'loadfail':'cancelled');
    phase('read',lines.length);
    return llmRun(src,today,lines.length).then(function(r){
      if(r.reason==='cancelled')return fallback('cancelled');
      var m=r.data?build(r.data,text):null;
      if(m)return {res:m,rule:meta,used:true,reason:'ok'};
      var why=r.data?'empty':r.reason,detail=r.data?'the model returned '+((r.data.items||[]).length)+' item(s), none matched your words':r.detail;
      if(lines.length<2||lines.length>8||LLM.state!=='ready'){   /* per-line retry only for a short list (each line can take 24 s on a phone) */var fb=fallback(why,detail);if(LLM.last)LLM.last.genMs=r.ms;return fb}
      /* the whole-text call failed: ask once per line and merge everything into the same meal */
      var merged={items:[],date:null,time:null,meal:null},bad=[],k=0,firstFail={reason:why,detail:detail},lineFail=null;
      function next(){
        if(k>=lines.length)return Promise.resolve();
        var i=k++;phase('line',i+1,lines.length);
        return llmRun(lines[i],today,1).then(function(x){
          if(x.reason==='cancelled'){bad.cancelled=true;return}
          var items=x.data&&Array.isArray(x.data.items)?x.data.items:[];
          if(x.data&&items.length){items.forEach(function(it){merged.items.push(it)});['date','time','meal'].forEach(function(f){if(merged[f]==null&&x.data[f]!=null)merged[f]=x.data[f]})}
          else{bad.push(i);lineFail=lineFail||{reason:x.data?'empty':x.reason,detail:x.data?'no item for this line':x.detail}}
        }).then(function(){return bad.cancelled?null:next()});
      }
      return next().then(function(){
        if(bad.cancelled)return fallback('cancelled');
        var goodLines=lines.filter(function(l,i){return bad.indexOf(i)<0}),m2=merged.items.length?build(merged,goodLines.join('\n')):null;
        if(!m2){var fb2=fallback(firstFail.reason,firstFail.detail);if(LLM.last)LLM.last.genMs=r.ms;return fb2}
        if(bad.length){   /* lines the AI could not read keep the built-in rules' rows (marked Check) */
          bad.forEach(function(i){parseLog(lines[i],Object.assign({},ctx,{viewDate:m2.date,metaText:null})).items.forEach(function(it){it.flag=it.flag==='none'?'check':it.flag;m2.items.push(it)})});
          aiRecord((lineFail||firstFail).reason,(lineFail||firstFail).detail,{input:String(text).slice(0,300)});
        }
        return {res:m2,rule:meta,used:true,reason:'ok',perLine:true,badLines:bad.length,nLines:lines.length};
      });
    });
  });
}
window.TrackMe=window.Journable={parseLog:parseLog,splitTimeBlocks:splitTimeBlocks,matchFood:matchFood,parseLogAI:parseLogAI,llmMerge:llmBuild,llmBuild:llmBuild,aiActive:aiEnabled,appConfig:function(){return llmImport().then(llmAppConfig)},version:'1.1.4'};
/* ---------- On-device AI screen (model manager) ---------- */
function mbText(mb){return mb>=1000?(Math.round(mb/100)/10)+' GB':Math.round(mb)+' MB'}
function onMobileData(){var c=navigator.connection;return !!c&&(c.type==='cellular'||c.saveData===true)}
function viewAI(root){
  var av=llmAvail(),box=h('div',{id:'ai-cards'}),storage=h('p',{class:'small muted',id:'ai-storage'});
  function estimate(){
    try{if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(function(e){if(!storage.isConnected)return;
      storage.textContent='Storage used by this app: '+mbText((e.usage||0)/1048576)+(e.quota?' of about '+mbText(e.quota/1048576)+' available.':'.')}).catch(function(){})}catch(err){}
  }
  function startDownload(d){
    var cached=!!LLM.cached[d.id];
    function go(){llmLoad(d.id,{cached:cached}).then(function(ok){if(ok&&UI.llmOn!==true){UI.llmOn=true;saveUI();refreshAI()}})}
    if(!cached&&onMobileData()){
      openSheet({title:'Download on mobile data?',id:'cell-sheet',build:function(body,close){
        body.appendChild(h('p',{text:'You seem to be on mobile data. This model is '+d.sizeText+'. It is best to download it on Wi-Fi.'}));
        body.appendChild(h('div',{class:'row'},h('button',{type:'button',class:'btn primary grow',id:'cell-ok',text:'Download anyway',onclick:function(){close(false);go()}}),
          h('button',{type:'button',class:'btn',id:'cell-cancel',text:'Not now',onclick:function(){close()}})));
      }});
    }else go();
  }
  function draw(){
    box.replaceChildren();
    var active=LLM.state==='downloading'||LLM.state==='loading';
    if(!av.ok)box.appendChild(h('section',{class:'banner warn',id:'ai-na',role:'note'},h('b',{text:'Not available here. '}),av.reason,' The Basic parser keeps working.'));
    var tog=h('input',{type:'checkbox',id:'ai-toggle',checked:UI.llmOn===true,disabled:!av.ok||!UI.modelId||active,
      onchange:function(){
        UI.llmOn=tog.checked;saveUI();
        if(!UI.llmOn)llmUnloadOnly();
        refreshAI();
      }});
    box.appendChild(h('section',{class:'card'},h('h2',{text:'On-device AI'}),
      h('p',{class:'muted',text:'Optional. When it is downloaded and switched on, it reads everything you type, on this phone. The model is downloaded once; after that nothing you type leaves your phone. Calories come from the built-in food list; only when a food is not in the list the AI gives an estimate, tagged AI, and you always check the list before saving.'}),
      h('label',{class:'check-row'},tog,h('span',{text:'Use on-device AI'})),
      h('p',{class:'small muted',id:'ai-state',text:'Status: '+chipLabel()+(UI.modelId&&llmModel(UI.modelId)?' ('+llmModel(UI.modelId).name+')':'')+'.'})));
    if(LLM.err)box.appendChild(h('section',{class:'banner error',id:'ai-err',role:'alert'},h('b',{text:'That did not work. '}),LLM.err));
    if(LLM.last){
      var L=LLM.last,rep=['TrackMe last AI problem, '+L.when,'Model: '+L.model,'Load: '+(L.loadMs!=null?L.loadMs+' ms':'n/a'),'Generate: '+(L.genMs!=null?L.genMs+' ms':'n/a'),'Tokens: '+(L.tokens!=null?L.tokens:'n/a'),'Reason: '+L.detail,'Text: '+(L.input||'').replace(/\n/g,' / ')].join('\n');
      box.appendChild(h('section',{class:'card',id:'ai-last'},h('h3',{style:'margin:0 0 6px',text:'Last AI problem'}),h('pre',{class:'small',id:'ai-last-text',style:'white-space:pre-wrap;margin:0 0 8px',text:rep}),
        h('button',{type:'button',class:'btn sm',id:'ai-last-copy',text:'Copy',onclick:function(){
          function fb(){var ta=h('textarea',{style:'position:fixed;opacity:0;top:0',readonly:true});ta.value=rep;document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}ta.remove();toast('Copied')}
          try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(rep).then(function(){toast('Copied')},fb);return}}catch(e){}fb();}})));
    }
    var g=LLM.gpu,usable=!g||g.ok;
    if(g&&g.ok&&!g.f16)box.appendChild(h('section',{class:'banner warn',id:'ai-f16-note',role:'note'},h('b',{text:'Compatible models only. '}),'Your phone\'s GPU can\'t run the fast models; using the compatible one.'));
    if(g&&!g.ok&&av.ok)box.appendChild(h('section',{class:'banner warn',id:'ai-gpu-note',role:'note'},h('b',{text:'This phone\'s GPU cannot run the AI. '}),g.why==='limits'?'Its GPU limits are below what the models need (a 256 MB buffer and 10 storage buffers per stage).':g.why==='nogpu'?'The browser offers no WebGPU.':'The browser found no usable GPU adapter.',' The Basic parser keeps working.'));
    var recFam=['q06','l1','q17'].filter(function(f){return llmVariant(f)})[0]||null;
    LLM_FAMS.forEach(function(fam,i){
      var d=llmVariant(fam),proto=LLM_MODELS.filter(function(m){return m.fam===fam})[0];
      if(!d){
        box.appendChild(h('section',{class:'card ai-card',id:'ai-card-'+i,'data-model':proto.id},h('h3',{style:'margin:0',text:proto.name}),
          h('p',{class:'small',style:'margin:4px 0'},h('b',{text:proto.note})),
          h('p',{class:'small muted',style:'margin:0 0 6px',text:usable?'Not offered: it needs the 16-bit GPU feature (shader-f16) that this phone\'s GPU does not have.':'Not offered on this phone.'}),
          h('div',{class:'row'},h('button',{type:'button',class:'btn primary',id:'ai-dl-'+i,disabled:true,text:'Download'}))));
        return;
      }
      var isActive=UI.modelId===d.id,loadingThis=active&&LLM.modelId===d.id,cached=!!LLM.cached[d.id];
      var st=loadingThis?(LLM.state==='downloading'?'Downloading '+LLM.pct+'%':'Loading '+LLM.pct+'%'):(LLM.state==='ready'&&LLM.modelId===d.id&&UI.llmOn?'Ready to use':cached&&isActive&&UI.llmOn?'Downloaded. Loads on first use.':cached?'Downloaded':'Not downloaded');
      var card=h('section',{class:'card ai-card',id:'ai-card-'+i,'data-model':d.id},
        h('div',{class:'row between'},h('h3',{style:'margin:0',text:d.name}),h('span',null,fam===recFam?h('span',{class:'tag rec',text:'Recommended'}):null,isActive?h('span',{class:'tag',style:'margin-left:4px',text:'In use'}):null)),
        h('p',{class:'small',style:'margin:4px 0'},h('b',{text:d.note})),
        h('p',{class:'small muted',style:'margin:0 0 6px'},'Download: '+d.sizeText+'. GPU memory while it runs: about '+mbText(d.vramMB)+'.'),
        h('p',{class:'ai-status',id:'ai-status-'+i,role:'status',text:st}));
      if(loadingThis)card.appendChild(h('div',{class:'ai-prog',role:'progressbar','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(LLM.pct),'aria-label':'Download progress'},h('i',{style:'width:'+LLM.pct+'%'})));
      var row=h('div',{class:'row',style:'margin-top:8px'});
      if(loadingThis)row.appendChild(h('button',{type:'button',class:'btn',id:'ai-cancel',text:'Cancel',onclick:function(){llmCancel()}}));
      else{
        row.appendChild(h('button',{type:'button',class:'btn primary',id:'ai-dl-'+i,disabled:!av.ok||active||!usable,text:cached?(isActive&&LLM.state==='ready'?'Loaded':'Use this model'):'Download',onclick:function(){startDownload(d)}}));
        if(cached)row.appendChild(h('button',{type:'button',class:'btn danger',id:'ai-del-'+i,disabled:active,text:'Delete',onclick:function(){llmDelete(d.id)}}));
      }
      card.appendChild(row);box.appendChild(card);
    });
    box.appendChild(storage);estimate();
    box.appendChild(h('p',{class:'small muted',text:'Sizes are approximate. The files come from huggingface.co when you tap Download (that site sees the download request). If the phone runs out of memory, try the smaller model.'}));
  }
  S.aiRedraw=draw;
  root.appendChild(box);draw();
  if(av.ok)llmProbe().then(function(){if(S.tab==='ai'&&box.isConnected&&!sheetState)draw()});
  LLM_MODELS.forEach(function(d){llmHas(d.id).then(function(has){if(has!==!!LLM.cached[d.id]){LLM.cached[d.id]=has;if(S.tab==='ai'&&box.isConnected&&!sheetState)draw()}})});
}

/* ---------- Check my phone ---------- */
function viewPhone(root){
  var rows=[],list=h('ul',{class:'plain phone-list',id:'phone-list'}),summary=h('p',{class:'small muted',id:'phone-summary'}),out=h('p',{class:'small',id:'phone-test-out',role:'status'});
  function add(id,label,status,detail){rows.push({id:id,label:label,status:status,detail:detail||''});drawList()}
  function drawList(){
    list.replaceChildren();
    rows.forEach(function(r){list.appendChild(h('li',{class:'phone-row','data-id':r.id,'data-status':r.status},h('span',{class:'phone-badge '+r.status,text:r.status==='pass'?'PASS':r.status==='fail'?'FAIL':'INFO'}),h('span',{class:'grow'},h('b',{text:r.label}),h('span',{class:'muted small',style:'display:block',text:r.detail}))))});
  }
  var secure=!!window.isSecureContext;
  add('secure','Secure context (https)',secure?'pass':'fail',secure?'Yes.':'No. The service worker and on-device AI need an https address (or localhost).');
  var sw='serviceWorker' in navigator,ctrl=sw&&!!navigator.serviceWorker.controller;
  add('sw','Offline support (service worker)',ctrl?'pass':'fail',!sw?'Not available in this browser.':ctrl?'Active: the app can open without internet.':location.protocol==='file:'?'Not used when the app is opened as a file.':'Not controlling this page yet. Reload once after the first visit.');
  var standalone=!!(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
  add('standalone','Installed on the home screen',standalone?'pass':'info',standalone?'Yes, running as an installed app.':'No. Chrome menu > Add to Home screen > Install.');
  var gpu=!!navigator.gpu;
  add('webgpu','WebGPU (needed for AI)',gpu?'pass':'fail',gpu?'Present.':'Missing. On-device AI will not work; the Basic parser still does.');
  add('adapter','GPU adapter','info','Checking...');
  add('f16','shader-f16 (needed by the compact models)','info','Checking...');
  add('maxbuf','Largest GPU buffer (needs 256 MB)','info','Checking...');
  add('storagebuf','Storage buffers per stage (needs 10)','info','Checking...');
  var dm=navigator.deviceMemory;
  add('memory','Device memory',dm?(dm>=4?'pass':'fail'):'info',dm?'About '+dm+' GB (the browser rounds this down; it never reports more than 8).':'The browser does not say.');
  add('persist','Storage kept safe','info','Checking...');
  add('estimate','Storage used / available','info','Checking...');
  add('cache','Cache API','caches' in window?'pass':'fail','caches' in window?'Present.':'Missing.');
  add('worker','Module web worker','info','Checking...');
  var sp=speechApi();add('speech','Speech recognition (mic button)',sp?'pass':'info',sp?'Present. It sends audio to Google; the keyboard mic is the private option.':'Not present. Use your keyboard\'s mic instead.');
  add('model','AI model on this phone','info','Checking...');
  function setRow(id,status,detail){rows.forEach(function(r){if(r.id===id){r.status=status;r.detail=detail}});drawList()}
  /* async checks */
  (function(){
    if(!navigator.gpu){setRow('adapter','fail','No WebGPU, so no adapter.');setRow('f16','info','Unknown without WebGPU.');setRow('maxbuf','info','Unknown without WebGPU.');setRow('storagebuf','info','Unknown without WebGPU.');return}
    navigator.gpu.requestAdapter().then(function(ad){
      if(!ad){setRow('adapter','fail','The browser found no GPU adapter.');setRow('f16','info','No adapter.');setRow('maxbuf','info','No adapter.');setRow('storagebuf','info','No adapter.');return}
      var info=ad.info||{};var d=[info.vendor,info.architecture,info.device,info.description].filter(Boolean).join(' ');
      setRow('adapter','pass',d||'Adapter found (the browser hides its name).');
      var f16=ad.features&&ad.features.has&&ad.features.has('shader-f16');
      setRow('f16',f16?'pass':'info',f16?'Supported: the fast (q4f16) models can run.':'Not supported. The fast (q4f16) models are off; the compatible (q4f32) model is used instead, it needs more GPU memory (about 1.9 GB for Qwen3 0.6B).');
      var mb=ad.limits&&ad.limits.maxBufferSize;
      setRow('maxbuf',mb?(mb>=MIN_BUF?'pass':'fail'):'info',mb?mbText(mb/1048576)+(mb>=MIN_BUF?'.':' is below the 256 MB the models need.'):'Not reported.');
      var sb=ad.limits&&ad.limits.maxStorageBuffersPerShaderStage;
      setRow('storagebuf',sb!=null?(sb>=MIN_STORAGE_BUFS?'pass':'fail'):'info',sb!=null?sb+(sb>=MIN_STORAGE_BUFS?'.':' is below the 10 the models need.'):'Not reported.');
    }).catch(function(e){setRow('adapter','fail','Could not ask for an adapter: '+String(e&&e.message||e).slice(0,100));});
  })();
  try{
    if(navigator.storage&&navigator.storage.persisted)navigator.storage.persisted().then(function(p){setRow('persist',p?'pass':'fail',p?'Yes: the browser promised not to clear your journal.':'Not promised: the browser may clear data if the phone runs low on space. Keep backups.')}).catch(function(){setRow('persist','info','Unknown.')});
    else setRow('persist','info','Not supported by this browser.');
    if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(function(e){setRow('estimate','info',mbText((e.usage||0)/1048576)+' used of about '+mbText((e.quota||0)/1048576))}).catch(function(){setRow('estimate','info','Unknown.')});
    else setRow('estimate','info','Not supported by this browser.');
  }catch(e){}
  (function(){
    if(location.protocol==='file:'||typeof Worker==='undefined'){setRow('worker',typeof Worker==='undefined'?'fail':'info',typeof Worker==='undefined'?'Not supported.':'Skipped when opened as a file.');return}
    try{
      var w=new Worker(new URL('./probe-worker.js',location.href),{type:'module'}),t=setTimeout(function(){setRow('worker','fail','The test worker did not answer.');try{w.terminate()}catch(e){}},4000);
      w.onmessage=function(){clearTimeout(t);setRow('worker','pass','Works.');w.terminate()};
      w.onerror=function(){clearTimeout(t);setRow('worker','fail','Module workers did not start.');try{w.terminate()}catch(e){}};
    }catch(e){setRow('worker','fail','Module workers are not supported.')}
  })();
  (function(){
    var id=UI.modelId||LLM_MODELS[0].id;
    llmHas(id).then(function(has){var m=llmModel(id);setRow('model',has?'pass':'info',has?(m?m.name:id)+' is downloaded'+(LLM.state==='ready'?' and loaded.':'.'):'No model downloaded yet (optional). Open On-device AI to download one.')});
  })();
  function report(){
    var lines=['TrackMe check, '+new Date().toISOString(),'Address: '+location.protocol+'//'+location.host+location.pathname,'Browser: '+navigator.userAgent];
    rows.forEach(function(r){lines.push((r.status==='pass'?'PASS':r.status==='fail'?'FAIL':'INFO')+'  '+r.label+': '+r.detail)});
    lines.push('Chip: '+chipLabel());if(out.textContent)lines.push('Test sentence: '+out.textContent);
    return lines.join('\n');
  }
  function copy(){
    var t=report();
    function fallback(){var ta=h('textarea',{style:'position:fixed;opacity:0;top:0',readonly:true});ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}ta.remove();toast('Report copied')}
    try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast('Report copied')},fallback);return}}catch(e){}
    fallback();
  }
  function runTest(){
    var sentence='2 roti, dal aur ek katori dahi, walked 20 min',t0=performance.now();
    out.textContent='Running...';
    var rule=parseLog(sentence,{});var tr=Math.round(performance.now()-t0);
    if(!aiEnabled()){out.textContent='Rule parser read "'+sentence+'" into '+rule.items.length+' rows in '+tr+' ms. No AI model is loaded, so there is no tokens/s figure.';return}
    var t1=performance.now();
    out.textContent=LLM.state==='ready'?'Running the AI...':'Loading the AI first (first use)...';
    llmEnsure().then(function(ok){
      if(!ok){out.textContent='The AI could not start: '+(LLM.err||'unknown reason');return}
      var t2=performance.now(),loadSec=(t2-t1)/1000;
      return llmRun(sentence,S.today).then(function(r){
        var sec=(performance.now()-t2)/1000,u=LLM.lastUsage||{},ex=u.extra||{},tk=u.completion_tokens,n=r.data&&Array.isArray(r.data.items)?r.data.items.length:0,f1=function(x){return String(Math.round(x*10)/10)};
        if(!r.data){out.textContent='AI did not answer ('+r.reason+') after '+f1(sec)+' s.';return}
        var bits=[];if(tk)bits.push(tk+' tokens');
        if(ex.prefill_tokens_per_s)bits.push('prefill '+f1(ex.prefill_tokens_per_s)+' tokens/s');
        if(ex.decode_tokens_per_s)bits.push('decode '+f1(ex.decode_tokens_per_s)+' tokens/s');
        else if(tk&&sec>0)bits.push('about '+f1(tk/sec)+' tokens/s overall');
        out.textContent='AI answered in '+f1(sec)+' s and found '+n+' item'+(n===1?'':'s')+(bits.length?' ('+bits.join(', ')+')':'')+(loadSec>0.05?'. Loading took '+f1(loadSec)+' s':'')+'.';
      });
    });
  }
  root.appendChild(h('section',{class:'card'},h('h2',{text:'Check my phone'}),
    h('p',{class:'muted',text:'Open this first. It shows whether this phone can install the app, keep your journal safe and run the optional on-device AI. Nothing here is sent anywhere.'}),list,summary));
  root.appendChild(h('section',{class:'card'},h('h2',{text:'Try it'}),
    h('div',{class:'row'},h('button',{type:'button',class:'btn',id:'phone-run',text:'Run test sentence',onclick:runTest}),h('button',{type:'button',class:'btn',id:'phone-copy',text:'Copy report',onclick:copy})),out));
}

/* ---------- service worker, update chip, storage persistence ---------- */
var SW_OK=('serviceWorker' in navigator)&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname==='[::1]');
function markUpdate(w){S.updateWorker=w;if(S){showBanners();toast('Update ready','Reload',applyUpdate)}}
function applyUpdate(){
  var w=S.updateWorker;if(!w)return;S.updateAsked=true;
  try{w.postMessage({type:'SKIP_WAITING'})}catch(e){location.reload()}
}
function registerSW(){
  if(!SW_OK)return;
  navigator.serviceWorker.register('./sw.js').then(function(reg){
    S.swReg=reg;
    if(reg.waiting&&navigator.serviceWorker.controller)markUpdate(reg.waiting);
    reg.addEventListener('updatefound',function(){
      var nw=reg.installing;if(!nw)return;
      nw.addEventListener('statechange',function(){if(nw.state==='installed'&&navigator.serviceWorker.controller)markUpdate(nw)});
    });
    document.addEventListener('visibilitychange',function(){if(!document.hidden)reg.update().catch(function(){})});
    window.__swReg=reg;
  }).catch(function(){});
  navigator.serviceWorker.addEventListener('controllerchange',function(){if(S.updateAsked&&!S.reloading){S.reloading=true;location.reload()}});
}
var persistAsked=false;
function askPersist(){
  if(persistAsked)return;persistAsked=true;
  try{if(navigator.storage&&navigator.storage.persist){
    navigator.storage.persisted().then(function(p){return p?true:navigator.storage.persist()}).then(function(r){S.persisted=r===true;if(S.tab==='backup'||S.tab==='phone'||S.tab==='settings'){var l=$('#persist-line');if(l)l.textContent=persistText()}}).catch(function(){});
  }}catch(e){}
}
function persistText(){
  return S.persisted===true?'Storage protection: on. The browser has promised to keep your journal.':S.persisted===false?'Storage protection: not granted. The browser may clear your journal if the phone runs low on space, so keep backups.':'Storage protection: not requested yet. It is requested after your first save.';
}


/* ---------- ADD FOOD ---------- */
function newAddCtx(o){
  o=o||{};var e=o.entry;
  if(e){var base=findFood(e.foodId)||{id:e.foodId,kind:'custom',est:false,units:[],group:e.est==='ai'?'AI estimate':'',alias:''};
    /* editing keeps the nutrition snapshot stored on the entry, not today's database values */
    var f=Object.assign({},base,{id:e.foodId,name:e.foodName,per100:e.per100});
    var us=unitsFor(f),u=us.filter(function(x){return x.kind===e.unit&&x.label===(e.unitLabel||x.label)&&(!e.unitG||x.grams===e.unitG)})[0]; /* same label but a new weight: keep the entry's own {label, unitG} */
    if(!u)u={kind:e.unit,label:e.unitLabel||e.unit,grams:e.unitG||1};
    return {editId:e.id,editDate:e.date,food:f,unit:u,qty:e.qty,date:e.date,time:e.time,slot:e.slot,slotName:e.slotName,query:'',mode:'form',createdAt:e.createdAt,logId:e.logId,adj:e.adj,est:e.est,orig:{foodId:e.foodId,qty:e.qty,unit:e.unit,unitLabel:e.unitLabel,grams:e.grams}};}
  var t=o.date&&o.date!==S.today?'12:00':nowTime();
  return {editId:null,food:null,unit:null,qty:1,date:o.date||S.viewDate,time:t,slot:o.slot||nextSlotId(S.profile,o.date||S.viewDate),query:'',mode:'search'};
}
function selectFood(ctx,f){
  ctx.pendingShared=null;ctx.food=f;var us=unitsFor(f);
  ctx.unit=us.length>1?us[1]:us[0];ctx.qty=ctx.unit.kind==='g'?100:1;
}
function returnToPreview(ctx){
  var P=S.pending,f=ctx.food;S.pending=null;
  if(ctx.pendingShared){putShared(ctx.pendingShared);ctx.pendingShared=null}
  S.add=null;S.tab='today';
  if(P&&f){var it=P.it;it.type='food';it.q=it.q||{qty:null,unit:null,size:null};fillItem(it,f);it.flag='none';it.score=1;it.cands=it.cands||[]}
  render(true);
  if(P)openPreview(null,P.st);
}
function viewAdd(root){
  if(!S.add)S.add=newAddCtx({date:S.viewDate});
  var ctx=S.add;
  if(ctx.fromPreview&&S.pending&&ctx.food&&ctx.mode!=='custom'){returnToPreview(ctx);return}
  if(ctx.fromPreview&&S.pending){
    root.appendChild(h('div',{class:'row',style:'margin-bottom:8px'},h('button',{type:'button',class:'btn',id:'back-to-preview',text:'Back to your list',onclick:function(){var P=S.pending;S.add=null;S.tab='today';render(true);if(P)openPreview(null,P.st)}})));
  }
  if(ctx.mode==='custom')return addCustom(root,ctx);
  if(!ctx.food)return addSearch(root,ctx);
  addForm(root,ctx);
}
/* the basis of a food's numbers, spelled out: "132 kcal per 100 g; 172 kcal for 1 katori (130 g)" */
function per100Txt(f){return f.liquid&&f.density?r0(f.per100.kcal*f.density)+' kcal per 100 ml':r0(f.per100.kcal)+' kcal per 100 g'}
function perText(f){
  var t=per100Txt(f),m=f.units&&f.units[0];
  if(m&&m.grams>0){
    /* "~" for an estimated portion; a glass or cup of liquid is shown in ml, as the label says (1 ml = 1 g is not assumed for the weight) */
    var lab=String(m.label),ml=/\((~?)\s*(\d+(?:\.\d+)?)\s*ml\)/.exec(lab),w=ml&&!/katori/i.test(lab)?ml[1]+ml[2]+' ml':(/\(~/.test(lab)?'~':'')+r0(m.grams)+' g';
    t+='; '+r0(f.per100.kcal*m.grams/100)+' kcal for '+(/^\d/.test(lab)?'':'1 ')+lab.replace(/\s*\(.*$/,'')+' ('+w+')';
  }
  return t;
}
function foodLine(f,extra){
  var tag=f.kind==='dish'?(f.est?h('span',{class:'tag',text:'estimate'}):h('span',{class:'tag alt',text:f.usda?'USDA':'IFCT'})):
    (f.kind==='shared'||f.kind==='custom')?h('span',{class:'tag alt',text:f.kind==='custom'?'My food':f.group}):h('span',{class:'tag alt',text:'raw ingredient'});
  return h('span',null,h('b',{text:f.name}),' ',tag,f.check?h('span',null,' ',h('span',{class:'tag',text:'check values'})):null,extra||null,
    h('span',{class:'muted small',style:'display:block',text:perText(f)+' - '+f.group}));
}
function addSearch(root,ctx){
  var results=h('div',{id:'results'}),status=h('p',{class:'sr-only',role:'status','aria-live':'polite'});
  var offOut=h('div',{id:'off-out','aria-live':'polite'}),cur=null,slowTimer=null,offBtns=[];
  var inp=h('input',{type:'search',id:'q',autocomplete:'off',value:ctx.query,placeholder:'e.g. roti, dal, ghee, banana',oninput:function(){ctx.query=inp.value;fill()},
    onkeydown:function(ev){if(ev.key==='Enter'){var b=results.querySelector('button.result');if(b){ev.preventDefault();b.click()}}}});
  function mkBtn(id,label,cls){var b=h('button',{type:'button',class:cls,id:id,text:label,'data-label':label,onclick:startOff});offBtns.push(b);return b}
  var topBtn=mkBtn('off-search-top','Search online','btn sm'),botBtn=mkBtn('off-search',"Can't find it? Search online",'btn');
  var topRow=h('div',{id:'off-top',class:'row',style:'margin-top:8px',hidden:true},topBtn,h('span',{class:'muted small',id:'off-notice-top',text:'Your search words are sent to openfoodfacts.org.'}));
  function fill(){
    topRow.hidden=ctx.query.trim().length<2;
    results.replaceChildren();var q=ctx.query.trim(),list,title;
    if(q){list=search(q,S.profile.id);title=null}
    else{var rec=recentIds(S.profile.id,8).map(findFood).filter(Boolean);list=rec.length?rec:FOODS.filter(function(f){return f.kind==='dish'}).slice(0,12);title=rec.length?'Recent foods':'Common dishes'}
    status.textContent=q?list.length+' foods found':'';
    if(title)results.appendChild(h('p',{class:'muted small',text:title}));
    list.slice(0,40).forEach(function(f){results.appendChild(h('button',{type:'button',class:'result',onclick:function(){selectFood(ctx,f);render(true)}},foodLine(f)))});
    if(q&&!list.length)results.appendChild(h('p',{class:'muted',text:'No match in your list. You can search online or add it as a custom food below.'}));
    else if(q&&list.length<4)results.appendChild(h('p',{class:'muted small',text:'Only a few matches. Try the online search.'}));
    if(list.length>40)results.appendChild(h('p',{class:'muted small',text:'Showing 40 of '+list.length+'. Type more letters to narrow down.'}));
  }
  function busy(on){offBtns.forEach(function(b){b.disabled=on;b.textContent=on?'Search online (wait a few seconds)':b.getAttribute('data-label')})}
  function startOff(){
    var q=ctx.query.trim();offOut.replaceChildren();clearTimeout(slowTimer);
    if(q.length<2){offOut.appendChild(h('p',{class:'err',role:'alert',text:'Type what you want to find first (at least 2 letters).'}));return}
    if(typeof navigator!=='undefined'&&navigator.onLine===false){offOut.appendChild(h('p',{class:'err',role:'alert',id:'off-msg',text:'You seem to be offline. Online search needs the internet; you can still add the food as a custom food.'}));return}
    var handle={cancelled:false,ctl:null,done:false};cur=handle;busy(true);
    setTimeout(function(){if(botBtn.isConnected)busy(false)},OFF_COOLDOWN);
    offOut.appendChild(h('p',{class:'muted',id:'off-msg',role:'status',text:'Searching Open Food Facts...'}));
    slowTimer=setTimeout(function(){
      if(cur!==handle||handle.done||!offOut.isConnected)return;
      offOut.replaceChildren(h('div',{class:'row',id:'off-slow'},h('span',{class:'muted',id:'off-msg',role:'status',text:'Still searching... this can take a while.'}),
        h('button',{type:'button',class:'btn sm',id:'off-cancel',text:'Cancel',onclick:function(){handle.cancelled=true;try{if(handle.ctl)handle.ctl.abort()}catch(e){}offOut.replaceChildren(h('p',{class:'muted',id:'off-msg',role:'status',text:'Search cancelled.'}))}})));
    },OFF_SLOW);
    offSearch(q,handle).then(function(r){clearTimeout(slowTimer);handle.done=true;if(cur!==handle||handle.cancelled||!offOut.isConnected)return;offShow(r,q)});
  }
  function offShow(r,q){
    offOut.replaceChildren();
    if(r.status==='rate'){offOut.appendChild(h('p',{class:'err',role:'alert',id:'off-msg',text:'Too many searches. Please wait a minute and try again.'}));return}
    if(r.status!=='ok'){
      var T=r.tries||[],busy=T.some(function(x){return x.why==='http'}),to=T.some(function(x){return x.why==='timeout'}),net=T.some(function(x){return x.why==='network'});
      var why=busy?'The Open Food Facts server is busy or down right now ('+T.filter(function(x){return x.why==='http'}).map(function(x){return x.host.split('.')[0]+': HTTP '+x.code}).join(', ')+').':to?'Open Food Facts did not answer in '+Math.round(OFF_TIMEOUT/1000)+' seconds.':net?'The request did not get through: no internet, or the browser or a content blocker stopped it.':'Open Food Facts sent an answer this app could not read.';
      offOut.appendChild(h('div',{class:'err',role:'alert',id:'off-msg'},h('span',{text:why+' You can try again, or add the food yourself with "Add a custom food". '}),h('button',{type:'button',class:'btn sm',id:'off-retry',text:'Retry',onclick:function(){startOff()}})));return}
    if(!r.items.length){offOut.appendChild(h('p',{class:'muted',id:'off-msg',role:'status',text:'No usable matches online for "'+q+'" (foods with missing or odd values are hidden). Try other words, or add a custom food.'}));return}
    offOut.appendChild(h('p',{class:'muted small',id:'off-msg',role:'status',text:r.items.length+' online matches from Open Food Facts (values per 100 g, entered by volunteers: please check them).'}));
    r.items.forEach(function(it){
      var tags=[h('span',{class:'tag alt',text:'Open Food Facts'})];if(it.flag)tags.push(' ',h('span',{class:'tag',text:'check values'}));
      offOut.appendChild(h('button',{type:'button',class:'result off-result',onclick:function(){
        var ex=loadShared()['off_'+it.code];
        if(ex&&!ex.deleted){selectFood(ctx,sharedToFood(ex))}
        else{
          /* not saved yet: it is stored in My foods only when the log entry is saved (or via "Save to my foods") */
          var rec={id:'off_'+it.code,name:it.name,aliases:it.brand?[it.brand]:[],per100:it.per100,units:it.serving?{serving:it.serving}:{},source:'openfoodfacts',updatedAt:Date.now()};
          if(it.flag)rec.check=true;
          selectFood(ctx,sharedToFood(rec));ctx.pendingShared=rec;
        }
        render(true)}},
        h('span',null,h('b',{text:it.name}),' ',tags),
        h('span',{class:'muted small',style:'display:block',text:r0(it.per100.kcal)+' kcal - P '+r1(it.per100.p)+' / C '+r1(it.per100.c)+' / F '+r1(it.per100.f)+' g per 100 g'})));
    });
  }
  /* which meal the food goes to (these chips used to sit on Today) */
  var mealChips=h('div',{class:'chips',role:'group','aria-label':'Add food to a meal',id:'add-meals'});
  function drawMeals(){
    mealChips.replaceChildren();
    S.profile.slots.forEach(function(sl){mealChips.appendChild(h('button',{type:'button',class:'chip','data-add-slot':sl.id,'aria-pressed':ctx.slot===sl.id?'true':'false',text:'Add to '+sl.name,onclick:function(){ctx.slot=sl.id;drawMeals()}}))});
  }
  drawMeals();
  root.appendChild(h('div',{class:'card'},mealChips));
  root.appendChild(h('div',{class:'card'},h('label',{for:'q',style:'margin-top:0'},'Search food'),inp,topRow,offOut,status,results,
    h('div',{style:'margin-top:10px'},botBtn,h('p',{class:'muted small',id:'off-notice',text:'Your search words are sent to openfoodfacts.org.'})),
    h('button',{type:'button',class:'btn',style:'margin-top:10px',id:'custom-food-btn',text:'Add a custom food',onclick:function(){ctx.mode='custom';render(true)}})));
  fill();
  if(ctx.autoOnline){ctx.autoOnline=false;if(ctx.query.trim().length>=2)startOff()}
}
/* ---------- Open Food Facts (opt-in) ---------- */
function offNum(v){if(v===null||v===undefined||v==='')return NaN;var x=typeof v==='number'?v:parseFloat(String(v).replace(',','.'));return isFinite(x)?x:NaN}
function offNorm(p){
  if(!p||typeof p!=='object')return null;
  var code=String(p.code==null?'':p.code).trim();if(!/^[A-Za-z0-9]{3,30}$/.test(code))return null;
  var name=normName(p.product_name||p.product_name_en||'').slice(0,80);if(!name)return null;
  var brand=normName(String(p.brands||'').split(',')[0]).slice(0,30),n=p.nutriments;if(!n||typeof n!=='object')return null;
  var kcal=offNum(n['energy-kcal_100g']);if(isNaN(kcal)){var kj=offNum(n['energy_100g']);if(isNaN(kj))kj=offNum(n['energy-kj_100g']);kcal=isNaN(kj)?NaN:kj/4.184}
  var P=offNum(n['proteins_100g']),C=offNum(n['carbohydrates_100g']),F=offNum(n['fat_100g']),B=offNum(n['fiber_100g']);if(isNaN(B))B=0;
  if([kcal,P,C,F].some(isNaN)||kcal<0||kcal>900||P<0||C<0||F<0||B<0||P+C+F>100.5||B>100)return null;
  var atw=4*P+4*C+9*F,flag=Math.abs(atw-kcal)>0.3*Math.max(kcal,10);
  var sv=offNum(p.serving_quantity);if(!(sv>0&&sv<=5000))sv=0;
  var rd=function(x){return Math.round(x*10)/10};
  /* show the brand once: only add it when the product name does not already contain it */
  var full=brand&&name.toLowerCase().indexOf(brand.toLowerCase())<0&&(name+' ('+brand+')').length<=80?name+' ('+brand+')':name;
  return {code:code,name:full,brand:brand,per100:{kcal:rd(kcal),p:rd(P),c:rd(C),f:rd(F),fib:rd(B)},serving:sv?rd(sv):0,flag:flag};
}
function offFetch(url,handle){
  return new Promise(function(resolve){
    if(handle&&handle.cancelled){resolve({status:'cancelled'});return}
    var ctl=typeof AbortController!=='undefined'?new AbortController():null,done=false,host=url.replace(/^https:\/\//,'').split('/')[0];if(handle)handle.ctl=ctl;
    function finish(r){if(done)return;done=true;clearTimeout(timer);r.host=host;resolve(r)}
    var timer=setTimeout(function(){try{if(ctl)ctl.abort()}catch(e){}finish({status:'fail',why:'timeout'})},OFF_TIMEOUT);
    try{
      fetch(url,{signal:ctl?ctl.signal:undefined,credentials:'omit',referrerPolicy:'no-referrer'}).then(function(resp){
        if(resp.status===429){finish({status:'rate'});return}   /* only 429 means "too many searches"; 5xx are plain failures */
        if(!resp.ok){finish({status:'fail',why:'http',code:resp.status});return}
        return resp.text().then(function(txt){
          var d;try{d=JSON.parse(txt)}catch(e){finish({status:'fail',why:'badjson'});return}
          var arr=d&&Array.isArray(d.products)?d.products:d&&Array.isArray(d.hits)?d.hits:Array.isArray(d)?d:null;
          if(!arr){finish({status:'fail',why:'badjson'});return}
          var seen=Object.create(null),items=[];arr.slice(0,100).forEach(function(x){var it=offNorm(x);if(it&&!seen[it.code]){seen[it.code]=1;items.push(it)}});
          finish({status:'ok',items:items.slice(0,20)});
        });
      }).catch(function(){finish(handle&&handle.cancelled?{status:'cancelled'}:{status:'fail',why:'network'})});   /* TypeError: offline, DNS, CORS or content blocker */
    }catch(e){finish({status:'fail',why:'network'})}
  });
}
/* tries the servers in turn; the first one with usable results wins. If none answers, the result carries every reason (r.tries). */
function offSearch(q,handle){
  var qs=encodeURIComponent(q),f=encodeURIComponent(OFF_FIELDS);
  var urls=[OFF_PRIMARY+'?search_terms='+qs+'&search_simple=1&action=process&json=1&page_size=20&fields='+f,OFF_FALLBACK+'?q='+qs+'&page_size=20&fields='+f,OFF_THIRD+'?search_terms='+qs+'&search_simple=1&action=process&json=1&page_size=20&fields='+f];
  var tries=[],empty=null;
  function go(i){
    if(i>=urls.length)return Promise.resolve(empty||{status:'fail',tries:tries});
    return offFetch(urls[i],handle).then(function(r){
      if(r.status==='cancelled'||r.status==='rate')return r;
      if(r.status==='ok'){if(r.items.length)return r;empty=empty||r;return go(i+1)}
      tries.push({host:r.host,why:r.why,code:r.code});return go(i+1);
    });
  }
  return go(0);
}
/* "Edit as text": retype one entry in plain words ("2 roti", "dal 1 katori"); the words are read by the same parser as the log box. */
var UNIT_WORD={g:'g',ml:'ml',katori:'katori',glass:'glass',cup:'cup',plate:'plate',tbsp:'tbsp',tsp:'tsp',slice:'slice',handful:'handful',serving:'serving'};
function entryText(ctx){
  var f=ctx.food,short=String(f.name||'').split(/[(,\/]/)[0].trim().toLowerCase(),u=ctx.unit.kind,q=fmtQty(ctx.qty),lab=String(ctx.unit.label||'').split(/[\s(]/)[0].toLowerCase();
  if(u==='g')return q+(lab&&UNIT_SHOW[lab]?lab:'g')+' '+short;
  var w=lab&&UNIT_SHOW[lab]?UNIT_SHOW[lab]:UNIT_WORD[u];
  return q+' '+(w?w+' ':'')+short;
}
function readOneFood(text,ctx){
  var res=parseLog(text,{today:S.today,now:nowTime(),viewDate:ctx.date,date:ctx.date,saved:[],kg:70}),it=null,nf=0,nx=0;
  res.items.forEach(function(i){if(i.type==='food'&&i.foodId){nf++;if(!it)it=i}else if(i.type==='exercise')nx++});
  return {it:it,extra:Math.max(0,nf-1),exercise:nx>0&&!it,none:!it&&!nx};
}
function editAsText(ctx){
  var first=entryText(ctx),box=h('div',{class:'card',id:'edit-text-card'}),live=h('p',{class:'small',id:'et-live',role:'status','aria-live':'polite'}),applyBtn;
  var inp=h('input',{type:'text',id:'edit-text',maxlength:'120',value:first,autocomplete:'off','aria-label':'Edit as text',placeholder:'e.g. 2 roti or dal 1 katori'});
  var cur=null;
  function upd(){
    cur=null;applyBtn.disabled=true;live.replaceChildren();
    var t=inp.value.trim();
    if(!t||t===first){live.textContent=t?'This is what the entry says now.':'';return}
    var r=readOneFood(t,ctx);
    if(r.exercise){live.textContent='That looks like exercise, not food. Add it from the log box instead.';return}
    if(!r.it){live.textContent='No food found in those words. Try a name and an amount, like "2 roti".';return}
    cur=r.it;applyBtn.disabled=false;
    live.appendChild(h('b',{id:'et-food',text:r.it.foodName}));
    live.appendChild(document.createTextNode(' \u00b7 '+qtyText(r.it)+' \u00b7 '));
    live.appendChild(h('b',{id:'et-kcal',text:r0(r.it.kcal)+' kcal'}));
    if(r.it.flag==='check'||r.it.score<0.8)live.appendChild(h('span',{class:'tag',style:'margin-left:6px',text:'Check'}));
    if(r.extra)live.appendChild(h('span',{class:'muted',id:'et-extra',text:' Only the first food is used ('+r.extra+' more ignored).'}));
    if(ctx.adj)live.appendChild(h('span',{class:'muted',id:'et-adj',text:' Your hand-adjusted calories will be reset if you save this; you will be asked first.'}));
  }
  applyBtn=h('button',{type:'button',class:'btn',id:'et-apply',disabled:true,text:'Use this',onclick:function(){
    if(!cur)return;var f=findFood(cur.foodId);if(!f)return;
    ctx.food=f;ctx.unit={kind:cur.unit,label:cur.unitLabel,grams:cur.unitG};ctx.qty=cur.qty;render(true);
  }});
  inp.addEventListener('input',upd);
  box.appendChild(h('label',{for:'edit-text',style:'margin-top:0'},'Edit as text',h('span',{class:'hint',text:'Retype this entry in your own words. Date, time and meal stay as they are.'})));
  box.appendChild(h('div',{class:'row'},h('div',{class:'grow'},inp),applyBtn));
  box.appendChild(live);
  return box;
}
function addForm(root,ctx){
  var f=ctx.food,units=unitsFor(f),err=h('p',{class:'err',role:'alert'}),prev=h('div',{id:'preview','aria-live':'polite'});
  /* an entry's own unit (as typed: bowl, ml...) stays selectable next to the usual alternatives */
  if(ctx.editId&&!units.some(function(u){return u.kind===ctx.unit.kind&&u.label===ctx.unit.label}))units.splice(1,0,ctx.unit);
  function pendingBox(){
    var box=h('div',{id:'pending-box',class:'small muted',style:'margin-top:6px'},h('span',{text:'Not saved to My foods yet (it is saved when you add this entry). '}),
      h('button',{type:'button',class:'btn sm',id:'save-to-myfoods',text:'Save to my foods',onclick:function(){
        if(ctx.pendingShared&&putShared(ctx.pendingShared)){ctx.pendingShared=null;box.replaceChildren(h('span',{text:'Saved to My foods.'}));toast('Saved to My foods')}}}));
    return box;
  }
  var qty=h('input',{type:'number',id:'qty',inputmode:'decimal',step:'any',min:'0',value:String(ctx.qty),'aria-label':'Quantity',oninput:function(){ctx.qty=parseFloat(qty.value);upd()}});
  function step(dir){var st=ctx.unit.kind==='g'?10:0.5,v=(isNaN(ctx.qty)?0:ctx.qty)+dir*st;v=Math.max(0,Math.round(v*100)/100);ctx.qty=v;qty.value=String(v);upd()}
  var chips=h('div',{class:'chips',role:'group','aria-label':'Unit'});
  function drawChips(){chips.replaceChildren();units.forEach(function(u){chips.appendChild(h('button',{type:'button',class:'chip','aria-pressed':u===ctx.unit||(u.kind===ctx.unit.kind&&u.label===ctx.unit.label)?'true':'false',
    onclick:function(){var wasG=ctx.unit.kind==='g';ctx.unit=u;if(u.kind==='g'&&!wasG)ctx.qty=100;else if(u.kind!=='g'&&wasG)ctx.qty=1;qty.value=String(ctx.qty);drawChips();upd()},text:u.label==='g'?'g (grams)':u.label}))})}
  var date=h('input',{type:'date',id:'adate',value:ctx.date,max:S.today,onchange:function(){if(isDate(date.value))ctx.date=date.value}});
  var tpick=timePicker({value:ctx.time,label:'Time you ate',idPrefix:'atime',onChange:function(v){ctx.time=v||'';ctx.timeTouched=true}});
  var slotBox=h('div',{id:'aslot'}),slotErr=h('p',{class:'err',role:'alert'});
  function curSlotName(){var s=S.profile.slots.filter(function(x){return x.id===ctx.slot})[0];return s?s.name:(ctx.slotName||'Other meal')}
  function drawSlots(focusNew){
    slotBox.replaceChildren();
    var chipsEl=h('div',{class:'chips',role:'group','aria-label':'Meal'}),live=S.profile.slots;
    if(!live.some(function(s){return s.id===ctx.slot}))chipsEl.appendChild(h('button',{type:'button',class:'chip','aria-pressed':'true','data-slot':ctx.slot,text:curSlotName()+' (removed)'}));
    live.forEach(function(s){chipsEl.appendChild(h('button',{type:'button',class:'chip','data-slot':s.id,'aria-pressed':s.id===ctx.slot?'true':'false',text:s.name,onclick:function(){ctx.slot=s.id;ctx.slotName=s.name;ctx.newSlotOpen=false;drawSlots();saveBtn.textContent=btnText()}}))});
    chipsEl.appendChild(h('button',{type:'button',class:'chip',id:'new-slot-chip','aria-expanded':ctx.newSlotOpen?'true':'false',text:'+ New meal slot',onclick:function(){ctx.newSlotOpen=!ctx.newSlotOpen;drawSlots(true)}}));
    slotBox.appendChild(chipsEl);
    if(ctx.newSlotOpen){
      var ni=h('input',{type:'text',id:'new-slot-name',maxlength:'30','aria-label':'Name for the new meal slot',placeholder:'e.g. Pre-workout',autocomplete:'off',
        onkeydown:function(ev){if(ev.key==='Enter'){ev.preventDefault();go()}}});
      function go(){
        var r=createSlot(ni.value);if(r.err){slotErr.textContent=r.err;ni.focus();return}
        var ns=r.slot;
        ctx.slot=ns.id;ctx.slotName=ns.name;ctx.newSlotOpen=false;slotErr.textContent='';drawSlots();saveBtn.textContent=btnText();
      }
      slotBox.appendChild(h('div',{class:'row',style:'margin-top:8px'},h('div',{class:'grow'},ni),h('button',{type:'button',id:'new-slot-add',class:'btn',text:'Add slot',onclick:go})));
      if(focusNew)ni.focus();
    }
    slotBox.appendChild(slotErr);
  }
  function btnText(){return ctx.editId?'Save changes':'Add to '+curSlotName()}
  function grams(){return ctx.qty*ctx.unit.grams}
  function upd(){
    var g=grams(),ok=isFinite(g)&&g>0&&g<=5000;prev.replaceChildren();
    if(!ok){prev.appendChild(h('p',{class:'muted',text:'Enter an amount between 0 and 5000 g.'}));return}
    var n={kcal:f.per100.kcal*g/100,p:f.per100.p*g/100,c:f.per100.c*g/100,f:f.per100.f*g/100};
    prev.appendChild(h('p',null,h('b',{id:'pv-kcal',text:r0(n.kcal)+' kcal'}),' for '+(function(){var lb=ctx.unit.kind==='g'?ctx.unit.label:'g';return lb==='ml'?fmtQty(ctx.qty)+' ml':lb==='g'?r0(g*10)/10+' g':lb==='l'||lb==='kg'?fmtQty(ctx.qty)+' '+lb:r0(g*10)/10+' g'})()));
    prev.appendChild(h('p',{class:'muted',id:'pv-macros',text:'Protein '+r1(n.p)+' g, carbs '+r1(n.c)+' g, fat '+r1(n.f)+' g'}));
  }
  function submit(){
    var wasWarn=!!err.querySelector('#adj-warn');err.textContent='';var g=grams();if(!wasWarn)ctx.adjOk=false;
    if(!isFinite(ctx.qty)||ctx.qty<=0){err.textContent='Enter how much you ate (more than 0).';qty.focus();return}
    if(g>5000){err.textContent='That is more than 5000 g. Please check the amount.';qty.focus();return}
    if(!isDate(ctx.date)||ctx.date>S.today){err.textContent='Pick a valid date that is not in the future.';return}
    if(!/^\d\d:\d\d$/.test(ctx.time)){err.textContent='Enter a valid time.';tpick.validate();return}
    /* Untouched time that is now stale (more than 10 minutes old, logging for today): use the current time. Edited times are never changed. */
    if(!ctx.editId&&!ctx.timeTouched&&ctx.date===S.today){
      var nt=nowTime(),mins=function(x){return (+x.slice(0,2))*60+(+x.slice(3))};
      if(mins(nt)-mins(ctx.time)>10)ctx.time=nt;
    }
    var e={id:ctx.editId||uuid(),date:ctx.date,time:ctx.time,slot:ctx.slot,slotName:curSlotName(),foodId:f.id,foodName:f.name,qty:Math.round(ctx.qty*100)/100,unit:ctx.unit.kind,unitLabel:ctx.unit.label,unitG:ctx.unit.grams,
      grams:Math.round(g*100)/100,per100:{kcal:f.per100.kcal,p:f.per100.p,c:f.per100.c,f:f.per100.f,fib:f.per100.fib},updatedAt:Date.now(),createdAt:ctx.createdAt||Date.now()};
    if(ctx.logId)e.logId=ctx.logId;
    /* an AI estimate keeps its AI tag while it is still the same entry (amount edits only scale it) */
    if(ctx.est&&ctx.orig&&ctx.orig.foodId===f.id)e.est=ctx.est;
    /* hand-adjusted calories stay unless the food or the amount changed; then the user is asked first */
    if(ctx.adj){
      var o=ctx.orig||{},changed=o.foodId!==f.id||Math.abs((o.grams||0)-e.grams)>0.005;
      if(changed&&!ctx.adjOk){
        err.textContent='';err.appendChild(h('span',{id:'adj-warn',text:'This entry has hand-adjusted calories. Saving a different food or amount resets them to calculated values. Tap Save again to continue.'}));ctx.adjOk=true;return;
      }
      if(!changed)e.adj=ctx.adj;
    }
    if(ctx.editId&&ctx.editDate!==ctx.date)removeEntry(S.profile.id,ctx.editId,ctx.editDate);
    putEntry(S.profile.id,e);
    if(ctx.pendingShared){var pe=loadShared()[ctx.pendingShared.id];if(!pe||pe.deleted)putShared(ctx.pendingShared);ctx.pendingShared=null}
    S.viewDate=ctx.date;S.add=null;S.tab='today';render(true);toast((ctx.editId?'Saved ':'Added ')+f.name);
  }
  if(ctx.editId)root.appendChild(editAsText(ctx));
  root.appendChild(h('div',{class:'card'},
    h('div',{class:'row between'},h('div',{class:'grow'},foodLine(f),ctx.est==='ai'&&!ctx.adj?h('span',{class:'tag ai',id:'ai-tag',title:'Calories and macros estimated by AI',text:'AI'}):null),ctx.editId?null:h('button',{type:'button',class:'btn sm',text:'Change food',onclick:function(){ctx.food=null;render(true)}})),
    f.check?h('p',{class:'small',id:'check-warning',role:'note',text:'Check values: the energy does not match protein, carbs and fat. Online values are entered by volunteers, so please compare with the pack.'}):null,
    ctx.pendingShared?pendingBox():null,
    ctx.editId?null:h('button',{type:'button',class:'btn sm',id:'edit-food',style:'margin-top:6px',text:'Edit this food',onclick:function(){S.myFoods={mode:'edit',id:f.id,returnToAdd:true};S.tab='myfoods';render(true)}}),
    h('label',{for:'qty'},'How much?'),
    h('div',{class:'stepper'},h('button',{type:'button',class:'btn','aria-label':'Decrease quantity',text:'\u2212',onclick:function(){step(-1)}}),qty,h('button',{type:'button',class:'btn','aria-label':'Increase quantity',text:'+',onclick:function(){step(1)}})),
    h('label',null,'Unit'),chips,
    h('label',{for:'adate'},'Date'),date,
    h('label',null,'Time you ate'),tpick.el,
    h('label',null,'Meal',h('span',{class:'hint',text:'Meals have no fixed times. Pick one, or make your own.'})),slotBox,
    h('div',{class:'card',style:'margin:12px 0 0;background:var(--accent-soft)'},prev),
    f.kind==='dish'&&f.est?h('p',{class:'small muted',text:'Cooked-dish values are estimates and vary with recipe and portion size.'}):null,
    null));
  var saveBtn=h('button',{type:'button',id:'save-entry',class:'btn primary grow',text:btnText(),onclick:submit});
  root.appendChild(h('div',{class:'sticky-actions'},err,h('div',{class:'row'},saveBtn,
    h('button',{type:'button',class:'btn',text:'Cancel',onclick:function(){S.add=null;S.tab='today';render(true)}}))));
  drawChips();drawSlots();upd();
}
/* One form for creating a food, editing a shared food, or editing a built-in food (creates an override). */
var FORM_UNITS=[['katori','Katori (g)'],['glass','Glass (g)'],['piece','Piece (g)'],['serving','Serving (g)'],['tbsp','Tablespoon (g)'],['tsp','Teaspoon (g)']];
function foodForm(o){
  var f=o.food||{},n=f.per100||{},u=f.units||{},err=h('p',{class:'err',role:'alert',id:'c-err'}),F={};
  function num(id,label,val,hint){var i=h('input',{type:'number',id:'c-'+id,inputmode:'decimal',step:'any',min:'0',value:val==null?'':String(val)});F[id]=i;return h('div',null,h('label',{for:'c-'+id},label,hint?h('span',{class:'hint',text:hint}):null),i)}
  var name=h('input',{type:'text',id:'c-name',maxlength:'80',autocomplete:'off',value:f.name||''});
  var box=h('div',{class:'card',id:'food-form'},h('h2',{text:o.title}),h('p',{class:'muted',text:'Enter values per 100 g, usually from the pack label.'}),
    h('label',{for:'c-name'},'Food name'),name,
    h('div',{class:'field-grid'},num('kcal','Calories (kcal)',n.kcal),num('p','Protein (g)',n.p),num('c','Carbs (g)',n.c),num('f','Fat (g)',n.f),num('fib','Fibre (g)',n.fib,'optional')),
    h('h3',{style:'margin-top:12px',text:'Household units (optional)'}),h('p',{class:'muted small',text:'How many grams one is, so you can log by the piece or katori.'}),
    h('div',{class:'field-grid'},FORM_UNITS.map(function(k){return num('u-'+k[0],k[1],u[k[0]])})),err,
    h('div',{class:'row',style:'margin-top:8px'},h('button',{type:'button',id:'c-save',class:'btn primary grow',text:'Save food',onclick:function(){
      err.textContent='';var nm=normName(name.value);
      if(!nm){err.textContent='Give the food a name.';name.focus();return}
      if(nm.length>80){err.textContent='Names can be up to 80 characters.';return}
      function v(id,max,req,label){var s=F[id].value.trim();if(s===''){if(req){err.textContent='Fill in '+label+'.';return null}return 0}var x=parseFloat(s);if(!isFinite(x)||x<0||x>max){err.textContent='Check '+label+' (0 to '+max+').';return null}return x}
      var kcal=v('kcal',900,true,'calories');if(kcal==null)return;var P=v('p',100,true,'protein');if(P==null)return;var C=v('c',100,true,'carbs');if(C==null)return;var Fa=v('f',100,true,'fat');if(Fa==null)return;var fib=v('fib',100,false,'fibre');if(fib==null)return;
      if(P+C+Fa>100.5){err.textContent='Protein, carbs and fat per 100 g cannot add up to more than 100 g.';return}
      var units=Object.assign({},u);
      for(var i=0;i<FORM_UNITS.length;i++){var k=FORM_UNITS[i][0],s=F['u-'+k].value.trim();
        if(s===''){delete units[k];continue}var g=parseFloat(s);if(!isFinite(g)||g<0.1||g>5000){err.textContent='Check the '+FORM_UNITS[i][1].toLowerCase()+' (0.1 to 5000).';return}units[k]=g}
      var rec=Object.assign({},o.base,{name:nm,per100:{kcal:kcal,p:P,c:C,f:Fa,fib:fib},units:units,updatedAt:Date.now()});delete rec.deleted;
      o.onSave(rec)}}),
      h('button',{type:'button',class:'btn',text:'Back',onclick:o.onCancel})));
  return box;
}
function addCustom(root,ctx){
  root.appendChild(foodForm({title:'Add a custom food',food:null,base:{id:'c_'+uuid(),source:'custom',aliases:[]},
    onSave:function(rec){if(!putShared(rec))return;ctx.mode='form';selectFood(ctx,sharedToFood(rec));render(true)},
    onCancel:function(){ctx.mode='search';render(true)}}));
}

/* ---------- MY FOODS (shared list) + food packs ---------- */
function builtinToForm(f){return {name:f.name,per100:f.per100,units:unitsArrToMap(f.units)}}
function viewMyFoods(root){
  if(!S.myFoods)S.myFoods={mode:'list'};
  var st=S.myFoods,m=loadShared(),pm=loadPackMeta();
  function back(){var ra=st.returnToAdd;S.myFoods=ra?null:{mode:'list'};if(!ra)S.tab='myfoods';if(ra){S.tab='add';var c=S.add;if(c&&c.food&&st.id===c.food.id){var nf=findFood(st.id);if(nf)selectFood(c,nf)}}render(true)}
  if(st.mode==='edit'){
    var cur=m[st.id]&&!m[st.id].deleted?m[st.id]:null,bi=FOODBYID[st.id]||null,legacy=!cur&&!bi?loadCustom(S.profile.id).filter(function(x){return x.id===st.id})[0]:null;
    root.appendChild(h('h2',{text:'Edit food'}));
    var form,base,food;
    if(cur){base=Object.assign({},cur);food={name:cur.name,per100:cur.per100,units:cur.units}}
    else if(bi){base={id:bi.id,source:'override',overrides:bi.id,aliases:[]};food=builtinToForm(bi)}
    else if(legacy){base={id:legacy.id,source:'custom',aliases:[]};food={name:legacy.name,per100:legacy.per100,units:unitsArrToMap(legacy.units)}}
    else if(st.id==null){base={id:'c_'+uuid(),source:'custom',aliases:[]};food=null}
    else{root.appendChild(h('p',{text:'That food could not be found.'}));S.myFoods=null;return}
    if(bi&&!cur)root.appendChild(h('p',{class:'muted',text:'This is a built-in food. Saving creates your own version that replaces the original in search. Old log entries keep the numbers they were saved with.'}));
    root.appendChild(foodForm({title:st.id==null?'Add a food':'Food details',food:food,base:base,onSave:function(rec){delete rec.origin;delete rec.check;if(rec.source==='pack')rec.source='custom';if(putShared(rec)){toast('Saved '+rec.name);back()}},onCancel:back}));
    return;
  }
  root.appendChild(h('div',{class:'row between'},h('h2',{style:'margin:0',text:'Your foods'}),h('button',{type:'button',class:'btn',id:'myfoods-back',text:'Back to Today',onclick:function(){S.myFoods=null;goto('today')}})));
  root.appendChild(h('p',{class:'muted',text:'Foods you add, edit or find online are saved on this device and shown first in search. To get updates from someone, ask them to Export food pack and send you the file.'}));
  root.appendChild(h('p',{class:'muted small',id:'clock-note',text:'When two lists differ, the newest edit wins. This uses each phone\'s clock, so keep your phone\'s date and time correct.'}));
  var imp=pm.lastPackImport;
  root.appendChild(h('p',{class:'small',id:'last-pack'},imp?'Food list from '+(imp.packName||'a shared pack')+' v'+imp.revision+(imp.exportedAt?', updated '+new Date(imp.exportedAt).toLocaleDateString():'')+'.':'No food pack imported yet.'));
  /* pack tools */
  var pname=h('input',{type:'text',id:'pack-name',maxlength:'40',value:pm.packName,'aria-label':'Pack name'}),pout=h('div',{id:'pack-out','aria-live':'polite'});
  var pfile=h('input',{type:'file',id:'pack-file',accept:'.json,application/json','aria-label':'Choose a food pack file to import',onchange:function(){
    pout.replaceChildren();var f=pfile.files&&pfile.files[0];if(!f)return;
    if(f.size>2*1024*1024){pout.appendChild(h('p',{class:'err',role:'alert',id:'pack-error',text:'That file is too big to be a food pack (over 2 MB).'}));return}
    var rd=new FileReader();rd.onerror=function(){pout.appendChild(h('p',{class:'err',role:'alert',id:'pack-error',text:'The file could not be opened.'}))};
    rd.onload=function(){try{var r=importPack(String(rd.result));pfile.value='';render();var o2=$('#pack-out');if(o2)o2.appendChild(h('div',{class:'banner info',id:'pack-summary',role:'status'},h('b',{text:'Food pack imported: '}),r.summary))}
      catch(e){pout.replaceChildren(h('p',{class:'err',role:'alert',id:'pack-error',text:e.message}))}};
    rd.readAsText(f);}});
  root.appendChild(h('section',{class:'card',id:'pack-card'},h('h2',{text:'Share your food list'}),
    h('label',{for:'pack-name',style:'margin-top:0'},'Pack name'),pname,
    h('div',{class:'row',style:'margin-top:8px'},h('button',{type:'button',class:'btn primary',id:'export-pack',text:'Export food pack',onclick:function(){exportPack(pname.value)}})),
    h('label',{for:'pack-file'},'Import food pack'),pfile,
    h('p',{class:'muted small',text:'Importing only adds or updates foods. It never changes your profiles or your log.'}),pout));
  /* list */
  var list=sharedList(),ul=h('ul',{class:'plain',id:'myfoods-list'});
  if(!list.length)ul.appendChild(h('li',{class:'muted',text:'You have no saved foods yet.'}));
  list.forEach(function(c){
    var isOv=!!c.overrides;
    ul.appendChild(h('li',{class:'entry','data-id':c.id},
      h('div',{class:'main'},h('b',{text:c.name}),' ',h('span',{class:'tag alt',text:c.origin==='pack'?'Shared pack':isOv?'Edited built-in':srcTag(c)}),
        h('div',{class:'muted small',text:r0(c.per100.kcal)+' kcal - P '+r1(c.per100.p)+' / C '+r1(c.per100.c)+' / F '+r1(c.per100.f)+' g per 100 g'})),
      h('button',{type:'button',class:'btn sm','aria-label':'Edit '+c.name,text:'Edit',onclick:function(){S.myFoods={mode:'edit',id:c.id};render(true)}}),
      h('button',{type:'button',class:'btn sm danger','aria-label':(isOv?'Restore original of ':'Delete ')+c.name,text:isOv?'Restore original':'Delete',onclick:function(){
        var old=c,mm=copyShared();mm[c.id]=Object.assign({},c,{deleted:true,updatedAt:Date.now()});saveShared(mm);render();
        toast((isOv?'Restored original: ':'Deleted ')+c.name,'Undo',function(){var m2=copyShared();m2[old.id]=Object.assign({},old,{updatedAt:Date.now()});saveShared(m2);render()})}})));
  });
  root.appendChild(h('section',{class:'card',id:'myfoods-card'},h('h2',{text:'Your saved foods'}),ul,
    h('button',{type:'button',class:'btn',id:'myfood-new',style:'margin-top:10px',text:'Add a food',onclick:function(){S.myFoods={mode:'edit',id:null};render(true)}})));
  /* edit a built-in */
  var res=h('ul',{class:'plain',id:'mf-results'}),si=h('input',{type:'search',id:'mf-search',autocomplete:'off',placeholder:'e.g. roti, milk, banana','aria-label':'Search built-in foods to edit',oninput:function(){
    res.replaceChildren();var q=si.value.trim();if(q.length<2)return;
    search(q,S.profile.id).filter(function(x){return x.kind==='dish'||x.kind==='raw'}).slice(0,8).forEach(function(x){
      res.appendChild(h('li',{class:'entry'},h('div',{class:'main'},foodLine(x)),h('button',{type:'button',class:'btn sm','aria-label':'Edit this food: '+x.name,text:'Edit this food',onclick:function(){S.myFoods={mode:'edit',id:x.id};render(true)}})))})}});
  root.appendChild(h('section',{class:'card'},h('h2',{text:'Change a built-in food'}),h('p',{class:'muted small',text:'Find a food and tap Edit this food to make your own version with your numbers.'}),si,res));
}
function exportPack(nameVal){
  var pm=loadPackMeta(),m=loadShared();pm.packName=normName(nameVal||pm.packName).slice(0,40)||'My foods';pm.revision+=1;
  var foods=Object.keys(m).map(function(k){return m[k]}),hasOff=foods.some(function(c){return !c.deleted&&c.source==='openfoodfacts'});
  var pack={type:'dt-foodpack',format:1,packName:pm.packName,revision:pm.revision,exportedAt:new Date().toISOString(),foods:foods,credits:hasOff?['Open Food Facts (ODbL)']:[]};
  savePackMeta(pm);
  download(pack,'diet-foods-'+(pm.packName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'pack')+'-'+todayStr()+'.json');
  toast('Food pack downloaded (version '+pm.revision+')');
}
function parsePack(text){
  var o;try{o=JSON.parse(text)}catch(e){throw new Error('That file could not be read. It is not a valid food pack (the JSON is broken).')}
  if(!o||typeof o!=='object'||o.type!=='dt-foodpack')throw new Error('This is not a Diet Tracker food pack file.');
  if(o.format!==1)throw new Error('This food pack was made by a newer version of the app and cannot be read here.');
  if(!Array.isArray(o.foods))throw new Error('This food pack has no foods in it.');
  if(o.foods.length>5000)throw new Error('This food pack has too many foods (the limit is 5000).');
  var foods=[],bad=0;o.foods.forEach(function(f){var c=cleanSharedFood(f);if(c){if(c.source==='custom')c.source='pack';c.origin='pack';foods.push(c)}else bad++});
  return {foods:foods,bad:bad,packName:normName(o.packName||'').slice(0,40)||'Shared pack',revision:numIn(o.revision,0,1e9)?Math.floor(o.revision):0,exportedAt:typeof o.exportedAt==='string'?o.exportedAt.slice(0,40):''};
}
function importPack(text){
  var pk2=parsePack(text),m=copyShared(),st=mergeSharedInto(m,pk2.foods);
  if(!saveShared(m))throw new Error('The foods could not be saved (storage may be full).');
  var pm=loadPackMeta();pm.lastPackImport={packName:pk2.packName,revision:pk2.revision,exportedAt:pk2.exportedAt};savePackMeta(pm);
  return {stat:st,bad:pk2.bad,summary:'+'+st.added+' new, '+st.updated+' updated, '+st.removed+' removed, '+st.older+' skipped (older)'+(pk2.bad?', '+pk2.bad+' invalid skipped':'')};
}
function updateCredit(){
  var el=$('#off-credit');if(!el)return;var m=loadShared();
  el.hidden=false;   /* the credit is always shown (About) */
}

/* ---------- HISTORY ---------- */
function viewHistory(root){
  var p=S.profile,byDate={};
  allEntries(p.id).forEach(function(e){(byDate[e.date]=byDate[e.date]||[]).push(e)});
  var dates=Object.keys(byDate).sort().reverse();
  if(!dates.length){root.appendChild(h('div',{class:'card'},h('p',{text:'No days logged yet. Type what you ate in the box at the bottom of Today.'})));return}
  var shown=S.histAll?dates:dates.slice(0,30);
  shown.forEach(function(d){
    var info=dayInfo(p,d),kcal=info.tot.kcal,ratio=kcal/info.c.target;
    var b=ratio<0.9?['under','Under target']:ratio<=1.1?['on','On target']:['over','Over target'];
    root.appendChild(h('section',{class:'card','aria-label':fmtDate(d)},
      h('div',{class:'row between'},h('h3',{text:fmtDate(d)+(d===S.today?' (today)':'')}),h('span',{class:'badge '+b[0],text:b[1]})),
      h('p',null,h('b',{text:r0(kcal)+' kcal'}),' of '+r0(info.c.target)+' target - '+byDate[d].length+(byDate[d].length===1?' item':' items')),
      h('div',{class:'row'},
        h('button',{type:'button',class:'btn sm',text:'Open',onclick:function(){S.viewDate=d;S.tab='today';render(true)}}),
        d!==S.today?h('button',{type:'button',class:'btn sm',text:'Copy to today',onclick:function(){
          var now=Date.now();byDate[d].forEach(function(e){var c=JSON.parse(JSON.stringify(e));delete c.logId;c.id=uuid();c.date=S.today;c.updatedAt=now;c.createdAt=now;putEntry(p.id,c)});
          toast('Copied '+byDate[d].length+' items to today');}}):null)));
  });
  if(!S.histAll&&dates.length>30)root.appendChild(h('button',{type:'button',class:'btn',text:'Show older days',onclick:function(){S.histAll=true;render()}}));
}

/* ---------- WEIGHT TRACKER ---------- */
var WT_RANGES=[['week','Week',7],['month','Month',30],['year','Year',365],['all','All time',0]];
function fmtLongDate(d){var t=parseD(d);return t.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
/* "nice" axis: ticks at a round step that cover [lo,hi] */
function niceAxis(lo,hi){
  var span=Math.max(hi-lo,1),steps=[0.5,1,2,2.5,5,10,20,25,50],st=steps[steps.length-1],i;
  for(i=0;i<steps.length;i++){if(span/steps[i]<=5){st=steps[i];break}}
  var a=Math.floor(lo/st)*st,b=Math.ceil(hi/st)*st,ticks=[],v;
  if(b-a<st*2)b=a+st*2;
  for(v=a;v<=b+1e-9;v+=st)ticks.push(Math.round(v*100)/100);
  return {lo:a,hi:b,ticks:ticks};
}
function weightChartSvg(pts,target,win,fallbackKg){
  var W=340,H=220,L=36,R=12,T=12,B=28,vals=pts.map(function(q){return q.kg});
  if(target!=null)vals.push(target);
  if(!vals.length)vals.push(fallbackKg);
  var lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals),pad=Math.max((hi-lo)*0.15,1);
  var ax=niceAxis(lo-pad,hi+pad);
  var t0=parseD(win[0]).getTime(),t1=parseD(win[1]).getTime();if(t1<=t0)t1=t0+864e5;
  function X(d){return L+(parseD(d).getTime()-t0)/(t1-t0)*(W-L-R)}
  function Y(v){return T+(H-T-B)*(1-(v-ax.lo)/(ax.hi-ax.lo))}
  var sv=s('svg',{class:'wtchart',id:'wt-chart',viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Weight chart: '+pts.length+(pts.length===1?' weigh-in':' weigh-ins')+' from '+fmtDM(win[0])+' to '+fmtDM(win[1])+(target!=null?'. Target '+target+' kg.':'.')});
  ax.ticks.forEach(function(v){
    sv.appendChild(s('line',{class:'grid',x1:L,x2:W-R,y1:Y(v),y2:Y(v)}));
    sv.appendChild(s('text',{class:'ytick',x:L-5,y:Y(v)+3.5,'text-anchor':'end',text:String(v)}));
  });
  var n=5,long=(t1-t0)/864e5>75;
  for(var k=0;k<n;k++){
    var tm=t0+(t1-t0)*k/(n-1),dd=new Date(tm),x=L+(W-L-R)*k/(n-1);
    sv.appendChild(s('line',{class:'grid',x1:x,x2:x,y1:T,y2:H-B}));
    var lbl=long?dd.toLocaleDateString('en-GB',{month:'short',year:'2-digit'}):dd.getDate()+' '+dd.toLocaleDateString('en-GB',{month:'short'});
    sv.appendChild(s('text',{class:'xtick',x:k===0?x:k===n-1?x:x,y:H-B+14,'text-anchor':k===0?'start':k===n-1?'end':'middle',text:lbl}));
  }
  sv.appendChild(s('line',{class:'axis',x1:L,x2:L,y1:T,y2:H-B}));sv.appendChild(s('line',{class:'axis',x1:L,x2:W-R,y1:H-B,y2:H-B}));
  if(target!=null){
    sv.appendChild(s('line',{class:'tgt',id:'wt-target-line',x1:L,x2:W-R,y1:Y(target),y2:Y(target)}));
    sv.appendChild(s('text',{class:'tgt-label',x:W-R-2,y:Y(target)-4,'text-anchor':'end',text:'Target '+target}));
  }
  if(pts.length>1)sv.appendChild(s('polyline',{class:'ln',id:'wt-line',points:pts.map(function(q){return X(q.date).toFixed(1)+','+Y(q.kg).toFixed(1)}).join(' ')}));
  pts.forEach(function(q){sv.appendChild(s('circle',{class:'pt',cx:X(q.date).toFixed(1),cy:Y(q.kg).toFixed(1),r:pts.length>60?2:3.5}))});
  return sv;
}
function openWeightSheet(p,w,opener){
  var editing=!!w;
  openSheet({title:editing?'Edit weight':'Add weight',opener:opener,id:'wt-sheet',build:function(body,close){
    var ws=loadWeights(p.id),err=h('p',{class:'err',role:'alert',id:'w-err'});
    var kg=h('input',{type:'number',id:'w-kg',inputmode:'decimal',step:'0.1',min:'20',max:'300',value:String(editing?w.kg:(ws.length?ws[ws.length-1].kg:p.startKg)),'data-autofocus':'1'});
    var dt=h('input',{type:'date',id:'w-date',value:editing?w.date:S.today,max:S.today});
    var tp=timePicker({value:editing&&w.time?w.time:nowTime(),label:'Time',idPrefix:'wt'});
    body.appendChild(h('label',{for:'w-kg',style:'margin-top:0'},'Weight (kg)'));body.appendChild(kg);
    body.appendChild(h('label',{for:'w-date'},'Date'));body.appendChild(dt);
    body.appendChild(h('label',null,'Time'));body.appendChild(tp.el);body.appendChild(err);
    function save(){
      err.textContent='';var v=parseFloat(kg.value);
      if(!isFinite(v)||v<20||v>300){err.textContent='Weight must be between 20 and 300 kg.';kg.focus();return}
      if(!isDate(dt.value)||dt.value>S.today){err.textContent='Pick a valid date that is not in the future.';return}
      var tv=tp.get();if(!tv){tp.validate();return}
      var a=loadWeights(p.id).filter(function(x){return x.date!==dt.value&&!(editing&&x.date===w.date)});
      a.push({date:dt.value,kg:Math.round(v*10)/10,time:tv,updatedAt:Date.now()});
      saveWeights(p.id,a);close(false);render();toast(editing?'Weight updated':'Weight saved');
    }
    var row=h('div',{class:'row',style:'margin-top:12px'},h('button',{type:'button',id:'w-save',class:'btn primary grow',text:'Save weight',onclick:save}),
      editing?h('button',{type:'button',id:'w-delete',class:'btn danger','aria-label':'Delete weight on '+fmtDate(w.date),text:'Delete',onclick:function(){
        var old=w;saveWeights(p.id,loadWeights(p.id).filter(function(x){return x.date!==old.date}));close(false);render();
        toast('Weight deleted','Undo',function(){var a=loadWeights(p.id).filter(function(x){return x.date!==old.date});a.push(old);saveWeights(p.id,a);render()});
      }}):null,
      h('button',{type:'button',class:'btn',id:'w-cancel',text:'Cancel',onclick:function(){close()}}));
    body.appendChild(row);
  }});
}
function viewWeight(root){
  var p=S.profile,ws=loadWeights(p.id),rk=S.wtRange||'month';
  var rg=WT_RANGES.filter(function(r){return r[0]===rk})[0]||WT_RANGES[1];
  root.appendChild(h('div',{class:'wt-head'},h('h2',{text:'Your weight'}),h('button',{type:'button',class:'icon-btn',id:'wt-add','aria-label':'Add weight',onclick:function(ev){openWeightSheet(p,null,ev.currentTarget)}},icon(ICONS.plus))));
  var cur=ws.length?ws[ws.length-1].kg:p.startKg,tg=p.targetWeightKg!=null?p.targetWeightKg:null;
  root.appendChild(h('div',{class:'wt-cards'},
    h('section',{class:'card','aria-label':'Current weight'},h('span',{class:'muted small',text:'Current weight'}),h('span',{class:'big',id:'wt-current',text:fmt2(cur)+' kg'})),
    h('section',{class:'card','aria-label':'Target weight'},h('span',{class:'muted small',text:'Target weight'}),h('span',{class:'big',id:'wt-target',text:tg!==null?fmt2(tg)+' kg':'-'}))));
  var seg=h('div',{class:'wt-tabs',role:'group','aria-label':'Chart range',id:'wt-range'});
  WT_RANGES.forEach(function(r){seg.appendChild(h('button',{type:'button','data-range':r[0],'aria-pressed':rk===r[0]?'true':'false',text:r[1],onclick:function(){S.wtRange=r[0];render()}}))});
  root.appendChild(seg);
  var inR=ws.filter(function(w){return !rg[2]||w.date>=addDays(S.today,-(rg[2]-1))});
  var win=rg[2]?[addDays(S.today,-(rg[2]-1)),S.today]:(inR.length?[inR[0].date,inR[inR.length-1].date]:[addDays(S.today,-29),S.today]);
  if(win[0]===win[1])win=[addDays(win[0],-3),addDays(win[1],3)];   /* a single point (All time): show a few days around it */
  var card=h('section',{class:'card',id:'wt-chart-card'},weightChartSvg(inR,tg,win,cur));
  if(!inR.length)card.appendChild(h('p',{class:'muted small',id:'wt-empty',text:ws.length?'No weights in this range.':'No weights logged yet. Tap + to add your first one.'}));
  else{
    var ch=inR[inR.length-1].kg-p.startKg;
    card.appendChild(h('p',{class:'small muted',id:'w-change',text:'Change since your starting weight ('+fmt2(p.startKg)+' kg): '+(ch>0?'+':'')+fmt2(Math.round(ch*10)/10)+' kg'}));
  }
  root.appendChild(card);
  root.appendChild(h('h2',{style:'margin:14px 2px 6px',text:'Weight entries'}));
  var list=h('ul',{class:'plain wt-list',id:'wt-list'});
  inR.slice().reverse().forEach(function(w){
    var btn=h('button',{type:'button',class:'wt-item','data-date':w.date,'aria-label':'Edit weight '+fmt2(w.kg)+' kg on '+fmtLongDate(w.date),onclick:function(ev){openWeightSheet(p,w,ev.currentTarget)}},
      h('b',{text:fmt2(w.kg)+' kg'}),h('span',{class:'muted small',text:fmtLongDate(w.date)+(w.time?' '+fmt12(w.time):'')}));
    list.appendChild(h('li',null,btn));
  });
  var card2=h('section',{class:'card'},list);
  if(!inR.length)card2.appendChild(h('p',{class:'muted',text:'No entries in this range.'}));
  root.appendChild(card2);
}

function viewGoals(root){
  var existing=S.profile&&!S.newPerson?S.profile:null,first=!S.profile;
  var p=existing||{name:'',sex:'m',dob:'',heightCm:'',startKg:'',activity:1.3,activityModel:3,exerciseAdds:true,goal:'lose',rateKgWk:0.5,proteinGPerKg:1.6,fatPct:25,override:{}};
  var model3=!existing||existing.activityModel>=3;
  var ov=p.override||{};
  if(first){
    root.appendChild(h('p',{class:'lead',text:'Create your profile to get started. Your numbers are used to work out how many calories you burn and a daily target. Nothing leaves this device.'}));
    root.appendChild(h('p',{class:'muted small',id:'tabs-hint',text:'The rest of the menu unlocks once your profile exists.'}));
    root.appendChild(importCard('Restore from backup','Already used this app (or the older Diet Tracker page)? Choose your backup file to get your people and logs back. No new profile is needed.'));
  }
  if(S.newPerson)root.appendChild(h('div',{class:'row',style:'margin-bottom:8px'},h('button',{type:'button',class:'btn',id:'cancel-person',text:'Cancel',onclick:function(){S.newPerson=false;S.tab='today';render(true)}})));
  var err=h('p',{class:'err',role:'alert'}),F={};
  function inp(id,type,val,extra){var i=h('input',Object.assign({type:type,id:'f-'+id,value:val==null?'':String(val)},extra||{}));F[id]=i;i.addEventListener('input',preview);return i}
  function selct(id,opts,val){var e=h('select',{id:'f-'+id});if(id==='activity'&&!opts.some(function(o){return String(o[0])===String(val)}))opts=opts.concat([[val,'Your current setting ('+val+')']]);opts.forEach(function(o){e.appendChild(h('option',{value:String(o[0]),text:o[1],selected:String(o[0])===String(val)}))});F[id]=e;e.addEventListener('input',preview);return e}
  var form=h('section',{class:'card'},h('h2',{text:'About you'}),
    h('label',{for:'f-name'},'Name'),inp('name','text',p.name,{maxlength:'40',autocomplete:'off'}),
    h('div',{class:'field-grid'},
      h('div',null,h('label',{for:'f-sex'},'Sex',h('span',{class:'hint',text:'Used in the calorie formula'})),selct('sex',[['m','Male'],['f','Female']],p.sex)),
      h('div',null,h('label',{for:'f-dob'},'Date of birth'),inp('dob','date',p.dob,{max:S.today})),
      h('div',null,h('label',{for:'f-height'},'Height (cm)'),inp('height','number',p.heightCm,{inputmode:'decimal',step:'any',min:'100',max:'230'})),
      h('div',null,h('label',{for:'f-weight'},existing?'Starting weight (kg)':'Weight (kg)'),inp('weight','number',p.startKg,{inputmode:'decimal',step:'0.1',min:'20',max:'300'})),
      h('div',null,h('label',{for:'f-target'},'Target weight (kg)',h('span',{class:'hint',text:'Optional. Shown in the Weight tracker'})),inp('target','number',p.targetWeightKg,{inputmode:'decimal',step:'0.1',min:'20',max:'300'}))),
    h('label',{for:'f-activity'},model3?'How active are you in everyday life?':'How active are you?'),selct('activity',model3?EVERYDAY:ACTIVITY,p.activity),
    h('p',{class:'muted small',id:'activity-note-help',text:model3?'Do not count workouts here. Workouts you log are added to your day separately.':'These already include your workouts, so don\'t add workout calories on top.'}),
    h('p',{class:'muted small',id:'activity-heavy-help',text:'Doing heavy physical work? If the number still looks low, set your own calories under Advanced.'}),
    h('label',{for:'f-goal'},'Your goal'),selct('goal',[['lose','Lose weight'],['maintain','Stay the same'],['gain','Gain weight']],p.goal),
    h('label',{for:'f-rate'},'Pace (kg per week)'),selct('rate',[[0.25,'0.25 kg per week (gentle)'],[0.5,'0.5 kg per week (steady)']],p.rateKgWk));
  var hasAdv=Object.keys(ov).length>0||p.proteinGPerKg!==1.6||p.fatPct!==25;
  var adv=h('details',{class:'card',id:'advanced',open:hasAdv},h('summary',{text:'Advanced (protein, fat, your own targets)'}),
    h('div',{class:'field-grid'},
      h('div',null,h('label',{for:'f-protein'},'Protein (g per kg body weight)'),inp('protein','number',p.proteinGPerKg,{inputmode:'decimal',step:'0.1',min:'0.5',max:'4'})),
      h('div',null,h('label',{for:'f-fat'},'Fat (% of calories)'),inp('fat','number',p.fatPct,{inputmode:'decimal',step:'1',min:'10',max:'50'}))),
    h('h3',{style:'margin-top:14px',text:'Set your own targets (optional)'}),h('p',{class:'muted small',text:'Leave a box empty to use the automatic number.'}),
    h('div',{class:'field-grid'},
      h('div',null,h('label',{for:'f-ovkcal'},'Calories per day'),inp('ovkcal','number',ov.kcal,{inputmode:'decimal',step:'any',min:'1'})),
      h('div',null,h('label',{for:'f-ovp'},'Protein (g)'),inp('ovp','number',ov.p,{inputmode:'decimal',step:'any',min:'0'})),
      h('div',null,h('label',{for:'f-ovc'},'Carbs (g)'),inp('ovc','number',ov.c,{inputmode:'decimal',step:'any',min:'0'})),
      h('div',null,h('label',{for:'f-ovf'},'Fat (g)'),inp('ovf','number',ov.f,{inputmode:'decimal',step:'any',min:'0'}))));
  var pv=h('section',{class:'card','aria-live':'polite',id:'pv'});
  function readForm(){
    function n(id){var t=F[id].value.trim();return t===''?null:parseFloat(t)}
    var o={};[['ovkcal','kcal'],['ovp','p'],['ovc','c'],['ovf','f']].forEach(function(k){var v=n(k[0]);if(v!=null&&isFinite(v))o[k[1]]=v});
    return {name:F.name.value.trim(),sex:F.sex.value,dob:F.dob.value,heightCm:n('height'),startKg:n('weight'),targetWeightKg:n('target'),activity:parseFloat(F.activity.value),goal:F.goal.value,rateKgWk:parseFloat(F.rate.value),proteinGPerKg:n('protein'),fatPct:n('fat'),override:o};
  }
  function validate(q){
    if(!q.name)return 'Please enter a name.';
    if(!isDate(q.dob)||q.dob>S.today||ageOn(q.dob,S.today)<10||ageOn(q.dob,S.today)>110)return 'Enter a valid date of birth (age 10 to 110).';
    if(!(q.heightCm>=100&&q.heightCm<=230))return 'Height must be between 100 and 230 cm.';
    if(!(q.startKg>=20&&q.startKg<=300))return 'Weight must be between 20 and 300 kg.';
    if(q.targetWeightKg!=null&&!(q.targetWeightKg>=20&&q.targetWeightKg<=300))return 'Target weight must be between 20 and 300 kg, or empty.';
    if(!(q.proteinGPerKg>=0.5&&q.proteinGPerKg<=4)){adv.open=true;return 'Protein must be between 0.5 and 4 g per kg.'}
    if(!(q.fatPct>=10&&q.fatPct<=50)){adv.open=true;return 'Fat must be between 10 and 50 percent of calories.'}
    var o=q.override;if('kcal' in o&&(o.kcal<500||o.kcal>10000)){adv.open=true;return 'Calories per day should be between 500 and 10000.'}
    return null;
  }
  function preview(){
    F.rate.disabled=F.goal.value==='maintain';
    var q=readForm(),bad=validate(q);pv.replaceChildren(h('h2',{text:'Your numbers'}));
    if(bad){pv.appendChild(h('p',{class:'muted',text:'Fill in the form to see your numbers.'}));return}
    var kg=existing?weightOn(existing.id,q,S.today):q.startKg,c=calc(q,kg,S.today);
    pv.appendChild(h('dl',{class:'kv'},
      kv('Age','pv-age',c.age+' years'),
      kv('Calories you burn at rest (BMR)','pv-bmr',fmt2(c.bmr)+' kcal'),
      kv('Calories you burn per day (TDEE)','pv-tdee',fmt2(c.tdee)+' kcal'),
      kv('Daily calorie target','pv-target',r0(c.target)+' kcal'),
      kv('Protein','pv-p',r0(c.p)+' g'),kv('Carbs','pv-c',r0(c.c)+' g'),kv('Fat','pv-f',r0(c.f)+' g')));
    var nt=targetNote(c,q);if(nt)pv.appendChild(noteEl(nt));
    if(existing){
      /* the numbers that used to sit on Today (for the day you were looking at): target, burn, deficit, fibre */
      var vd=S.viewDate||S.today,c2=calc(q,weightOn(existing.id,q,vd),vd),tt=sumEntries(entriesOn(existing.id,vd)),cnt=existing.exerciseAdds?sumEx(exOn(existing.id,vd)):0,def=c2.tdee+cnt-tt.kcal;
      pv.appendChild(h('h3',{style:'margin-top:12px',id:'sofar-title',text:vd===S.today?'Today so far':fmtDate(vd)}));
      pv.appendChild(h('dl',{class:'kv',id:'totals','aria-live':'polite','aria-atomic':'true'},
        kv('Daily target','t-target',r0(c2.target)+' kcal'),
        kv('Calories you burn per day','t-tdee',r0(c2.tdee)+' kcal'),
        kv('Eaten vs what you burn (deficit)','t-deficit',r0(Math.abs(def))+' kcal '+(def>=0?'under':'over'),def<0),
        kv('Fibre eaten','t-fibre',r1(tt.fib)+' g')));
      pv.appendChild(h('p',{class:'small muted',id:'deficit-help',text:vd===S.today?'The day is not over yet, so this number shrinks as you eat. A deficit means you have eaten less than you burn per day.':'A deficit means you ate less than you burn per day.'}));
    }
    pv.appendChild(h('p',{class:'small muted',text:'Estimates from the Mifflin-St Jeor formula. 1 kg of body weight is about 7700 kcal.'}));
  }
  root.appendChild(form);
  if(existing&&!model3)root.appendChild(h('div',{class:'card',id:'m3-reopen-card'},h('p',{class:'muted small',text:'Your activity level above includes your workouts. You can switch to an everyday level and count each logged workout separately.'}),
    h('button',{type:'button',class:'btn',id:'m3-reopen',text:'Count workouts separately',onclick:function(){var np=Object.assign({},S.profile,{m3Dismissed:false,activityNote:S.profile.activityNote?Object.assign({},S.profile.activityNote,{dismissed:true}):null,updatedAt:Date.now()});saveProfile(np);S.profile=np;S.tab='today';render(true)}})));
  root.appendChild(adv);root.appendChild(pv);
  root.appendChild(h('div',{class:'card'},err,h('button',{type:'button',id:'save-profile',class:'btn primary',style:'width:100%',text:existing?'Save changes':'Create profile',onclick:function(){
    err.textContent='';var q=readForm(),bad=validate(q);if(bad){err.textContent=bad;return}
    var now=Date.now(),base=existing?S.profile:{slots:defaultSlots()},np=Object.assign({},base,q,{id:existing?existing.id:'p_'+uuid().replace(/[^\w-]/g,'').slice(0,12),updatedAt:now,createdAt:existing?existing.createdAt:now,activityModel:existing?Math.max(2,existing.activityModel||2):3,exerciseAdds:existing?existing.exerciseAdds===true:true});
    if(q.targetWeightKg==null||!isFinite(q.targetWeightKg))delete np.targetWeightKg;
    if(existing&&q.activity!==existing.activity)np.activityNote=null;
    if(!existing){np.waterGoalCups=8;np.cupMl=250;np.m3Dismissed=false}
    saveProfile(np);
    if(!existing){meta.profileIds.push(np.id);meta.activeProfileId=np.id;saveMeta();S.profile=np;S.newPerson=false;S.viewDate=S.today;S.add=null;S.tab='today';render(true);toast('Profile created')}
    else{S.profile=np;render();toast('Daily goals saved')}}})));
  preview();
}

/* ---------- export / import ---------- */
function buildExport(pids){
  var sm=loadShared(),pm=loadPackMeta();
  return {app:'diet-tracker',schema:1,exportedAt:new Date().toISOString(),
    sharedFoods:Object.keys(sm).map(function(k){return sm[k]}),lastPackImport:pm.lastPackImport,
    profiles:pids.map(function(pid){
    var entries={},logs={},exercise={};monthsOf(pid).forEach(function(ym){entries[ym]=loadMonth(pid,ym)});monthsOfLogs(pid).forEach(function(ym){logs[ym]=loadLogs(pid,ym)});monthsOfEx(pid).forEach(function(ym){exercise[ym]=loadEx(pid,ym)});
    return {profile:loadProfile(pid),entries:entries,logs:logs,exercise:exercise,water:loadWater(pid),saved:loadSaved(pid),weights:loadWeights(pid),foods:loadCustom(pid)}}).filter(function(x){return x.profile})};
}
function download(obj,name){
  var blob=new Blob([JSON.stringify(obj,null,1)],{type:'application/json'}),url=URL.createObjectURL(blob),a=h('a',{href:url,download:name});
  document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},3000);
}
function doExport(pids,label){
  download(buildExport(pids),'trackme-backup-'+todayStr()+'.json');
  meta.lastExport=Date.now();saveMeta();S.exportedSinceDelete=true;showBanners();toast('Backup file downloaded');
}
function safeId(x){return typeof x==='string'&&/^[\w-]{1,64}$/.test(x)}
function numIn(x,lo,hi){return typeof x==='number'&&isFinite(x)&&x>=lo&&x<=hi}
function cleanProfile(p){
  if(!p||typeof p!=='object'||!safeId(p.id)||typeof p.name!=='string'||!p.name.trim())return null;
  if(p.sex!=='m'&&p.sex!=='f')return null;if(!isDate(p.dob))return null;
  if(!numIn(p.heightCm,100,230)||!numIn(p.startKg,20,300))return null;
  var av=typeof p.activity==='string'?parseFloat(p.activity.replace(',','.')):p.activity;
  if(typeof av!=='number'||!isFinite(av))return null;
  var am=Number(p.activityModel),isNew=isFinite(am)&&am>=2,actVal,note=null;
  if(isNew){
    /* model 2: snap to a level; a newer model number than this app knows is kept as is (factor clamped to 1.2-1.7) */
    actVal=am===2?nearestOf(av,ACTIVITY.map(function(a){return a[0]})):am===3?nearestOf(av,EVERYDAY.map(function(a){return a[0]})):Math.max(1.2,Math.min(1.7,av));
    var an=p.activityNote;if(an&&typeof an==='object'&&typeof an.from==='number'&&typeof an.to==='number'&&isFinite(an.from)&&isFinite(an.to))note={from:an.from,to:an.to,dismissed:an.dismissed===true};
  }else{
    /* old scale: map to the new level once, then stamp activityModel 2 */
    var oldv=nearestOf(av,[1.2,1.375,1.55,1.725,1.9]);actVal=OLD_ACTIVITY[oldv];
    if(oldv!==actVal)note={from:oldv,to:actVal,dismissed:false};
  }
  if(['lose','maintain','gain'].indexOf(p.goal)<0)return null;
  var o={},ov=p.override||{};['kcal','p','c','f'].forEach(function(k){if(numIn(ov[k],0,20000))o[k]=ov[k]});
  return {id:p.id,name:p.name.trim().slice(0,40),sex:p.sex,dob:p.dob,heightCm:p.heightCm,startKg:p.startKg,activity:actVal,activityModel:isNew&&am>2?am:2,activityNote:note,goal:p.goal,rateKgWk:p.rateKgWk===0.25?0.25:0.5,
    proteinGPerKg:numIn(p.proteinGPerKg,0.5,4)?p.proteinGPerKg:1.6,fatPct:numIn(p.fatPct,10,50)?p.fatPct:25,override:o,slots:(function(s){return s.length?s:defaultSlots()})(cleanSlots(p.slots)),
    targetWeightKg:numIn(p.targetWeightKg,20,300)?p.targetWeightKg:undefined,
    exerciseAdds:isNew&&am>=3&&p.exerciseAdds===true,m3Dismissed:p.m3Dismissed===true,waterGoalCups:numIn(p.waterGoalCups,1,30)?Math.round(p.waterGoalCups):8,cupMl:numIn(p.cupMl,50,1000)?Math.round(p.cupMl):250,
    createdAt:numIn(p.createdAt,0,9e15)?p.createdAt:Date.now(),updatedAt:numIn(p.updatedAt,0,9e15)?p.updatedAt:0};
}
function cleanEntry(e){
  if(!e||typeof e!=='object'||!safeId(e.id)||!isDate(e.date)||!/^\d\d:\d\d$/.test(e.time||''))return null;
  if(typeof e.slot!=='string'||!/^[\w-]{1,40}$/.test(e.slot)||typeof e.foodName!=='string'||!e.foodName||typeof e.foodId!=='string')return null;
  if(!numIn(e.qty,0.0001,1e6)||!numIn(e.grams,0.0001,5000)||!e.per100)return null;
  var n=e.per100,out={};for(var k of ['kcal','p','c','f','fib']){if(!numIn(n[k],0,1000))return null;out[k]=n[k]}
  return {id:e.id,date:e.date,time:e.time,slot:e.slot,slotName:typeof e.slotName==='string'?normName(e.slotName).slice(0,30):'',foodId:e.foodId.slice(0,80),foodName:e.foodName.slice(0,120),qty:e.qty,unit:typeof e.unit==='string'?e.unit.slice(0,20):'g',
    unitLabel:typeof e.unitLabel==='string'?e.unitLabel.slice(0,80):(e.unit||'g'),unitG:numIn(e.unitG,0.0001,5000)?e.unitG:1,grams:e.grams,per100:out,
    updatedAt:numIn(e.updatedAt,0,9e15)?e.updatedAt:0,createdAt:numIn(e.createdAt,0,9e15)?e.createdAt:0};
}
function cleanEntryFull(e){
  var c=cleanEntry(e);if(!c)return null;
  if(typeof e.logId==='string'&&safeId(e.logId))c.logId=e.logId;
  if(e.est==='ai')c.est='ai';
  if(e.imp==='pdf')c.imp='pdf';
  var a=e.adj;if(a&&typeof a==='object'&&numIn(a.kcal,0,20000)&&numIn(a.p,0,20000)&&numIn(a.c,0,20000)&&numIn(a.f,0,20000))c.adj={kcal:a.kcal,p:a.p,c:a.c,f:a.f};
  return c;
}
function cleanWeight(w){
  if(!w||!isDate(w.date)||!numIn(w.kg,20,300))return null;
  var o={date:w.date,kg:w.kg,updatedAt:numIn(w.updatedAt,0,9e15)?w.updatedAt:0};
  if(typeof w.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(w.time))o.time=w.time;   /* optional: older weights have no time */
  return o;
}
function cleanFood(f){
  if(!f||typeof f.id!=='string'||!/^c_[\w-]{1,64}$/.test(f.id)||typeof f.name!=='string'||!f.name.trim()||!f.per100)return null;
  var n=f.per100,out={};for(var k of ['kcal','p','c','f','fib']){if(!numIn(n[k],0,1000))return null;out[k]=n[k]}
  var units=(Array.isArray(f.units)?f.units:[]).filter(function(u){return u&&typeof u.label==='string'&&numIn(u.grams,0.0001,5000)}).map(function(u){return {label:u.label.slice(0,80),grams:u.grams}});
  return {id:f.id,name:f.name.trim().slice(0,80),per100:out,units:units,updatedAt:numIn(f.updatedAt,0,9e15)?f.updatedAt:0};
}
function parseImport(text){
  var o;try{o=JSON.parse(text)}catch(e){throw new Error('That file could not be read. It is not a valid backup (the JSON is broken). Choose a file exported from this app.')}
  if(!o||o.app!=='diet-tracker'||!Array.isArray(o.profiles))throw new Error('This does not look like a Diet Tracker backup file.');
  if(o.schema!==1)throw new Error('This backup was made by a newer version of the app and cannot be read here.');
  var out=[],skipped=0;
  o.profiles.forEach(function(bp){
    var p=bp&&cleanProfile(bp.profile);if(!p){skipped++;return}
    var months={};
    Object.keys(bp.entries||{}).forEach(function(k){var arr=bp.entries[k];if(!Array.isArray(arr))return;arr.forEach(function(e){var c=cleanEntryFull(e);if(c)(months[c.date.slice(0,7)]=months[c.date.slice(0,7)]||[]).push(c);else skipped++})});
    var flat=[];Object.keys(months).forEach(function(ym){flat=flat.concat(months[ym])});migrateEntries(flat,p);
    var ws=[];(Array.isArray(bp.weights)?bp.weights:[]).forEach(function(w){var c=cleanWeight(w);if(c)ws.push(c);else skipped++});
    var fs=[];(Array.isArray(bp.foods)?bp.foods:[]).forEach(function(f){var c=cleanFood(f);if(c)fs.push(c);else skipped++});
    var lgs={};Object.keys(bp.logs&&typeof bp.logs==='object'&&!Array.isArray(bp.logs)?bp.logs:{}).forEach(function(k){var arr=bp.logs[k];if(!Array.isArray(arr))return;arr.forEach(function(l){var c=cleanLog(l);if(c)(lgs[c.date.slice(0,7)]=lgs[c.date.slice(0,7)]||[]).push(c);else skipped++})});
    var exs={};Object.keys(bp.exercise&&typeof bp.exercise==='object'&&!Array.isArray(bp.exercise)?bp.exercise:{}).forEach(function(k){var arr=bp.exercise[k];if(!Array.isArray(arr))return;arr.forEach(function(x){var c=cleanEx(x);if(c)(exs[c.date.slice(0,7)]=exs[c.date.slice(0,7)]||[]).push(c);else skipped++})});
    var sv=[];(Array.isArray(bp.saved)?bp.saved:[]).forEach(function(x){var c=cleanSaved(x);if(c)sv.push(c);else skipped++});
    out.push({profile:p,months:months,logs:lgs,exercise:exs,water:cleanWaterMap(bp.water),saved:sv,weights:ws,foods:fs,incModel:Number(bp.profile.activityModel)>=2?Math.floor(Number(bp.profile.activityModel)):1,fromOld:!(Number(bp.profile.activityModel)>=2)});
  });
  if(!out.length)throw new Error('No people could be read from this file.');
  var sfoods=[],sbad=0;
  if(Array.isArray(o.sharedFoods)){
    if(o.sharedFoods.length>5000)throw new Error('This backup has too many saved foods (the limit is 5000).');
    o.sharedFoods.forEach(function(f){var c=cleanSharedFood(f);if(c)sfoods.push(c);else sbad++});
  }
  var li=o.lastPackImport&&typeof o.lastPackImport==='object'?o.lastPackImport:null;
  return {items:out,skipped:skipped+sbad,sharedFoods:sfoods,lastPackImport:li?{packName:normName(li.packName||'').slice(0,40),revision:numIn(li.revision,0,1e9)?Math.floor(li.revision):0,exportedAt:typeof li.exportedAt==='string'?li.exportedAt.slice(0,40):''}:null};
}
function mergeList(local,incoming,keyFn){
  var map={},stat={added:0,updated:0,kept:0};local.forEach(function(x){map[keyFn(x)]=x});
  incoming.forEach(function(x){var k=keyFn(x),cur=map[k];if(!cur){map[k]=x;stat.added++}else if((x.updatedAt||0)>(cur.updatedAt||0)){map[k]=x;stat.updated++}else stat.kept++});
  var res=Object.keys(map).map(function(k){return map[k]});return {list:res,stat:stat};
}
function applyImport(parsed,mode){
  var lines=[];
  parsed.items.forEach(function(it){
    var pid=it.profile.id,exists=meta.profileIds.indexOf(pid)>=0,line;
    if(!exists||mode==='replace'){
      if(exists){skeys(pk(pid,'')).forEach(sdel)}
      saveProfile(it.profile);Object.keys(it.months).forEach(function(ym){saveMonth(pid,ym,it.months[ym])});saveWeights(pid,it.weights);saveCustom(pid,it.foods);Object.keys(it.logs||{}).forEach(function(ym){saveLogs(pid,ym,it.logs[ym])});
      Object.keys(it.exercise||{}).forEach(function(ym){saveEx(pid,ym,it.exercise[ym])});saveWater(pid,it.water||{});saveSaved(pid,it.saved||[]);
      if(!exists)meta.profileIds.push(pid);
      var ne=0;Object.keys(it.months).forEach(function(ym){ne+=it.months[ym].length});
      line=it.profile.name+': '+(exists?'replaced':'added')+' with '+ne+' entries, '+it.weights.length+' weights';
    }else{
      var cur=loadProfile(pid),pr=cur&&(cur.updatedAt||0)>=(it.profile.updatedAt||0)?cur:it.profile,oth=pr===cur?it.profile:cur;
      var refd={};(pr===cur?Object.keys(it.months).flatMap(function(ym){return it.months[ym]}):allEntries(pid)).forEach(function(e){refd[e.slot]=1});
      pr=Object.assign({},pr,{slots:unionSlots(pr.slots,oth?oth.slots:[],refd)});
      /* an old-scale backup must never change the activity level of a profile that is already on the new scale */
      /* a dismissed notice stays dismissed if either side dismissed it */
      var dism=!!((cur&&cur.activityNote&&cur.activityNote.dismissed)||(it.profile.activityNote&&it.profile.activityNote.dismissed));
      /* the newer activity model wins whichever side is newer; a lower incoming model never downgrades the current one */
      if(cur){
        var cm=cur.activityModel||2,im=it.incModel||2;
        if(im<cm)pr=Object.assign({},pr,{activity:cur.activity,activityModel:cur.activityModel,activityNote:cur.activityNote||null,exerciseAdds:cur.exerciseAdds,m3Dismissed:cur.m3Dismissed});
        else if(im>cm)pr=Object.assign({},pr,{activity:it.profile.activity,activityModel:it.profile.activityModel,activityNote:it.profile.activityNote||null,exerciseAdds:it.profile.exerciseAdds,m3Dismissed:it.profile.m3Dismissed});
      }
      if(dism&&pr.activityNote&&!pr.activityNote.dismissed)pr=Object.assign({},pr,{activityNote:Object.assign({},pr.activityNote,{dismissed:true})});
      Object.keys(it.months).forEach(function(ym){remapEntrySlots(it.months[ym],pr.slots)});saveProfile(pr);if(S.profile&&S.profile.id===pid)S.profile=pr;
      var a=0,u=0,k=0;
      Object.keys(it.months).forEach(function(ym){var m=mergeList(loadMonth(pid,ym),it.months[ym],function(x){return x.id});saveMonth(pid,ym,m.list);a+=m.stat.added;u+=m.stat.updated;k+=m.stat.kept});
      Object.keys(it.logs||{}).forEach(function(ym){saveLogs(pid,ym,mergeList(loadLogs(pid,ym),it.logs[ym],function(x){return x.id}).list)});
      Object.keys(it.exercise||{}).forEach(function(ym){saveEx(pid,ym,mergeList(loadEx(pid,ym),it.exercise[ym],function(x){return x.id}).list)});
      var wm=loadWater(pid),wi=it.water||{};Object.keys(wi).forEach(function(k){if(!wm[k]||(wi[k].updatedAt||0)>(wm[k].updatedAt||0))wm[k]=wi[k]});saveWater(pid,wm);
      saveSaved(pid,mergeList(loadSaved(pid),it.saved||[],function(x){return x.id}).list);
      var mw=mergeList(loadWeights(pid),it.weights,function(x){return x.date});saveWeights(pid,mw.list);
      var mf=mergeList(loadCustom(pid),it.foods,function(x){return x.id});saveCustom(pid,mf.list);
      line=it.profile.name+': merged - '+a+' new entries, '+u+' updated, '+k+' kept; weights +'+mw.stat.added+'/'+mw.stat.updated+' updated';
    }
    lines.push(line);
  });
  if(!meta.activeProfileId||meta.profileIds.indexOf(meta.activeProfileId)<0)meta.activeProfileId=meta.profileIds[0]||null;
  saveMeta();S.profile=meta.activeProfileId?loadProfile(meta.activeProfileId):null;
  if(parsed.sharedFoods&&parsed.sharedFoods.length){
    var sm2=copyShared(),ss=mergeSharedInto(sm2,parsed.sharedFoods);saveShared(sm2);
    lines.push('Saved foods: +'+ss.added+' new, '+ss.updated+' updated, '+ss.removed+' removed, '+ss.older+' skipped (older)');
  }
  if(parsed.lastPackImport){var pm2=loadPackMeta();if(!pm2.lastPackImport){pm2.lastPackImport=parsed.lastPackImport;savePackMeta(pm2)}}
  try{migrateCustom()}catch(e){}
  return lines;
}
function slotsCard(){
  var card=h('section',{class:'card',id:'slots'},h('h2',{text:'Meal slots'}),
    h('p',{class:'muted small',text:'Meals have no fixed times. Add, rename or reorder them. Removing a meal slot never deletes anything you logged.'}));
  var list=h('ul',{class:'plain'}),err=h('p',{class:'err',role:'alert'}),status=h('p',{class:'small muted',role:'status',id:'slot-status'}),stTimer=null,confirming=null;
  function refresh(){
    list.replaceChildren();var slots=S.profile.slots;
    slots.forEach(function(s,i){
      var li=h('li',{class:'slotrow','data-slot':s.id});
      if(confirming===s.id){
        li.appendChild(h('p',{style:'margin:0;flex:1 1 100%',text:'Delete "'+s.name+'"? Food you logged under it is kept and still shown under this name.'}));
        li.appendChild(h('button',{type:'button',class:'btn danger solid',text:'Delete '+s.name,onclick:function(){confirming=null;saveSlots(S.profile.slots.filter(function(x){return x.id!==s.id}));refresh()}}));
        li.appendChild(h('button',{type:'button',class:'btn',text:'Keep it',onclick:function(){confirming=null;refresh()}}));
      }else{
        var inp=h('input',{type:'text',maxlength:'30','aria-label':'Meal slot name',value:s.name,
          onkeydown:function(ev){if(ev.key==='Enter'){ev.preventDefault();inp.blur()}},
          onchange:function(){
            var bad=slotNameError(inp.value,S.profile.slots,s.id);
            if(bad){err.textContent=bad;status.textContent='';inp.value=s.name;return}
            err.textContent='';var n=normName(inp.value);if(n===s.name){inp.value=n;return}
            saveSlots(S.profile.slots.map(function(x){return x.id===s.id?{id:x.id,name:n}:x}));renameSlotEntries(s.id,n);
            status.textContent='Saved: '+n;clearTimeout(stTimer);stTimer=setTimeout(function(){status.textContent=''},2500);refresh();}});
        li.appendChild(inp);li.appendChild(h('span',{class:'spacer'}));
        li.appendChild(h('button',{type:'button',class:'btn icon','aria-label':'Move '+s.name+' up',text:'↑',disabled:i===0,onclick:function(){move(i,-1)}}));
        li.appendChild(h('button',{type:'button',class:'btn icon','aria-label':'Move '+s.name+' down',text:'↓',disabled:i===slots.length-1,onclick:function(){move(i,1)}}));
        li.appendChild(h('button',{type:'button',class:'btn icon danger','aria-label':'Delete '+s.name,text:'×',disabled:slots.length<2,title:slots.length<2?'Keep at least one meal slot':null,onclick:function(){confirming=s.id;refresh()}}));
      }
      list.appendChild(li);
    });
  }
  function move(i,dir){var a=S.profile.slots.slice(),j=i+dir;if(j<0||j>=a.length)return;var x=a[i];a[i]=a[j];a[j]=x;saveSlots(a);refresh()}
  var ni=h('input',{type:'text',id:'slot-new-name',maxlength:'30','aria-label':'New meal slot name',placeholder:'e.g. Pre-workout',autocomplete:'off',onkeydown:function(ev){if(ev.key==='Enter'){ev.preventDefault();add()}}});
  function add(){var r=createSlot(ni.value);if(r.err){err.textContent=r.err;ni.focus();return}
    err.textContent='';ni.value='';refresh()}
  card.appendChild(list);
  card.appendChild(h('div',{class:'row',style:'margin-top:10px'},h('div',{class:'grow'},ni),h('button',{type:'button',id:'slot-add',class:'btn',text:'Add meal slot',onclick:add})));
  card.appendChild(err);card.appendChild(status);refresh();return card;
}
/* Keep a's slots; take slots from b only if the entries on b's side reference them (so a deleted slot is not resurrected). */
function unionSlots(a,b,referenced){
  var out=a.slice(),ids={},names={};out.forEach(function(s){ids[s.id.toLowerCase()]=1;names[s.name.toLowerCase()]=1});
  b.forEach(function(s){if(ids[s.id.toLowerCase()]||!referenced[s.id])return;var n=s.name;if(names[n.toLowerCase()])n=(n.slice(0,26)+' (2)');if(names[n.toLowerCase()])return;ids[s.id.toLowerCase()]=1;names[n.toLowerCase()]=1;out.push({id:s.id,name:n})});
  return out;
}
/* Imported entries may spell a slot id or name with different capitalisation: map them onto the matching slot. */
function remapEntrySlots(list,slots){
  var byId={},byName={};slots.forEach(function(s){byId[s.id.toLowerCase()]=s;byName[s.name.toLowerCase()]=s});
  list.forEach(function(e){var s=byId[String(e.slot).toLowerCase()]||(e.slotName&&byName[e.slotName.toLowerCase()]);if(s){e.slot=s.id;e.slotName=s.name}});
}
function dataCard(){
  var card=h('section',{class:'card',id:'backup'},h('h2',{text:'Backup and sharing'}),
    h('p',{class:'muted small',text:'Download a file to keep your log safe or move it to another phone. Last backup: '+(meta.lastExport?new Date(meta.lastExport).toLocaleDateString():'never')+'.'}),
    h('div',{class:'row'},h('button',{type:'button',id:'export-one',class:'btn primary',text:'Export only me ('+S.profile.name.slice(0,20)+')',onclick:function(){doExport([S.profile.id],'person')}}),
      h('button',{type:'button',id:'export-all',class:'btn',text:'Export everyone',onclick:function(){doExport(meta.profileIds.slice(),'all')}})),
    h('p',{class:'muted small',text:'Everyone puts all people on this device in one file you can share with family.'}));
  card.appendChild(importBody('Import a backup file'));
  return card;
}
function importCard(title,hint){var c=h('section',{class:'card',id:'restore'},h('h2',{text:title}),h('p',{class:'muted small',text:hint}));c.appendChild(importBody('Choose a backup file'));return c}
function importBody(label){
  var frag=h('div',null),out=h('div',{id:'import-out','aria-live':'polite'});
  var file=h('input',{type:'file',id:'import-file',class:'file-hidden',accept:'.json,application/json',onchange:function(){
    out.replaceChildren();var f=file.files&&file.files[0];if(!f)return;
    var rd=new FileReader();rd.onerror=function(){out.appendChild(h('p',{class:'err',role:'alert',text:'The file could not be opened.'}))};
    rd.onload=function(){
      try{var parsed=parseImport(String(rd.result));showImportPanel(out,parsed)}catch(e){out.replaceChildren(h('p',{class:'err',role:'alert',id:'import-error',text:e.message}))}};
    rd.readAsText(f);}});
  frag.appendChild(h('div',{class:'file-wrap'},h('label',{for:'import-file',class:'btn file-btn',id:'import-btn'},label),file));frag.appendChild(out);
  file.addEventListener('focus',function(){$('#import-btn')&&$('#import-btn').classList.add('focus')});file.addEventListener('blur',function(){$('#import-btn')&&$('#import-btn').classList.remove('focus')});
  return frag;
}
function showImportPanel(out,parsed){
  out.replaceChildren();var mode='merge';
  var ul=h('ul');if(parsed.sharedFoods&&parsed.sharedFoods.length)ul.appendChild(h('li',{text:parsed.sharedFoods.filter(function(c){return !c.deleted}).length+' saved foods (My foods list)'}));
  parsed.items.forEach(function(it){var ne=0;Object.keys(it.months).forEach(function(ym){ne+=it.months[ym].length});
    ul.appendChild(h('li',{text:it.profile.name+' - '+ne+' entries, '+it.weights.length+' weights, '+it.foods.length+' custom foods'+(meta.profileIds.indexOf(it.profile.id)>=0?' (already on this device)':' (new)')}))});
  function radio(v,label,hint){return h('label',{style:'font-weight:400;display:flex;gap:8px;align-items:flex-start;min-height:44px'},h('input',{type:'radio',name:'imode',value:v,checked:v==='merge',style:'width:24px;height:24px;flex:none',onchange:function(){mode=v}}),h('span',null,h('b',{text:label}),h('span',{class:'hint',text:hint})))}
  out.appendChild(h('div',{class:'banner info'},h('p',{text:'This file contains:'}),ul,parsed.skipped?h('p',{text:parsed.skipped+' damaged records were skipped.'}):null,
    radio('merge','Merge (recommended)','Adds what is missing; for the same item, the newer edit wins.'),
    radio('replace','Replace','For people already here, deletes their current data and uses the file instead.'),
    h('div',{class:'row'},h('button',{type:'button',id:'import-apply',class:'btn primary',text:'Import now',onclick:function(){
      var hadProfile=!!S.profile,lines=applyImport(parsed,mode);
      if(!hadProfile&&S.profile){S.tab='today';S.viewDate=S.today;render(true);toast('Restored '+parsed.items.length+(parsed.items.length===1?' person':' people'));return}
      render();var o2=$('#import-out');if(o2){o2.replaceChildren(h('div',{class:'banner info',id:'import-summary'},h('b',{text:'Import finished'}),h('ul',null,lines.map(function(l){return h('li',{text:l})}))))}}}),
      h('button',{type:'button',class:'btn',text:'Cancel',onclick:function(){out.replaceChildren();var fi=$('#import-file');if(fi)fi.value=''}}))));
}
function deleteCard(p){
  var conf=h('input',{type:'text',id:'del-name',autocomplete:'off','aria-label':'Type the name '+p.name+' to confirm'}),
      go=h('button',{type:'button',id:'del-go',class:'btn danger solid',text:'Delete '+p.name,disabled:true,onclick:function(){
        meta.profileIds=meta.profileIds.filter(function(i){return i!==p.id});skeys(pk(p.id,'')).forEach(sdel);
        meta.activeProfileId=meta.profileIds[0]||null;saveMeta();S.profile=meta.activeProfileId?loadProfile(meta.activeProfileId):null;S.exportedSinceDelete=false;S.add=null;S.viewDate=S.today;
        S.tab=S.profile?'today':'goals';render(true);toast('Profile deleted')}});
  function chk(){go.disabled=!(S.exportedSinceDelete&&conf.value.trim()===p.name)}
  conf.addEventListener('input',chk);
  var exp=h('button',{type:'button',class:'btn',id:'del-export',text:'1. Download a backup of '+p.name,onclick:function(){doExport([p.id],'person');chk();stat.textContent='Backup downloaded.'}}),stat=h('span',{class:'small muted',role:'status'});
  return h('details',{class:'card'},h('summary',{style:'min-height:44px;cursor:pointer;font-weight:700',text:'Delete this person'}),
    h('p',{class:'small',text:'This removes '+p.name+' and all their entries, weights and custom foods from this device. Other people are not touched.'}),
    h('div',{class:'row'},exp,stat),h('label',{for:'del-name'},'2. Type their name ('+p.name+') to confirm'),conf,h('div',{style:'margin-top:10px'},go));
}
function storageCard(){
  var est=h('p',{class:'small muted',id:'st-est'}),per=h('p',{class:'small muted',id:'st-persist'});
  var n=0;skeys(NS).forEach(function(k){n+=(sget(k)||'').length*2});
  est.textContent='Stored data: about '+Math.max(1,Math.round(n/1024))+' KB (browsers usually allow around 5 MB).';
  per.textContent=!storageOK?'Storage is blocked here: data will not be kept.':S.persisted===true?'The browser has promised to keep this data.':S.persisted===false?'The browser may clear this data if the device runs low on space. Export a backup regularly and keep this file in one fixed place.':'Export a backup regularly and keep this file in one fixed place.';
  return h('section',{class:'card'},h('h2',{text:'Storage health'}),est,per);
}

/* ---------- placeholders for features that arrive in the next update ---------- */
/* ---------- Water tracker ---------- */
function waterSettingsCard(){
  var p=S.profile,err=h('p',{class:'err',role:'alert',id:'w-err'});
  var goal=h('input',{type:'number',id:'w-goal',inputmode:'numeric',min:'1',max:'30',step:'1',value:String(p.waterGoalCups||8),'aria-label':'Daily goal in cups'});
  var cup=h('input',{type:'number',id:'w-cup',inputmode:'numeric',min:'50',max:'1000',step:'10',value:String(p.cupMl||250),'aria-label':'Cup size in ml'});
  function save(){
    err.textContent='';var g=parseInt(goal.value,10),c=parseInt(cup.value,10);
    if(!(g>=1&&g<=30)){err.textContent='The goal should be 1 to 30 cups.';return}
    if(!(c>=50&&c<=1000)){err.textContent='A cup should be 50 to 1000 ml.';return}
    var np=Object.assign({},S.profile,{waterGoalCups:g,cupMl:c,updatedAt:Date.now()});saveProfile(np);S.profile=np;toast('Water settings saved');
  }
  goal.addEventListener('change',save);cup.addEventListener('change',save);
  return h('section',{class:'card',id:'water-settings'},h('h2',{text:'Water goal'}),
    h('div',{class:'field-grid'},h('div',null,h('label',{for:'w-goal'},'Goal (cups per day)'),goal),h('div',null,h('label',{for:'w-cup'},'Cup size (ml)'),cup)),err);
}
function viewWater(root){
  var p=S.profile;
  root.appendChild(waterCard(p,S.today));
  root.appendChild(waterSettingsCard());
  var rows=[],i;for(i=0;i<7;i++){var d=addDays(S.today,-i);rows.push(h('li',{class:'between'},h('span',{text:i===0?'Today':fmtDate(d)}),h('span',{class:'wk-cups',text:cupsOn(p.id,d)+' cups ('+fmtWater(cupsOn(p.id,d)*(p.cupMl||250))+')'})))}
  root.appendChild(h('section',{class:'card',id:'water-week'},h('h2',{text:'Last 7 days'}),h('ul',{class:'plain'},rows)));
}

/* ---------- Saved entries ---------- */
function savedSummary(sv){
  var kcal=0,burn=0,names=[];
  sv.items.forEach(function(it){
    if(it.type==='exercise'){names.push(it.label+' '+fmtQty(it.minutes)+' min');burn+=it.kcalAdj!=null?it.kcalAdj:it.met*weightOn(S.profile.id,S.profile,S.today)*it.minutes/60}
    else{names.push(it.foodName+' ('+fmtQty(it.qty)+' x '+(it.unitLabel||it.unit||'g').replace(/\s*\(.*$/,'')+')');kcal+=it.adj?it.adj.kcal:it.per100.kcal*it.grams/100}
  });
  return {text:names.join(', '),kcal:kcal,burn:burn};
}
function viewSaved(root){
  var p=S.profile,list=loadSaved(p.id).sort(function(a,b){return a.name.toLowerCase()<b.name.toLowerCase()?-1:1});
  if(!list.length){
    root.appendChild(h('section',{class:'card',id:'saved-empty'},h('h2',{text:'Saved entries'}),
      h('p',{class:'muted',text:'Nothing saved yet. Open the options of any entry and choose "Add to saved entries", or open a meal\'s options and choose "Save this meal". Then add it again with one tap here, or by typing its name in the log box.'}),
      h('button',{type:'button',class:'btn',text:'Back to Today',onclick:function(){goto('today')}})));
    return;
  }
  root.appendChild(h('p',{class:'muted small',text:'Tap Add to put an entry on '+(S.viewDate===S.today?'today':fmtDate(S.viewDate))+'. You can also type a saved name in the log box.'}));
  list.forEach(function(sv){
    var sm=savedSummary(sv);
    root.appendChild(h('section',{class:'card saved-card','data-id':sv.id},
      h('div',{class:'between'},h('b',{class:'sv-name',text:sv.name}),h('span',{class:'muted sv-kcal',text:r0(sm.kcal)+' kcal'+(sm.burn>0?', burn '+r0(sm.burn):'')})),
      h('p',{class:'muted small sv-items',text:sm.text}),
      h('div',{class:'row'},
        h('button',{type:'button',class:'btn primary sv-add',text:'Add',onclick:function(){var n=addSavedTo(sv,S.viewDate);S.tab='today';render(true);toast('Added "'+sv.name+'" ('+n+(n===1?' item)':' items)'))}}),
        h('button',{type:'button',class:'btn sv-rename',text:'Rename',onclick:function(ev){openRenameSaved(sv,ev.currentTarget)}}),
        h('button',{type:'button',class:'btn danger sv-delete',text:'Delete',onclick:function(){
          saveSaved(p.id,loadSaved(p.id).filter(function(x){return x.id!==sv.id}));render();
          toast('Deleted "'+sv.name+'"','Undo',function(){var l=loadSaved(p.id);l.push(sv);saveSaved(p.id,l);render()});}}))));
  });
}
function openRenameSaved(sv,opener){
  openSheet({title:'Rename',opener:opener,id:'rename-sheet',build:function(body,close){
    var err=h('p',{class:'err',role:'alert',id:'sv-err'});
    var inp=h('input',{type:'text',id:'sv-rename-name',maxlength:'40',autocomplete:'off',value:sv.name,'aria-label':'Name',onkeydown:function(ev){if(ev.key==='Enter'){ev.preventDefault();go()}}});
    function go(){
      err.textContent='';var nm=normName(inp.value);if(!nm){err.textContent='Give it a name.';return}
      var list=loadSaved(S.profile.id);
      if(list.some(function(x){return x.id!==sv.id&&savedKey(x.name)===savedKey(nm)})){err.textContent='You already have a saved entry with that name.';return}
      list.forEach(function(x){if(x.id===sv.id){x.name=nm;x.updatedAt=Date.now()}});saveSaved(S.profile.id,list);close(false);render();toast('Renamed')
    }
    body.appendChild(h('label',{for:'sv-rename-name',style:'margin-top:0'},'Name'));body.appendChild(inp);body.appendChild(err);
    body.appendChild(h('div',{class:'row',style:'margin-top:12px'},h('button',{type:'button',id:'sv-rename-save',class:'btn primary grow',text:'Save',onclick:go}),h('button',{type:'button',class:'btn',text:'Cancel',onclick:function(){close()}})));
    inp.setAttribute('data-autofocus','1');
  }});
}

/* ---------- Weekly summary ---------- */
/* ---------- WEEKLY SUMMARY ---------- */
var WK_TABS=13;   /* This week ... 12 weeks ago */
function wkTabName(i){return i===0?'This week':i===1?'Last week':i+' weeks ago'}
function fmtDM(d){var t=parseD(d);return t.getDate()+' '+t.toLocaleDateString('en-GB',{month:'short'})}
function fmtDMY(d){var t=parseD(d);return t.toLocaleDateString('en-GB',{weekday:'short'})+' '+t.getDate()+' '+t.toLocaleDateString('en-GB',{month:'short'})+' '+t.getFullYear()}
function fmtVol(ml){return ml>=1000?(Math.round(ml/10)/100)+'L':Math.round(ml)+'ml'}
/* numbers for one Monday-to-Sunday week. A day is "tracked" when it has any food entry. */
function weekData(p,mon){return rangeData(p,mon,7)}
function rangeData(p,mon,n){
  var days=[],i,ws=loadWeights(p.id),water=loadWater(p.id);
  for(i=0;i<n;i++){
    var d=addDays(mon,i),info=d<=S.today?dayInfo(p,d):null,tracked=!!(info&&info.ents.length),c=info?info.c:null;
    var wt=ws.filter(function(w){return w.date===d})[0]||null,wr=water[d];
    days.push({date:d,tracked:tracked,food:tracked?info.tot.kcal:null,exercise:tracked?info.exTotal:null,rem:tracked?info.left:null,goal:c?c.target:null,
      carbs:tracked?info.tot.c:null,protein:tracked?info.tot.p:null,fat:tracked?info.tot.f:null,gc:c?c.c:null,gp:c?c.p:null,gf:c?c.f:null,
      weight:wt,cups:wr&&wr.cups>0?wr.cups:null});
  }
  var tr=days.filter(function(x){return x.tracked});
  function sum(f){return tr.reduce(function(a,x){return a+f(x)},0)}
  return {mon:mon,days:days,n:tr.length,food:sum(function(x){return x.food}),exercise:sum(function(x){return x.exercise}),rem:sum(function(x){return x.rem}),
    carbs:sum(function(x){return x.carbs}),protein:sum(function(x){return x.protein}),fat:sum(function(x){return x.fat}),
    gc:sum(function(x){return x.gc}),gp:sum(function(x){return x.gp}),gf:sum(function(x){return x.gf}),
    goal:tr.length?tr[tr.length-1].goal:null,last:tr.length?tr[tr.length-1]:null};
}
/* the report module (PDF export and import) is loaded only when asked for; it works through this small API */
var REPORT=null;
function loadReportModule(){
  if(window.TMReport)return Promise.resolve(window.TMReport);
  if(REPORT)return REPORT;
  REPORT=new Promise(function(res,rej){var sc=document.createElement('script');sc.src='report.js';sc.onload=function(){window.TMReport?res(window.TMReport):rej(new Error('report module missing'))};sc.onerror=function(){rej(new Error('could not load the report module'))};document.head.appendChild(sc)}).catch(function(e){REPORT=null;throw e});
  return REPORT;
}
function reportFail(e){toast('Could not start the report tool ('+String(e&&e.message||e).slice(0,60)+').')}
function TMApi(){
  return {h:h,openSheet:openSheet,toast:toast,S:S,render:render,addDays:addDays,parseD:parseD,ymd:ymd,isDate:isDate,uuid:uuid,r0:r0,r1:r1,fmt2:fmt2,fmtQty:fmtQty,qtyText:qtyText,
    rangeData:rangeData,dayInfo:dayInfo,mondayOf:mondayOf,calc:calc,weightOn:weightOn,loadWeights:loadWeights,saveWeights:saveWeights,loadWater:loadWater,cupsOn:cupsOn,setCups:setCups,
    entriesOn:entriesOn,exOn:exOn,putEntry:putEntry,removeEntry:removeEntry,putEx:putEx,removeEx:removeEx,exKcal:exKcal,typicalTime:typicalTime,slotNameOf:slotNameOf,
    shortUnit:shortUnit,todayStr:todayStr,fmt12:fmt12,sumEntries:sumEntries};
}
function viewWeekly(root){
  var p=S.profile,idx=Math.max(0,Math.min(WK_TABS-1,S.weekIdx||0)),mon=addDays(mondayOf(S.today),-7*idx);
  var wd=weekData(p,mon),prev=weekData(p,addDays(mon,-7));
  /* tabs */
  var tabs=h('div',{class:'wk-tabs',role:'tablist','aria-label':'Choose a week',id:'wk-tabs'});
  for(var t=0;t<WK_TABS;t++)(function(t){
    tabs.appendChild(h('button',{type:'button',class:'wk-tab',role:'tab','data-week':String(t),'aria-selected':t===idx?'true':'false',text:wkTabName(t),onclick:function(){S.weekIdx=t;render()}}));
  })(t);
  root.appendChild(tabs);
  root.appendChild(h('div',{class:'row',style:'margin:0 0 8px;justify-content:flex-end'},h('button',{type:'button',class:'btn sm',id:'wk-export',text:'Export report (PDF)',onclick:function(ev){loadReportModule().then(function(R){R.openExport(TMApi(),ev.target)},reportFail)}})));
  var act=tabs.children[idx];setTimeout(function(){if(act&&tabs.isConnected)tabs.scrollLeft=Math.max(0,act.offsetLeft-12)},0);
  function dayCells(x){var dt=parseD(x.date);return [h('td',{text:dt.toLocaleDateString('en-GB',{weekday:'short'})}),h('td',{text:fmtDM(x.date)})]}
  function cols(){return h('colgroup',null,h('col',{class:'cd'}),h('col',{class:'cdt'}),h('col'),h('col'),h('col'))}
  function sg(n){n=r0(n);if(n===0)n=0;return (n>0?'+':n<0?'-':'')+Math.abs(n)}
  /* summary card */
  var tot=r0(wd.rem),under=tot>=0;
  var big=wd.n?h('p',{class:'wk-big '+(under?'good':'bad'),id:'wk-budget'},h('b',{text:String(Math.abs(tot))+' calories'}),' '+(under?'under':'over')+' budget this week'):h('p',{class:'wk-big',id:'wk-budget',text:'No food logged this week'});
  root.appendChild(h('section',{class:'card',id:'wk-summary'},h('p',{class:'wk-range',id:'wk-range',text:fmtDMY(mon)+' - '+fmtDMY(addDays(mon,6))}),big,
    h('p',{class:'muted',id:'wk-tracked',text:wd.n+' out of 7 days tracked this week'})));
  /* calories */
  var ct=h('table',{class:'wk-tbl',id:'wk-cal'},cols(),h('thead',null,h('tr',null,h('th',{text:'Day'}),h('th',{text:'Date'}),h('th',{class:'n',text:'Food'}),h('th',{class:'n',text:'Exercise'}),h('th',{class:'n',text:'Remaining'}))));
  var cb=h('tbody');
  wd.days.forEach(function(x){
    var dc=dayCells(x);
    cb.appendChild(h('tr',{'data-date':x.date},dc[0],dc[1],h('td',{class:'n',text:x.tracked?String(r0(x.food)):'-'}),h('td',{class:'n',text:x.tracked?String(r0(x.exercise)):'-'}),
      h('td',{class:'n '+(x.tracked?(x.rem>=0?'pos':'neg'):''),text:x.tracked?String(r0(x.rem)):'-'})));
  });
  cb.appendChild(h('tr',{class:'tot',id:'wk-total'},h('td',{colspan:'2',text:'Total'}),h('td',{class:'n',text:wd.n?String(r0(wd.food)):'-'}),h('td',{class:'n',text:wd.n?String(r0(wd.exercise)):'-'}),
    h('td',{class:'n '+(wd.n?(tot>=0?'pos':'neg'):''),text:wd.n?String(tot):'-'})));
  var both=wd.n&&prev.n;
  cb.appendChild(h('tr',{class:'vs',id:'wk-vs'},h('td',{colspan:'2',text:'Versus last week'}),h('td',{class:'n',text:both?sg(wd.food-prev.food):'-'}),h('td',{class:'n',text:both?sg(wd.exercise-prev.exercise):'-'}),h('td',{class:'n',text:both?sg(wd.rem-prev.rem):'-'})));
  ct.appendChild(cb);
  var goalDay=wd.goal!==null?wd.goal:calc(p,weightOn(p.id,p,S.today),S.today).target;
  root.appendChild(h('section',{class:'card',id:'wk-cal-card'},h('h2',{text:'Calories'}),ct,h('p',{class:'wk-foot',id:'wk-goal-note',text:'* Based on a daily goal of '+r0(goalDay)+' calories'})));
  /* macros */
  function mac(v,g){var d=g-v,r=r0(Math.abs(d));return [String(r0(v))+'g',(d>=0?r+'g under':r+'g over')]}
  var mt=h('table',{class:'wk-tbl',id:'wk-mac'},cols(),h('thead',null,h('tr',null,h('th',{text:'Day'}),h('th',{text:'Date'}),h('th',{class:'n',text:'Carbs'}),h('th',{class:'n',text:'Protein'}),h('th',{class:'n',text:'Fat'}))));
  var mb=h('tbody');
  function macCell(v,g){var m=mac(v,g);return h('td',{class:'n'},m[0],h('span',{class:'sub',text:m[1]}))}
  wd.days.forEach(function(x){
    var dc=dayCells(x);
    mb.appendChild(h('tr',{'data-date':x.date},dc[0],dc[1],x.tracked?macCell(x.carbs,x.gc):h('td',{class:'n',text:'-'}),x.tracked?macCell(x.protein,x.gp):h('td',{class:'n',text:'-'}),x.tracked?macCell(x.fat,x.gf):h('td',{class:'n',text:'-'})));
  });
  mb.appendChild(h('tr',{class:'tot',id:'wk-mac-total'},h('td',{colspan:'2',text:'Total'}),wd.n?macCell(wd.carbs,wd.gc):h('td',{class:'n',text:'-'}),wd.n?macCell(wd.protein,wd.gp):h('td',{class:'n',text:'-'}),wd.n?macCell(wd.fat,wd.gf):h('td',{class:'n',text:'-'})));
  mt.appendChild(mb);
  var cg=wd.last?{target:wd.last.goal,c:wd.last.gc,p:wd.last.gp,f:wd.last.gf}:calc(p,weightOn(p.id,p,S.today),S.today);
  var sh=cg.target>0?[4*cg.c/cg.target*100,4*cg.p/cg.target*100,9*cg.f/cg.target*100].map(function(x){return Math.round(x)}):[0,0,0];
  if(Math.abs(sh[0]+sh[1]+sh[2]-100)<=2)sh[2]=100-sh[0]-sh[1];
  root.appendChild(h('section',{class:'card',id:'wk-mac-card'},h('h2',{text:'Macronutrients'}),mt,
    h('p',{class:'wk-foot',id:'wk-split-note',text:'* Based on a daily macronutrient split of '+sh[0]+'% carbohydrates, '+sh[1]+'% protein, '+sh[2]+'% fat'})));
  /* weight */
  var wt=h('table',{class:'wk-tbl',id:'wk-weight'},cols(),h('thead',null,h('tr',null,h('th',{text:'Day'}),h('th',{text:'Date'}),h('th',{colspan:'2',text:'Time'}),h('th',{class:'n',text:'Weight'}))));
  var wb=h('tbody');
  wd.days.forEach(function(x){
    var dc=dayCells(x),w=x.weight;
    wb.appendChild(h('tr',{'data-date':x.date},dc[0],dc[1],h('td',{colspan:'2',text:w&&w.time?fmt12(w.time):'-'}),h('td',{class:'n',text:w?fmt2(w.kg)+' kg':'-'})));
  });
  wt.appendChild(wb);
  root.appendChild(h('section',{class:'card',id:'wk-weight-card'},h('h2',{text:'Weight'}),wt));
  /* water */
  var wa=h('table',{class:'wk-tbl',id:'wk-water'},cols(),h('thead',null,h('tr',null,h('th',{text:'Day'}),h('th',{text:'Date'}),h('th',{class:'n',text:'Cups'}),h('th',{class:'n',text:'Volume'}),h('th',{class:'n',text:'Remaining cups'}))));
  var wab=h('tbody');
  wd.days.forEach(function(x){
    var dc=dayCells(x),c=x.cups;
    wab.appendChild(h('tr',{'data-date':x.date},dc[0],dc[1],h('td',{class:'n',text:c!==null?String(c):'-'}),h('td',{class:'n',text:c!==null?fmtVol(c*p.cupMl):'-'}),h('td',{class:'n',text:c!==null?String(Math.max(0,p.waterGoalCups-c)):'-'})));
  });
  wa.appendChild(wab);
  root.appendChild(h('section',{class:'card',id:'wk-water-card'},h('h2',{text:'Water'}),wa));
}

/* ---------- Backup & restore ---------- */
function viewBackup(root){
  askPersist();
  root.appendChild(dataCard());
  root.appendChild(h('section',{class:'card',id:'persist-card'},h('h2',{text:'Keep your journal safe'}),h('p',{class:'small',id:'persist-line',text:persistText()}),
    h('p',{class:'small muted',text:'Clearing site data in Chrome deletes the journal. A backup file is the only copy that survives that.'}),
    h('button',{type:'button',class:'btn sm',text:'Check my phone',onclick:function(){goto('phone')}})));
  root.appendChild(h('section',{class:'card',id:'report-import-card'},h('h2',{text:'Import a report (PDF)'}),
    h('p',{class:'muted small',text:'Bring in days from a report PDF made by this app or a similar one. It is read on this phone only. You see everything before anything is saved. Goals in the report are not imported.'}),
    h('label',{class:'btn',for:'report-file',id:'report-file-label'},'Choose a report PDF'),
    h('input',{type:'file',id:'report-file',accept:'application/pdf,.pdf',class:'sr-only',onchange:function(ev){var f=ev.target.files&&ev.target.files[0];ev.target.value='';if(f)loadReportModule().then(function(R){R.openImport(TMApi(),f)},reportFail)}})));
  root.appendChild(h('section',{class:'card'},h('h2',{text:'Old Diet Tracker backups'}),
    h('p',{class:'muted',text:'A backup file made with the older Diet Tracker page can be imported above. Nothing in it is lost: your people, meals, weights and foods come across.'})));
}

/* ---------- Settings ---------- */
function viewSettings(root){
  var seg=h('div',{class:'seg',role:'group','aria-label':'Theme',id:'theme-seg'});
  [['system','System'],['light','Light'],['dark','Dark']].forEach(function(t){
    seg.appendChild(h('button',{type:'button','data-theme-opt':t[0],'aria-pressed':UI.theme===t[0]?'true':'false',text:t[1],onclick:function(){UI.theme=t[0];saveUI();applyTheme();render()}}));
  });
  var fseg=h('div',{class:'seg seg4',role:'group','aria-label':'Text size',id:'fontsize-seg'}),sample=h('p',{class:'size-sample',id:'size-sample',text:'This is how your text will look. 2 roti, dal and curd: 480 kcal.'});
  FONT_SIZES.forEach(function(f){
    fseg.appendChild(h('button',{type:'button','data-size-opt':f[0],'aria-pressed':UI.fontSize===f[0]?'true':'false',text:f[1],onclick:function(){
      UI.fontSize=f[0];saveUI();applyFontSize();
      fseg.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-size-opt')===f[0]?'true':'false')});
    }}));
  });
  root.appendChild(h('section',{class:'card',id:'fontsize-card'},h('h2',{text:'Text size'}),h('p',{class:'muted small',text:'Changes the size of all text in the app on this device. Medium is the default.'}),fseg,sample));
  root.appendChild(h('section',{class:'card',id:'theme-card'},h('h2',{text:'Theme'}),h('p',{class:'muted small',text:'System follows your phone. Light and Dark override it on this device.'}),seg));
  root.appendChild(h('section',{class:'card',id:'parser-card'},h('h2',{text:'Text reading'}),h('p',{id:'parser-mode',text:aiEnabled()?'On-device AI reads what you type.':'Basic (built-in rules).'}),
    h('p',{class:'muted small',text:'With an on-device AI model downloaded and switched on, the AI reads your words first. Otherwise the built-in rules read them. Either way you check the result before anything is saved.'})));
  var vseg=h('div',{class:'seg',role:'group','aria-label':'Voice language',id:'voice-seg'});
  [['en-IN','English (India)'],['hi-IN','Hindi']].forEach(function(t){vseg.appendChild(h('button',{type:'button','data-voice-lang':t[0],'aria-pressed':UI.voiceLang===t[0]?'true':'false',text:t[1],onclick:function(){UI.voiceLang=t[0];saveUI();render()}}))});
  root.appendChild(h('section',{class:'card',id:'voice-card'},h('h2',{text:'Voice typing'}),
    h('p',{class:'muted small',text:speechApi()?'The mic button next to the log box fills the box with what you say. It never saves by itself. Your audio goes to Google to be turned into text.':'Voice typing is not available in this browser, so the mic button is hidden. Your keyboard\'s mic still works in the log box.'}),vseg));
  root.appendChild(waterSettingsCard());
  var rem=h('input',{type:'checkbox',id:'reminder-toggle',checked:UI.backupReminder,onchange:function(){UI.backupReminder=rem.checked;saveUI();showBanners()}});
  root.appendChild(h('section',{class:'card',id:'reminder-card'},h('h2',{text:'Backup reminder'}),
    h('label',{class:'check-row',for:'reminder-toggle'},rem,h('span',{text:'Remind me to back up every 7 days'})),
    h('p',{class:'muted small',text:'Your journal lives only in this browser. A reminder appears on Today when the last backup is more than 7 days old.'})));
  root.appendChild(slotsCard());
  root.appendChild(deleteCard(S.profile));
  root.appendChild(storageCard());
}

/* ---------- About ---------- */
function viewAbout(root){
  root.appendChild(h('section',{class:'card about'},h('div',{class:'row'},brandIcon(56),h('div',null,h('h2',{style:'margin:0',text:'TrackMe'}),h('p',{class:'muted small',style:'margin:0',text:'Version 1.1.4. Works offline once installed.'}))),
    h('p',{text:'A private food journal. Type what you ate in plain words, check what was understood, and save. Your journal stays in this browser on this device.'}),
    h('p',{class:'muted small',text:'Estimates only, not medical advice. Use Backup & restore regularly: clearing site data deletes the journal.'})));
  root.appendChild(h('section',{class:'card',id:'whatsnew-card'},h('h2',{text:'What\'s new in 1.1.4'}),
    h('ul',{id:'whatsnew',class:'bullets'},
      h('li',{text:'Household sizes are now fixed: small katori 100 ml, katori 150 ml, large katori 200 ml, bowl 275 ml, cup 150 ml, glass 250 ml, tbsp 15 ml, tsp 5 ml. Type "small katori dal", "1 bowl rice", "2 tbsp ghee". Milk and other liquids in ml now use their real weight (200 ml milk is about 206 g).'}),
      h('li',{text:'Boiled vegetables (spinach, okra, cauliflower, brinjal, karela, lauki, drumstick and more) have their own cooked values. Most come from USDA FoodData Central; a few Indian vegetables are estimates derived from the raw value and say so.'}),
      h('li',{text:'More foods have a "1 piece" size (brinjal, capsicum, radish, parwal and others). Weights are estimates, marked with ~. Entries you already saved keep their numbers.'}),
      h('li',{text:'Drinks and liquids: water (0 kcal), juice, nimbu pani, soft drink, beer, whisky, wine, honey, kheer, soup, kadhi, smoothie, protein shake and more. They show ml ("1 cup milk (150 ml)") and the unit picker has an ml choice. "water" is no longer the water chestnut.'}),
      h('li',{text:'Version 1.1 brought the TrackMe name, text size, a sticky summary, swipe between days, weekly tables, weight tracker, meal details, PDF export and import, and AI-first reading. All still here.'}))));
  root.appendChild(h('section',{class:'card',id:'install-help'},h('h2',{text:'Install'}),
    h('p',{class:'small',text:'In Chrome on Android: menu, then Install app (or Add to Home screen). It then opens full screen and works offline.'}),
    h('p',{class:'small muted',text:'If you installed this app before it was renamed, the home-screen icon keeps its old name and icon until you remove it and install it again (your journal stays in the browser; make a backup first if you reinstall).'})));
  root.appendChild(h('section',{class:'card',id:'credit'},h('h2',{text:'Credits'}),
    h('p',{class:'small',id:'fdc-credit',text:'Cooked vegetables and drinks (water, juice, beer, honey and more): USDA FoodData Central, SR Legacy; Indian vegetables and home drinks or dishes without a USDA record are estimates (recipes from the food table), marked estimate.'}),
    h('p',{class:'small',id:'ifct-credit',text:'Food data: IFCT 2017, ICMR-National Institute of Nutrition (via npm ifct2017-compositions); cooked-dish values are estimates.'}),
    h('p',{class:'small',id:'off-credit',text:'Open Food Facts, ODbL (openfoodfacts.org): used when you add a food from the online search. Values are entered by volunteers.'}),
    h('p',{class:'small',id:'pdf-credit',text:'PDF import (optional): pdf.js by Mozilla, Apache-2.0 licence. PDF export is made by a small writer inside this app.'}),
    h('p',{class:'small',id:'ai-credit',text:'On-device AI (optional): WebLLM by MLC AI, Apache-2.0 licence. Models: Qwen3 by Alibaba Cloud, Apache-2.0 licence; Llama 3.2 by Meta, under the Llama 3.2 Community Licence. Built with Llama.'}),
    h('p',{class:'small muted',text:'The AI reads your words and amounts. Calories come from the food data above; the AI estimates them only for foods that are not in it, and those rows are tagged AI.'})));
}


/* ---------- init ---------- */
function tick(){var t=todayStr();if(t!==S.today){var was=S.viewDate===S.today;S.today=t;if(was)S.viewDate=t;if(!sheetState)render()}}
setInterval(tick,60000);
document.addEventListener('visibilitychange',function(){if(!document.hidden)tick()});
$('#menu-btn').addEventListener('click',function(){if(drawerOpen())closeDrawer();else openDrawer()});
$('#drawer-scrim').addEventListener('click',function(){closeDrawer()});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&drawerOpen()&&!sheetState){ev.preventDefault();closeDrawer()}});
initQuickBar();
try{migrateCustom()}catch(e){}
if(!S.profile)S.tab='goals';
render();
(function initAI(){
  /* nothing is loaded at start: the chip only says whether a downloaded model is switched on; it loads on first use */
  var mk=llmMock();
  if(mk&&!mk.load){LLM.modelId=mk.modelId||LLM_MODELS[0].id;UI.modelId=LLM.modelId;UI.llmOn=mk.on!==false;LLM.cached[LLM.modelId]=true}
  updateChip();
  if(UI.modelId&&UI.llmOn&&llmAvail().ok&&!mk)LLM.cached[UI.modelId]=true;   /* saved only after a successful download; verified at first use, without loading the AI library */
  else if(UI.modelId&&mk)llmHas(UI.modelId).then(function(has){LLM.cached[UI.modelId]=has;updateChip()});
  updateChip();
})();
registerSW();
})();
