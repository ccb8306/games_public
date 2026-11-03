import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {AUGMENTS,SCORE_CATEGORIES,emptyScorecard,initAugment,useAugment,afterAugmentRoll,augmentedScore as actualScore,recordAugment,advanceAugment,playerTotals,blockedCategory,flashTargets} from '../shared/dist/index.js';
const scoreCaches=new WeakMap();
function augmentedScore(s,p,c){
 let cache=scoreCaches.get(s);if(!cache){cache=new Map();scoreCaches.set(s,cache);}if(cache.size>1000)cache.clear();
 const t=s.augment.turn,key=[t.serial,s.rollCount,s.dice.join(''),t.flags.join(','),t.kept.join(','),t.extra,t.target,p.id,c,p.augment.streak,p.augment.savingsPaid,p.augment.items.map(i=>i.id).join(',')].join('|');
 if(!cache.has(key))cache.set(key,actualScore(s,p,c));return cache.get(key);
}
const samples=Number(process.argv[2]??2000);
const output=process.env.BALANCE_OUTPUT??"focused";
const only=(process.env.BALANCE_IDS??"").split(",").filter(Boolean);
const partition=Number(process.argv[3]??0), partitions=Number(process.argv[4]??1);
const scenarioOnly=new Set(['loan','thief','duel','parallel','handsUp','strike','squid','collector','artisan','fakeHouse','chance','tomorrow','inspection','memory','dropIt','receipt','broken','construction','closed','hostage','practice','misdelivery','goldRush','fork','bombParcel','taste','bounty']);
if(only.some(id=>scenarioOnly.has(id)))throw Error('These cards require scripts/choice-balance.mjs and scripts/stress-augments.mjs; this legacy paired bot does not support their choices.');
const face=(seed,turn,roll,die)=>{let x=(seed^Math.imul(turn+1,73856093)^Math.imul(roll+1,19349663)^Math.imul(die+1,83492791))>>>0;x=Math.imul(x^(x>>>16),0x45d9f3b);return 1+((x^(x>>>16))>>>0)%6;};
function play(card,seed,enabled){
 const count=2+seed%3,actor=seed%count,start=card.rarity==='silver'?1:card.rarity==='gold'?4:10;
 const s={mode:'augment',phase:'playing',players:Array.from({length:count},(_,slot)=>({id:String(slot),slot,nickname:String(slot),connected:true,forfeited:false,scores:emptyScorecard()})),currentPlayerId:'0',dice:[],held:[],rollCount:0,rollPhase:'idle',revision:0};
 initAugment(s,n=>n===100?99:0);s.augment.drafting=false;s.augment.round=start;
 for(const p of s.players){p.augment.offers=[];for(const k of SCORE_CATEGORIES.slice(0,start-1))p.scores[k]=0;}
 const grant=(p,id)=>{const d=AUGMENTS.find(x=>x.id===id);p.augment.items.push({id,remaining:d.charges,usedTurn:-1,usedRound:-1});};
 // Give all seats a common gold to exercise copying, suppression and swaps.
 for(const p of s.players)grant(p,['swap','doppel'].includes(card.id)?(p.slot===actor?'fourth':'clone'):seed%2?'clone':'fourth');
 if(enabled)grant(s.players[actor],card.id);
 const attempt=(p,id,args={})=>{try{useAugment(s,p,{op:'use',id,...args},()=>0);return true;}catch{return false;}};
 for(let turn=0;turn<count*(13-start);turn++){
  s.augment.drafting=false;for(const p of s.players)p.augment.offers=[];
  let p=s.players.find(p=>p.id===s.currentPlayerId),slot=p.slot;
  const own=id=>s.players[slot].augment.items.some(i=>i.id===id&&i.remaining!==0);
  const empty=()=>SCORE_CATEGORIES.filter(k=>s.players[slot].scores[k]===null&&!blockedCategory(s.players[slot],k));
  for(const id of ['swap','doppel'])if(own(id)){
   for(const q of s.players.filter(q=>q.slot!==slot))for(const other of [...q.augment.items])for(const mine of [...s.players[slot].augment.items])if(own(id))attempt(s.players[slot],id,{target:q.id,other:other.id,category:mine.id});
  }
  for(const id of ['loan','devil','revive','target'])if(own(id))attempt(s.players[slot],id,{category:empty()[0],die:0,value:6});
  for(const i of [...s.players[slot].augment.items])if(AUGMENTS.find(d=>d.id===i.id)?.flash&&i.remaining!==0){
   const candidates=[{}];
   for(const q of s.players.filter(q=>q.slot!==slot)){
    candidates.push({target:q.id});for(const category of SCORE_CATEGORIES.filter(k=>q.scores[k]===null))candidates.push({target:q.id,category});
    for(const other of q.augment.items)candidates.push({target:q.id,other:other.id});
    const ks=SCORE_CATEGORIES.filter(k=>q.scores[k]===null);if(ks.length>=3)candidates.push({seals:ks.slice(-2).map(category=>({target:q.id,category}))});
   }
   for(const args of candidates){try{flashTargets(s,s.players[slot],{op:'use',id:i.id,...args});}catch{continue;}if(attempt(s.players[slot],i.id,args))break;}
  }
  p=s.players[slot];
  for(let roll=1;roll<=s.augment.turn.maxRolls;roll++){
   s.dice=s.dice.map((n,i)=>s.held[i]?n:face(seed,turn,roll,i));s.rollCount=roll;afterAugmentRoll(s,()=>0);
   const fav=[1,2,3,4,5,6].sort((a,b)=>s.dice.filter(n=>n===b).length-s.dice.filter(n=>n===a).length)[0];
   const straight=seed%4===1,seen=new Set();let held=0;
   s.held=s.dice.map((n,i)=>{const take=i===s.augment.turn.locked||(straight?!seen.has(n):n===fav);seen.add(n);if(take)held++;return take;});
   if(roll===1)s.augment.turn.kept=s.held.flatMap((v,i)=>v?[i]:[]);else s.augment.turn.kept=s.augment.turn.kept.filter(i=>s.held[i]);
   if(seed%4===2&&roll===1&&Math.max(...empty().map(k=>augmentedScore(s,p,k).total))>=20)break;
  }
  for(const id of ['clone','nudge','evolution','alchemy','mirror','flip','choiceRoll','cat','thief','lock','seal','duel','erase','parallel','worldFlip','wild'])if(own(id)){
   const min=Math.min(...s.dice),die=s.dice.indexOf(min),q=s.players.find(q=>q.slot!==slot&&Object.values(q.scores).some(n=>n===null));
   const options=empty(),best=options.toSorted((a,b)=>augmentedScore(s,s.players[slot],b).total-augmentedScore(s,s.players[slot],a).total)[0];
   let args={die,value:id==='clone'?s.dice.indexOf(Math.max(...s.dice)):id==='nudge'?Math.min(6,min+1):id==='evolution'?Math.min(6,min+2):6,target:q?.id,category:id==='erase'?SCORE_CATEGORIES.find(k=>s.players[slot].scores[k]===0):id==='parallel'?options.find(k=>k!==best):undefined,indices:s.dice.flatMap((n,i)=>n<4?[i]:[])};
   if(['nudge','evolution','clone','alchemy','mirror','flip','wild'].includes(id)) {
     const before=Math.max(...options.map(k=>augmentedScore(s,s.players[slot],k).total));
     const old=s.dice[die],value=id==='clone'?s.dice[args.value]:['mirror','flip'].includes(id)?7-old:args.value;
     s.dice[die]=value;const after=Math.max(...options.map(k=>augmentedScore(s,s.players[slot],k).total));s.dice[die]=old;
     if(after<=before)continue;
   }
   if(id==='worldFlip'){
     const original=[...s.dice];let bestScore=Math.max(...options.map(k=>augmentedScore(s,s.players[slot],k).total)),indices=[];
     for(let mask=1;mask<(1<<original.length);mask++){
       s.dice=original.map((n,i)=>mask&(1<<i)?7-n:n);const score=Math.max(...options.map(k=>augmentedScore(s,s.players[slot],k).total));
       if(score>bestScore){bestScore=score;indices=original.flatMap((_,i)=>mask&(1<<i)?[i]:[]);}
     }
     s.dice=original;if(!indices.length)continue;args={indices};
   }
   attempt(s.players[slot],id,args);
   if(s.augment.turn.reroll){const rr=s.augment.turn.reroll;s.dice[rr.index]=face(seed,turn,8,rr.index);s.rollCount++;s.rollPhase='idle';afterAugmentRoll(s,()=>0);if(s.augment.turn.chooseOld)useAugment(s,s.players[slot],{op:'keepOld',value:rr.old>s.dice[rr.index]?1:0},()=>0);}
   if(s.augment.turn.oldWorld){s.dice=s.dice.map((_,i)=>face(seed,turn,9,i));s.rollCount=s.augment.turn.maxRolls;useAugment(s,s.players[slot],{op:'world',value:0},()=>0);}
  }
  if(own('substitute')){
   const before=Math.max(...empty().map(k=>augmentedScore(s,s.players[slot],k).total));const backup=structuredClone(s);attempt(s.players[slot],'substitute');if(Math.max(...empty().map(k=>augmentedScore(s,s.players[slot],k).total))<before)Object.assign(s,backup);
  }
  p=s.players[slot];const choices=empty().filter(k=>k!==s.augment.turn.parallel);if(!choices.length)throw Error('No legal score');
  const category=choices.sort((a,b)=>augmentedScore(s,p,b).total-augmentedScore(s,p,a).total)[0];
  recordAugment(s,p,category);advanceAugment(s,()=>0);
 }
 const scores=s.players.map(p=>playerTotals(p).total),mine=scores[actor],rivals=scores.filter((_,i)=>i!==actor);
 return {mine,margin:mine-Math.max(...rivals)};
}
await mkdir('artifacts/augments',{recursive:true});
let report=[];
try{if(only.length)throw Error();report=JSON.parse(await readFile(`artifacts/augments/paired-progress-${only.length?output:partition}.json`,'utf8'));}catch{}

for(const card of AUGMENTS.filter((d,i)=>!scenarioOnly.has(d.id)&&(only.length?only.includes(d.id):i%partitions===partition&&!report.some(r=>r.id===d.id)))){let points=0,margin=0,min=Infinity,max=-Infinity;for(let i=0;i<samples;i++){const a=play(card,10000+i,false),b=play(card,10000+i,true),delta=b.margin-a.margin;points+=b.mine-a.mine;margin+=delta;min=Math.min(min,delta);max=Math.max(max,delta);}report.push({id:card.id,name:card.name,rarity:card.rarity,flash:!!card.flash,pairs:samples,meanScoreDelta:points/samples,meanMarginDelta:margin/samples,min,max});await writeFile(`artifacts/augments/paired-progress-${only.length?output:partition}.json`,JSON.stringify(report));console.log(card.id,JSON.stringify(report.at(-1)));}
await mkdir('artifacts/augments',{recursive:true});await writeFile(`artifacts/augments/paired-balance-${only.length?output:partition}.json`,JSON.stringify({samples,excludedCards:[...scenarioOnly],method:'Paired deterministic synthetic-dice heuristic games; 2/3/4 seats rotated, four policies. Cards granted at rarity acquisition round; common clone/fourth background. Not human win-rate estimates. Instant swap/doppel require separate draft tests.',cards:report},null,2));
