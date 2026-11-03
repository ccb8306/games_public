import {SCORE_CATEGORIES,type RoomState,type PublicPlayer,type ScoreCategory} from './index.js';
export const NOVEL_IDS=['customDie','monster','custody','estate','crown'];
export const turnsLeft=(p:PublicPlayer)=>Object.values(p.scores).filter(v=>v===null).length;
export function estateReward(p:PublicPlayer,c:ScoreCategory,base:number){
 const e=p.augment?.estate;if(!e||!e.plots.includes(c)||base<=0||e.completed.includes(c)||e.ruined.includes(c))return 0;
 const successes=e.completed.length+1;
 return Math.max(0,(successes===3?32:successes===2?8:0)-e.paid);
}
export function novelStart(s:RoomState,p:PublicPlayer){
 const link=s.augment!.custody?.find(l=>(l.a===p.id&&l.aLeft>0)||(l.b===p.id&&l.bLeft>0));
 if(link){const i=s.held.findIndex(v=>!v);if(i>=0){s.augment!.turn.childIndex=i;if(link.face!==null){s.dice[i]=link.face;s.held[i]=true;}}}
}
export function novelRecord(s:RoomState,p:PublicPlayer,c:ScoreCategory,base:number,result:(text:string)=>void){
 const a=s.augment!,e=p.augment!.estate;
 if(e&&e.plots.includes(c)&&!e.completed.includes(c)&&!e.ruined.includes(c)){(base>0&&(p.scores[c]??0)>0?e.completed:e.ruined).push(c);const n=e.completed.length;e.paid=Math.max(e.paid,n===3?32:n===2?8:0);}
 for(const link of a.custody??[]){
  const key=link.a===p.id?'aLeft':link.b===p.id?'bLeft':null;
  if(key&&link[key]>0){
   const face=s.dice[a.turn.childIndex??-1];
   if(face!==null&&face!==undefined){const recipient=s.players.find(q=>q?.id===(face>=4?p.id:link.a===p.id?link.b:link.a));if(recipient){const paidKey=recipient.id===link.a?'aPaid':'bPaid';const paid=Math.min(6,18-(link[paidKey]??0));link[paidKey]=(link[paidKey]??0)+paid;recipient.augment!.bonus+=paid;result(`${recipient.nickname} · 공동 육아 ${face}: +${paid}점 지급 완료`);}}
link[key]--;const i=a.turn.childIndex;if(i!==undefined)link.face=s.dice[i]??null;result(`${p.nickname} · 공동 주사위 ${link.face} 전달! 남은 육아 ${link.aLeft}/${link.bLeft}턴`);}
 }
 a.custody=a.custody?.filter(l=>l.aLeft>0||l.bLeft>0);
 const crown=a.crown;if(!crown||crown.finished)return;
 const entry=crown.entries.find(e=>e.id===p.id&&e.left>0);if(!entry)return;
 entry.left--;
 if(base>=25&&(!crown.claimed||base>crown.threshold)){
  crown.holder=p.id;crown.threshold=base;crown.claimed=true;
  result(`${p.nickname} · 왕관 탈취! 기본 ${base}점 · 다음 기준 ${crown.threshold}점 초과`);
 }
 crown.entries=crown.entries.filter(e=>s.players.some(q=>q?.id===e.id&&!q.forfeited));
 if(crown.entries.every(e=>e.left===0)){
  crown.finished=true;const winner=s.players.find(q=>q?.id===crown.holder&&!q.forfeited);
  if(winner){winner.augment!.bonus+=40;result(`${winner.nickname} · 왕관 최종 우승! 보너스 +40점 지급 완료`);}
  else result('왕관 보유자 기권 · 우승 보상 없이 종료');
 }
}
export function physicalFaces(s:RoomState):number[]|undefined{
 return s.players.find(p=>p?.id===s.currentPlayerId)?.augment?.customFaces;
}
export function displayedFaces(s:RoomState){const base=physicalFaces(s);return base?s.dice.map((_,i)=>s.augment?.turn.customOverride?.[i]??base):undefined;}
export function monsterIndex(s:RoomState){const m=s.augment?.turn.monster;return m&&!m.split?m.index:undefined;}

// A regular dodecahedron shared by the collision mesh and the visible mesh.
type V=[number,number,number];
const phi=(1+Math.sqrt(5))/2;
const vertices:V[]=[];
for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
for(const a of [-1,1])for(const b of [-1,1])vertices.push([0,a/phi,b*phi],[a/phi,b*phi,0],[a*phi,0,b/phi]);
const sub=(a:V,b:V):V=>a.map((n,i)=>n-b[i]!) as V;
const dot=(a:V,b:V)=>a.reduce((s,n,i)=>s+n*b[i]!,0);
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(v:V):V=>v.map(n=>n/Math.hypot(...v)) as V;
const faces:{indices:number[];normal:V}[]=[];
for(let i=0;i<20;i++)for(let j=i+1;j<20;j++)for(let k=j+1;k<20;k++){
 let n=cross(sub(vertices[j]!,vertices[i]!),sub(vertices[k]!,vertices[i]!));if(Math.hypot(...n)<1e-6)continue;n=unit(n);
 if(dot(n,vertices[i]!)<0)n=n.map(v=>-v) as V;
 const h=dot(n,vertices[i]!);if(vertices.some(v=>dot(n,v)>h+1e-6))continue;
 const ids=vertices.flatMap((v,l)=>Math.abs(dot(n,v)-h)<1e-6?[l]:[]);if(ids.length!==5||faces.some(f=>f.indices.every(x=>ids.includes(x))))continue;
 const center=n.map(v=>v*h) as V,u=unit(sub(vertices[ids[0]!]!,center)),v=cross(n,u);
 ids.sort((a,b)=>Math.atan2(dot(sub(vertices[a]!,center),v),dot(sub(vertices[a]!,center),u))-Math.atan2(dot(sub(vertices[b]!,center),v),dot(sub(vertices[b]!,center),u)));
 faces.push({indices:ids,normal:n});
}
export const D12={vertices:vertices.map(v=>v.map(x=>x*.42) as V),faces};
