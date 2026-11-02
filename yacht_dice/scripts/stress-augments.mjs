import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {AUGMENTS,EVENTS,SCORE_CATEGORIES,emptyScorecard,initAugment,applyGameAction,completeRoll,afterAugmentRoll,roomStateSchema,playerTotals,pendingInstant} from '../shared/dist/index.js';

const games=Number(process.argv[2]??1000), initialSeed=Number(process.argv[3]??20261103);
let seed=initialSeed,actions=0,rejections=0,turns=0,refreshes=0;
const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*max);};
const uses={},picks={},pending={},events={},scores=[],diceCounts={},rerolls={};
let s;
const actor=()=>s.players.find(p=>p.id===s.currentPlayerId);
function act(action,player=actor(),required=false){
 const result=applyGameAction(s,player.id,action,random);
 if(!result.ok){rejections++;if(required)throw Error(JSON.stringify({action,error:result,turn:s.augment.turn,seed}));return false;}
 s=result.state;actions++;
 if(action.type==='augment'&&action.command.op==='use')uses[action.command.id]=(uses[action.command.id]??0)+1;
 return true;
}
function command(c,player=actor(),required=false){return act({type:'augment',command:c},player,required);}
function physical(){
 if(s.rollPhase==='idle')act({type:'startShake'},actor(),true);
 act({type:'roll'},actor(),true);
 const id=randomUUID(),frame={id,seq:1,at:1,phase:'rest',dice:s.dice.map(()=>({p:[0,.48,0],q:[0,0,0,1]})),cup:null,wind:false,windDirection:0,paused:false};
 s.motion={...frame,phase:'throwing'};
 const values=s.dice.map((value,i)=>s.held[i]?value:random(6)+1);
 s=completeRoll(s,values,frame);afterAugmentRoll(s,random);
}
function settle(){
 for(let guard=0;guard<10;guard++){
  const t=s.augment.turn;
  if(s.rollPhase==='shaking'){if(t.reroll)rerolls[t.reroll.id]=(rerolls[t.reroll.id]??0)+1;physical();continue;}
  if(t.pending){
   pending[t.pending]=(pending[t.pending]??0)+1;
   const indices=s.dice.flatMap((_,i)=>t.preheld?.includes(i)?[]:[i]).slice(0,2);
   const value=t.pending==='forkSecond'?0:random(2);
   if(!command({op:'resolve',value,indices}))command({op:'resolve',value:1-value,indices},actor(),true);
   continue;
  }
  if(t.chooseOld){command({op:'keepOld',value:random(2)},actor(),true);continue;}
  if(t.fork){physical();continue;}
  return;
 }
 throw Error('Pending action did not settle');
}
function argumentsFor(id,p){
 const enemies=s.players.filter(q=>q.id!==p.id&&!q.forfeited),q=enemies[random(enemies.length)];
 const open=SCORE_CATEGORIES.filter(k=>p.scores[k]===null),zero=SCORE_CATEGORIES.filter(k=>p.scores[k]===0);
 const indices=s.dice.map((_,i)=>i),die=random(indices.length),value=random(6)+1;
 const their=q.augment.items.filter(i=>AUGMENTS.find(d=>d.id===i.id).rarity==='gold'),mine=p.augment.items.filter(i=>AUGMENTS.find(d=>d.id===i.id).rarity==='gold');
 return {die:id==='even'?s.dice.indexOf(1):die,value:id==='clone'?random(indices.length):['taste','misdelivery'].includes(id)?(q.augment.lastDice?.[0]??value):value,target:q.id,
  historyIndex:p.augment.archive?.length?random(p.augment.archive.length):0,
  category:id==='closed'?SCORE_CATEGORIES.slice(6).find(k=>p.scores[k]!==null&&q.scores[k]!==null&&p.scores[k]!==q.scores[k]):id==='swap'?mine[0]?.id:id==='erase'?zero[0]:open[random(open.length)],other:their[0]?.id,
  indices:indices.slice(0,id==='worldFlip'?1+random(indices.length):2),
  seals:SCORE_CATEGORIES.filter(k=>q.scores[k]===null).slice(0,2).map(category=>({target:q.id,category}))};
}
function abilities(){
 const ids=[...actor().augment.items.map(i=>i.id),s.augment.event].filter(Boolean);
 // Rotate priority so finalizing abilities do not always suppress the same cards.
 const offset=random(ids.length||1);
 for(const id of ids.slice(offset).concat(ids.slice(0,offset))){
  if(command({op:'use',id,...argumentsFor(id,actor())}))settle();
 }
}
for(let game=0;game<games;game++){
 const count=2+game%3;
 s={roomId:randomUUID(),code:'ABC12345',mode:'augment',capacity:count,disconnectGraceSeconds:60,phase:'playing',players:Array.from({length:count},(_,slot)=>({id:randomUUID(),slot,nickname:`P${slot}`,connected:true,ready:true,forfeited:false,reconnectDeadline:null,scores:emptyScorecard()})),currentPlayerId:null,dice:Array(5).fill(null),held:Array(5).fill(false),rollCount:0,rollPhase:'idle',revision:0,reconnectDeadline:null,outcome:null};
 s.currentPlayerId=s.players[0].id;initAugment(s,random);
 for(let step=0;s.phase==='playing'&&step<12*count;step++){
  if(s.augment.drafting){
   for(const id of s.players.map(p=>p.id)){
    let p=s.players.find(p=>p.id===id);
    if(!p.augment.refreshed&&random(3)===0){command({op:'refresh'},p,true);refreshes++;p=s.players.find(p=>p.id===id);}
    const pick=s.augment.round===7&&p.augment.items.some(i=>i.id==='nudge')&&random(2)===0?'evolution':p.augment.offers[random(p.augment.offers.length)];picks[pick]=(picks[pick]??0)+1;command({op:'pick',id:pick},p,true);
   }
   for(const id of s.players.map(p=>p.id)){
    const p=s.players.find(p=>p.id===id),instant=pendingInstant(p);if(!instant)continue;
    let resolved=false;
    for(const q of s.players.filter(q=>q.id!==id))for(const other of q.augment.items)for(const mine of p.augment.items){
     if(!resolved)resolved=command({op:'use',id:instant,target:q.id,other:other.id,category:mine.id},s.players.find(p=>p.id===id));
    }
   }
   assert.equal(s.augment.drafting,false,'instant draft must resolve');
  }
  if(s.augment.event)events[s.augment.event]=(events[s.augment.event]??0)+1;
  diceCounts[s.dice.length]=(diceCounts[s.dice.length]??0)+1;
  settle();abilities();
  while(!s.rollCount||s.rollCount<s.augment.turn.maxRolls){
   if(s.augment.turn.flags.includes('final'))break;
   if(s.rollCount){
    let held=s.dice.map((_,i)=>s.augment.turn.locked===i||!!s.augment.turn.fixed?.includes(i)||random(3)===0);
    if(held.every(Boolean))held=held.map((_,i)=>s.augment.turn.locked===i||!!s.augment.turn.fixed?.includes(i));
    if(!act({type:'setHolds',held}))act({type:'setHolds',held:held.map((_,i)=>s.augment.turn.locked===i||!!s.augment.turn.fixed?.includes(i))},actor(),true);
    if(s.held.every(Boolean))break;
   }
   physical();settle();abilities();
   if(random(3)===0)break;
  }
  settle();if(s.augment.turn.oldWorld)command({op:'world',value:random(2)},actor(),true);
  const before=actor().id,open=SCORE_CATEGORIES.filter(k=>actor().scores[k]===null),offset=random(open.length);
  let recorded=false;for(const category of open.slice(offset).concat(open.slice(0,offset)))if(act({type:'score',category})){recorded=true;break;}
  assert.ok(recorded,`no score possible: ${JSON.stringify(s.augment.turn)}`);turns++;
  assert.ok(roomStateSchema.safeParse(s).success,JSON.stringify(roomStateSchema.safeParse(s).error));
  for(const p of s.players){assert.ok(Number.isFinite(playerTotals(p).total)&&playerTotals(p).total>=0);assert.ok(p.augment.items.every(i=>i.remaining>=-1));}
  assert.notEqual(s.currentPlayerId,before,'no double turn');
 }
 assert.equal(s.phase,'finished');assert.ok(s.players.every(p=>Object.values(p.scores).every(n=>n!==null)));
 scores.push(...s.players.map(p=>playerTotals(p).total));
 if((game+1)%100===0)console.log(JSON.stringify({games:game+1,turns,actions}));
}
const report={games,initialSeed,turns,actions,rejections,refreshes,meanScore:scores.reduce((a,b)=>a+b,0)/scores.length,min:Math.min(...scores),max:Math.max(...scores),uses,picks,pending,events,diceCounts,rerolls,unusedActiveCards:AUGMENTS.filter(d=>d.trigger==='active'&&!uses[d.id]).map(d=>d.id),method:'Seeded random legal actions and synthetic uniform dice; validates engine completion and state invariants, not physical probabilities or human win-rate balance.'};
await mkdir('artifacts/augments',{recursive:true});await writeFile(`artifacts/augments/extended-stress-${initialSeed}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
