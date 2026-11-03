import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, give } from './augments.test.mjs';
import { augmentedScore, AUGMENTS, useAugment, recordAugment, advanceAugment, afterAugmentRoll, playerTotals, SCORE_CATEGORIES, categoryScore } from '../dist/index.js';

test('ordinary rework charges match published rules', () => {
  for (const [id, charges] of [['collector',4],['seal',2],['target',3]])
    assert.equal(AUGMENTS.find(d => d.id === id).charges, charges);
});

test('remodel preserves totals, number of filled slots, and does not fire zero rewards',()=>{
 const s=fixture(['scoreRemodel','lifebuoy']),p=s.players[0];p.scores.yacht=50;
 const total=playerTotals(p).total;
 useAugment(s,p,{op:'use',id:'scoreRemodel',category:'yacht',destination:'choice'},()=>0);
 assert.equal(playerTotals(p).total,total);assert.equal(p.scores.yacht,null);assert.equal(p.scores.choice,0);assert.equal(p.augment.previousZero,false);
 assert.throws(()=>useAugment(s,p,{op:'use',id:'scoreRemodel',category:'choice',destination:'yacht'},()=>0));
});
test('vault reserves future turns and debits only the accepted ordinary roll count',()=>{
 const s=fixture(),p=s.players[1];give(p,['rollVault']);
 for(const k of SCORE_CATEGORIES.slice(0,9))p.scores[k]=0;
 advanceAugment(s,()=>0);assert.equal(p.augment.rollBank,12);assert.equal(s.augment.turn.maxRolls,7);
 s.dice=[6,6,6,6,6];s.rollCount=7;recordAugment(s,p,'yacht');assert.equal(p.augment.rollBank,5);
});
test('return all ones excludes forced dice and restores original holds and count',()=>{
 const s=fixture(['even']);s.dice=[1,1,1,4,5];s.held=[true,true,true,false,false];s.rollCount=2;s.augment.turn.fixed=[2];
 useAugment(s,s.players[0],{op:'use',id:'even'},()=>0);assert.deepEqual(s.held,[false,false,true,true,true]);
 s.dice=[2,3,1,4,5];s.rollCount=3;afterAugmentRoll(s,()=>0);assert.equal(s.rollCount,2);assert.deepEqual(s.held,[true,true,true,false,false]);
});
test('revival starts available, gives two faces, and has three-use lifetime cap',()=>{
 const s=fixture(['revive']),p=s.players[0];
 useAugment(s,p,{op:'use',id:'revive',die:0,value:6},()=>0);assert.deepEqual(s.dice.slice(0,2),[6,6]);assert.deepEqual(s.held.slice(0,2),[true,true]);
 s.dice=[1,2,3,4,6];s.rollCount=1;recordAugment(s,p,'yacht');assert.equal(p.augment.items[0].remaining,1);
});
test('defect never reduces a normal score across every five and six dice outcome',()=>{
 const s=fixture(['defect']),p=s.players[0];
 for(const n of [5,6])for(let code=0;code<6**n;code++){
   let value=code;s.dice=Array.from({length:n},()=>{const face=value%6+1;value=Math.floor(value/6);return face;});
   for(const category of SCORE_CATEGORIES){const raw=categoryScore(category,s.dice),score=augmentedScore(s,p,category).score;assert.ok(score>=raw);if(raw>0)assert.equal(score,raw);}
 }
});

test('defect supports near misses but preserves normal results and stronger house rule', () => {
  const s = fixture(['defect']);
  const p = s.players[0];
  for (const [dice, category, score] of [
    [[6,6,6,2,1],'fourOfAKind',16],
    [[6,6,2,2,1],'fullHouse',13],
    [[6,6,6,2,1],'fullHouse',16],
    [[1,2,3,6,6],'smallStraight',12],
    [[1,2,3,4,6],'largeStraight',24],
    [[6,6,6,6,1],'yacht',40],
    [[1,2,3,4,5],'largeStraight',30],
    [[6,6,6,6,6],'yacht',50],
    [[1,1,3,5,5],'smallStraight',0],
  ]) {
    s.dice = dice;
    assert.equal(augmentedScore(s,p,category).score,score,category);
  }
  give(p,['defect','fakeHouse']);
  s.dice = [6,6,6,6,1];
  assert.equal(augmentedScore(s,p,'fullHouse').score,25);
});
