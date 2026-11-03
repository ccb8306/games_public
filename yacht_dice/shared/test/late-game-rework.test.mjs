import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,give} from './augments.test.mjs';
import {AUGMENTS,SCORE_CATEGORIES,categoryScore,useAugment,afterAugmentRoll,recordAugment,scoreBreakdown,advanceAugment,playerTotals,roomStateSchema,displayedFaces,applyGameAction,drawAugmentOffers} from '../dist/index.js';
const use=(s,id,args={},p=s.players.find(p=>p.id===s.currentPlayerId))=>useAugment(s,p,{op:'use',id,...args},()=>0);
const roll=(s,dice=[1,2,3,4,5],count=1)=>{s.dice=[...dice];s.held=dice.map(()=>false);s.rollCount=count;s.rollPhase='idle';};

test('parallel uses spent categories in the final turn, pays only raw score, twice per game once per turn',()=>{
 const s=fixture(['parallel','hunter','defect']);const p=s.players[0];
 for(const k of SCORE_CATEGORIES)p.scores[k]=0;p.scores.ones=null;
 roll(s,[6,6,6,6,1]);use(s,'parallel',{category:'yacht'});assert.equal(scoreBreakdown(s,p,'ones').augment,8); // hunter only, defect must not turn parallel into 40
 assert.throws(()=>use(s,'parallel',{category:'choice'}));
 s.dice=[6,6,6,6,6];const preview=scoreBreakdown(s,p,'ones');assert.equal(preview.augment,52);recordAugment(s,p,'ones');assert.equal(p.scores.yacht,0);assert.equal(p.augment.bonus,52);
});

test('minimum guarantee pays only missing recorded points and caps lifetime at 45 without upper credit',()=>{
 const s=fixture(['erase']);const p=s.players[0];
 for(const [i,k] of ['ones','twos','threes'].entries()){roll(s,[6,6,6,6,6]);const expected=[20,20,5][i];assert.equal(scoreBreakdown(s,p,k).augment,expected);recordAugment(s,p,k);}
 assert.equal(p.augment.bonus,45);assert.equal(p.augment.rawUpper,0);roll(s);assert.equal(scoreBreakdown(s,p,'yacht').augment,0);
});

test('all 7776 outcomes agree between final-turn preview and settlement with passive reworks',()=>{
 const initial=fixture(['erase','hunter','upper','lower','savings','underdog','parallel']);
 for(let code=0;code<7776;code++){
  const s=structuredClone(initial),p=s.players[0];let value=code;const dice=Array.from({length:5},()=>{const n=value%6+1;value=Math.floor(value/6);return n;});roll(s,dice);
  const c=SCORE_CATEGORIES[code%12];for(const k of SCORE_CATEGORIES)if(k!==c)p.scores[k]=0;
  p.augment.progress={erase:30,hunter:30,underdog:18};p.augment.streak=2;s.augment.turn.flags.push('lastPlace');
  use(s,'parallel',{category:c==='choice'?'yacht':'choice'});
  const preview=scoreBreakdown(s,p,c),before=playerTotals(p).total;assert.ok(preview);recordAugment(s,p,c);
  assert.equal(playerTotals(p).total-before,preview.total,`${dice}:${c}`);assert.equal(p.scores[c],preview.recorded);assert.equal(p.augment.rawUpper,c==='choice'||SCORE_CATEGORIES.indexOf(c)>=6?0:categoryScore(c,dice));
 }
});

test('factory repeats once per turn, maps all dice, rejects multiple substitutions and serializes overrides',()=>{
 const s=fixture(['customDie','alchemy']);use(s,'customDie',{faces:[6,2,3,4,5,6]});assert.throws(()=>use(s,'customDie',{faces:[1,6,3,4,5,6]}));
 roll(s,[6,6,6,6,6,6]);s.motion={id:'x',seq:0,at:0,phase:'settled',dice:s.dice.map(()=>({p:[0,0,0],q:[0,0,0,1]})),cup:null};
 use(s,'alchemy',{die:4,value:1});assert.equal(displayedFaces(s)[4][0],1);assert.equal(displayedFaces(s)[0][0],6);assert.equal(s.dice[0],6);
 s.motion=null;assert.ok(roomStateSchema.safeParse(s).success);
 recordAugment(s,s.players[0],'choice');advanceAugment(s,()=>0);roll(s);recordAugment(s,s.players[1],'choice');advanceAugment(s,()=>0);assert.equal(s.players[0].augment.customFaces,undefined);use(s,'customDie',{faces:[1,6,3,4,5,6]});
});

test('lifebuoy releases voluntary holds, preserves fixed dice, counts as free and forbids prior edits',()=>{
 const s=fixture(['lifebuoy','nudge']);roll(s);s.held.fill(true);s.augment.turn.fixed=[0];
 use(s,'lifebuoy');assert.deepEqual(s.held,[true,false,false,false,false]);s.rollCount++;s.rollPhase='idle';afterAugmentRoll(s,()=>0);assert.equal(s.rollCount,1);assert.deepEqual(s.held,[true,false,false,false,false]);assert.throws(()=>use(s,'lifebuoy'));
 const q=fixture(['lifebuoy','nudge']);roll(q);use(q,'nudge',{die:1,value:3});assert.throws(()=>use(q,'lifebuoy'));
});

test('cleaning voucher, odd and six retain passive effects after their active is spent',()=>{
 const s=fixture(['cleaner','odd','six']);roll(s,[1,1,3,5,2]);recordAugment(s,s.players[0],'choice');assert.equal(s.players[0].augment.progress.cleanerVoucher,1);
 advanceAugment(s,()=>0);roll(s);recordAugment(s,s.players[1],'choice');advanceAugment(s,()=>0);roll(s,[1,2,3,5,6]);use(s,'cleaner',{die:0});s.rollCount++;s.rollPhase='idle';afterAugmentRoll(s,()=>0);assert.equal(s.players[0].augment.progress.cleanerVoucher,0);
 use(s,'odd',{die:1});use(s,'six',{die:3});assert.deepEqual(s.dice,[1,1,3,6,6]);assert.throws(()=>use(s,'six',{die:3}));
 roll(s,[1,1,3,5,5]);assert.equal(scoreBreakdown(s,s.players[0],'ones').augment,12);
});

test('lock sends chosen low face, preserves source, and cannot be changed or released',()=>{
 const s=fixture(['lock']);give(s.players[1],['alchemy']);roll(s,[3,2,4,5,6]);use(s,'lock',{die:0,target:s.players[1].id});assert.equal(s.dice[0],3);advanceAugment(s,()=>0);roll(s,[6,6,6,6,6]);afterAugmentRoll(s,()=>0);assert.equal(s.dice[0],3);
 assert.throws(()=>use(s,'alchemy',{die:0,value:6}));assert.equal(applyGameAction(s,s.currentPlayerId,{type:'setHolds',held:Array(5).fill(false)},()=>0).ok,false);
});

test('tariff charges immediate, passive and distinct active effects, never repeated kinds or over 25',()=>{
 const s=fixture(['ordinaryDay']),[p,q]=s.players;give(q,['fourth','alchemy','hunter']);q.augment.bonus=100;use(s,'ordinaryDay',{target:q.id});assert.equal(p.augment.bonus,15);advanceAugment(s,()=>0);assert.equal(p.augment.bonus,15);roll(s,[6,6,6,2,3],4);afterAugmentRoll(s,()=>0);assert.equal(p.augment.bonus,20);use(s,'alchemy',{die:3,value:6});use(s,'alchemy',{die:4,value:6});assert.equal(p.augment.bonus,25);recordAugment(s,q,'choice');assert.equal(p.augment.bonus,25);assert.equal(q.scores.choice,30);
});

test('custody pays guardian according to final shared die and caps each guardian',()=>{
 const s=fixture(['custody']),[p,q]=s.players;use(s,'custody',{target:q.id});
 for(let i=0;i<4;i++){const actor=s.players.find(p=>p.id===s.currentPlayerId);roll(s,[actor===p?6:1,2,3,4,5]);recordAugment(s,actor,i<2?'choice':'sixes');advanceAugment(s,()=>0);}
 assert.equal(p.augment.bonus,18);assert.equal(q.augment.bonus,0);
});

test('estate relocates a failed plot once without granting points or another draft',()=>{
 const s=fixture(['estate']);s.augment.drafting=true;use(s,'estate',{categories:['ones','twos','threes']});roll(s,[2,2,2,2,2]);recordAugment(s,s.players[0],'ones');advanceAugment(s,()=>0);roll(s);recordAugment(s,s.players[1],'choice');advanceAugment(s,()=>0);use(s,'estate',{category:'ones',destination:'fours'});assert.deepEqual(s.players[0].augment.estate.plots,['fours','twos','threes']);assert.equal(s.players[0].augment.bonus,0);assert.throws(()=>use(s,'estate',{category:'twos',destination:'fives'}));
});

test('cat grants three fresh attempts even after one allowed roll, keeps forced holds, locks other actions',()=>{
 const s=fixture(['cat','alchemy','rollVault']);roll(s,[1,2,3,4,5]);afterAugmentRoll(s,()=>0);s.augment.turn.maxRolls=1;s.augment.turn.fixed=[0];s.held=[true,true,true,false,false];s.players[0].augment.rollBank=10;use(s,'cat');assert.equal(s.augment.turn.maxRolls,4);assert.deepEqual(s.held,[true,false,false,false,false]);assert.throws(()=>use(s,'alchemy',{die:1,value:6}));s.rollCount=4;s.dice=[1,6,6,6,6];afterAugmentRoll(s,()=>0);useAugment(s,s.players[0],{op:'world',value:0},()=>0);recordAugment(s,s.players[0],'choice');assert.equal(s.players[0].augment.rollBank,9);
});

test('gold migration additional use belongs only to the incoming instance',()=>{
 const s=fixture(['goldRush','fourth']),[p,q]=s.players;give(q,['clone']);use(s,'goldRush');roll(s,[1,2,3,4,5]);use(s,'clone',{die:0,value:4});use(s,'clone',{die:1,value:4});assert.throws(()=>use(s,'clone',{die:2,value:4}));assert.equal(p.augment.items.find(i=>i.id==='clone').remaining,2);
});

test('monster allows other D6 edits and attacks but rejects direct edits and world rewinds',()=>{
 const s=fixture(['monster','alchemy','cat','seal']);use(s,'monster');roll(s,[2,3,4,10]);use(s,'alchemy',{die:0,value:6});assert.equal(s.dice[0],6);assert.throws(()=>use(s,'alchemy',{die:3,value:6}));use(s,'seal',{target:s.players[1].id});assert.equal(s.players[0].augment.bonus,5);assert.throws(()=>use(s,'cat'));use(s,'monster',{value:4});assert.deepEqual(s.dice,[6,3,4,4,6]);
});

test('carousel rejection leaves shields and card untouched when fewer than three survive',()=>{
 const s=fixture(['strike'],3);s.players.forEach((p,i)=>p.scores.yacht=i*20);give(s.players[1],['shield']);const before=structuredClone(s);assert.throws(()=>use(s,'strike',{category:'yacht'}));assert.deepEqual(s,before);
});

test('catalog definitions are unique, live cards have readable limits, and reworked tiers remain unchanged',()=>{
 assert.equal(new Set(AUGMENTS.map(d=>d.id)).size,AUGMENTS.length);for(const d of AUGMENTS.filter(d=>!d.retired)){assert.ok(d.description.length>20);assert.ok(!d.description.includes('undefined'));}for(const id of ['parallel','erase','customDie','ordinaryDay','duel'])assert.equal(AUGMENTS.find(d=>d.id===id).rarity,'prism');
});

test('finalized event results reject both new free rerolls without spending a charge or voucher',()=>{
 for(const id of ['cleaner','lifebuoy']){const s=fixture([id]);roll(s,[1,2,3,4,5]);s.players[0].augment.progress={cleanerVoucher:1};s.augment.turn.flags.push('final');const before=structuredClone(s);assert.throws(()=>use(s,id,{die:0}));assert.deepEqual(s,before);}
});

test('a moved hunter retains its paid budget and a sealed non-one survives the old-world choice',()=>{
 const s=fixture(['hunter']),p=s.players[0];p.augment.items[0].earned=34;roll(s,[6,6,6,6,6]);assert.equal(scoreBreakdown(s,p,'choice').augment,2);recordAugment(s,p,'choice');assert.equal(p.augment.items[0].earned,36);
 const q=fixture(['cat']);roll(q,[3,2,3,4,5]);afterAugmentRoll(q,()=>0);q.augment.turn.sealed=[0];q.augment.turn.fixed=[0];q.rollCount=3;use(q,'cat');useAugment(q,q.players[0],{op:'world',value:1},()=>0);assert.equal(q.dice[0],3);
});

test('reworked offers do not require old zero records or unused matching lower categories',()=>{
 const s=fixture(),p=s.players[0];for(const k of SCORE_CATEGORIES)p.scores[k]=1;p.scores.fours=null;s.augment.round=10;let seed=44;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/2**32*n);};
 const seen=new Set();for(let i=0;i<300;i++){drawAugmentOffers(s,p,random);p.augment.offers.forEach(id=>seen.add(id));}assert.ok(seen.has('erase'));assert.ok(seen.has('devil'));assert.ok(seen.has('parallel'));
 s.augment.round=7;for(let i=0;i<300;i++){drawAugmentOffers(s,p,random);p.augment.offers.forEach(id=>seen.add(id));}assert.ok(seen.has('hunter'));
});
