import {mkdir,writeFile} from 'node:fs/promises';
import {AUGMENTS,emptyScorecard,initAugment,useAugment,afterAugmentRoll,augmentedScore,recordAugment,advanceAugment,playerTotals,SCORE_CATEGORIES,pendingInstant} from '../shared/dist/index.js';
const games=Number(process.argv[2]??10000);let seed=20261029;
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
const cards=Object.fromEntries(AUGMENTS.map(d=>[d.id,{name:d.name,picks:0,wins:0,total:0}]));
let sum=0,max=0,min=Infinity,actions=0;
function attempt(s,p,id,args={}){const def=AUGMENTS.find(d=>d.id===id),t=s.augment.turn;
 if(def ? !p.augment.items.some(i=>i.id===id&&i.remaining!==0&&i.usedTurn!==t.serial) : s.augment.event!==id||t.flags.includes(id))return false;
 const before=structuredClone(s);try{useAugment(s,p,{op:'use',id,...args},random);actions++;return true;}catch{Object.assign(s,before);return false;}}
function best(s,p){let category,score=-Infinity;for(const k of SCORE_CATEGORIES){if(p.scores[k]!==null)continue;const n=augmentedScore(s,p,k).total;if(n>score){score=n;category=k;}}return category;}
function simulate(){
 const s={mode:'augment',phase:'playing',players:[0,1].map(slot=>({id:String(slot),slot,nickname:String(slot),connected:true,forfeited:false,scores:emptyScorecard()})),currentPlayerId:'0',dice:Array(5).fill(null),held:Array(5).fill(false),rollCount:0,rollPhase:'idle'};initAugment(s,random);
 for(let turn=0;turn<24;turn++){
  if(s.augment.drafting){
   for(let i=0;i<2;i++){const p=s.players[i];useAugment(s,p,{op:'pick',id:p.augment.offers[random(p.augment.offers.length)]},random);}
   for(let i=0;i<2;i++){
    let p=s.players[i],id=pendingInstant(p);if(!id)continue;const q=s.players[1-i];
    for(const their of [...q.augment.items])for(const mine of [...p.augment.items]){
     p=s.players[i];if(pendingInstant(p))attempt(s,p,id,{target:q.id,other:their.id,category:mine.id});
    }
   }
   if(s.augment.drafting)throw Error('Draft did not resolve');
  }
  const slot=Number(s.currentPlayerId);let p=s.players[slot];
  for(const id of ['target','loan','devil','revive','bomb','debt']){p=s.players[slot];attempt(s,p,id,{category:SCORE_CATEGORIES.filter(k=>p.scores[k]===null)[random(SCORE_CATEGORIES.filter(k=>p.scores[k]===null).length)],die:0,value:6});}
  const rolls=1+random(s.augment.turn.maxRolls);
  for(let r=1;r<=rolls;r++){
   s.dice=s.dice.map((n,i)=>s.held[i]?n:1+random(6));s.rollCount=r;afterAugmentRoll(s,random);
   const counts=Array.from({length:6},(_,i)=>s.dice.filter(n=>n===i+1).length),fav=counts.indexOf(Math.max(...counts))+1;
   s.held=s.dice.map((n,i)=>n===fav||s.augment.turn.locked===i);
   if(r===1)s.augment.turn.kept=s.held.flatMap((v,i)=>v?[i]:[]);else s.augment.turn.kept=s.augment.turn.kept.filter(i=>s.held[i]);
  }
  for(const id of ['nudge','evolution','clone','alchemy','mirror','flip','choiceRoll','cat','thief','lock','seal','duel','erase','parallel','substitute','exchange','chaos','worldFlip','reverse','wild']){
   p=s.players[slot];const minimum=Math.min(...s.dice),die=s.dice.indexOf(minimum),q=s.players[1-slot];
   const main=id==='parallel'?best(s,p):null;
   const category=id==='erase'?SCORE_CATEGORIES.find(k=>p.scores[k]===0):id==='parallel'?SCORE_CATEGORIES.find(k=>p.scores[k]===null&&k!==main):undefined;
   const value=id==='clone'?s.dice.indexOf(Math.max(...s.dice)):id==='nudge'?Math.min(6,minimum+1):id==='evolution'?Math.min(6,minimum+2):6;
   if(!attempt(s,p,id,{die,value,target:q.id,category,indices:s.dice.flatMap((n,i)=>n<4?[i]:[])}))continue;
   if(s.augment.turn.reroll){const rr=s.augment.turn.reroll;s.dice[rr.index]=1+random(6);s.rollCount++;s.rollPhase='idle';afterAugmentRoll(s,random);if(s.augment.turn.chooseOld)useAugment(s,s.players[slot],{op:'keepOld',value:rr.old>s.dice[rr.index]?1:0},random);}
   if(s.augment.turn.oldWorld){s.dice=s.dice.map(()=>1+random(6));s.rollCount=s.augment.turn.maxRolls;useAugment(s,s.players[slot],{op:'world',value:0},random);}
  }
  p=s.players[slot];
  let category=best(s,p);if(s.augment.turn.parallel===category)category=SCORE_CATEGORIES.find(k=>p.scores[k]===null&&k!==category)??category;
  recordAugment(s,p,category);advanceAugment(s,random);
 }
 const totals=s.players.map(p=>playerTotals(p).total),winner=Math.max(...totals);
 for(const p of s.players){const total=playerTotals(p).total;sum+=total;max=Math.max(max,total);min=Math.min(min,total);for(const i of p.augment.items){const c=cards[i.id];c.picks++;c.total+=total;if(total===winner)c.wins++;}}
}
for(let i=0;i<games;i++){simulate();if((i+1)%1000===0)console.log(`${i+1}/${games}`);}
const report={games,playersPerGame:2,seed:20261029,method:'Deterministic heuristic bots, uniform synthetic rolls; stress/balance signal, not physical fairness or causal win contribution.',meanScore:sum/(games*2),min,max,abilityActions:actions,cards:Object.entries(cards).map(([id,c])=>({id,...c,winRate:c.picks?c.wins/c.picks:null,meanScore:c.picks?c.total/c.picks:null}))};
await mkdir('artifacts/augments',{recursive:true});await writeFile('artifacts/augments/balance.json',JSON.stringify(report,null,2));console.log(JSON.stringify({games,meanScore:report.meanScore,min,max,abilityActions:actions}));
