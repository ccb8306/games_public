import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AUGMENTS, emptyScorecard, initAugment, applyGameAction, afterAugmentRoll, completeRoll, roomStateSchema } from '../dist/index.js';

function room(count=5) {
 const s={roomId:randomUUID(),code:'ABC12345',mode:'augment',capacity:4,disconnectGraceSeconds:60,phase:'playing',players:Array.from({length:4},(_,slot)=>({id:randomUUID(),slot,nickname:`P${slot}`,connected:true,ready:true,forfeited:false,reconnectDeadline:null,scores:emptyScorecard()})),currentPlayerId:null,dice:Array(count).fill(null),held:Array(count).fill(false),rollCount:0,rollPhase:'idle',revision:0,reconnectDeadline:null,outcome:null};
 s.currentPlayerId=s.players[0].id;initAugment(s,()=>0);s.augment.drafting=false;s.players.forEach(p=>p.augment.offers=[]);s.dice=Array.from({length:count},(_,i)=>i%6+1);s.held=Array(count).fill(false);s.rollCount=3;return s;
}
function action(s,command,actor=s.currentPlayerId) {return applyGameAction(s,actor,{type:'augment',command},()=>0);}

test('all one-die rerolls preserve counts, other faces and holds across 4-10 dice and every old/new face',()=>{
 let cases=0;
 for(const id of ['choiceRoll','even','chaos','exchange'])for(let count=4;count<=10;count++)for(let index=0;index<count;index++)for(let old=1;old<=6;old++)for(let next=1;next<=6;next++){
  if(id==='even'&&old!==1)continue;
  let s=room(count);const p=s.players[0];s.currentPlayerId=p.id;s.dice[index]=old;s.held=s.held.map((_,i)=>i%2===0);
  p.augment.items=[{id,remaining:3,usedTurn:-1,usedRound:-1}];if(['chaos','exchange'].includes(id))s.augment.event=id;
  const original=structuredClone(s),used=action(s,{op:'use',id,die:index});assert.equal(used.ok,true,`${id}/${count}/${index}`);s=used.state;
  assert.deepEqual(s.held,s.held.map((_,i)=>i!==index));
  assert.equal(action(s,{op:'use',id,die:index}).ok,false);
  assert.equal(applyGameAction(s,p.id,{type:'score',category:'choice'},()=>0).ok,false);
  const thrown=applyGameAction(s,p.id,{type:'roll'},()=>0);assert.equal(thrown.ok,true);s=thrown.state;
  const motion={id:randomUUID(),seq:1,at:1,phase:'rest',dice:s.dice.map(()=>({p:[0,.48,0],q:[0,0,0,1]})),cup:null,wind:false,windDirection:0,paused:false};s.motion={...motion,phase:'throwing'};
  const values=[...s.dice];values[index]=next;s=completeRoll(s,values,motion);afterAugmentRoll(s,()=>0);
  assert.equal(s.rollCount,3);assert.deepEqual(s.held,original.held);assert.deepEqual(s.dice,values);
  assert.equal(s.augment.turn.reroll,null);assert.equal(s.augment.turn.extra,id==='exchange'?8:0);
  if(id==='choiceRoll'&&old!==next){
   assert.equal(applyGameAction(s,p.id,{type:'score',category:'choice'},()=>0).ok,false);
   const restored=action(s,{op:'keepOld',value:1});assert.equal(restored.ok,true);assert.deepEqual(restored.state.dice,original.dice);
   const accepted=action(s,{op:'keepOld',value:0});assert.equal(accepted.ok,true);assert.deepEqual(accepted.state.dice,values);
   assert.equal(action(restored.state,{op:'keepOld',value:1}).ok,false);
  } else assert.equal(s.augment.turn.chooseOld,null);
  assert.equal(roomStateSchema.safeParse(s).success,true);cases++;
 }
 assert.equal(cases,5586);
});

test('refresh is personal, once per game, replaces offers and preserves flash entitlement at every tier',()=>{
 for(const round of [1,4,7,10])for(const flash of [false,true])for(let seed=0;seed<100;seed++){
  let n=seed+1;const rng=max=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return Math.floor(n/4294967296*max);};
  let s=room();s.augment.round=round;s.augment.drafting=true;
  const tier=round===1?'silver':round===10?'prism':'gold';
  for(const p of s.players){p.augment.offers=AUGMENTS.filter(d=>d.rarity===tier&&!d.flash&&d.id!=='evolution').slice(0,3).map(d=>d.id);p.augment.flashOffer=flash;p.augment.items=[{id:'fourth',remaining:-1,usedTurn:-1,usedRound:-1}];}
  const p=s.players[0],before=structuredClone(s);const result=applyGameAction(s,p.id,{type:'augment',command:{op:'refresh'}},rng);assert.equal(result.ok,true);assert.deepEqual(s,before);s=result.state;
  const offers=s.players[0].augment.offers;assert.equal(new Set(offers).size,3);assert.ok(offers.every(id=>!before.players[0].augment.offers.includes(id)));
  assert.equal(offers.filter(id=>AUGMENTS.find(d=>d.id===id).flash).length,Number(flash));
  assert.deepEqual(s.players.slice(1),before.players.slice(1));
  assert.equal(action(s,{op:'refresh'},p.id).ok,false);
  const later=structuredClone(s);later.augment.round=round===10?10:round+3;later.players[0].augment.offers=['nudge','mirror','cleaner'];assert.equal(action(later,{op:'refresh'},p.id).ok,false);
  const chosen=action(s,{op:'pick',id:offers[0]},p.id);assert.equal(chosen.ok,true);assert.equal(action(chosen.state,{op:'refresh'},p.id).ok,false);
 }
});
