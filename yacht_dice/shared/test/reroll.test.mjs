import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AUGMENTS, emptyScorecard, initAugment, applyGameAction, afterAugmentRoll, completeRoll, roomStateSchema, advanceAugment } from '../dist/index.js';

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

test('each draft slot rerolls once, preserves peers and rarity, rejects stale requests and resets next draft',()=>{
 for(const [round,tier,flashId] of [[1,'silver','taxSix'],[4,'gold','handsUp'],[7,'gold','handsUp'],[10,'prism','squid']])for(const flash of [false,true]){
  let s=room();s.augment.round=round;s.augment.drafting=true;
  for(const p of s.players){p.augment.items=[];p.augment.offers=AUGMENTS.filter(d=>d.rarity===tier&&!d.flash&&d.id!=='evolution').slice(0,3).map(d=>d.id);if(flash)p.augment.offers[2]=flashId;p.augment.seenOffers=[...p.augment.offers];p.augment.flashOffer=flash;}
  const pid=s.players[0].id,peers=structuredClone(s.players.slice(1));
  for(const offerIndex of [0,2,1]){
   const before=structuredClone(s),id=s.players[0].augment.offers[offerIndex],result=action(s,{op:'refresh',offerIndex,id});assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(s,before);s=result.state;
   const ap=s.players[0].augment;assert.equal(ap.rerolled[offerIndex],true);assert.ok(!before.players[0].augment.seenOffers.includes(ap.offers[offerIndex]));
   for(let i=0;i<3;i++)if(i!==offerIndex)assert.equal(ap.offers[i],before.players[0].augment.offers[i]);assert.deepEqual(s.players.slice(1),peers);
   assert.equal(AUGMENTS.find(d=>d.id===ap.offers[offerIndex]).rarity,tier);assert.equal(ap.offers.filter(id=>AUGMENTS.find(d=>d.id===id).flash).length,Number(flash));assert.equal(new Set(ap.offers).size,3);
   assert.equal(action(s,{op:'refresh',offerIndex,id}).ok,false);assert.equal(action(s,{op:'refresh',offerIndex,id:ap.offers[offerIndex]}).ok,false);assert.equal(roomStateSchema.safeParse(s).success,true);
  }
  for(const offerIndex of [undefined,-1,3,.5])assert.equal(action(s,{op:'refresh',offerIndex,id:s.players[0].augment.offers[0]}).ok,false);
  const chosen=action(s,{op:'pick',id:s.players[0].augment.offers[0]},pid);assert.equal(chosen.ok,true);assert.equal(action(chosen.state,{op:'refresh',offerIndex:0,id:'nudge'},pid).ok,false);
  if(round<10){s.augment.round=round===1?3:round+2;s.augment.done=s.players.map(p=>p.id);advanceAugment(s,()=>0);assert.equal(s.augment.drafting,true);assert.deepEqual(s.players[0].augment.rerolled,[false,false,false]);assert.equal(action(s,{op:'refresh',offerIndex:0,id:s.players[0].augment.offers[0]}).ok,true);}
 }
});

test('no eligible replacement rejects atomically without spending the slot',()=>{
 const s=room(),p=s.players[0];s.augment.round=1;s.augment.drafting=true;p.augment.offers=['nudge','mirror','taxSix'];p.augment.seenOffers=[...p.augment.offers];
 p.augment.items=AUGMENTS.filter(d=>d.flash&&d.rarity==='silver'&&d.id!=='taxSix').map(d=>({id:d.id,remaining:d.charges,usedTurn:-1,usedRound:-1}));
 const before=structuredClone(s);assert.equal(action(s,{op:'refresh',offerIndex:2,id:'taxSix'}).ok,false);assert.deepEqual(s,before);assert.deepEqual(p.augment.rerolled,[false,false,false]);
});
