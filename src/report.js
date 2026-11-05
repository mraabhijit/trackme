/* TrackMe report module: PDF export (own small writer, Helvetica, no libraries) and PDF import (pdf.js, vendored, loaded only when used).
   Loaded on demand by app.js; talks to the app only through the API object it is given. */
(function(){
'use strict';
var WR=[278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 761, 556, 761, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 761, 611, 761, 761, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 761, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500],WB=[278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761, 556, 761, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 761, 611, 761, 761, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 761, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556];
var DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
function pad(n){return (n<10?'0':'')+n}
function D(s){var a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2])}
function dShort(s){return D(s).getDate()+' '+MON[D(s).getMonth()].slice(0,3)}
function dowShort(s){return DAYS[D(s).getDay()].slice(0,3)}
function dowLong(s){return DAYS[D(s).getDay()]}
function dLong(s){var d=D(s);return DAYS[d.getDay()]+', '+d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear()}
function dRange(s){var d=D(s);return DAYS[d.getDay()].slice(0,3)+', '+d.getDate()+' '+MON[d.getMonth()].slice(0,3)+' '+d.getFullYear()}
function h24(t){return t?(+t.slice(0,2))+':'+t.slice(3,5):'-'}

/* ================= PDF writer ================= */
function Pdf(){this.pages=[];this.cur=null;this.newPage()}
Pdf.prototype.newPage=function(){this.cur=[];this.pages.push(this.cur)};
Pdf.prototype.width=function(s,size,bold){var t=bold?WB:WR,w=0;for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);w+=(c>=32&&c<=255&&!(c>=127&&c<160))?t[c-32]:(c<32?0:556)}return w*size/1000};
function hex(s){var o='';for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<32)c=32;if(c>255||(c>=127&&c<160))c=63;o+=(c<16?'0':'')+c.toString(16)}return '<'+o+'>'}
function f3(n){return (Math.round(n*100)/100).toString()}
Pdf.prototype.text=function(x,y,s,o){
  o=o||{};var c=o.color||[0.15,0.15,0.15];
  if(!s)return;
  this.cur.push('BT /'+(o.bold?'F2':'F1')+' '+f3(o.size||9)+' Tf '+f3(c[0])+' '+f3(c[1])+' '+f3(c[2])+' rg '+f3(x)+' '+f3(841.89-y)+' Td '+hex(String(s))+' Tj ET');
};
Pdf.prototype.fill=function(x,y,w,h,c){this.cur.push(f3(c[0])+' '+f3(c[1])+' '+f3(c[2])+' rg '+f3(x)+' '+f3(841.89-y-h)+' '+f3(w)+' '+f3(h)+' re f')};
Pdf.prototype.line=function(x1,y1,x2,y2,c,lw){c=c||[0.2,0.2,0.2];this.cur.push(f3(lw||0.5)+' w '+f3(c[0])+' '+f3(c[1])+' '+f3(c[2])+' RG '+f3(x1)+' '+f3(841.89-y1)+' m '+f3(x2)+' '+f3(841.89-y2)+' l S')};
Pdf.prototype.finish=function(title){
  var n=this.pages.length,objs=[];
  objs[1]='<</Type/Catalog/Pages 2 0 R>>';
  var kids=[],i;for(i=0;i<n;i++)kids.push((5+i*2)+' 0 R');
  objs[2]='<</Type/Pages/Kids['+kids.join(' ')+']/Count '+n+'>>';
  objs[3]='<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>';
  objs[4]='<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>';
  for(i=0;i<n;i++){
    var body=this.pages[i].join('\n');
    objs[4+i*2+1]='<</Type/Page/Parent 2 0 R/MediaBox[0 0 595.28 841.89]/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents '+(6+i*2)+' 0 R>>';
    objs[4+i*2+2]='<</Length '+body.length+'>>\nstream\n'+body+'\nendstream';
  }
  var info=objs.length;objs[info]='<</Title '+hex(title||'TrackMe report')+'/Producer '+hex('TrackMe')+'>>';
  var out='%PDF-1.4\n',offs=[];
  for(i=1;i<objs.length;i++){offs[i]=out.length;out+=i+' 0 obj\n'+objs[i]+'\nendobj\n'}
  var x=out.length;out+='xref\n0 '+objs.length+'\n0000000000 65535 f \n';
  for(i=1;i<objs.length;i++)out+=('0000000000'+offs[i]).slice(-10)+' 00000 n \n';
  out+='trailer\n<</Size '+objs.length+'/Root 1 0 R/Info '+info+' 0 R>>\nstartxref\n'+x+'\n%%EOF\n';
  var u=new Uint8Array(out.length);for(i=0;i<out.length;i++)u[i]=out.charCodeAt(i)&255;return u;
};

/* ================= layout ================= */
var PW=595.28,M=42,CW=PW-2*M,FOOT=790,FS=8.5,LH=10.5,PX=6,PY=6,GREY=[0.8,0.8,0.8],LINE=[0.45,0.45,0.45],GOOD=[0.09,0.58,0.27],BAD=[0.78,0.15,0.12],MUTED=[0.42,0.42,0.42];
function wrap(pdf,s,w,size,bold){
  s=String(s);var out=[],words=s.split(' '),cur='';
  words.forEach(function(wd){
    while(pdf.width(wd,size,bold)>w){var k=wd.length;while(k>1&&pdf.width(wd.slice(0,k),size,bold)>w)k--;if(cur){out.push(cur);cur=''}out.push(wd.slice(0,k));wd=wd.slice(k)}
    var t=cur?cur+' '+wd:wd;
    if(cur&&pdf.width(t,size,bold)>w){out.push(cur);cur=wd}else cur=t;
  });
  out.push(cur);return out;
}
function Layout(pdf){this.pdf=pdf;this.y=M}
Layout.prototype.ensure=function(hh){if(this.y+hh>FOOT){this.pdf.newPage();this.y=M;return true}return false};
Layout.prototype.page=function(){if(this.pdf.cur.length){this.pdf.newPage()}this.y=M};
Layout.prototype.title=function(t,size){this.ensure(30);this.pdf.text(M,this.y+(size||13),t,{size:size||13,color:[0.2,0.2,0.2]});this.y+=(size||13)+14};
/* cols: widths in points; head: strings; rows: {cells:[string|{t,color,bold,sub,subColor}], span:bool (time cell continues), top:bool} */
Layout.prototype.table=function(cols,head,rows,o){
  var pdf=this.pdf,self=this;o=o||{};
  var xs=[M];cols.forEach(function(w){xs.push(xs[xs.length-1]+w)});
  function drawHead(){
    var hh=LH+2*PY-2;self.ensure(hh+20);
    pdf.fill(M,self.y,CW,hh,GREY);
    head.forEach(function(t,i){pdf.text(xs[i]+PX,self.y+PY+7,t,{size:FS,bold:true,color:[0.2,0.2,0.2]})});
    pdf.line(M,self.y,M+CW,self.y,LINE);pdf.line(M,self.y+hh,M+CW,self.y+hh,LINE);xs.forEach(function(x){pdf.line(x,self.y,x,self.y+hh,LINE)});
    self.y+=hh;
  }
  drawHead();
  rows.forEach(function(r){
    var cells=r.cells.map(function(c,i){c=(typeof c==='string')?{t:c}:c;return {c:c,lines:c.t===''||c.t==null?[]:wrap(pdf,c.t,cols[i]-2*PX,FS,c.bold)}});
    var hh=0;cells.forEach(function(x){var n=x.lines.length*LH+(x.c.sub?10:0);if(n>hh)hh=n});hh=Math.max(hh,LH)+2*PY;
    if(self.y+hh>FOOT){pdf.newPage();self.y=M;drawHead()}
    cells.forEach(function(x,i){
      var yy=self.y+PY+7;
      x.lines.forEach(function(ln){pdf.text(xs[i]+PX,yy,ln,{size:FS,bold:x.c.bold,color:x.c.color||[0.18,0.18,0.18]});yy+=LH});
      if(x.c.sub)pdf.text(xs[i]+PX,yy+0.5,x.c.sub,{size:7,color:x.c.subColor||MUTED});
    });
    xs.forEach(function(x){pdf.line(x,self.y,x,self.y+hh,LINE)});
    cells.forEach(function(x,i){if(i===0&&r.cont)return;pdf.line(xs[i],self.y+hh,xs[i+1],self.y+hh,LINE)});
    if(!r.cont)pdf.line(xs[0],self.y,xs[1],self.y,LINE);
    self.y+=hh;
  });
  return this;
};
Layout.prototype.note=function(t){this.y+=8;this.ensure(14);this.pdf.text(M,this.y+7,t,{size:7.5,color:MUTED});this.y+=14};

/* ================= report data (the same numbers as the Weekly summary) ================= */
function buildData(api,from,to){
  var p=api.S.profile,days=[],d=from;while(d<=to){days.push(d);d=api.addDays(d,1)}
  var n=days.length,wd=api.rangeData(p,from,n),prev=api.rangeData(p,api.addDays(from,-(n<=7?7:n)),n);   /* up to a week: the same days one week earlier ('vs Last Week'); longer: the period of the same length before */
  var perDay=days.map(function(dt){var info=dt<=api.S.today?api.dayInfo(p,dt):{ents:[],exs:[],tot:{kcal:0,p:0,c:0,f:0},c:null,left:0};return {date:dt,info:info}});
  var cg=wd.last?{target:wd.last.goal,c:wd.last.gc,p:wd.last.gp,f:wd.last.gf}:api.calc(p,api.weightOn(p.id,p,api.S.today),api.S.today);
  var sh=cg.target>0?[4*cg.c/cg.target*100,4*cg.p/cg.target*100,9*cg.f/cg.target*100].map(function(x){return Math.round(x)}):[0,0,0];
  if(Math.abs(sh[0]+sh[1]+sh[2]-100)<=2)sh[2]=100-sh[0]-sh[1];
  var goalDay=wd.goal!==null?wd.goal:cg.target;
  /* the tables list the whole Monday-Sunday week(s) that contain the period; days outside the period show '-' */
  var wk=[],w0=api.mondayOf(from),w1=api.addDays(api.mondayOf(to),6),byDate={};
  wd.days.forEach(function(x){byDate[x.date]=x});
  for(d=w0;d<=w1;d=api.addDays(d,1))wk.push({date:d,x:byDate[d]||null});
  return {p:p,from:from,to:to,n:n,wd:wd,prev:prev,perDay:perDay,weekDays:wk,goalDay:goalDay,split:sh,cupMl:p.cupMl||250,goalCups:p.waterGoalCups||8};
}
function sgn(n){n=Math.round(n);if(n===0)n=0;return (n>0?'+':n<0?'-':'')+Math.abs(n)}
function macSub(v,g){var d=g-v,r=Math.round(Math.abs(d));return {sub:r+'g '+(d>=0?'under':'over'),subColor:d>=0?GOOD:BAD}}
function kgText(k){var r=Math.round(k*100)/100;return r%1===0?r.toFixed(1):String(r)}   /* 75 -> '75.0' as in the reference report */
function nf1(v){var r=Math.round(v*10)/10;return r%1===0?String(r):r.toFixed(1)}
/* quantities as the reference report prints them: 1/2 -> '\u00bd', 1 1/4 -> '1\u00bc' (these glyphs exist in Helvetica WinAnsi); other numbers as the app shows them */
function fracQty(api,q){
  var w=Math.floor(q+1e-9),f=q-w,g=f<1e-6?'':Math.abs(f-0.5)<1e-6?'\u00bd':Math.abs(f-0.25)<1e-6?'\u00bc':Math.abs(f-0.75)<1e-6?'\u00be':null;
  if(g===null)return api.fmtQty(q);
  return (w>0||!g?String(w):'')+g;
}
function qtyPlain(api,e){return fracQty(api,e.qty)+' '+api.shortUnit(e)}
/* an entry = what was logged together: the items of one log at one time; items without a log are one entry each (so two entries at the same time stay two) */
function groupItems(info){
  var items=[],groups={},order=[];
  info.ents.forEach(function(e,i){items.push({time:e.time,kind:'f',key:e.logId?'f|'+e.logId+'|'+e.time:'f#'+i,e:e})});
  info.exs.forEach(function(e,i){items.push({time:e.time,kind:'x',key:e.logId?'x|'+e.logId+'|'+e.time:'x#'+i,x:e})});
  items.forEach(function(it,i){var g=groups[it.key];if(!g){g=groups[it.key]={time:it.time,kind:it.kind,first:i,items:[]};order.push(g)}g.items.push(it)});
  order.sort(function(a,b){return a.time<b.time?-1:a.time>b.time?1:a.first-b.first});
  return order;
}

function buildPdf(api,data){
  var pdf=new Pdf(),L=new Layout(pdf),wd=data.wd,r0=Math.round,P=data.p;
  /* page 1 */
  pdf.text(M,L.y+9,dRange(data.from)+' - '+dRange(data.to),{size:9});L.y+=20;pdf.line(M,L.y,M+CW,L.y,[0.7,0.7,0.7]);L.y+=26;
  var tot=r0(wd.rem),under=tot>=0;
  if(wd.n){pdf.text(M,L.y,Math.abs(tot)+' calories',{size:16,bold:true,color:under?GOOD:BAD});var bw=pdf.width(Math.abs(tot)+' calories',16,true);pdf.text(M+bw+5,L.y,(under?'under':'over')+' budget this period',{size:9})}
  else pdf.text(M,L.y,'No food logged in this period',{size:12,bold:true});
  L.y+=16;pdf.text(M,L.y,wd.n+' of '+data.n+' days tracked',{size:9});
  /* calories: the full week(s), days outside the period or in the future show '-' */
  L.page();L.title('Calories');
  var c5=[CW*0.17,CW*0.17,CW*0.22,CW*0.22,CW*0.22],rows=[];
  data.weekDays.forEach(function(w){var x=w.x;rows.push({cells:[dowShort(w.date),dShort(w.date),x&&x.tracked?String(r0(x.food)):'-',x&&x.tracked?String(r0(x.exercise)):'-',x&&x.tracked?{t:String(r0(x.rem)),color:x.rem>=0?GOOD:BAD}:'-']})});
  rows.push({cells:['Total','',wd.n?String(r0(wd.food)):'-',wd.n?String(r0(wd.exercise)):'-',wd.n?{t:String(tot),color:tot>=0?GOOD:BAD}:'-']});
  var both=wd.n&&data.prev.n;
  rows.push({cells:[data.n<=7?'vs Last Week':'vs Previous Period','',both?sgn(wd.food-data.prev.food):'-',both?sgn(wd.exercise-data.prev.exercise):'-',both?sgn(wd.rem-data.prev.rem):'-']});
  L.table(c5,['Day','Date','Food','Exercise','Remaining'],rows);L.note('Based on a daily goal of '+r0(data.goalDay)+' calories');
  /* macros */
  L.page();L.title('Macronutrients');rows=[];
  function mc(v,g,ok){return ok?Object.assign({t:r0(v)+'g'},macSub(v,g)):'-'}
  data.weekDays.forEach(function(w){var x=w.x,t=!!(x&&x.tracked);rows.push({cells:[dowShort(w.date),dShort(w.date),mc(t&&x.carbs,t&&x.gc,t),mc(t&&x.protein,t&&x.gp,t),mc(t&&x.fat,t&&x.gf,t)]})});
  rows.push({cells:['Total','',mc(wd.carbs,wd.gc,wd.n),mc(wd.protein,wd.gp,wd.n),mc(wd.fat,wd.gf,wd.n)]});
  L.table(c5,['Day','Date','Carbs','Protein','Fat'],rows);L.note('Based on a daily distribution of '+data.split[0]+'% carbs, '+data.split[1]+'% protein, '+data.split[2]+'% fat');
  /* weight */
  L.page();L.title('Weight');rows=[];
  var c4=[CW*0.22,CW*0.26,CW*0.24,CW*0.28];
  data.weekDays.forEach(function(wk){var w=wk.x&&wk.x.weight;rows.push({cells:[dowShort(wk.date),dShort(wk.date),w&&w.time?h24(w.time):'-',w?kgText(w.kg)+' kg':'-']})});
  L.table(c4,['Day','Date','Time','Weight'],rows);
  /* water */
  L.page();L.title('Water');rows=[];
  data.weekDays.forEach(function(w){var c=w.x?w.x.cups:null;rows.push({cells:[dowShort(w.date),dShort(w.date),c!==null?String(c):'-',c!==null?r0(c*data.cupMl)+' ml':'-',c!==null?String(Math.max(0,data.goalCups-c)):'-']})});
  L.table(c5,['Day','Date','Cups','Volume','Remaining'],rows);
  /* consistency stats */
  var nf=0,nx=0;data.perDay.forEach(function(x){groupItems(x.info).forEach(function(g){if(g.kind==='x')nx++;else nf++})});
  L.page();L.title('Consistency Stats');L.table([CW/2,CW/2],['Food Entries','Exercise Entries'],[{cells:[String(nf),String(nx)]}]);
  /* entries */
  var first=true;
  data.perDay.forEach(function(x){
    var info=x.info;if(!info.ents.length&&!info.exs.length)return;
    if(first){L.page();L.title('Entries');first=false}else{L.y+=10}
    L.ensure(60);pdf.text(M,L.y+9,dLong(x.date),{size:10});L.y+=22;
    var cE=[CW*0.12,CW*0.34,CW*0.14,CW*0.13,CW*0.14,CW*0.13],erows=[];
    groupItems(info).forEach(function(g){
      g.items.forEach(function(it,k){
        var tl=k===0?h24(it.time):'';
        if(it.e){var e=it.e,nn=e.adj?{kcal:e.adj.kcal,p:e.adj.p,c:e.adj.c,f:e.adj.f}:{kcal:e.per100.kcal*e.grams/100,p:e.per100.p*e.grams/100,c:e.per100.c*e.grams/100,f:e.per100.f*e.grams/100};
          erows.push({cont:!tl,cells:[tl,e.foodName+' ('+qtyPlain(api,e)+')'+(e.est==='ai'&&!e.adj?' AI':''),nf1(nn.kcal),nf1(nn.c)+'g',nf1(nn.p)+'g',nf1(nn.f)+'g']})}
        else{var xx=it.x;erows.push({cont:!tl,cells:[tl,xx.label+' ('+api.fmtQty(xx.minutes)+' min'+(xx.distanceKm?', '+api.fmtQty(xx.distanceKm)+' km':'')+')','-'+nf1(api.exKcal(xx)),'-','-','-']})}
      });
    });
    var c=info.c,tt=info.tot;
    erows.push({cells:[{t:'Total',bold:true},'',String(r0(tt.kcal)),r0(tt.c)+'g',r0(tt.p)+'g',r0(tt.f)+'g']});
    function rm(v,g,u){var d=g-v;return {t:r0(d)+u,color:d>=0?GOOD:BAD}}
    erows.push({cells:[{t:'Remaining',bold:true},'',{t:String(r0(info.left)),color:info.left>=0?GOOD:BAD},rm(tt.c,c.c,'g'),rm(tt.p,c.p,'g'),rm(tt.f,c.f,'g')]});
    L.table(cE,['','','Calories','Carbs','Protein','Fat'],erows);
  });
  if(first){L.page();L.title('Entries');pdf.text(M,L.y+9,'No entries in this period.',{size:9});}
  /* footer on every page */
  var np=pdf.pages.length;
  pdf.pages.forEach(function(pg,i){pdf.cur=pg;pdf.line(M,805,M+CW,805,[0.7,0.7,0.7]);pdf.text(M,818,'TrackMe',{size:7.5,color:MUTED});var s='Page '+(i+1)+' of '+np;pdf.text(M+CW-pdf.width(s,7.5),818,s,{size:7.5,color:MUTED})});
  return pdf.finish('TrackMe report '+data.from+' to '+data.to);
}

/* ================= export sheet ================= */
function openExport(api,opener){
  var h=api.h,S=api.S,T=S.today;
  var state={preset:'this',from:api.mondayOf(T),to:T};
  api.openSheet({title:'Export report (PDF)',opener:opener,id:'rx-sheet',build:function(body,close){
    var err=h('p',{class:'err',role:'alert',id:'rx-err'}),info=h('p',{class:'muted small',id:'rx-info'});
    var segBox=h('div',{class:'chips',role:'group','aria-label':'Period',id:'rx-presets'}),custom=h('div',{id:'rx-custom',hidden:true});
    var fi=h('input',{type:'date',id:'rx-from',max:T,'aria-label':'From',value:state.from}),ti=h('input',{type:'date',id:'rx-to',max:T,'aria-label':'To',value:state.to});
    custom.appendChild(h('label',{for:'rx-from'},'From'));custom.appendChild(fi);custom.appendChild(h('label',{for:'rx-to'},'To'));custom.appendChild(ti);
    function setPreset(k){
      state.preset=k;var m=api.mondayOf(T);
      if(k==='this'){state.from=m;state.to=T}else if(k==='last'){state.from=api.addDays(m,-7);state.to=api.addDays(m,-1)}else if(k==='30'){state.from=api.addDays(T,-29);state.to=T}
      else{state.from=fi.value||state.from;state.to=ti.value||state.to}
      fi.value=state.from;ti.value=state.to;custom.hidden=k!=='custom';draw();
    }
    function days(){return Math.round((D(state.to)-D(state.from))/864e5)+1}
    function valid(){
      if(!api.isDate(state.from)||!api.isDate(state.to))return 'Choose both dates.';
      if(state.from>state.to)return 'The start date is after the end date.';
      if(state.to>T)return 'The end date cannot be in the future.';
      if(days()>92)return 'Choose at most 92 days.';
      return '';
    }
    function draw(){
      segBox.replaceChildren();
      [['this','This week'],['last','Last week'],['30','Last 30 days'],['custom','Custom']].forEach(function(x){segBox.appendChild(h('button',{type:'button',class:'chip','data-preset':x[0],'aria-pressed':state.preset===x[0]?'true':'false',text:x[1],onclick:function(){setPreset(x[0])}}))});
      var e=valid();err.textContent=e;info.textContent=e?'':dRange(state.from)+' to '+dRange(state.to)+' ('+days()+(days()===1?' day':' days')+')';
      var b=body.querySelector('#rx-make');if(b)b.disabled=!!e;
    }
    fi.addEventListener('change',function(){state.from=fi.value;draw()});ti.addEventListener('change',function(){state.to=ti.value;draw()});
    body.appendChild(h('p',{class:'muted small',text:'Makes a PDF of your food, macros, weight and water for the period. It is made on this phone and saved to your Downloads.'}));
    body.appendChild(segBox);body.appendChild(custom);body.appendChild(info);body.appendChild(err);
    body.appendChild(h('div',{class:'row',style:'margin-top:10px'},h('button',{type:'button',class:'btn primary grow',id:'rx-make',text:'Create PDF',onclick:function(){
      var e=valid();if(e){err.textContent=e;return}
      var u8;try{u8=buildPdf(api,buildData(api,state.from,state.to))}catch(ex){err.textContent='The report could not be made: '+String(ex&&ex.message||ex).slice(0,80);return}
      var name='trackme-report-'+state.from+'-to-'+state.to+'.pdf';
      saveBlob(u8,name,api);close(false);api.toast('Report ready: '+name);
    }}),h('button',{type:'button',class:'btn',text:'Cancel',onclick:function(){close()}})));
    draw();
  }});
}
function saveBlob(u8,name,api){
  var blob=new Blob([u8],{type:'application/pdf'}),url=URL.createObjectURL(blob);
  if('download' in HTMLAnchorElement.prototype){var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},4000)}
  else{
    try{var f=new File([blob],name,{type:'application/pdf'});if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:name}).catch(function(){});return}}catch(e){}
    window.open(url,'_blank');
  }
}

/* ================= import: read the PDF with pdf.js, rebuild rows from text positions ================= */
function loadPdfjs(){
  var base=new URL('./vendor/pdfjs/',location.href).href;
  return import(base+'pdf.min.mjs').then(function(m){m.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.mjs';return m});
}
function readItems(api,file,timeoutMs){
  return new Promise(function(resolve,reject){
    var done=false,tm=setTimeout(function(){if(!done){done=true;reject(new Error('timeout'))}},timeoutMs||60000);
    function fail(e){if(!done){done=true;clearTimeout(tm);reject(e)}}
    file.arrayBuffer().then(function(buf){
      var u8=new Uint8Array(buf);
      if(String.fromCharCode.apply(null,u8.subarray(0,5))!=='%PDF-')throw new Error('notpdf');
      return loadPdfjs().then(function(pdfjs){return pdfjs.getDocument({data:u8,isEvalSupported:false,useWorkerFetch:false,disableFontFace:true,verbosity:0}).promise});
    }).then(function(doc){
      var pages=[],chain=Promise.resolve(),i;
      function one(n){return doc.getPage(n).then(function(pg){var vp=pg.getViewport({scale:1});return pg.getTextContent().then(function(tc){
        var its=[];tc.items.forEach(function(it){var s=String(it.str||'');if(!s.trim())return;its.push({s:s.trim(),x:it.transform[4],y:vp.height-it.transform[5],w:it.width,hh:it.height})});
        pages.push({n:n,h:vp.height,items:its})})})}
      for(i=1;i<=Math.min(doc.numPages,200);i++)(function(n){chain=chain.then(function(){return one(n)})})(i);
      return chain.then(function(){return pages});
    }).then(function(pages){if(!done){done=true;clearTimeout(tm);resolve(pages)}},fail);
  });
}
/* group a page's text items into lines (same baseline), left to right */
function toLines(items){
  var s=items.slice().sort(function(a,b){return a.y-b.y||a.x-b.x}),lines=[];
  s.forEach(function(it){var l=lines[lines.length-1];if(l&&Math.abs(l.y-it.y)<=2.6){l.items.push(it)}else lines.push({y:it.y,items:[it]})});
  lines.forEach(function(l){l.items.sort(function(a,b){return a.x-b.x})});return lines;
}
var FR={'½':0.5,'¼':0.25,'¾':0.75,'⅓':0.33,'⅔':0.67};
/* "1¼ katori" -> {qty:1.25, unit:'katori'}; "½ small katori"; "200 ml"; "1/2 cup"; no leading number -> qty 1 */
function parseQty(t){
  t=String(t||'').trim();var m=/^(\d+(?:\.\d+)?)?\s*([½¼¾⅓⅔])?\s*(?:\/(\d+))?\s*(.*)$/.exec(t),q=null,rest=t;
  if(m&&(m[1]||m[2])){
    q=m[1]?parseFloat(m[1]):0;if(m[2])q+=FR[m[2]];
    if(m[3]&&m[1]&&!m[2]){q=parseFloat(m[1])/parseFloat(m[3])}
    rest=m[4]||'';
  }
  var f=/^(\d+)\s*\/\s*(\d+)\s*(.*)$/.exec(t);if(f&&q==null){q=parseFloat(f[1])/parseFloat(f[2]);rest=f[3]}
  if(q==null||!isFinite(q)||q<=0){q=1;rest=t}
  return {qty:Math.round(q*1000)/1000,unit:rest.trim()};
}
function monthIdx(s){for(var i=0;i<12;i++)if(MON[i].toLowerCase().slice(0,3)===s.toLowerCase().slice(0,3))return i;return -1}
function hhmm(s){var m=/^(\d{1,2}):(\d{2})$/.exec(s);return m&&+m[1]<24&&+m[2]<60?pad(+m[1])+':'+m[2]:null}
var DAYRX=/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/;
var RANGERX=/^[A-Za-z]{3},\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*-\s*[A-Za-z]{3},\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/;
var SECTIONS={'Calories':'calories','Macronutrients':'macros','Weight':'weight','Water':'water','Consistency Stats':'stats','Entries':'entries'};
function isoOf(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d)}
function parseReport(pages){
  var out={period:null,goal:null,days:{},weights:[],water:[],unread:[],tracked:null},sect=null,cur=null,hdr=null,row=null,lastTime=null,year0=null;
  function unread(txt,pg){txt=String(txt).slice(0,90);if(txt)out.unread.push('Page '+pg+': '+txt)}
  function dateOf(txt){var m=/^(\d{1,2})\s+([A-Za-z]{3})$/.exec(txt);if(!m)return null;var mi=monthIdx(m[2]);if(mi<0)return null;
    var per=out.period,y=per?+per.from.slice(0,4):(year0||new Date().getFullYear()),c=isoOf(y,mi,+m[1]);
    if(per&&(c<per.from||c>per.to)){var c2=isoOf(+per.to.slice(0,4),mi,+m[1]);if(c2>=per.from&&c2<=per.to)c=c2}return c}
  function flushRow(){
    if(!row)return;var r=row;row=null;
    var name=r.name.join(' ').replace(/\s+/g,' ').trim(),ai=false;
    if(/\)\s+AI$/.test(name)){ai=true;name=name.replace(/\s+AI$/,'')}
    var q='',pm=/^(.*)\(([^()]*)\)\s*$/.exec(name);if(pm){name=pm[1].trim();q=pm[2].trim()}
    var rec={name:name,qtyText:q,time:r.time,kcal:r.kcal,c:r.c,p:r.p,f:r.f,ai:ai,page:r.page,gi:r.gi};
    if(!name||!isFinite(rec.kcal)){unread(r.name.join(' ')||'(row)',r.page);return}
    if(rec.kcal<0){rec.kind='exercise';rec.kcal=-rec.kcal}else rec.kind='food';
    cur.items.push(rec);
  }
  function num(s){var m=/^(-?\d+(?:\.\d+)?)\s*g?$/.exec(String(s||'').trim());return m?parseFloat(m[1]):NaN}
  pages.forEach(function(pg){
    hdr=null;
    toLines(pg.items).forEach(function(ln){
      var its=ln.items,txt=its.map(function(i){return i.s}).join(' ');
      if(ln.y>pg.h-90&&(/^Page \d+ of \d+$/.test(its[its.length-1].s)||its.length<=2&&/^(https?:|[A-Za-z]+$)/.test(its[0].s)))return;   /* footer */
      if(/Page \d+ of \d+$/.test(txt)||/^https?:\/\//.test(txt))return;
      var m;
      if(its.length===1&&(m=RANGERX.exec(its[0].s))){
        var a=monthIdx(m[2]),b=monthIdx(m[5]);if(a>=0&&b>=0){out.period={from:isoOf(+m[3],a,+m[1]),to:isoOf(+m[6],b,+m[4])};year0=+m[3]}return}
      if(its.length===1&&SECTIONS[its[0].s]&&its[0].hh>11){flushRow();sect=SECTIONS[its[0].s];cur=null;hdr=null;return}
      if(its.length===1&&(m=/^(\d+)\s+calories$/.exec(its[0].s))){return}
      if(/^(\d+) calories$/.test(its[0].s)||/budget this period$/.test(txt))return;
      if(m=/^(\d+) of (\d+) days tracked$/.exec(txt)){out.tracked=[+m[1],+m[2]];return}
      if(m=/^Based on a daily goal of (\d+) calories$/.exec(txt)){out.goal=+m[1];return}
      if(/^Based on a daily distribution/.test(txt)||/^\* Based on/.test(txt))return;
      if(sect==='entries'){
        if(its.length===1&&(m=DAYRX.exec(its[0].s))){
          flushRow();var mi=monthIdx(m[3]);
          if(mi<0){unread(txt,pg.n);return}
          var date=isoOf(+m[4],mi,+m[2]);cur=out.days[date]=out.days[date]||{date:date,items:[],total:null,remaining:null};lastTime=null;hdr=null;return;
        }
        if(its.some(function(i){return i.s==='Calories'})&&its.some(function(i){return i.s==='Carbs'})){
          flushRow();hdr={};its.forEach(function(i){if(['Calories','Carbs','Protein','Fat'].indexOf(i.s)>=0)hdr[i.s]=i.x});return}
        if(!cur||!hdr){unread(txt,pg.n);return}
        var cols={Calories:null,Carbs:null,Protein:null,Fat:null},left=[];
        its.forEach(function(it){
          var best=null,bd=1e9;['Calories','Carbs','Protein','Fat'].forEach(function(k){var d=Math.abs(it.x-hdr[k]);if(d<bd){bd=d;best=k}});
          if(bd<=7&&it.x>=hdr.Calories-7)cols[best]=it.s;else left.push(it);
        });
        var label=left.length?left[0].s:'';
        if((label==='Total'||label==='Remaining')&&cols.Calories!==null){
          flushRow();var rec={kcal:num(cols.Calories),c:num(cols.Carbs),p:num(cols.Protein),f:num(cols.Fat)};
          if(label==='Total')cur.total=rec;else cur.remaining=rec;return;
        }
        if(cols.Calories!==null){
          flushRow();var tm=null,nm=[];
          left.forEach(function(it){var t=hhmm(it.s);if(t&&!nm.length&&tm===null)tm=t;else nm.push(it.s)});
          if(tm!==null){lastTime=tm;cur.gn=(cur.gn||0)+1}
          var kcal=num(cols.Calories);
          if(!isFinite(kcal)){unread(txt,pg.n);return}
          row={name:nm,time:lastTime,gi:cur.gn||0,kcal:kcal,c:num(cols.Carbs),p:num(cols.Protein),f:num(cols.Fat),page:pg.n};
          if(!row.time){unread(txt,pg.n);row=null}
          return;
        }
        if(row&&left.length&&left.every(function(i){return !hhmm(i.s)})){left.forEach(function(it){row.name.push(it.s)});return}   /* wrapped name */
        unread(txt,pg.n);return;
      }
      if(sect==='weight'||sect==='water'){
        if(its.some(function(i){return i.s==='Day'})&&its.some(function(i){return i.s==='Date'}))return;
        var dt=its[1]?dateOf(its[1].s):null;
        if(!dt||!/^[A-Za-z]{3}$/.test(its[0].s)){unread(txt,pg.n);return}
        var rest=its.slice(2).map(function(i){return i.s});
        if(sect==='weight'){
          if(rest.every(function(s){return s==='-'}))return;
          var t2=hhmm(rest[0]||''),mk=/^(\d+(?:\.\d+)?)\s*kg$/.exec(rest[1]||'');
          if(mk)out.weights.push({date:dt,time:t2||'08:00',kg:parseFloat(mk[1])});else unread(txt,pg.n);
        }else{
          if(rest.every(function(s){return s==='-'}))return;
          var cups=/^\d+$/.test(rest[0]||'')?+rest[0]:NaN,ml=/^(\d+)\s*ml$/.exec(rest[1]||'');
          if(isFinite(cups))out.water.push({date:dt,cups:cups,ml:ml?+ml[1]:null});else unread(txt,pg.n);
        }
        return;
      }
      /* calories / macros / stats pages and anything else: only counted */
    });
    flushRow();
  });
  return out;
}

/* ================= import: preview and save ================= */
function slotForTime(api,slots,t){
  var best=null,bd=1e9,mins=(+t.slice(0,2))*60+(+t.slice(3,5));
  slots.forEach(function(s){var ty=api.typicalTime(slots,s.id);if(!ty)return;var d=Math.abs((+ty.slice(0,2))*60+(+ty.slice(3,5))-mins);if(d<bd){bd=d;best=s}});
  return best||slots[0];
}
function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'item'}
function makeEntry(api,p,date,it,now,logId){
  var pq=parseQty(it.qtyText),unit=pq.unit||'g',ul=unit.toLowerCase(),G;
  if(/^(g|gm|gms|gram|grams)$/.test(ul))G=pq.qty;else if(/^(ml|millilit\w*)$/.test(ul))G=pq.qty;else if(/^kg$/.test(ul))G=pq.qty*1000;else if(/^(l|litre|liter|litres|liters)$/.test(ul))G=pq.qty*1000;else G=100;
  if(!(G>=0.0001))G=100;
  var mx=Math.max(it.kcal,it.c||0,it.p||0,it.f||0)*100/G;if(mx>900)G=Math.min(5000,G*Math.ceil(mx/900));
  var per={kcal:it.kcal*100/G,p:(it.p||0)*100/G,c:(it.c||0)*100/G,f:(it.f||0)*100/G,fib:0};
  var sl=slotForTime(api,p.slots,it.time);
  var e={id:api.uuid(),date:date,time:it.time,slot:sl.id,slotName:sl.name,foodId:'rp_'+slug(it.name),foodName:it.name.slice(0,80),qty:Math.min(1e6,Math.max(0.0001,pq.qty)),unit:'g',unitLabel:unit.slice(0,80),unitG:Math.min(5000,Math.max(0.0001,G/pq.qty)),grams:G,per100:per,imp:'pdf',updatedAt:now,createdAt:now};
  if(logId)e.logId=logId;
  if(it.ai)e.est='ai';
  return e;
}
function openImport(api,file){
  var h=api.h,S=api.S,p=S.profile,T=S.today;
  if(!p){api.toast('Create your profile first.');return}
  if(file.size>15*1048576){api.toast('That PDF is too large (limit 15 MB).');return}
  var busy=h('p',{id:'ri-busy',role:'status',text:'Reading the PDF on this phone...'}),canceled=false;
  api.openSheet({title:'Import a report',id:'ri-sheet',tall:true,onClose:function(){canceled=true},build:function(body,close){
    var box=h('div',{id:'ri-box'});body.appendChild(box);box.appendChild(busy);
    box.appendChild(h('button',{type:'button',class:'btn',id:'ri-cancel0',text:'Cancel',onclick:function(){canceled=true;close()}}));
    function msg(t){box.replaceChildren(h('p',{id:'ri-msg',role:'alert',text:t}),h('button',{type:'button',class:'btn',id:'ri-close',text:'Close',onclick:function(){close()}}))}
    readItems(api,file,60000).then(function(pages){
      if(canceled)return;
      var rep;try{rep=parseReport(pages)}catch(e){msg('This PDF could not be read as a report.');return}
      var dates=Object.keys(rep.days).sort();
      if(!rep.period&&!dates.length){msg('This PDF does not look like a food report (no period or day tables found). Nothing was changed.');return}
      draw(rep,dates,box,close);
    },function(e){
      if(canceled)return;
      var m=String(e&&e.message||e);
      msg(m==='notpdf'?'That file is not a PDF.':m==='timeout'?'Reading the PDF took too long, so it was stopped.':(location.protocol==='file:'?'Reading PDFs needs the installed web app (opened from its https address), not a local file.':'This PDF could not be read. It may be damaged or protected.'));
    });
  }});
  function draw(rep,dates,box,close){
    var mode='new',existing={},now=Date.now();
    dates.forEach(function(d){existing[d]=api.entriesOn(p.id,d)});
    var wex={};api.loadWeights(p.id).forEach(function(w){wex[w.date]=w});var waterMap=api.loadWater(p.id);
    var nGroups=0,nItems=0,nEx=0,groupsSeen={};
    dates.forEach(function(d){rep.days[d].items.forEach(function(it){if(it.kind==='exercise')nEx++;else nItems++;groupsSeen[d+'|'+it.gi]=1})});nGroups=Object.keys(groupsSeen).length;
    function isDup(d,it){return existing[d].some(function(e){return e.time===it.time&&e.foodName.toLowerCase()===it.name.toLowerCase()&&Math.abs(api.r0(e.adj?e.adj.kcal:e.per100.kcal*e.grams/100)-api.r0(it.kcal))<=1})}
    function isDupEx(d,it){return api.exOn(p.id,d).some(function(x){return x.time===it.time&&Math.abs(api.exKcal(x)-it.kcal)<=1})}
    box.replaceChildren();
    box.appendChild(h('p',{class:'muted small',id:'ri-period',text:rep.period?'Report period: '+dRange(rep.period.from)+' to '+dRange(rep.period.to)+(rep.goal?'. The report used a daily goal of '+rep.goal+' calories (information only, not imported).':'.'):'Period not found in the header.'}));
    box.appendChild(h('p',{id:'ri-counts',class:'ri-counts',text:nGroups+' entries, '+nItems+' items'+(nEx?', '+nEx+' exercise':'')+', '+rep.weights.length+' weight'+(rep.weights.length===1?'':'s')+', '+rep.water.length+' water day'+(rep.water.length===1?'':'s')}));
    var sel=h('div',{role:'radiogroup','aria-label':'What to import',class:'ri-modes'});
    [['new','Import new only (skip what is already there)'],['all','Import all (may duplicate)']].forEach(function(o){
      var r=h('input',{type:'radio',name:'ri-mode',value:o[0],id:'ri-mode-'+o[0],checked:o[0]==='new',onchange:function(){mode=o[0];upd()}});
      sel.appendChild(h('label',{class:'check-row',for:'ri-mode-'+o[0]},r,h('span',{text:o[1]})));
    });
    box.appendChild(sel);
    var list=h('div',{id:'ri-days'});box.appendChild(list);
    dates.forEach(function(d){
      var day=rep.days[d],sec=h('section',{class:'card ri-day','data-date':d},h('h3',{text:dLong(d)}));
      var lastT=null,lastGi=null,sum={kcal:0,c:0,p:0,f:0},ul=h('ul',{class:'plain'});
      day.items.forEach(function(it){
        if(it.time!==lastT||it.gi!==lastGi){lastT=it.time;lastGi=it.gi;ul.appendChild(h('li',{class:'ri-time',text:h24(it.time)}))}
        if(it.kind==='food'){sum.kcal+=it.kcal;sum.c+=it.c||0;sum.p+=it.p||0;sum.f+=it.f||0}
        ul.appendChild(h('li',{class:'ri-item'},h('span',{class:'ri-name',text:it.name+(it.qtyText?' ('+it.qtyText+')':'')+(it.ai?' AI':'')+(it.kind==='exercise'?' (exercise)':'')}),h('span',{class:'muted small ri-nums',text:(it.kind==='exercise'?'burned ':'')+api.r0(it.kcal)+' kcal'+(it.kind==='food'?', C '+api.r0(it.c||0)+' P '+api.r0(it.p||0)+' F '+api.r0(it.f||0):'')})));
      });
      sec.appendChild(ul);
      var tl=day.total,tol=Math.max(1,day.items.length*0.5),ok=!tl||(Math.abs(sum.kcal-tl.kcal)<=tol&&(!isFinite(tl.c)||Math.abs(sum.c-tl.c)<=tol)&&(!isFinite(tl.p)||Math.abs(sum.p-tl.p)<=tol)&&(!isFinite(tl.f)||Math.abs(sum.f-tl.f)<=tol));
      sec.appendChild(h('p',{class:'small ri-total'+(ok?'':' bad'),'data-ok':ok?'1':'0',text:'Items add up to '+api.r0(sum.kcal)+' kcal, C '+api.r0(sum.c)+' P '+api.r0(sum.p)+' F '+api.r0(sum.f)+(tl?'. Report total: '+api.r0(tl.kcal)+' kcal, C '+api.r0(tl.c)+' P '+api.r0(tl.p)+' F '+api.r0(tl.f)+(ok?'. Match.':'. Does not match.'):'. The report has no total for this day.')}));
      list.appendChild(sec);
    });
    if(rep.weights.length||rep.water.length){
      var wc=h('section',{class:'card',id:'ri-wetc'},h('h3',{text:'Weight and water'}));
      rep.weights.forEach(function(w){wc.appendChild(h('p',{class:'small ri-weight',text:dRange(w.date)+' '+h24(w.time)+': '+w.kg+' kg'}))});
      rep.water.forEach(function(w){wc.appendChild(h('p',{class:'small ri-water',text:dRange(w.date)+': '+w.cups+' cups'+(w.ml?' ('+w.ml+' ml)':'')}))});
      box.appendChild(wc);
    }
    if(rep.unread.length){
      var un=h('section',{class:'card',id:'ri-unread'},h('h3',{text:"Couldn't read ("+rep.unread.length+')'}),h('p',{class:'muted small',text:'These lines were not imported:'}));
      rep.unread.slice(0,30).forEach(function(t){un.appendChild(h('p',{class:'small ri-unread-line',text:t}))});
      box.appendChild(un);
    }
    var go=h('button',{type:'button',class:'btn primary grow',id:'ri-import',onclick:doImport}),st=h('p',{class:'muted small',id:'ri-sum'});
    box.appendChild(st);box.appendChild(h('div',{class:'row sticky-actions'},go,h('button',{type:'button',class:'btn',id:'ri-cancel',text:'Cancel',onclick:function(){close()}})));
    function plan(){
      var P={ents:[],exs:[],weights:[],water:[]};
      dates.forEach(function(d){rep.days[d].items.forEach(function(it){
        if(d>T)return;
        if(it.kind==='exercise'){if(mode==='new'&&isDupEx(d,it))return;P.exs.push({d:d,it:it});return}
        if(mode==='new'&&isDup(d,it))return;P.ents.push({d:d,it:it});
      })});
      rep.weights.forEach(function(w){if(w.date>T)return;if(mode==='new'&&wex[w.date])return;P.weights.push(w)});
      rep.water.forEach(function(w){if(w.date>T)return;if(mode==='new'&&waterMap[w.date]&&waterMap[w.date].cups>0)return;P.water.push(w)});
      return P;
    }
    function upd(){var P=plan(),n=P.ents.length+P.exs.length+P.weights.length+P.water.length;st.textContent='Will add '+P.ents.length+' food items'+(P.exs.length?', '+P.exs.length+' exercise':'')+', '+P.weights.length+' weights, '+P.water.length+' water days.';go.textContent=n?'Import '+n+' records':'Nothing new to import';go.disabled=!n}
    function doImport(){
      var P=plan(),lids={},ids=[],exIds=[],prevW=api.loadWeights(p.id),prevWater=JSON.parse(JSON.stringify(api.loadWater(p.id))),t0=Date.now();
      function lid(d,gi){var k=d+'|'+gi;return lids[k]||(lids[k]='l'+api.uuid().replace(/[^\w]/g,'').slice(0,20))}
      P.ents.forEach(function(x){var e=makeEntry(api,p,x.d,x.it,t0,lid(x.d,x.it.gi));api.putEntry(p.id,e);ids.push([e.id,e.date])});
      P.exs.forEach(function(x){
        var kg=api.weightOn(p.id,p,x.d),mins=Math.max(0.1,(function(){var m=/(\d+(?:\.\d+)?)\s*min/.exec(x.it.qtyText);return m?parseFloat(m[1]):30})()),km=/(\d+(?:\.\d+)?)\s*km/.exec(x.it.qtyText);
        var met=Math.min(25,Math.max(0.5,x.it.kcal*60/(kg*mins)));
        var xo={id:api.uuid(),date:x.d,time:x.it.time,actKey:'other',label:x.it.name.slice(0,40)||'Exercise',minutes:mins,met:met,kgUsed:kg,kcal:x.it.kcal,imp:'pdf',logId:lid(x.d,x.it.gi),updatedAt:t0,createdAt:t0};
        if(km)xo.distanceKm=parseFloat(km[1]);api.putEx(p.id,xo);exIds.push([xo.id,xo.date]);
      });
      if(P.weights.length){var ws=api.loadWeights(p.id).filter(function(w){return !P.weights.some(function(q){return q.date===w.date})});P.weights.forEach(function(w){ws.push({date:w.date,kg:w.kg,time:w.time,updatedAt:t0})});api.saveWeights(p.id,ws)}
      P.water.forEach(function(w){var cups=w.ml&&w.cups?Math.round(w.ml/(p.cupMl||250)):w.cups;api.setCups(p.id,w.date,cups||w.cups)});
      close(false);api.render();
      api.toast('Imported '+P.ents.length+' food items'+(P.exs.length?', '+P.exs.length+' exercise':'')+(P.weights.length?', '+P.weights.length+(P.weights.length>1?' weights':' weight'):'')+(P.water.length?', '+P.water.length+' water days':''),'Undo',function(){
        ids.forEach(function(x){api.removeEntry(p.id,x[0],x[1])});exIds.forEach(function(x){api.removeEx(p.id,x[0],x[1])});
        api.saveWeights(p.id,prevW);
        var cur=api.loadWater(p.id);P.water.forEach(function(w){if(prevWater[w.date])api.setCups(p.id,w.date,prevWater[w.date].cups);else api.setCups(p.id,w.date,0)});
        api.render();
      });
    }
    upd();
  }
}
window.TMReport={buildPdf:buildPdf,fracQty:fracQty,groupItems:groupItems,buildData:buildData,openExport:openExport,openImport:openImport,parseReport:parseReport,parseQty:parseQty,toLines:toLines,version:1};
})();
