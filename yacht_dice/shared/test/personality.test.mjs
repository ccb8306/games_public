import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,give} from './augments.test.mjs';
import {AUGMENTS,SCORE_CATEGORIES,useAugment,advanceAugment,recordAugment,afterAugmentRoll,augmentedScore,flashEligible} from '../dist/index.js';
const use=(s,p,id,args={})=>useAugment(s,p,{op:'use',id,...args},()=>0);
const roll=(s,dice=[1,2,3,4,5],count=1)=>{s.dice=dice;s.held=dice.map(()=>false);s.rollCount=count;s.rollPhase='idle';};

test('bounty coexists with hostile reservations, leaves shields intact, and pays hit or escape once',()=>{
 for(const hit of [false,true]){
  const s=fixture(['bounty']),[p,q]=s.players;give(q,['shield']);q.augment.curse={id:'seal',from:p.id};
  use(s,p,'bounty',{target:q.id,value:6});assert.equal(q.augment.curse.id,'seal');assert.equal(q.augment.items[0].remaining,1);
  assert.throws(()=>use(s,p,'bounty',{target:q.id,value:6}));advanceAugment(s,()=>0);roll(s,hit?[6,6,1,2,3]:[1,2,3,4,5]);recordAugment(s,q,'choice');
  assert.equal(p.augment.bonus,hit?8:0);assert.equal(q.augment.bonus,hit?0:3);assert.deepEqual(q.augment.bounties,[]);
 }
});
test('button toll permits powers, exempts silver, and caps actual payments at fifteen',()=>{
 const s=fixture(['ordinaryDay']),[p,q]=s.players;give(q,['alchemy','mirror','fourth']);q.augment.items[0].remaining=4;q.augment.bonus=40;
 use(s,p,'ordinaryDay',{target:q.id});assert.equal(p.augment.bonus,15);advanceAugment(s,()=>0);assert.equal(s.augment.turn.maxRolls,4);roll(s);
 use(s,q,'mirror',{die:0});assert.equal(p.augment.bonus,15);
 for(const value of [2,3,4,5])use(s,q,'alchemy',{die:0,value});
 assert.equal(s.dice[0],5);assert.equal(p.augment.bonus,20);assert.equal(q.augment.bonus,20);
});
test('gold migration refills instance lifetime uses and preserves donor copies',()=>{
 const s=fixture(['goldRush','fourth','revive']),[p,q]=s.players;
 p.augment.items[2].remaining=0;p.augment.items[2].uses=3;give(q,['revive']);q.augment.items[0].uses=2;
 use(s,p,'goldRush');const incoming=p.augment.items.find(i=>i.id==='revive'&&i.remaining===1);assert.equal(incoming.uses,0);
 use(s,p,'revive',{die:0,value:6});assert.equal(incoming.uses,1);assert.deepEqual(s.dice.slice(0,2),[6,6]);
});
test('sponsor follows the card and self-contracts reopen without minting a fresh budget',()=>{
 const s=fixture(['parasite','goldRush']),[p,q]=s.players;give(q,['fourth']);
 use(s,p,'parasite',{target:q.id});p.augment.items[0].earned=12;
 use(s,p,'goldRush');const moved=q.augment.items.find(i=>i.id==='parasite');assert.equal(moved.target,undefined);assert.equal(moved.remaining,1);assert.equal(moved.earned,12);
});
test('sponsor pays selected rival only and rewards matching their score within the card budget',()=>{
 const s=fixture(['parasite'],3),[p,q,r]=s.players;use(s,p,'parasite',{target:q.id});
 roll(s,[6,6,6,6,6]);recordAugment(s,r,'choice');assert.equal(p.augment.bonus,0);
 recordAugment(s,q,'choice');assert.equal(p.augment.bonus,5);
 assert.equal(augmentedScore(s,p,'choice').extra,5);recordAugment(s,p,'choice');assert.equal(p.augment.bonus,10);assert.equal(p.augment.items[0].earned,10);
});
test('last shot is a physical reroll after roll three, retains the count and closes further rerolls',()=>{
 const s=fixture(['lastmove']),p=s.players[0];roll(s);assert.throws(()=>use(s,p,'lastmove',{die:0}));
 s.rollCount=3;use(s,p,'lastmove',{die:0});assert.equal(s.rollPhase,'shaking');s.dice[0]=6;s.rollCount=4;afterAugmentRoll(s,()=>0);assert.equal(s.rollCount,3);assert.ok(!s.augment.turn.flags.includes('final'));
 assert.throws(()=>use(s,p,'lastmove',{die:1}));
});
test('two-seat carousel is excluded while confiscation supplies its two-seat bonus',()=>{
 const s=fixture(['confiscate']),p=s.players[0];assert.equal(flashEligible(s,p,'strike'),false);use(s,p,'confiscate');assert.equal(p.augment.curse.other,'2');assert.equal(s.players[1].augment.curse.id,'confiscate');
});
test('dead late-game scoring offers and retired cards never appear',()=>{
 for(let seed=0;seed<50;seed++){
  const s=fixture();for(const p of s.players)for(const k of SCORE_CATEGORIES.slice(3))p.scores[k]=0;
  s.augment.round=9;s.augment.done=s.players.map(p=>p.id);let cursor=seed;advanceAugment(s,n=>(cursor++)%n);
  for(const p of s.players)for(const id of p.augment.offers){assert.ok(!['defect','devil','scoreRemodel'].includes(id));assert.ok(!AUGMENTS.find(d=>d.id===id).retired);}
 }
});
test('duel refusal grants one next-turn roll, and victory messages show actual thirty-five points',()=>{
 const s=fixture(['duel']),[p,q]=s.players;q.augment.bonus=30;use(s,p,'duel',{target:q.id});advanceAugment(s,()=>0);useAugment(s,q,{op:'resolve',value:0},()=>0);roll(s);recordAugment(s,q,'choice');advanceAugment(s,()=>0);assert.equal(s.augment.turn.maxRolls,3);assert.equal(p.augment.progress.duelRoll,0);
 const d=fixture();d.augment.duels=[{a:'unused',b:'unused',after:0,accepted:true,aScore:null,bScore:null}];
 d.augment.turn.serial=2;d.augment.duels=[{a:d.players[0].id,b:d.players[1].id,after:0,accepted:true,aScore:null,bScore:10}];roll(d,[6,6,6,6,6]);recordAugment(d,d.players[0],'choice');assert.equal(d.players[0].augment.bonus,40);assert.ok(d.augment.results.some(r=>r.text.includes('+40')));
});
