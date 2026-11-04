import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,give} from './augments.test.mjs';
import {useAugment,afterAugmentRoll,advanceAugment,recordAugment,scoreBreakdown,roomStateSchema} from '../dist/index.js';
const use=(s,id,args={},p=s.players[0])=>useAugment(s,p,{op:'use',id,...args},()=>0);
const roll=(s,dice,count=1)=>{s.dice=dice;s.held=dice.map(()=>false);s.rollCount=count;s.rollPhase='idle';};
test('monster accepts exactly both physical sums and gives one split bonus',()=>{
 for(let n=1;n<=12;n++)for(const sum of [n,13-n].filter(n=>n>=2))for(let first=1;first<=6;first++){
 if(sum-first<1||sum-first>6)continue;
 const s=fixture(['monster']);use(s,'monster');roll(s,[2,3,4,n]);use(s,'monster',{sum,value:first});
 assert.equal(s.dice[3]+s.dice[4],sum);assert.equal(s.augment.turn.extra,8);assert.throws(()=>use(s,'monster',{sum,value:first}));assert.ok(roomStateSchema.safeParse(s).success);
 }
});
test('shield blocks reservation rewards and dinner does not curse its host',()=>{
 for(const id of ['receipt','dinner','custody']){const s=fixture([id]);give(s.players[1],['shield']);use(s,id,{target:s.players[1].id});assert.equal(s.players[0].augment.bonus,0);}
 const s=fixture(['dinner']);use(s,'dinner');assert.equal(s.players[0].augment.bonus,20);assert.equal(s.players[0].augment.curse,null);
});
test('tax provides three point minimum without taking unavailable points',()=>{
 const s=fixture(['taxSix']);use(s,'taxSix',{target:s.players[1].id});advanceAugment(s,()=>0);roll(s,[1,2,3,4,5]);recordAugment(s,s.players[1],'sixes');assert.equal(s.players[0].augment.bonus,3);assert.equal(s.players[1].scores.sixes,0);
});
test('banana pays once and does not change fixed dice',()=>{
 const s=fixture(['dropIt']);use(s,'dropIt',{target:s.players[1].id});advanceAugment(s,()=>0);roll(s,[6,5,3,2,1]);s.augment.turn.fixed=[0];afterAugmentRoll(s,()=>0);assert.deepEqual(s.dice,[6,1,3,2,1]);assert.equal(s.players[0].augment.bonus,8);afterAugmentRoll(s,()=>0);assert.equal(s.players[0].augment.bonus,8);
});
