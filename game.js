(() => {
'use strict';
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const TILE = 40, COLS = 24, ROWS = 16;
const state = {
  day: 1, season: 'Spring', time: 360, energy: 100, gold: 120,
  player: {x: 14, y: 11, face: 'down'}, selected: 'hoe',
  seeds: 5, parsnips: 0, wood: 0, stone: 0, strawberrySeeds: 0,
  plantedTotal: 0, wateredToday: 0, crops: {}, tilled: new Set(), wet: new Set(),
  rocks: new Set(['5,12','7,13','19,11']), stumps: new Set(['3,10','20,8']),
  toastTimer: 0, marketOpen: false, lastMove: 0, questPaid: false,
  decorations: [],
};
const key = (x,y) => `${x},${y}`;
const cropAt = (x,y) => state.crops[key(x,y)];
let dpr = 1, tileSize = 40, offsetX = 0, offsetY = 0, lastFrame = 0, rainDrop = 0;

function resize(){
 const r = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
 canvas.width = Math.round(r.width*dpr); canvas.height = Math.round(r.height*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 tileSize = Math.min(r.width/COLS, r.height/ROWS);
 offsetX = (r.width-COLS*tileSize)/2; offsetY=(r.height-ROWS*tileSize)/2;
}
window.addEventListener('resize',resize); resize();
function rng(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)}
function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function text(str,x,y,size,color,weight='600',align='center'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px "DM Sans", sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(str,x,y)}
function box(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
function tileType(x,y){
 // A soft lawn, winding paths, a little pond, and a working patch beside the cottage.
 if ((x>=8&&x<=13&&y>=7&&y<=10) || (x>=6&&x<=14&&y===8)) return 'plot';
 if ((y>=2&&y<=4&&x>=3&&x<=19) || (x>=15&&x<=19&&y>=4&&y<=8) || (x>=7&&x<=14&&y>=10&&y<=12)) return 'path';
 if ((x-3.5)**2/5+(y-12.5)**2/2.5<1) return 'water';
 return 'grass';
}
const blocked = new Set(['18,4','19,4','20,4','18,5','19,5','20,5','18,6','19,6','20,6','18,7','19,7','20,7','4,3','5,3','4,4','5,4']);
function drawGrass(x,y,s){
 const r=rng(y*COLS+x);
 box(x,y,s,s,['#91bd79','#95c27d','#8fba76','#9bc582'][Math.floor(r*4)]);
 // subtle, hand-painted grass speckles
 for(let i=0;i<3;i++){let px=x+rng(x*17+y*9+i)*s,py=y+rng(x*5+y*19+i+4)*s;box(px,py,Math.max(1,s*.045),Math.max(1,s*.065),i===0?'#b4d18c':'#79a969')}
}
function drawPath(x,y,s){
 const r=rng(x*31+y*73);box(x,y,s,s,r>.5?'#dfc99b':'#e4d0a4');
 for(let i=0;i<4;i++){let px=x+rng(i+x*8+y*7)*s,py=y+rng(i*2+x*9+y*3)*s;ellipse(px,py,s*.055,s*.04,i%2?'#c9b486':'#ead9b5')}
}
function drawWater(x,y,s){
 const r=rng(x*5+y*15);box(x,y,s,s,'#77c3c0');
 ctx.strokeStyle='#a5dcce';ctx.lineWidth=Math.max(1,s*.035);ctx.beginPath();ctx.moveTo(x+s*.18,y+s*(.35+r*.25));ctx.quadraticCurveTo(x+s*.5,y+s*(.25+r*.3),x+s*.82,y+s*(.42+r*.25));ctx.stroke();
 if(r>.72) ellipse(x+s*.7,y+s*.72,s*.08,s*.025,'#d7e8ba');
}
function drawPlotBase(x,y,s,tx,ty){
 box(x,y,s,s,'#8fba76');rounded(x+s*.11,y+s*.13,s*.78,s*.73,s*.11,'#aa8054');
 box(x+s*.15,y+s*.19,s*.7,s*.08,'#bd9461');box(x+s*.15,y+s*.72,s*.7,s*.07,'#8d6949');
 const crop=cropAt(tx,ty);
 if(state.wet.has(key(tx,ty))) box(x+s*.17,y+s*.3,s*.66,s*.35,'#825d4a');
 if(crop) drawCrop(x,y,s,crop);
 if(state.tilled.has(key(tx,ty))&&!crop&&!state.wet.has(key(tx,ty))){ellipse(x+s*.5,y+s*.47,s*.045,s*.035,'#d2aa70')}
}
function drawCrop(x,y,s,c){
 const cx=x+s*.5, cy=y+s*.51, growth=c.growth;
 if(c.kind==='strawberry'){
   let h=s*(.17+growth*.08);box(cx-s*.04,cy-h*.3,s*.08,h*.56,'#528d4d');
   ellipse(cx-s*.12,cy-h*.28,s*.13,s*.075,'#62a45b');ellipse(cx+s*.11,cy-h*.39,s*.13,s*.075,'#78b45d');
   if(growth>=3){ellipse(cx,cy+s*.05,s*.14,s*.14,'#e96958');ellipse(cx-s*.14,cy+s*.02,s*.12,s*.12,'#ef765d');}
 } else if(growth===0){
   box(cx-s*.035,cy-s*.05,s*.07,s*.13,'#6b9c50');ellipse(cx-s*.07,cy-s*.06,s*.09,s*.045,'#80b55e');ellipse(cx+s*.07,cy-s*.02,s*.09,s*.045,'#89bd67');
 } else {
   const h=s*(.16+growth*.085);box(cx-s*.035,cy-h*.25,s*.07,h*.6,'#4e8d50');
   ellipse(cx-s*.1,cy-h*.42,s*.14,s*.07,'#74ad59');ellipse(cx+s*.1,cy-h*.23,s*.15,s*.075,'#87b960');
   if(growth>=3){ellipse(cx,cy-s*.19,s*.12,s*.13,'#f1cb63');ellipse(cx-s*.1,cy-s*.16,s*.05,s*.08,'#fff0a8');}
 }
}
function drawTree(x,y,s,small=false){
 const cx=x+s*.5, scale=small?.7:1;
 ellipse(cx+s*.02,y+s*.81,s*.34,s*.13,'#355d3d44');
 box(cx-s*.08,y+s*.53,s*.16,s*.38,'#8b6545');
 ellipse(cx,y+s*.38,s*.39*scale,s*.4*scale,'#4a8556');ellipse(cx-s*.18,y+s*.35,s*.25*scale,s*.27*scale,'#589563');ellipse(cx+s*.2,y+s*.23,s*.24*scale,s*.27*scale,'#639d68');
 ellipse(cx-s*.11,y+s*.24,s*.07,s*.06,'#84b978');ellipse(cx+s*.19,y+s*.41,s*.08,s*.05,'#78ad6a');
}
function drawCottage(x,y,s){
 const px=x+s*.3, py=y+s*.35,w=s*3.4,h=s*3.05;
 ellipse(px+w*.52,py+h*.94,w*.65,s*.19,'#426a4b55');
 // house walls
 box(px,py+s*.72,w,h-s*.72,'#e9c98e');box(px+s*.15,py+s*.85,w-s*.3,h-s*.95,'#f3d9a6');
 // roof
 ctx.fillStyle='#426b59';ctx.beginPath();ctx.moveTo(px-s*.2,py+s*.83);ctx.lineTo(px+w*.5,py-s*.1);ctx.lineTo(px+w+s*.2,py+s*.83);ctx.closePath();ctx.fill();
 ctx.fillStyle='#527b64';ctx.beginPath();ctx.moveTo(px+s*.05,py+s*.68);ctx.lineTo(px+w*.52,py+s*.05);ctx.lineTo(px+w*.95,py+s*.68);ctx.closePath();ctx.fill();
 box(px+s*.5,py+s*1.35,s*.65,s*.75,'#9b6849');rounded(px+s*1.45,py+s*1.35,s*.85,s*.8,s*.07,'#86b6bd');box(px+s*1.55,py+s*1.43,s*.64,s*.06,'#d7eeee');box(px+s*1.85,py+s*1.39,s*.06,s*.69,'#d7eeee');
 box(px+s*.52,py+s*2.15,s*.61,s*.12,'#c89a64');ellipse(px+s*1.02,py+s*1.77,s*.04,s*.04,'#f0d47a');
 rounded(px+w*.69,py+s*.78,s*.48,s*.22,s*.05,'#f3e7c2');text('FERN',px+w*.93,py+s*.89,s*.105,'#587a60','800');
}
function drawMarket(x,y,s){
 const px=x+s*.08,py=y+s*.2;
 ellipse(px+s*.65,py+s*1.1,s*.75,s*.12,'#48664c44');
 box(px+s*.12,py+s*.62,s*1.08,s*.47,'#9b6845');box(px+s*.2,py+s*.69,s*.92,s*.29,'#c78c5b');
 ctx.fillStyle='#e7b963';ctx.beginPath();ctx.moveTo(px,py+s*.64);ctx.lineTo(px+s*.28,py+s*.08);ctx.lineTo(px+s*1.15,py+s*.08);ctx.lineTo(px+s*1.4,py+s*.64);ctx.closePath();ctx.fill();
 for(let i=0;i<4;i++)box(px+s*(.26+i*.25),py+s*.11,s*.12,s*.5,i%2?'#fff0c8':'#e88763');
 text('SEEDS',px+s*.68,py+s*.81,s*.13,'#fff4d8','800');
}
function drawFence(x,y,s){
 box(x+s*.1,y+s*.47,s*.8,s*.13,'#c69b66');box(x+s*.1,y+s*.73,s*.8,s*.13,'#b78d5d');
 for(let i=0;i<3;i++){let px=x+s*(.16+i*.34);box(px,y+s*.34,s*.1,s*.57,'#d2ad79');ctx.beginPath();ctx.moveTo(px-s*.02,y+s*.37);ctx.lineTo(px+s*.05,y+s*.23);ctx.lineTo(px+s*.12,y+s*.37);ctx.fillStyle='#d2ad79';ctx.fill()}
}
function drawWorld(){
 const s=tileSize;ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);ctx.save();ctx.translate(offsetX,offsetY);
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
   const px=x*s,py=y*s,type=tileType(x,y);
   if(type==='grass')drawGrass(px,py,s);else if(type==='path')drawPath(px,py,s);else if(type==='water')drawWater(px,py,s);else drawPlotBase(px,py,s,x,y);
 }
 // Scattered garden flowers, deliberately placed outside the main paths
 for(const [x,y,c] of [[2,6,'#f2d578'],[6,5,'#ef9b91'],[14,4,'#fff0ce'],[22,9,'#eea3a0'],[15,13,'#e4cb73'],[2,8,'#fff0cf'],[11,5,'#d792a7'],[22,13,'#f5d875']]){
   const px=x*s,py=y*s;ellipse(px+s*.5,py+s*.72,s*.045,s*.13,'#598951');for(let i=0;i<5;i++){let a=i*Math.PI*2/5;ellipse(px+s*.5+Math.cos(a)*s*.09,py+s*.52+Math.sin(a)*s*.07,s*.055,s*.045,c)}ellipse(px+s*.5,py+s*.52,s*.035,s*.03,'#f3d16a');
 }
 // Fence around the homestead, with a welcoming gap
 for(let x=1;x<22;x++){if(x!==14&&x!==15){drawFence(x*s,1*s,s);drawFence(x*s,14*s,s)}}
 for(let y=2;y<14;y++){drawFence(1*s,y*s,s);drawFence(22*s,y*s,s)}
 // Landmark props
 drawMarket(4*s,3*s,s);drawCottage(18*s,4*s,s);
 // Trees in stable little clusters
 const trees=[[2,2],[8,2],[10,2],[21,2],[22,3],[2,5],[2,10],[6,12],[16,2],[21,10],[21,12],[16,14],[18,13],[5,6],[23,6]];
 for(const [x,y] of trees){if(!(x>=7&&x<=14&&y>=6&&y<=11))drawTree(x*s,y*s,s)}
 // Decorative stones and fallen logs
 for(const k of state.rocks){const [x,y]=k.split(',').map(Number);ellipse((x+.5)*s,(y+.68)*s,s*.23,s*.13,'#797f70');ellipse((x+.47)*s,(y+.58)*s,s*.19,s*.16,'#a8a994');ellipse((x+.42)*s,(y+.55)*s,s*.055,s*.035,'#d0cfb6')}
 for(const k of state.stumps){const [x,y]=k.split(',').map(Number);ellipse((x+.5)*s,(y+.67)*s,s*.29,s*.13,'#74543d');ellipse((x+.5)*s,(y+.57)*s,s*.21,s*.12,'#bd9361');ellipse((x+.5)*s,(y+.56)*s,s*.13,s*.07,'#ddbd84')}
 drawPlayer(s);
 ctx.restore();
}
