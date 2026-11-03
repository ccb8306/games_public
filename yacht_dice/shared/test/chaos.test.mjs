import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,give} from './augments.test.mjs';
import {useAugment,recordAugment,advanceAugment,afterAugmentRoll,prepareAugmentRoll,playerTotals,scorePreview,augmentedScore,reconcileAugment,roomStateSchema} from '../dist/index.js';
const actor=s=>s.players.find(p=>p.id===s.currentPlayerId);
const use=(s,id,fields={})=>useAugment(s,actor(s),{op:'use',id,...fields},()=>0);
const resolve=(s,value)=>useAugment(s,actor(s),{op:'resolve',value},()=>0);
const roll=(s,face=6)=>{s.dice=Array(s.dice.length).fill(face);s.held=s.dice.map(()=>false);s.rollCount=1;s.rollPhase='idle';};
test('pressure: pay, challenge win, challenge reversal and zero floor',()=>{
 for(const value of [0,1])for(const face of [1,6]){
  const s=fixture(['thief']);s.players.forEach(p=>p.augment.bonus=30);use(s,'thief',{target:s.players[1].id});advanceAugment(s,()=>0);
  assert.equal(s.augment.turn.pending,'thief');resolve(s,value);assert.equal(s.augment.turn.pending,undefined);
  if(!value){assert.equal(s.players[0].augment.bonus,38);assert.equal(s.players[1].augment.bonus,22);continue;}
  roll(s,face);const before=playerTotals(actor(s)).total,preview=scorePreview(s,actor(s),'choice');recordAugment(s,actor(s),'choice');assert.equal(playerTotals(actor(s)).total-before,preview);
  assert.equal(s.players[0].augment.bonus,face===6?42:32);
 }
 const s=fixture(['thief']);use(s,'thief',{target:s.players[1].id});advanceAugment(s,()=>0);assert.throws(()=>resolve(s,0));resolve(s,1);roll(s,1);recordAugment(s,actor(s),'choice');assert.equal(s.players[0].augment.bonus,2);
});
test('double wager requires actual third ordinary roll and is not duplicated',()=>{
 const s=fixture(['loan']);use(s,'loan');roll(s);s.rollCount=2;use(s,'loanDouble');assert.equal(s.rollPhase,'shaking');assert.throws(()=>recordAugment(s,actor(s),'choice'));
 s.rollPhase='idle';assert.throws(()=>use(s,'loanDouble'));s.rollCount=3;afterAugmentRoll(s,()=>0);
 assert.equal(augmentedScore(s,actor(s),'choice').extra,40);s.dice.fill(1);assert.equal(augmentedScore(s,actor(s),'choice').extra,-5); // turn score floor
});
test('duel refusal preserves normal rolls and accepted ties pay once',()=>{
 for(const value of [0,1]){
  const s=fixture(['duel']);s.players.forEach(p=>p.augment.bonus=30);use(s,'duel',{target:s.players[1].id});advanceAugment(s,()=>0);resolve(s,value);
  if(!value){assert.equal(s.augment.duels.length,0);assert.equal(s.augment.turn.maxRolls,3);assert.equal(s.players[0].augment.bonus,55);continue;}
  assert.equal(s.augment.turn.maxRolls,actor(s).id===s.players[0].id?3:2);roll(s);recordAugment(s,actor(s),'choice');advanceAugment(s,()=>0);roll(s);recordAugment(s,actor(s),'choice');assert.equal(s.augment.duels.length,0);assert.deepEqual(s.players.map(p=>p.augment.bonus),[45,45]);
 }
});
test('mixer releases all voluntary holds, keeps forced holds and rewards only actual mixing',()=>{
 const s=fixture(['handsUp']);use(s,'handsUp');advanceAugment(s,()=>0);roll(s);s.held=[true,true,true,true,true];s.augment.turn.fixed=[0];s.augment.turn.locked=1;
 assert.equal(augmentedScore(s,actor(s),'choice').extra,0);prepareAugmentRoll(s,()=>0);assert.deepEqual(s.held,[true,true,false,false,false]);s.rollCount=2;afterAugmentRoll(s,()=>0);assert.equal(augmentedScore(s,actor(s),'choice').extra,0);
});
test('carousel rotates lower scores without minting points and respects shield and shared immunity',()=>{
 for(const count of [3,4]){
  const s=fixture(['strike'],count);s.players.forEach((p,i)=>p.scores.yacht=i*10);const sum=s.players.reduce((n,p)=>n+p.scores.yacht,0);use(s,'strike',{category:'yacht'});
  assert.equal(s.players[0].scores.yacht,(count-1)*10);assert.equal(s.players.reduce((n,p)=>n+p.scores.yacht,0),sum);assert.ok(s.players.every(p=>p.augment.scoreSwapped));
  give(s.players[0],['strike']);assert.throws(()=>use(s,'strike',{category:'yacht'}));
 }
 const s=fixture(['strike'],3);s.players.forEach((p,i)=>p.scores.yacht=i*50);give(s.players[1],['shield']);give(s.players[2],['shield']);assert.throws(()=>use(s,'strike',{category:'yacht'}));assert.deepEqual(s.players.map(p=>p.scores.yacht),[0,50,100]);assert.equal(s.players[0].augment.items[0].remaining,1);
});
test('jackpot collects once, settles ties exactly, excludes poor players and refunds forfeiture',()=>{
 for(const count of [2,3,4]){
  const s=fixture(['squid'],count);s.players.forEach(p=>p.augment.bonus=30);use(s,'squid');assert.equal(s.augment.jackpot.pot,count*20);assert.ok(s.players.every(p=>p.augment.bonus===10));assert.ok(roomStateSchema.safeParse(s).success);
  for(let n=0;n<count;n++){advanceAugment(s,()=>0);assert.equal(s.augment.turn.maxRolls,actor(s).id===s.players[0].id?3:2);roll(s);recordAugment(s,actor(s),'choice');}
  assert.equal(s.augment.jackpot,undefined);assert.equal(s.players.reduce((sum,p)=>sum+p.augment.bonus,0),count*30+60);
 }
 const s=fixture(['squid'],3);s.players.forEach(p=>p.augment.bonus=30);s.players[2].augment.bonus=19;use(s,'squid');assert.equal(s.augment.jackpot.entries.length,2);s.players[1].forfeited=true;reconcileAugment(s,()=>0);assert.equal(s.augment.jackpot,undefined);assert.deepEqual(s.players.map(p=>p.augment.bonus),[30,30,19]);
});
