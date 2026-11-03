import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,give} from './augments.test.mjs';
import {useAugment,advanceAugment,afterAugmentRoll,recordAugment,scoreBreakdown,SCORE_CATEGORIES,AUGMENTS} from '../dist/index.js';
const use=(s,id,args={})=>useAugment(s,s.players[0],{op:'use',id,...args},()=>0);
test('silver tax transfers actual damage and practice pays once after successful reroll',()=>{
 const s=fixture(['taxSix']);use(s,'taxSix',{target:s.players[1].id});advanceAugment(s,()=>0);s.dice=[6,6,6,1,1];s.rollCount=1;
 recordAugment(s,s.players[1],'choice');assert.equal(s.players[0].augment.bonus,6);assert.equal(s.players[1].augment.bonus,-6);
 const x=fixture(['practice']);use(x,'practice',{target:x.players[1].id});advanceAugment(x,()=>0);x.dice=[6,2,3,4,5];x.rollCount=2;afterAugmentRoll(x,()=>0);assert.equal(x.players[0].augment.bonus,0);
 x.rollCount++;x.rollPhase='idle';afterAugmentRoll(x,()=>0);afterAugmentRoll(x,()=>0);assert.equal(x.players[0].augment.bonus,4);
});
test('mixer protects caster and pays only if a rival is marked; construction leaves exactly two choices',()=>{
 for(const shield of [false,true]){
  const s=fixture(['handsUp']);if(shield)give(s.players[1],['shield']);use(s,'handsUp');assert.equal(s.players[0].augment.curse,null);assert.equal(s.players[0].augment.bonus,shield?0:10);
 }
 const s=fixture(['construction']);use(s,'construction',{target:s.players[1].id});advanceAugment(s,()=>0);s.dice=[1,2,3,4,5];s.rollCount=1;afterAugmentRoll(s,()=>0);
 assert.equal(SCORE_CATEGORIES.filter(c=>!s.players[1].augment.curse.categories.includes(c)).length,2);
});
test('prism carousel favors caster; gold migration refills only caster and pays only on success',()=>{
 const s=fixture(['strike'],3);s.players.forEach((p,i)=>p.scores.choice=[0,50,10][i]);use(s,'strike',{category:'choice'});assert.equal(s.players[0].scores.choice,50);
 const g=fixture(['goldRush','fourth']);give(g.players[1],['clone']);g.players[1].augment.items[0].remaining=1;use(g,'goldRush');
 assert.equal(g.players[0].augment.bonus,20);assert.equal(g.players[0].augment.items.find(i=>i.id==='clone').remaining,AUGMENTS.find(d=>d.id==='clone').charges);
});
test('base and upper credit exclude both separate bonuses and embedded multipliers',()=>{
 const s=fixture(['rest']);s.dice=[6,6,6,6,1];s.rollCount=1;let r=scoreBreakdown(s,s.players[0],'sixes');assert.equal(r.base,24);assert.equal(r.augment,6);assert.equal(r.upperCredit,24);
 give(s.players[0],['devil']);s.rollCount=0;use(s,'devil');s.dice=[6,6,6,6,6];s.rollCount=1;r=scoreBreakdown(s,s.players[0],'sixes');assert.equal(r.base,30);assert.equal(r.recorded,60);assert.equal(r.upperCredit,30);
 s.dice=[6,6,6,6,1];r=scoreBreakdown(s,s.players[0],'sixes');assert.equal(r.base,0);assert.equal(r.recorded,0);assert.equal(r.upperCredit,0);
});
