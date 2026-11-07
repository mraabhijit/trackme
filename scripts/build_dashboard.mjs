// Builds dashboard/trackme-dashboard.html: the current TrackMe pages as ONE self-contained page for a Claude Artifact.
// Storage goes to the artifact's `db` (collection `kv`, one doc per localStorage key {v, t}), so Claude can write entries and the page shows them.
// Usage: node --no-warnings scripts/build_dashboard.mjs   (reads the built site in the repo root; run build.mjs first)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (f) => readFileSync(join(ROOT, f), 'utf8');
const once = (s, a, b, what) => { if (s.split(a).length !== 2) throw new Error('patch target not found exactly once: ' + what); return s.replace(a, () => b); };

let app = rd('app.js');
// no service worker in an artifact
app = once(app, '\nregisterSW();\n})();', '\n/* dashboard: no service worker */\n})();', 'registerSW call');
// no on-device AI / phone check in the drawer (the dashboard has no model)
app = once(app, "['ai','On-device AI','ai'],['phone','Check my phone','phone'],", '', 'drawer items');
// file saves go through the artifact `downloads` capability
const dl = app.indexOf('function download(obj,name){'), dlEnd = app.indexOf('function doExport(');
if (dl < 0 || dlEnd < dl) throw new Error('download() not found');
app = app.slice(0, dl) + `function download(obj,name){
  var text=JSON.stringify(obj,null,1);
  (window.claude&&window.claude.use?window.claude.use('downloads'):Promise.resolve(null)).then(function(d){
    if(!d){toast('This view cannot save files.');return}
    return d.save({filename:name,data:text}).catch(function(e){if(!(e&&/declin|cancel/i.test(String(e.code||e.message||''))))toast('Could not save the file.')});
  }).catch(function(){toast('This view cannot save files.')});
}
` + app.slice(dlEnd);


// over budget: the number is red and negative; no "Over by" / "(over)" words
app = once(app, "text:neg?'Over by':'Remaining'", "text:'Remaining'", 'collapsed label');
app = once(app, "text:left>=0?'Remaining':'Over by'", "text:'Remaining'", 'today label');
app = once(app, "(over?' (over)':'')", "''", 'macro over text');
app = once(app, "(pc>100?' (over)':'')", "''", 'percent over text');
// no "Add to <meal>" buttons: entries are logged by telling Claude
app = once(app, "if(!g.removed)card.appendChild(h('button',{type:'button',class:'btn sm',style:'margin-top:6px',text:'Add to '+g.name,onclick:function(){S.add=newAddCtx({date:d,slot:g.id});S.tab='add';render(true)}}));", '', 'add-to-meal button');
app = once(app, "h('button',{type:'button',class:'btn sm',id:'meal-add',text:'Add to '+name,onclick:function(){S.add=newAddCtx({date:d,slot:m.slot});S.tab='add';render(true)}}),", '', 'meal-add button');
// meal cards: no time under every item; one time at the end of each logged group, items compact
app = once(app, "    var ul=h('ul',{class:'plain'}),lastLog=null;\n    list.forEach(function(e){", "    var ul=h('ul',{class:'plain'}),lastLog=null,endT=null;function gtot(){var t=sumEntries(list);function col(l,v,goal,u){var pc=goal>0?v/goal*100:0;return h('div',{class:'tc'+(pc>100?' over':'')},h('span',{class:'cl',text:l}),h('span',{class:'cv',text:r0(v)+u}),bar(goal>0?v/goal:0,pc>100),h('span',{class:'cp',text:r0(pc)+'%'}))}return h('div',{class:'cols4c meal-totals'},col('Calories',t.kcal,c.target+info.counted,''),col('Carbs',t.c,c.c,'g'),col('Protein',t.p,c.p,'g'),col('Fat',t.f,c.f,'g'))}function flushT(){if(endT){ul.appendChild(h('li',{class:'gtime'},gtot(),h('span',{class:'time-text',text:fmt12(endT)})));endT=null}}\n    list.forEach(function(e){", 'group time helper');
app = once(app, "if(lg&&e.logId!==lastLog){\n        var txt=", "if(lg&&e.logId!==lastLog){flushT();\n        var txt=", 'group start');
app = once(app, "li.appendChild(h('div',{class:'muted small'},h('span',{class:'time-text',text:fmt12(e.time)})));\n      li.appendChild(chipsFor(n,!!e.adj));\n      ul.appendChild(li);\n    });\n    card.appendChild(ul);", "if(!lg)li.appendChild(h('div',{class:'muted small'},h('span',{class:'time-text',text:fmt12(e.time)})));\n      li.appendChild(chipsFor(n,!!e.adj));\n      ul.appendChild(li);if(lg)endT=e.time;\n    });\n    flushT();card.appendChild(ul);", 'item time');
// logging goes through Claude (see installAI): no mic, no search-add, no edit menus, no legacy menu pages
app = once(app, "var NAV=[['backup','Backup & restore','backup'],['today','Today','today'],", "var NAV=[['today','Today','today'],", 'nav start');
app = once(app, "  ['saved','Saved entries','saved'],['myfoods','My foods','myfoods'],['history','History','history'],['settings','Settings','settings'],['about','About','about']];", "  ['settings','Settings','settings'],['about','About','about']];", 'nav end');
app = once(app, 'window.TrackMe=window.Journable={parseLog:', 'window.__llmPrompt=function(){return {system:LLM_SYSTEM,shots:LLM_SHOTS,schema:llmSchema(),today:S.today}};window.__foodSearch=function(q){var seg=parseSegment(normText(String(q||\'\'))),r=matchTokens(seg.words);return sortList(r.list).slice(0,8).map(function(x){var n=x.f.per100;return {name:x.f.name,kcal:Math.round(n.kcal),protein:Math.round(n.p*10)/10,carbs:Math.round(n.c*10)/10,fat:Math.round(n.f*10)/10}})};window.TrackMe=window.Journable={parseLog:', 'prompt hook');
app = once(app, "aiLine('Read with on-device AI'", "aiLine('Read by Claude'", 'ai line wording');
app = app.split('Re-read with AI').join('Ask again');
app = once(app, "h('span',{class:'pv-ai-msg',id:'pv-ai-busy',text:msg})", "(waitLine(true),h('span',{class:'pv-ai-msg',id:'pv-ai-busy',text:'Analyzing macros...'}))", 'waiting text');
app = app.split('with on-device AI').join('with Claude');
app = app.split('Starting on-device AI').join('Starting Claude');
// no "Check before saving": Claude's reading is saved straight away; a failure says so and keeps the text
app = once(app, "title:'Check before saving'", "title:'Adding to your day'", 'sheet title');
app = once(app, "drawRows();\n        if(r.reason==='cancelled')aiLine('AI read cancelled, using the built-in rules.');\n        else aiLine('AI could not read this: '+aiReasonText(r.reason,r.detail)+'. Using the built-in rules.',false,true);\n        return;", "waitLine(false);closeSheet(false);S.pending=null;if(r.reason!=='cancelled')toast('Claude could not read that: '+aiReasonText(r.reason,r.detail)+'. Please try again.');return;", 'ai failure');
{
  const m = app.match(/\n\s*if\(r\.badLines\)\{drawChips\(\);drawRows\(\);aiLine\([^\n]*\n/);
  if (!m) throw new Error('badLines branch not found');
  app = app.replace(m[0], '\n');
  const f = app.match(/\n\s*aiLine\('Read by Claude'[^\n]*\n/);
  if (!f) throw new Error('final ai line not found');
  app = app.replace(f[0], '\n      autoSave();\n');
}
app = once(app, "  function runAI(){\n    var my=st.runTok", "  function autoSave(){\n    waitLine(false);var miss=st.items.filter(function(it){return it.type!=='exercise'&&!isFoodRow(it)}).map(function(it){return it.text||it.phrase||'?'});\n    if(!st.items.some(function(it){return it.type==='exercise'||isFoodRow(it)})){closeSheet(false);S.pending=null;toast('Could not understand that. Please try again.');return}\n    save();if(miss.length)toast('Not saved: '+miss.join(', '));\n  }\n  function runAI(){\n    var my=st.runTok", 'autoSave');
app = once(app, "text:'One item per line. Date, time and meal stay as they are. You check the result before it replaces this meal.'", "text:'One item per line. Claude reads it and replaces this meal.'", 'edit text help');
app = once(app, "text:'Read and check'", "text:'Save'", 'edit text button');
// the meal's three dots: Edit text and Delete; edited text is only re-analysed when it changed
{
  const m = app.match(/function openSlotMenu\(g,opener\)\{[\s\S]*?\n\}\n(?=function openSaveName)/);
  if (!m) throw new Error('openSlotMenu not found');
  app = app.replace(m[0], `function openSlotMenu(g,opener){
  openSheet({title:g.name,opener:opener,id:'slot-menu',build:function(body,close){
    function doDelete(){
      var p=S.profile,ids={};
      g.list.forEach(function(e){removeEntry(p.id,e.id,e.date);if(e.logId)ids[e.logId]=e.date});
      Object.keys(ids).forEach(function(id){if(!entriesOn(p.id,ids[id]).some(function(e){return e.logId===id}))removeLog(p.id,id,ids[id])});
      close(false);render(true);toast('Deleted '+g.name);
    }
    function ask(){
      body.replaceChildren(h('p',{text:'Delete '+g.name+'?'}),h('div',{class:'row'},h('button',{type:'button',id:'sm-del-yes',class:'btn primary grow',text:'Delete',onclick:doDelete}),h('button',{type:'button',class:'btn',text:'Cancel',onclick:function(){close()}})));
    }
    var ul=h('ul',{class:'plain menu-list'});
    ul.appendChild(h('li',null,h('button',{type:'button',id:'sm-text',class:'menu-item',onclick:function(){close(false);editMealAsText(g,opener)}},icon(ICONS.edit),h('span',{class:'grow',text:'Edit text'}))));
    ul.appendChild(h('li',null,h('button',{type:'button',id:'sm-del',class:'menu-item',onclick:ask},icon(ICONS.close),h('span',{class:'grow',text:'Delete'}))));
    body.appendChild(ul);ul.querySelector('button').setAttribute('data-autofocus','1');
  }});
}
`);
}
app = once(app, "var v=ta.value.trim();if(!v)return;close(false);openPreview(", "var v=ta.value.trim();if(!v)return;if(v===txt.trim()){close();return}close(false);openPreview(", 'edit text unchanged');
app = once(app, "replace:g.list.map(function(e){return {id:e.id,date:e.date}})", "replace:g.list.map(function(e){return {id:e.id,date:e.date,logId:e.logId}})", 'replace keeps logId');
app = once(app, "if(st.replace)st.replace.forEach(function(o){removeEntry(S.profile.id,o.id,o.date)});", "if(st.replace){st.replace.forEach(function(o){removeEntry(S.profile.id,o.id,o.date)});st.replace.forEach(function(o){if(o.logId&&!entriesOn(S.profile.id,o.date).some(function(e){return e.logId===o.logId}))removeLog(S.profile.id,o.logId,o.date)})}", 'replace removes old log');
app = once(app, "title:'Edit as text'", "title:'Edit text'", 'edit text title');
// no meal slots: every logged group is one meal ("Meal 1", "Meal 2"... in time order)
app = once(app, "  var bySlot={},order=[];\n  info.ents.forEach(function(e){if(!bySlot[e.slot]){bySlot[e.slot]=[];order.push(e.slot)}bySlot[e.slot].push(e)});\n  var liveIds=p.slots.map(function(s){return s.id}),groups=[];\n  p.slots.forEach(function(s){if(bySlot[s.id])groups.push({id:s.id,name:s.name,list:bySlot[s.id]})});\n  order.forEach(function(id){if(liveIds.indexOf(id)<0)groups.push({id:id,name:slotNameOf(p,bySlot[id][0]),list:bySlot[id],removed:true})});",
  "  var groups=[],byKey={};\n  info.ents.forEach(function(e){var k=e.logId||('t'+e.time+e.slot);if(!byKey[k]){byKey[k]={id:e.slot,key:k,name:'Meal '+(groups.length+1),list:[]};groups.push(byKey[k])}byKey[k].list.push(e)});", 'group by meal');
app = once(app, "if(S.tab==='meal'&&S.meal)return S.meal.name||'Meal';", "if(S.tab==='meal'&&S.meal)return 'Meal';", 'meal page title');
app = once(app, "S.meal={date:d,slot:g.id,name:g.name}", "S.meal={date:d,slot:g.id,name:g.name,key:g.key}", 'open meal key');
app = once(app, "filter(function(e){return e.slot===m.slot}):[];", "filter(function(e){return m.key?(e.logId||('t'+e.time+e.slot))===m.key:e.slot===m.slot}):[];", 'meal detail filter');
app = once(app, "var live=p.slots.filter(function(x){return x.id===m.slot})[0],name=live?live.name:slotNameOf(p,list[0]);m.name=name;", "var live=true,name=m.name||'Meal';m.name=name;", 'meal detail name');
// no "adjusted" pill: the report's numbers are the numbers
app = once(app, "adjusted?h('span',{class:'tag',text:'adjusted'}):null", 'null', 'adjusted pill');
// profile / starter form: one small page per section (wizardize), minimal words
const WIZ = `function waitLine(on){var o=document.getElementById('dash-wait');if(o)o.remove();if(!on)return;var pin=document.querySelector('.today-pin')||document.querySelector('#app');if(pin)pin.appendChild(h('p',{id:'dash-wait',role:'status',text:'Analyzing macros...'}))}
function wizardize(root0,src,F,check){
  var L={name:'Name',sex:'Sex',dob:'Birth date',height:'Height (cm)',weight:'Weight (kg)',target:'Target weight (kg), optional',activity:'Activity',goal:'Goal',rate:'Pace (kg a week)',ovkcal:'Calories',ovp:'Protein (g)',ovc:'Carbs (g)',ovf:'Fat (g)',protein:'Protein (g per kg)',fat:'Fat (% of calories)'};
  var STEPS=[['Name',['name']],['You',['sex','dob']],['Body',['height','weight','target']],['Activity',['activity']],['Goal',['goal','rate']],['Targets',['ovkcal','ovp','ovc','ovf']],['Macros',['protein','fat']],['Done',null]];
  var pv=src.querySelector('#pv'),save=src.lastElementChild,serr=save.querySelector('.err'),pages=[],cur=0;
  var werr=h('p',{class:'err',role:'alert'}),prog=h('div',{class:'wprog'}),bar=h('div',{class:'wbar'},h('span')),back=h('button',{type:'button',class:'btn',id:'w-back',text:'Back'}),next=h('button',{type:'button',class:'btn primary',id:'w-next',text:'Next'});
  root0.replaceChildren(prog,bar,werr);
  STEPS.forEach(function(s,i){
    var sec=h('section',{class:'card wpage'},h('h2',{text:s[0]}));
    if(s[1])s[1].forEach(function(id){var lab=src.querySelector('label[for="f-'+id+'"]');if(!lab||!F[id])return;lab.textContent=L[id];sec.appendChild(h('div',{class:'wfield'},lab,F[id]))});
    else{sec.appendChild(pv);sec.appendChild(save)}
    sec.hidden=i!==0;pages.push(sec);root0.appendChild(sec);
  });
  root0.appendChild(h('div',{class:'wnav'},back,next));
  function stepOf(m){return /name/i.test(m)?0:/birth/i.test(m)?1:/Height|Weight|Target weight/.test(m)?2:/Calories per day/.test(m)?5:/Protein|Fat/.test(m)?6:7}
  function show(i){cur=i;pages.forEach(function(p,k){p.hidden=k!==i});prog.textContent=(i+1)+' / '+pages.length;bar.firstChild.style.width=((i+1)/pages.length*100)+'%';back.hidden=i===0;next.hidden=i===pages.length-1;werr.textContent='';serr.textContent='';window.scrollTo(0,0)}
  back.addEventListener('click',function(){show(cur-1)});
  next.addEventListener('click',function(){var bad=check();if(bad){var s=stepOf(bad);if(s<=cur){show(s);werr.textContent=bad;return}}show(cur+1)});
  show(0);
}
`;
app = once(app, 'function viewGoals(root){', WIZ + 'function viewGoals(root){', 'viewGoals');
app = once(app, 'root.appendChild(form);', 'var root0=root;root=h("div");root.appendChild(form);', 'goals form append');
app = once(app, '  preview();\n}\n\n/* ---------- export / import ---------- */', '  preview();wizardize(root0,root,F,function(){return validate(readForm())});\n}\n\n/* ---------- export / import ---------- */', 'goals end');

const html = rd('index.html');
const bodyStart = html.indexOf('<body>') + 6, firstScript = html.indexOf('<script id="foods"');
const markup = html.slice(bodyStart, firstScript).replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const data = html.slice(firstScript, html.indexOf('<script src="app.js"></script>'));
const css = rd('app.css') + `
#ai-chip,#wk-export,#report-import-card,#parser-card,.menu-btn,#add-person,#ql-mic,#ql-plus,#slots{display:none!important}
#pv-sheet.sheet.tall{height:auto}
#pv-sheet .sheet-foot{display:none}
.sheet-wrap:has(#pv-sheet){display:none!important}
body.sheet-open:has(#pv-sheet){overflow:auto}
/* meal cards have no title: the calories lead, the three dots sit on the right */
.slot h3 .slot-title-btn{display:none}
.slot h3 .slot-kcal{display:none}
.slot h3{justify-content:flex-end}
#dash-wait{margin:2px 0 4px;text-align:center;font-size:.8rem;color:var(--muted)}
#pv-sheet #pv-raw,#pv-sheet #pv-chips,#pv-sheet #pv-panelbox,#pv-sheet #pv-rows,#pv-sheet #pv-save,#pv-sheet #pv-cancel{display:none!important}
.wprog{font-size:.85rem;color:var(--muted);margin:2px 2px 0}
.wbar{height:4px;background:var(--line);border-radius:2px;margin:6px 0 12px}.wbar span{display:block;height:100%;background:var(--accent);border-radius:2px}
.wpage h2{margin:0 0 14px}
.wfield{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}.wfield label{font-weight:600}
.wfield input,.wfield select{min-height:44px;font-size:1rem}
.wnav{display:flex;gap:10px;margin-top:12px}.wnav .btn{flex:1;min-height:48px}
.wpage #pv.card{border:0;box-shadow:none;background:none;padding:0;margin:0}
.wpage #pv>h2,.wpage #pv>p,.wpage #pv>div:not(.kv),.wpage #pv .kv>div:has(#pv-age),.wpage #pv .kv>div:has(#pv-bmr),.wpage #pv .kv>div:has(#pv-tdee){display:none}
.wpage>.card{border:0;box-shadow:none;background:none;padding:0;margin:14px 0 0}
.logtext{min-height:0;padding:0}
.logtext .logtext-in{display:block;-webkit-line-clamp:unset;overflow:visible}
.logline{padding:6px 0 4px}
.entry.col{padding:5px 0 6px}
.nchips{gap:4px;margin-top:3px}
.nchip{font-size:.72rem;padding:1px 6px}
.gtime{padding:8px 0 4px;border-top:1px solid var(--line);list-style:none}
.gtime .meal-totals{margin:0}
.gtime .time-text{display:block;text-align:right;margin-top:6px;color:var(--muted);font-size:.85rem;white-space:nowrap}
#ql-close{display:none}
body.composing #qbar{position:fixed;top:0;bottom:auto;left:0;right:0;z-index:60;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;background:var(--bg);box-shadow:0 8px 20px rgba(0,0,0,.3);align-items:flex-start}
body.composing #ql{min-height:84px;max-height:40vh}
body.composing #ql-close{display:inline-flex}
#dash-note{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(88px + env(safe-area-inset-bottom,0px));max-width:min(92vw,520px);background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:.9rem;z-index:50;box-shadow:0 2px 10px rgba(0,0,0,.18)}
#dash-note[hidden]{display:none}
`;

const bridge = `
(function(){
  var RAW=null,MEM=new Map(),pend=new Map(),lastT=new Map(),col=null,flushT=0,writing=false,remoteT=0,SKIP=/:probe$/,fails=0;
  function note(t){var n=document.getElementById('dash-note');if(!n){n=document.createElement('div');n.id='dash-note';n.setAttribute('role','status');document.body.appendChild(n)}if(!t){n.hidden=true;return}n.textContent=t;n.hidden=false}
  var shim={
    getItem:function(k){k=String(k);return MEM.has(k)?MEM.get(k):null},
    setItem:function(k,v){k=String(k);v=String(v);MEM.set(k,v);if(col&&!SKIP.test(k))queue(k,v)},
    removeItem:function(k){k=String(k);MEM.delete(k);if(col&&!SKIP.test(k))queue(k,null)},
    key:function(i){var a=Array.from(MEM.keys());return i<a.length?a[i]:null},
    clear:function(){Array.from(MEM.keys()).forEach(function(k){shim.removeItem(k)})}
  };
  Object.defineProperty(shim,'length',{get:function(){return MEM.size}});
  function queue(k,v){pend.set(k,v);clearTimeout(flushT);flushT=setTimeout(flush,500)}
  function flush(){
    if(writing){flushT=setTimeout(flush,300);return}
    writing=true;
    var items=Array.from(pend);pend.clear();
    var chain=Promise.resolve();
    items.forEach(function(kv){
      chain=chain.then(function(){
        var k=kv[0],v=kv[1],t=Date.now();lastT.set(k,t);
        var ref;try{ref=col.doc(k)}catch(e){return}            // a key the store cannot hold stays in this page only
        return (v===null?ref.delete():ref.set({v:v,t:t})).catch(function(){if(!pend.has(k))pend.set(k,v);throw 1});
      });
    });
    chain.then(function(){fails=0;if(!pend.size)note('')},function(){
      fails++;note('Could not save to the dashboard. Retrying...');
      clearTimeout(flushT);flushT=setTimeout(flush,Math.min(30000,2000*fails));
    }).then(function(){writing=false;if(pend.size&&!flushT)flushT=setTimeout(flush,300)});
  }
  function onRemote(snap){
    var changed=false;
    snap.docChanges().forEach(function(ch){
      var id=ch.doc.id,o=ch.doc.data();
      if(ch.type==='removed'){if(MEM.has(id)&&!pend.has(id)){MEM.delete(id);changed=true}return}
      if(!o||typeof o.v!=='string'||pend.has(id))return;
      if(typeof o.t==='number'&&o.t<=(lastT.get(id)||0))return;   // an echo of this page's own write
      if(MEM.get(id)!==o.v){MEM.set(id,o.v);changed=true}
    });
    if(changed){note('Updated from Claude. Refreshing...');clearTimeout(remoteT);remoteT=setTimeout(function again(){if(pend.size||writing){remoteT=setTimeout(again,800);return}location.reload()},900)}
  }
  function tmo(ms){return new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'))},ms)})}

  function installAI(){
    var ac=null;
    function ask(){return window.claude&&window.claude.use?window.claude.use('sample'):Promise.resolve(null)}
    function conv(text){
      var P=window.__llmPrompt(),msgs=[],sys=P.system+' Today is '+P.today+'. Leave meal null (there are no meal names). Set time as HH:MM when the user gives or implies one, otherwise null. Use the search_foods tool for every food: call it with a short plain English name including the cooking style (for example "chicken breast boiled"), then set name to the EXACT name of a candidate that is the same food. Never pick a different dish only because a word matches (chicken biryani is not boiled chicken; chicken broth is not chicken curry). A katori, bowl, cup or glass means the food as served: cooked unless it is naturally eaten raw. If the only candidate is the raw dry form (for example raw Bengal gram or dal) and the user ate a cooked serving, do not use it: estimate the cooked food instead. If no candidate is the same food, keep your own plain name, set estimated true, and estimate kcal, protein, carbs, fat and grams for the stated amount. Reply with JSON only, matching this JSON schema: '+JSON.stringify(P.schema);
      P.shots.forEach(function(s,i){msgs.push({role:'user',content:(i===0?sys+'\\n\\n':'')+s[0]});msgs.push({role:'assistant',content:JSON.stringify(s[1])})});
      msgs.push({role:'user',content:text});return msgs;
    }
    window.__llmMock={on:true,has:function(){return true},usage:null,cancel:function(){try{if(ac)ac.abort()}catch(e){}},
      extract:function(text){return ask().then(function(sample){
        if(!sample)throw new Error('Claude is not available in this view');
        ac=new AbortController();
        var tools=[{name:'search_foods',description:'Search the food table. Returns up to 8 candidate foods with calories, protein, carbs and fat per 100 g.',inputSchema:{type:'object',properties:{query:{type:'string',description:'short plain English food name with the cooking style'}},required:['query']},execute:function(input){return window.__foodSearch(String(input&&input.query||''))}}];
        return sample.json(conv(text),{cache:false,signal:ac.signal,tools:tools}).catch(function(e){
          if(e&&(e.code==='rate_limited'||e.code==='not_granted'||e.name==='AbortError'))throw e;
          return sample.json(conv(text),{cache:false,signal:ac.signal});
        });
      }).then(function(v){return JSON.stringify(v)})},
      analyse:function(prompt){return ask().then(function(sample){if(!sample)throw new Error('Claude is not available in this view');return sample(prompt,{cache:false})}).then(function(r){return r.text})}};
  }

  function setupComposer(){
    var ql=document.getElementById('ql'),bar=document.getElementById('qbar');if(!ql||!bar)return;
    var x=document.createElement('button');x.type='button';x.id='ql-close';x.className='icon-btn';x.setAttribute('aria-label','Close');x.textContent='\\u00d7';bar.insertBefore(x,bar.firstChild);
    function open(){document.body.classList.add('composing')}
    function close(){document.body.classList.remove('composing');ql.blur()}
    ql.addEventListener('focus',open);x.addEventListener('click',close);
    bar.addEventListener('submit',function(){setTimeout(close,300)});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
  }
  function run(){try{installAI();BOOT();setupComposer()}catch(e){console.error(e);note('The page could not start: '+(e&&e.message||e))}}
  (async function(){
    var db=null;
    try{if(window.claude&&window.claude.use)db=await Promise.race([window.claude.use('db'),tmo(12000)])}catch(e){}
    if(!db){try{RAW=window.localStorage}catch(e){}run();setTimeout(function(){note('Not connected to the dashboard database: changes stay in this browser only.')},800);return}
    col=db.collection('kv');
    try{
      var snap=await Promise.race([col.get(),tmo(15000)]);
      snap.docs.forEach(function(d){var o=d.data();if(o&&typeof o.v==='string')MEM.set(d.id,o.v)});
    }catch(e){col=null;try{RAW=window.localStorage}catch(_){}run();setTimeout(function(){note('The dashboard database did not answer: changes stay in this browser only.')},800);return}
    try{Object.defineProperty(window,'localStorage',{configurable:true,value:shim})}catch(e){console.error('cannot replace localStorage',e)}
    run();
    try{col.onSnapshot(onRemote,function(){note('Live updates stopped. Reload the page to see new entries.')})}catch(e){}
  })();
})();`;

const early = rd('early.js');
const out = `<title>TrackMe Dashboard</title>
<style>
${css}
</style>
${markup}
${data}
<script>
var BOOT=function(){
${early}
${app}
};
${bridge}
</script>
`;
mkdirSync(join(ROOT, 'dashboard'), { recursive: true });
writeFileSync(join(ROOT, 'dashboard', 'trackme-dashboard.html'), out);
console.log('dashboard/trackme-dashboard.html', (out.length / 1024).toFixed(0) + ' KB');
