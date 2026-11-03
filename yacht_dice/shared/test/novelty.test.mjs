import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,give} from './augments.test.mjs';
import {useAugment,recordAugment,advanceAugment,afterAugmentRoll,scoreBreakdown,roomStateSchema,playerTotals,completeRoll,reconcileAugment,D12,pendingInstant} from '../dist/index.js';
const use=(s,id,args={},p=s.players[0])=>useAugment(s,p,{op:'use',id,...args},()=>0);
const roll=(s,dice,count=1)=>{s.rollCount=count;s.dice=dice;s.held=dice.map(()=>false);s.rollPhase='idle';};
test('custom die acquisition waits for a valid six-face edit and rejects more than three transfers',()=>{
 const s=fixture();s.augment.drafting=true;s.players[0].augment.offers=['customDie'];useAugment(s,s.players[0],{op:'pick',id:'customDie'},()=>0);
 assert.equal(pendingInstant(s.players[0]),undefined);assert.equal(s.augment.drafting,false);
 for(const faces of [[6,6,6,1,1,1],[1,1,1,1,1,1],[0,2,3,4,6,6]])assert.throws(()=>use(s,'customDie',{faces}));
 use(s,'customDie',{faces:[6,2,3,4,5,6]});assert.equal(s.augment.drafting,false);assert.deepEqual(s.players[0].augment.customFaces,[6,2,3,4,5,6]);
 assert.ok(roomStateSchema.safeParse(s).success);assert.throws(()=>use(s,'customDie',{faces:[1,2,3,4,5,6]}));
});
test('monster splits every physical face, guards scoring and preserves normal die count',()=>{
 for(const count of [4,5,10])for(let n=1;n<=12;n++){
  const s=fixture(['monster']);s.dice=Array(count).fill(null);s.held=Array(count).fill(false);use(s,'monster');assert.equal(s.dice.length,count-1);
  roll(s,Array.from({length:count-1},(_,i)=>i===count-2?n:4));assert.ok(roomStateSchema.safeParse(s).success);
  assert.equal(scoreBreakdown(s,s.players[0],'choice'),null);assert.throws(()=>recordAugment(s,s.players[0],'choice'));
  assert.throws(()=>use(s,'monster',{value:7}));
  use(s,'monster',{value:Math.max(1,n-6)});assert.equal(s.dice.length,count);assert.equal(s.dice.at(-1)+s.dice.at(-2),n===1?2:n);
  assert.ok(s.augment.turn.flags.includes('final'));assert.ok(roomStateSchema.safeParse(s).success);
  const before=playerTotals(s.players[0]).total,preview=scoreBreakdown(s,s.players[0],'choice');recordAugment(s,s.players[0],'choice');assert.equal(playerTotals(s.players[0]).total-before,preview.total);
 }
 assert.equal(D12.vertices.length,20);assert.equal(D12.faces.length,12);assert.ok(D12.faces.every(f=>f.indices.length===5));
});
test('estate rewards 8 then 24 and a failed plot cannot be resurrected by rewriting zero',()=>{
 for(const fail of [false,true]){
  const s=fixture(['estate']);s.augment.drafting=true;use(s,'estate',{categories:['ones','twos','threes']});
  for(const [k,dice] of [['ones',fail?[2,2,2,2,2]:[1,1,1,1,1]],['twos',[2,2,2,2,2]],['threes',[3,3,3,3,3]]]){roll(s,dice);const before=playerTotals(s.players[0]).total,preview=scoreBreakdown(s,s.players[0],k);recordAugment(s,s.players[0],k);assert.equal(playerTotals(s.players[0]).total-before,preview.total);}
  assert.equal(s.players[0].augment.bonus,fail?8:32);
  s.players[0].scores.ones=null;roll(s,[1,1,1,1,1]);recordAugment(s,s.players[0],'ones');assert.equal(s.players[0].augment.bonus,fail?8:32);
 }
});
test('custody passes the final face into the next first throw and expires after two turns each',()=>{
 const s=fixture(['custody']);use(s,'custody',{target:s.players[1].id});
 for(let i=0;i<4;i++){
  const p=s.players.find(p=>p.id===s.currentPlayerId);if(i){assert.equal(s.dice[s.augment.turn.childIndex],i+1);assert.equal(s.held[s.augment.turn.childIndex],true);}
  roll(s,[i+2,2,3,4,5]);recordAugment(s,p,i<2?'choice':'sixes');advanceAugment(s,()=>0);
 }
 assert.deepEqual(s.augment.custody,[]);
 const blocked=fixture(['custody']);give(blocked.players[1],['shield']);use(blocked,'custody',{target:blocked.players[1].id});assert.equal(blocked.augment.custody,undefined);
});
test('crown gives equal attempts, progressive thresholds, one final payment, and preview includes payment',()=>{
 const s=fixture(['crown']);use(s,'crown');assert.equal(s.players[0].augment.bonus,10);
 const scenarios=[[s.players[0],'choice',[5,5,5,5,5]],[s.players[1],'choice',[6,6,6,6,6]],[s.players[0],'yacht',[6,6,6,6,6]],[s.players[1],'yacht',[5,5,5,5,5]]];
 for(const [p,key,dice] of scenarios){s.currentPlayerId=p.id;roll(s,dice);const before=playerTotals(p).total,preview=scoreBreakdown(s,p,key);recordAugment(s,p,key);assert.equal(playerTotals(p).total-before,preview.total);}
 assert.equal(s.augment.crown.finished,true);assert.equal(s.augment.crown.holder,s.players[0].id);assert.equal(s.players[1].augment.bonus,0);
 roll(s,[1,2,3,4,5]);recordAugment(s,s.players[1],'ones');assert.equal(s.players[1].augment.bonus,0);assert.throws(()=>use(s,'crown'));
});
test('forfeit clears custody and cannot pay a forfeited crown holder',()=>{
 const s=fixture(['custody','crown']);use(s,'custody',{target:s.players[1].id});use(s,'crown');s.players[0].forfeited=true;reconcileAugment(s,()=>0);assert.deepEqual(s.augment.custody,[]);assert.equal(s.augment.crown.holder,'');
});
test('a duplicate crown converts once when another holder starts the single shared event',()=>{
 const s=fixture(['crown']);give(s.players[1],['crown']);use(s,'crown');assert.equal(s.players[1].augment.bonus,35);assert.equal(s.players[1].augment.items[0].remaining,0);assert.equal(s.augment.crown.entries.length,2);assert.throws(()=>use(s,'crown',{},s.players[1]));assert.equal(s.players[1].augment.bonus,35);
});
