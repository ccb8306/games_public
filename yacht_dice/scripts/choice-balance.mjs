import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {AUGMENTS,categoryScore,SCORE_CATEGORIES} from '../shared/dist/index.js';
let seed=20261106;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const die=()=>1+Math.floor(random()*6),roll=n=>Array.from({length:n},die);
const samples=Number(process.argv[2]??1000),results=[];
const best=(dice,keys)=>Math.max(...keys.map(k=>categoryScore(k,dice)));
function holds(dice){const counts=Array.from({length:6},(_,i)=>dice.filter(n=>n===i+1).length);const favorite=counts.indexOf(Math.max(...counts))+1;return dice.map(n=>n===favorite);}
function finish(dice,keys,rolls=2,locked=[]){
 for(let r=0;r<rolls;r++){const held=holds(dice);dice=dice.map((n,i)=>locked.includes(i)||held[i]?n:die());}return best(dice,keys);
}
for(const count of [5,6,7]){
 const sums={tomorrow:0,memory:0,inspection:0,practice:0,dropIt:0,hostage:0};let pay=0;
 for(let i=0;i<samples;i++){
  const keys=SCORE_CATEGORIES.filter(()=>random()<.45);if(!keys.length)keys.push('choice');
  const first=roll(count),history=Array.from({length:4},()=>roll(5)),saved=history[0].find(n=>n<=3);
  const candidates={tomorrow:saved===undefined?first:[7-saved,...first.slice(1)],memory:history.map(d=>[...d,...first.slice(5)]).sort((a,b)=>best(b,keys)-best(a,keys))[0],dropIt:[...first],practice:[...first]};
  const high=first.indexOf(Math.max(...first));candidates.dropIt[high]=1;candidates.practice[high]=die();
  let base=0,normal=0;const totals={tomorrow:0,memory:0,inspection:0,practice:0,dropIt:0};const futures=12;
  for(let k=0;k<futures;k++){
   base+=finish([...first],keys);for(const id of Object.keys(candidates))totals[id]+=finish([...candidates[id]],keys);
   const held=holds(first),pool=held.flatMap((v,j)=>v?[j]:[]);for(let n=0;n<2&&pool.length;n++)held[pool.splice(Math.floor(random()*pool.length),1)[0]]=false;
   const second=first.map((n,j)=>held[j]?n:die());totals.inspection+=finish(second,keys,1);
  }
  normal=base/futures;
  for(const id of Object.keys(totals))sums[id]+=totals[id]/futures-normal;
  let sealed=-Infinity;
  for(let a=0;a<count;a++)for(let b=a+1;b<count;b++)for(let c=b+1;c<count;c++){let value=0;for(let k=0;k<futures;k++){const copy=[...first];copy[a]=copy[b]=copy[c]=1;value+=finish(copy,keys,2,[a,b,c]);}sealed=Math.max(sealed,value/futures);}
  if(normal-30>sealed)pay++;sums.hostage+=Math.max(normal-30,sealed)-normal;
 }
 const deltas=Object.fromEntries(Object.entries(sums).map(([k,v])=>[k,v/samples]));assert.ok(Object.values(deltas).every(Number.isFinite));
 results.push({dice:count,samples,targetTurnScoreDeltas:deltas,hostagePayRate:pay/samples});
}
const ids=['tomorrow','inspection','memory','dropIt','receipt','broken','construction','closed','hostage','practice','misdelivery','goldRush'];
const report={seed:20261106,method:'Scenario screening using synthetic uniform dice, random remaining categories, duplicate-keeping rerolls and 12 continuations. Memory chooses among four random archived results by immediate category score. Hostage assumes enough money. Choice estimation has sampling optimism; not optimal play, physical probability, full-game win rates or synergy estimates. Zero-cost activation opportunities and charge frequency are not modeled.',results,cards:AUGMENTS.filter(d=>ids.includes(d.id)),bounds:{receiptPerUse:{caster:5,targetLoss:5},hostageRansom:30,closed:'One recorded lower category exchanged; not capped damage; once per victim; both can shield.',goldRush:'Caster receives 20 points and refills incoming gold; other seats preserve spent history; shielded players and borrowed items excluded.'}};
await mkdir('artifacts/augments',{recursive:true});
await writeFile('artifacts/augments/rework-choice-balance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
