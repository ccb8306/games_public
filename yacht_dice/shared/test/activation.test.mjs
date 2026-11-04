import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,give} from './augments.test.mjs';
import {useAugment,roomStateSchema} from '../dist/index.js';
const use=(s,id,fields={})=>useAugment(s,s.players[0],{op:'use',id,...fields},()=>0);
test('activation identifies actor, targets, reservation and defense instead of claiming a blocked attack succeeded',()=>{
 const s=fixture(['seal']);use(s,'seal',{target:s.players[1].id});
 let r=s.augment.results.at(-1);assert.equal(r.activation.actor,'P0');assert.deepEqual(r.activation.targets,['P1']);
 assert.match(r.activation.effect,/다음 자기 턴에 적용 예정/);assert.equal(r.activation.kind,'attack');assert.ok(roomStateSchema.safeParse(s).success);
 const b=fixture(['seal']);give(b.players[1],['shield']);use(b,'seal',{target:b.players[1].id});r=b.augment.results.at(-1);
 assert.equal(r.activation.kind,'defense');assert.match(r.activation.effect,/공격 무효/);assert.doesNotMatch(r.activation.effect,/적용 예정/);
});
test('global activation names all attempted targets and only reserves unshielded players',()=>{
 const s=fixture(['handsUp'],4);give(s.players[1],['shield']);use(s,'handsUp');
 const a=s.augment.results.at(-1).activation;assert.equal(a.flash,true);assert.deepEqual(a.targets,['P1','P2','P3']);
 assert.match(a.effect,/P2 · P3의 다음/);assert.match(a.effect,/P1.*공격 무효/);
 const x=fixture(['strike'],4);x.players.forEach((p,i)=>p.scores.choice=10+i);give(x.players[1],['shield']);use(x,'strike',{category:'choice'});
 assert.equal(x.augment.results.at(-1).activation.kind,'swap');assert.match(x.augment.results.at(-1).activation.effect,/공격 무효/);
 const b=fixture(['bounty']);use(b,'bounty',{target:b.players[1].id,value:6});assert.match(b.augment.results.at(-1).activation.effect,/수배한 눈: 6/);
});
test('dice edits include actual faces; failed uses do not publish activations; double wager never advertises the old payout',()=>{
 const s=fixture(['nudge']);s.rollCount=1;s.dice=[3,2,3,4,5];use(s,'nudge',{die:0,value:4,target:s.players[1].id,category:'yacht'});
 assert.deepEqual(s.augment.results.at(-1).activation.targets,['P0']);assert.doesNotMatch(s.augment.results.at(-1).activation.effect,/선택한 점수칸/);
 assert.match(s.augment.results.at(-1).activation.effect,/1번 주사위 3 → 4/);
 const count=s.augment.results.length;assert.throws(()=>use(s,'nudge',{die:0,value:5}));assert.equal(s.augment.results.length,count);
 const d=fixture(['loan']);use(d,'loan');d.rollCount=2;d.dice=[1,2,3,4,5];use(d,'loanDouble');
 assert.match(d.augment.results.at(-1).activation.effect,/\+60/);assert.doesNotMatch(d.augment.results.at(-1).activation.effect,/\+20/);
});
