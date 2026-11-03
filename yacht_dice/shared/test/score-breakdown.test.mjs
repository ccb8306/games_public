import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,give} from './augments.test.mjs';
import {scoreBreakdown,recordAugment,playerTotals,useAugment} from '../dist/index.js';
const rolled=(ids,dice=[6,6,6,6,6])=>{const s=fixture(ids);s.dice=dice;s.held=dice.map(()=>false);s.rollCount=1;return s;};
test('recorded 30 plus augment 6 is separate, pure, and totals 36',()=>{
 const s=rolled(['rest']),before=structuredClone(s);
 assert.deepEqual(scoreBreakdown(s,s.players[0],'choice'),{base:30,upperCredit:0,recorded:30,augment:6,otherRecords:0,upperBonus:0,floorAdjustment:0,total:36});assert.deepEqual(s,before);
});
test('zero repair, upper threshold, debt floor and parallel are classified by destination',()=>{
 const s=rolled(['erase']);s.players[0].scores.sixes=0;s.players[0].augment.rawUpper=40;

 assert.deepEqual(scoreBreakdown(s,s.players[0],'choice'),{base:30,upperCredit:0,recorded:30,augment:0,otherRecords:0,upperBonus:0,floorAdjustment:0,total:30});
 const p=rolled(['parallel']);useAugment(p,p.players[0],{op:'use',id:'parallel',category:'yacht'},()=>0);
 assert.equal(scoreBreakdown(p,p.players[0],'choice').augment,40);assert.equal(scoreBreakdown(p,p.players[0],'yacht'),null);
 const d=rolled([],[1,1,1,1,1]);d.players[0].augment.bonus=-20;
 assert.deepEqual(scoreBreakdown(d,d.players[0],'choice'),{base:5,upperCredit:0,recorded:5,augment:0,otherRecords:0,upperBonus:0,floorAdjustment:-5,total:0});
});
test('preview includes only currently resolved duel and jackpot awards without consuming either',()=>{
 for(const kind of ['duel','jackpot']){
  const s=rolled([]),p=s.players[0],q=s.players[1];s.augment.turn.serial=5;
  if(kind==='duel')s.augment.duels=[{a:p.id,b:q.id,aScore:null,bScore:10,after:1,accepted:true}];
  else s.augment.jackpot={after:1,pot:40,entries:[{id:p.id,score:null},{id:q.id,score:10}]};
  const before=structuredClone(s),r=scoreBreakdown(s,p,'choice');assert.equal(r.augment,kind==='duel'?40:100);assert.deepEqual(s,before);
  const total=playerTotals(p).total;recordAugment(s,p,'choice');assert.equal(playerTotals(p).total-total,r.total);
 }
});
test('invalid and blocked records have no preview',()=>{
 const s=rolled(['parallel']);s.players[0].augment.curse={id:'construction',from:s.players[1].id,active:true,categories:['choice']};
 assert.equal(scoreBreakdown(s,s.players[0],'choice'),null);s.augment.turn.flags.push('loanDoublePending');assert.equal(scoreBreakdown(s,s.players[0],'sixes'),null);
});
