import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AUGMENTS,EVENTS,emptyScorecard,applyGameAction,initAugment,useAugment,afterAugmentRoll,augmentedScore,recordAugment,advanceAugment,playerTotals,roomStateSchema,scoringDice,scorePreview,categoryScore,SCORE_CATEGORIES} from '../dist/index.js';
export function fixture(ids=[],count=2){
 const s={roomId:randomUUID(),code:'ABC12345',mode:'augment',capacity:count,disconnectGraceSeconds:60,phase:'playing',players:Array.from({length:count},(_,slot)=>({id:randomUUID(),slot,nickname:`P${slot}`,connected:true,ready:true,forfeited:false,reconnectDeadline:null,scores:emptyScorecard()})),currentPlayerId:null,dice:Array(5).fill(null),held:Array(5).fill(false),rollCount:0,rollPhase:'idle',revision:0,reconnectDeadline:null,outcome:null};
 s.currentPlayerId=s.players[0].id;initAugment(s,()=>0);s.augment.drafting=false;s.players.forEach(p=>p.augment.offers=[]);give(s.players[0],ids);return s;
}
export function give(p,ids){p.augment.items=ids.map(id=>({id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}));}
const use=(s,id,extra={})=>useAugment(s,s.players[0],{op:'use',id,...extra},()=>0);
const rolled=(s,dice=[6,6,6,2,4],rolls=1)=>{s.dice=dice;s.held=dice.map(()=>false);s.rollCount=rolls;return s;};
test('practice chooses a highest tie, physically rerolls once and keeps count and replay snapshot',()=>{
 const s=fixture(['practice']);use(s,'practice',{target:s.players[1].id});advanceAugment(s,()=>0);rolled(s,[2,6,6,3,1]);afterAugmentRoll(s,()=>1);
 assert.equal(s.augment.turn.reroll.index,2);assert.equal(s.rollPhase,'shaking');assert.deepEqual(s.held,[true,true,false,true,true]);
 s.dice[2]=1;s.rollCount=2;s.rollPhase='idle';afterAugmentRoll(s,()=>0);assert.equal(s.rollCount,1);assert.equal(s.augment.turn.reroll,null);assert.deepEqual(s.augment.turn.first.dice,[2,6,1,3,1]);assert.ok(s.held.every(v=>!v));
 afterAugmentRoll(s,()=>0);assert.equal(s.augment.turn.reroll,null);
});
test('misdelivery exchanges the chosen value, preserves next first hold, and shield blocks both halves',()=>{
 for(const shield of [false,true]){
  const s=rolled(fixture(['misdelivery']),[1,2,3,4,5]),q=s.players[1];q.augment.lastDice=[6,6,6,2,2];if(shield)give(q,['shield']);
  use(s,'misdelivery',{target:q.id,die:0,value:6});assert.equal(s.dice[0],shield?1:6);
  if(shield){assert.equal(q.augment.curse,null);continue;}
  advanceAugment(s,()=>0);assert.equal(s.dice[0],1);assert.equal(s.held[0],true);assert.deepEqual(s.augment.turn.preheld,[0]);
  s.dice=[1,2,3,4,5];s.rollCount=1;afterAugmentRoll(s,()=>0);assert.equal(applyGameAction(s,q.id,{type:'setHolds',held:Array(5).fill(false)},()=>0).ok,true);
 }
});
test('borrowed gold has one use, preserves source charges and expires at the next own record',()=>{
 const s=rolled(fixture(['broken'])),p=s.players[0],q=s.players[1];give(q,['alchemy']);use(s,'broken',{target:q.id,other:'alchemy'});
 use(s,'alchemy',{die:0,value:1});assert.equal(q.augment.items[0].remaining,2);assert.throws(()=>use(s,'alchemy',{die:1,value:1}));
 recordAugment(s,p,'choice');assert.ok(p.augment.items.some(i=>i.borrowedAt!==undefined));advanceAugment(s,()=>0);rolled(s);assert.throws(()=>useAugment(s,q,{op:'use',id:'alchemy',die:0,value:1},()=>0));recordAugment(s,q,'choice');advanceAugment(s,()=>0);rolled(s);recordAugment(s,p,'ones');assert.ok(!p.augment.items.some(i=>i.borrowedAt!==undefined));
});
test('gold migration preserves instance history, excludes borrowed gold and shields, allows duplicates',()=>{
 const s=fixture(['goldRush','alchemy'],4),[p,q,r,u]=s.players;give(q,['clone']);give(r,['shield','fourth']);give(u,['flip']);
 p.augment.items[1].remaining=1;p.augment.items[1].usedTurn=12;q.augment.items.push({id:'flip',remaining:1,usedTurn:-1,usedRound:-1,borrowedAt:0});
 use(s,'goldRush');assert.ok(p.augment.items.some(i=>i.id==='flip'));assert.equal(q.augment.items[0].id,'alchemy');assert.equal(q.augment.items[0].remaining,1);assert.equal(q.augment.items[0].usedTurn,12);assert.equal(q.augment.items[1].borrowedAt,0);assert.equal(r.augment.items[1].id,'fourth');assert.equal(u.augment.items[0].id,'clone');assert.equal(roomStateSchema.safeParse(s).success,true);
 const blocked=fixture(['goldRush','fourth']);give(blocked.players[1],['shield','clone']);use(blocked,'goldRush');assert.equal(blocked.players[0].augment.items[1].id,'fourth');assert.equal(blocked.players[0].augment.items[0].remaining,0);assert.equal(blocked.players[1].augment.items[0].remaining,0);
});
test('receipt pays once only for actual reroll and cannot be undone through replay',()=>{
 const s=fixture(['receipt']);use(s,'receipt',{target:s.players[1].id});advanceAugment(s,()=>0);rolled(s);afterAugmentRoll(s,()=>2);afterAugmentRoll(s,()=>0);assert.equal(s.players[0].augment.bonus,0);
 s.held[2]=true;s.rollCount=2;afterAugmentRoll(s,()=>0);assert.equal(s.players[0].augment.bonus,0);
 s.held[2]=false;s.rollCount=3;afterAugmentRoll(s,()=>0);afterAugmentRoll(s,()=>0);assert.equal(s.players[0].augment.bonus,3);assert.equal(augmentedScore(s,s.players[1],'choice').extra,0);
});
test('hostage face seals survive cat rewind and reject every face edit',()=>{
 const s=fixture(['hostage']);give(s.players[1],['cat','alchemy','worldFlip']);use(s,'hostage',{target:s.players[1].id});advanceAugment(s,()=>0);rolled(s);afterAugmentRoll(s,()=>0);
 useAugment(s,s.players[1],{op:'resolve',value:1,indices:[0,1]},()=>0);s.rollCount=3;
 useAugment(s,s.players[1],{op:'use',id:'cat'},()=>0);assert.deepEqual(s.dice.slice(0,2),[1,1]);assert.deepEqual(s.held.slice(0,2),[true,true]);
 for(const command of [{op:'use',id:'alchemy',die:0,value:6},{op:'use',id:'worldFlip',indices:[0]}])assert.equal(applyGameAction(s,s.players[1].id,{type:'augment',command},()=>0).ok,false);
});
test('first-throw curses cannot be bypassed by declaring parallel worlds',()=>{
 for(const id of ['dropIt','receipt','practice','hostage','lock']){
  const s=fixture([id]);give(s.players[1],['fork']);use(s,id,{target:s.players[1].id});advanceAugment(s,()=>0);assert.throws(()=>useAugment(s,s.players[1],{op:'use',id:'fork'},()=>0));
 }
});
test('every player draws three independent uniformly indexed ordinary offers',()=>{
 for(const count of [2,3,4]){
  const s=fixture([],count),pool=AUGMENTS.filter(d=>d.rarity==='silver'&&!d.flash&&d.id!=='evolution');
  let draws=0,lotteries=0;
  initAugment(s,max=>{if(max===100){lotteries++;return 99;}const player=Math.floor(draws/3);draws++;return player%max;});
  assert.equal(draws,count*3);assert.equal(lotteries,count);
  for(let i=0;i<count;i++){
   assert.deepEqual(s.players[i].augment.offers,pool.slice(i,i+3).map(d=>d.id));
   assert.equal(new Set(s.players[i].augment.offers).size,3);
  }
 }
});
test('catalog has 48 specified cards, one evolution, and eight events',()=>{
 assert.equal(AUGMENTS.length,74);assert.equal(EVENTS.length,8);assert.equal(new Set(AUGMENTS.map(a=>a.id)).size,74);
 assert.equal(AUGMENTS.filter(d=>d.rarity==='silver').length,26);assert.equal(AUGMENTS.filter(d=>d.rarity==='prism').length,21);
});
test('draft offers, refresh, ownership, evolution and pause guards',()=>{
 const s=fixture();s.augment.drafting=true;s.players[0].augment.offers=['nudge','mirror','cleaner'];
 assert.throws(()=>useAugment(s,s.players[0],{op:'pick',id:'wild'},()=>0));
 useAugment(s,s.players[0],{op:'refresh'},()=>0);assert.equal(s.players[0].augment.offers.length,3);
 assert.throws(()=>useAugment(s,s.players[0],{op:'refresh'},()=>0));
 useAugment(s,s.players[0],{op:'pick',id:s.players[0].augment.offers[0]},()=>0);assert.equal(s.augment.drafting,false);
 assert.equal(roomStateSchema.safeParse(s).success,true);
 give(s.players[0],['nudge']);s.augment.round=7;s.augment.drafting=true;s.players[0].augment.offers=['fourth'];
 useAugment(s,s.players[0],{op:'pick',id:'evolution'},()=>0);assert.deepEqual(s.players[0].augment.items.map(a=>a.id),['evolution']);
});
test('all face edits, charges, copy, final lock and anti-cheat validation',()=>{
 for(const [id,args,want] of [['nudge',{die:3,value:3},3],['evolution',{die:3,value:4},4],['mirror',{die:3},5],['flip',{die:3},5],['clone',{die:3,value:0},6],['alchemy',{die:3,value:1},1],['wild',{die:3,value:5},5]]){
  const s=rolled(fixture([id]));use(s,id,args);assert.equal(s.dice[3],want,id);
  if(!['alchemy','mirror'].includes(id))assert.throws(()=>use(s,id,args));
 }
 const s=rolled(fixture(['worldFlip','nudge']));use(s,'worldFlip',{indices:[0,3]});assert.deepEqual(s.dice,[1,6,6,5,4]);assert.ok(s.augment.turn.flags.includes('final'));
 assert.throws(()=>use(s,'alchemy',{die:1,value:6}));assert.throws(()=>use(s,'nudge',{die:1,value:1}));
});
test('silver passive score conditions and non-repeating savings',()=>{
 const cases=[['cleaner',[1,1,2,3,4],'choice',6],['collector',[1,2,3,4,5],'choice',8],['rest',[1,2,3,4,5],'choice',6],['odd',[1,1,3,5,2],'choice',6],['upper',[6,6,6,1,2],'sixes',5],['six',[6,6,6,1,2],'choice',7]];
 for(const [id,dice,c,extra] of cases){const s=rolled(fixture([id]),dice);assert.equal(augmentedScore(s,s.players[0],c).extra,extra,id);}
 const s=rolled(fixture(['savings','stubborn','lastmove','underdog']));s.augment.turn.kept=[0,1];s.augment.turn.flags=['third'];s.augment.turn.gap=25;s.players[0].augment.streak=2;
 assert.equal(augmentedScore(s,s.players[0],'choice').extra,24);recordAugment(s,s.players[0],'choice');assert.equal(s.players[0].augment.savingsPaid,true);
});
test('gold and prism category rules, bets, raw upper and bonus floor',()=>{
 const cases=[['fakeHouse',[6,6,6,6,1],'fullHouse',25],['artisan',[1,2,3,4,5],'largeStraight',48],['hunter',[6,6,6,6,1],'fourOfAKind',40],['chance',[6,6,6,6,6],'choice',55],['defect',[6,6,6,6,1],'yacht',40]];
 for(const [id,dice,c,want] of cases){const s=rolled(fixture([id]),dice);assert.equal(augmentedScore(s,s.players[0],c).score,want,id);}
 const s=fixture(['target','loan','devil','substitute']);use(s,'target',{category:'yacht'});use(s,'loan');use(s,'devil');rolled(s,[6,6,6,6,6]);assert.equal(augmentedScore(s,s.players[0],'yacht').total,142);
 use(s,'substitute');assert.equal(augmentedScore(s,s.players[0],'yacht').total,47);
 const fail=fixture(['loan','devil']);use(fail,'loan');use(fail,'devil');rolled(fail,[1,1,1,1,1]);recordAugment(fail,fail.players[0],'choice');assert.equal(playerTotals(fail.players[0]).total,0);
});
test('zero repair and parallel scoring do not fill extra slots or retrigger bonuses',()=>{
 const s=rolled(fixture(['erase','parallel','cleaner']),[1,1,1,1,1]);s.players[0].scores.yacht=0;
 use(s,'erase',{category:'yacht'});use(s,'parallel',{category:'fullHouse'});recordAugment(s,s.players[0],'ones');
 assert.equal(s.players[0].scores.yacht,50);assert.equal(s.players[0].scores.fullHouse,null);assert.equal(s.players[0].augment.bonus,8);assert.equal(s.players[0].augment.rawUpper,5);
 const b=rolled(fixture(['erase']));use(b,'erase');recordAugment(b,b.players[0],'choice');assert.equal(b.players[0].augment.bonus,10);
});
test('attacks, shields, capped reflection, theft, gold swaps and copying',()=>{
 for(const id of ['thief','lock','seal']){const s=fixture([id]);use(s,id,{target:s.players[1].id});assert.equal(s.players[1].augment.curse.id,id);assert.throws(()=>use(s,id,{target:s.players[1].id}));}
 for(const id of ['shield','reflect']){const s=fixture(['thief']);give(s.players[1],[id]);use(s,'thief',{target:s.players[1].id});assert.equal(s.players[1].augment.curse,null);assert.equal(s.players[0].augment.items[0].remaining,1);}
 const s=rolled(fixture(['spectator','parasite']));s.players[0].augment.curse={id:'thief',from:s.players[1].id};recordAugment(s,s.players[0],'choice');assert.equal(s.players[1].augment.bonus,8);
 const swap=fixture(['swap','fourth']);give(swap.players[1],['clone']);use(swap,'swap',{target:swap.players[1].id,other:'clone',category:'fourth'});assert.ok(swap.players[0].augment.items.some(i=>i.id==='clone'));assert.equal(swap.players[1].augment.items[0].id,'fourth');
 const copy=fixture(['doppel']);give(copy.players[1],['fourth']);use(copy,'doppel',{target:copy.players[1].id,other:'fourth'});assert.ok(copy.players[0].augment.items.some(i=>i.id==='fourth'));assert.equal(copy.players[1].augment.items[0].id,'fourth');
});
test('physical rerolls preserve ordinary count and held selection, world replay consumes once',()=>{
 const s=rolled(fixture(['choiceRoll','cat']));use(s,'choiceRoll',{die:3});assert.equal(s.rollPhase,'shaking');assert.deepEqual(s.held,[true,true,true,false,true]);
 s.dice[3]=5;s.rollCount++;s.rollPhase='idle';afterAugmentRoll(s,()=>0);assert.equal(s.rollCount,1);assert.deepEqual(s.held,Array(5).fill(false));useAugment(s,s.players[0],{op:'keepOld',value:1},()=>0);assert.equal(s.dice[3],2);
 afterAugmentRoll(s,()=>0);const first=[...s.dice];s.rollCount=3;s.dice=[1,1,1,1,1];use(s,'cat');assert.deepEqual(s.dice,first);assert.equal(s.rollCount,1);useAugment(s,s.players[0],{op:'world',value:1},()=>0);assert.deepEqual(s.dice,[1,1,1,1,1]);assert.throws(()=>use(s,'cat'));
});
test('all eight events and extra dice selection',()=>{
 for(const id of EVENTS.map(e=>e.id)){const s=fixture();s.augment.event=id;
  if(id==='bomb')use(s,id);if(id==='debt'){use(s,id);assert.equal(s.augment.turn.maxRolls,4);}
  rolled(s,[6,6,6,2,4],2);
  if(id==='reverse'){use(s,id,{die:3});assert.equal(s.dice[3],5);}
  if(['chaos','exchange'].includes(id)){use(s,id,{die:3});s.rollCount++;s.rollPhase='idle';afterAugmentRoll(s,()=>0);assert.equal(s.rollCount,2);}
  if(id==='speed')assert.equal(augmentedScore(s,s.players[0],'choice').extra,10);
  if(id==='aid')assert.equal(augmentedScore(s,s.players[0],'yacht').extra,12);
  if(id==='bomb')assert.equal(augmentedScore(s,s.players[0],'choice').extra,20);
 }
 const s=rolled(fixture(['sixth']),[1,2,3,4,5,6,6]);assert.deepEqual(scoringDice(s),s.dice);

});
for (const count of [2,3,4]) test(`twelve rounds keep cyclic order for ${count} players with drafts and events`,()=>{
 let s=fixture([],count);const rounds=new Map(),drafts=new Set(),events=new Set();
 for(let i=0;i<12*count;i++){
  assert.equal(s.currentPlayerId,s.players[i%count].id);
  if(s.augment.drafting){drafts.add(s.augment.round);for(const p of s.players)if(p.augment.offers.length)useAugment(s,p,{op:'pick',id:p.augment.offers[0]},()=>0);}
  rounds.set(s.augment.round,rounds.get(s.augment.round)??s.currentPlayerId);if(s.augment.event)events.add(s.augment.round);
  rolled(s,[1,2,3,4,5]);const p=s.players.find(p=>p.id===s.currentPlayerId),category=SCORE_CATEGORIES.find(k=>p.scores[k]===null);
  const result=applyGameAction(s,p.id,{type:'score',category},()=>0);assert.equal(result.ok,true,JSON.stringify(result));s=result.state;
 }
 assert.equal(s.phase,'finished');assert.deepEqual([...drafts],[4,7,10]);assert.deepEqual([...events],[3,6,9,12]);assert.equal(new Set(rounds.values()).size,1);assert.equal(roomStateSchema.safeParse(s).success,true);
});
test('roll modifiers, revival and forced hold are applied at next personal turn',()=>{
 const s=fixture();give(s.players[1],['fourth','lifebuoy','loser','revive']);s.players[1].augment.previousZero=true;s.players[0].augment.bonus=50;
 s.players[1].augment.curse={id:'seal',from:s.players[0].id};advanceAugment(s,()=>0);assert.equal(s.augment.turn.maxRolls,5);
 useAugment(s,s.players[1],{op:'use',id:'revive',die:0,value:6},()=>0);assert.equal(s.held[0],true);assert.equal(s.dice[0],6);
 s.players[1].augment.curse={id:'lock',from:s.players[0].id};rolled(s);afterAugmentRoll(s,()=>2);assert.equal(s.augment.turn.locked,2);assert.equal(s.held[2],true);
 const result=applyGameAction(s,s.players[1].id,{type:'setHolds',held:Array(5).fill(false)},()=>0);assert.equal(result.ok,false);
});
test('duel compares only subsequent turns and settles once; debt cannot evade its cap',()=>{
 const s=fixture(['duel']);use(s,'duel',{target:s.players[1].id});assert.equal(s.augment.duels.length,1);
 rolled(s,[6,6,6,6,6]);recordAugment(s,s.players[0],'choice');assert.equal(s.augment.duels[0].aScore,null);
 advanceAugment(s,()=>0);assert.equal(s.augment.turn.maxRolls,2);s.augment.event='debt';assert.throws(()=>useAugment(s,s.players[1],{op:'use',id:'debt'},()=>0));
 rolled(s,[1,2,3,4,5]);recordAugment(s,s.players[1],'choice');advanceAugment(s,()=>0);assert.equal(s.currentPlayerId,s.players[0].id);assert.equal(s.augment.turn.maxRolls,2);
 rolled(s,[6,6,6,6,6]);recordAugment(s,s.players[0],'sixes');assert.equal(s.players[0].augment.bonus,20);assert.equal(s.augment.duels.length,0);
});
test('spectator income is capped per round and raw upper ignores multiplied scores',()=>{
 const s=fixture([],4);give(s.players[0],['spectator','parasite']);
 for(const p of s.players.slice(1)){rolled(s,[6,6,6,6,6]);recordAugment(s,p,'yacht');}
 assert.equal(s.players[0].augment.bonus,16);
 give(s.players[0],['devil']);s.rollCount=0;use(s,'devil');rolled(s,[6,6,6,6,6]);recordAugment(s,s.players[0],'sixes');assert.equal(s.players[0].scores.sixes,60);assert.equal(s.players[0].augment.rawUpper,30);assert.equal(playerTotals(s.players[0]).bonus,0);
});
test('invalid commands preserve input state and a disconnected draft cannot act',()=>{
 const s=rolled(fixture(['nudge'])),before=structuredClone(s);
 assert.equal(applyGameAction(s,s.players[0].id,{type:'augment',command:{op:'use',id:'nudge',die:0,value:1}},()=>0).ok,false);assert.deepEqual(s,before);
 s.players[1].connected=false;assert.equal(applyGameAction(s,s.players[0].id,{type:'augment',command:{op:'use',id:'nudge',die:3,value:3}},()=>0).ok,false);
});
test('game-limited charges can be spent in one turn; per-turn charges cannot',()=>{
 const s=rolled(fixture(['mirror','alchemy']));use(s,'mirror',{die:0});use(s,'mirror',{die:1});use(s,'mirror',{die:2});assert.throws(()=>use(s,'mirror',{die:3}));
 use(s,'alchemy',{die:2,value:6});use(s,'alchemy',{die:3,value:6});assert.throws(()=>use(s,'alchemy',{die:4,value:6}));
});

test('all six or seven dice score, including extra matches and subset combinations',()=>{
 for(const dice of [[5,5,5,1,2,5],[5,5,5,1,2,5,5]]){
  const s=rolled(fixture(['sixth']),dice),p=s.players[0],expected=dice.filter(n=>n===5).length*5;
  assert.equal(scorePreview(s,p,'fives'),expected);
  const result=applyGameAction(s,p.id,{type:'score',category:'fives'},()=>0);
  assert.equal(result.ok,true);assert.equal(result.state.players[0].scores.fives,expected);
 }
 for(const [dice,category,score] of [
  [[5,5,5,5,1,2],'fourOfAKind',23],[[5,5,5,5,2,2],'fullHouse',24],
  [[2,2,2,3,3,3],'fullHouse',15],[[1,1,1,2,2,6,6],'fullHouse',19],
  [[1,1,1,2,3,4],'fullHouse',0],[[1,2,3,4,5,6],'largeStraight',30],
  [[5,5,5,5,5,5],'yacht',50],[[5,5,5,5,5,1,2],'yacht',50],
  [[5,5,5,5,1,2],'yacht',0],[[6,6,6,6,6,6,6],'choice',42]
 ])assert.equal(categoryScore(category,dice),score,`${category}: ${dice}`);
 const s=rolled(fixture(['defect','fakeHouse']),[5,5,5,5,2,2]);
 assert.equal(augmentedScore(s,s.players[0],'fullHouse').score,24);
 s.dice=[5,5,5,5,5,5];assert.equal(augmentedScore(s,s.players[0],'yacht').score,50);
});

test('parallel cannot consume last slot; substitute does not fake successful combos',()=>{
 const s=rolled(fixture(['parallel']));for(const k of SCORE_CATEGORIES)if(k!=='choice')s.players[0].scores[k]=0;
 assert.throws(()=>use(s,'parallel',{category:'choice'}));assert.equal(s.players[0].augment.items[0].remaining,1);
 const q=rolled(fixture(['substitute','hunter','artisan']),[1,2,3,5,6]);use(q,'substitute');
 assert.equal(augmentedScore(q,q.players[0],'yacht').score,17);assert.equal(augmentedScore(q,q.players[0],'largeStraight').score,17);
});
test('cat restores held history and cannot waste charge with only one roll',()=>{
 const s=rolled(fixture(['cat','stubborn']));afterAugmentRoll(s,()=>0);s.rollCount=3;s.augment.turn.kept=[0,1];
 const before=augmentedScore(s,s.players[0],'choice').extra;use(s,'cat');useAugment(s,s.players[0],{op:'world',value:1},()=>0);
 assert.equal(augmentedScore(s,s.players[0],'choice').extra,before);
 const q=rolled(fixture(['cat']));q.augment.turn.maxRolls=1;afterAugmentRoll(q,()=>0);assert.throws(()=>use(q,'cat'));assert.equal(q.players[0].augment.items[0].remaining,1);
});
test('contract zero resets streak and enables failure recovery',()=>{
 const s=fixture(['devil','target','savings']);use(s,'devil');use(s,'target',{category:'choice'});rolled(s,[1,2,3,5,6]);s.players[0].augment.streak=2;
 recordAugment(s,s.players[0],'choice');assert.equal(s.players[0].scores.choice,0);assert.equal(s.players[0].augment.streak,0);assert.equal(s.players[0].augment.previousZero,true);assert.equal(s.players[0].augment.savingsPaid,false);
});
test('identical free reroll resolves without duplicate choice',()=>{
 const s=rolled(fixture(['choiceRoll']));use(s,'choiceRoll',{die:0});s.rollCount++;s.rollPhase='idle';afterAugmentRoll(s,()=>0);assert.equal(s.augment.turn.chooseOld,null);assert.equal(s.rollCount,1);
});

test('flash catalog: tier distribution, ten percent offers and refresh does not retrigger lottery',()=>{
 for(const tier of ['silver','gold','prism'])assert.equal(AUGMENTS.filter(d=>d.flash&&d.rarity===tier).length,tier==='prism'?6:5);
 for(const roll of [0,9,10,99]){
  const s=fixture();initAugment(s,n=>n===100?roll:0);const p=s.players[0];
  assert.equal(p.augment.offers.filter(id=>AUGMENTS.find(d=>d.id===id).flash).length,roll<10?1:0);
  useAugment(s,p,{op:'refresh'},n=>n===100?(roll<10?99:0):0);
  assert.equal(p.augment.offers.filter(id=>AUGMENTS.find(d=>d.id===id).flash).length,roll<10?1:0);
 }
});
test('all targeted flash effects reserve, defend and apply to the next personal turn',()=>{
 for(const id of ['taxSix','dropIt','receipt','broken','construction']){
  const s=fixture([id]);give(s.players[1],['clone']);
  const args={target:s.players[1].id,other:'clone',category:'choice',seals:[{target:s.players[1].id,category:'ones'},{target:s.players[1].id,category:'twos'}]};
  use(s,id,args);assert.equal(s.players[1].augment.curse.active,false);
  advanceAugment(s,()=>0);assert.equal(s.players[1].augment.curse.active,true);rolled(s,[6,6,6,1,2]);afterAugmentRoll(s,()=>0);
  if(id==='taxSix'){assert.equal(scorePreview(s,s.players[1],'choice'),15);recordAugment(s,s.players[1],'choice');assert.equal(playerTotals(s.players[1]).total,15);}
  if(id==='dropIt'){assert.equal(s.dice[0],1);assert.equal(s.augment.turn.locked,null);const dice=[...s.dice];afterAugmentRoll(s,()=>0);assert.deepEqual(s.dice,dice);}
  if(id==='receipt'){assert.equal(s.players[1].augment.curse.die,0);assert.equal(scorePreview(s,s.players[1],'choice'),17);}
  if(id==='broken')assert.throws(()=>useAugment(s,s.players[1],{op:'use',id:'clone',die:3,value:0},()=>0));
  if(id==='construction')assert.throws(()=>recordAugment(s,s.players[1],'choice'));
  if(id==='closed')for(const category of ['ones','twos'])assert.throws(()=>recordAugment(s,s.players[1],category));
  const shield=fixture([id]);give(shield.players[1],['clone','shield']);use(shield,id,{...args,target:shield.players[1].id,seals:args.seals.map(x=>({...x,target:shield.players[1].id}))});assert.equal(shield.players[1].augment.curse,null);
 }
});
test('global flash affects each next turn including caster and expires; gold strike resumes',()=>{
 for(const id of ['handsUp','strike','squid']) {
  const s=rolled(fixture([id,'fourth']),[6,6,6,6,6]);give(s.players[1],['fourth']);use(s,id);recordAugment(s,s.players[0],'choice');
  assert.equal(s.players[0].augment.curse.active,false);advanceAugment(s,()=>0);
  assert.equal(s.players[1].augment.curse.active,true);
  assert.equal(s.augment.turn.maxRolls,id==='strike'?3:id==='squid'?2:4);
  rolled(s,[6,6,6,6,6]);
  if(id==='handsUp')assert.equal(applyGameAction(s,s.players[1].id,{type:'setHolds',held:[true,true,true,false,false]},()=>0).ok,false);
  if(id==='squid')assert.equal(augmentedScore(s,s.players[1],'choice').score,60);
  recordAugment(s,s.players[1],'choice');assert.equal(s.players[1].augment.curse,null);advanceAugment(s,()=>0);
  assert.equal(s.players[0].augment.curse.active,true);assert.equal(s.augment.turn.maxRolls,id==='strike'?4:id==='squid'?2:4);
 }
});
test('flash forbids double curses and blocking every remaining category',()=>{
 const s=fixture(['construction','closed']);for(const k of SCORE_CATEGORIES)if(k!=='choice')s.players[1].scores[k]=0;
 assert.throws(()=>use(s,'construction',{target:s.players[1].id,category:'choice'}));
 const q=fixture(['taxSix','receipt']);use(q,'taxSix',{target:q.players[1].id});assert.throws(()=>use(q,'receipt',{target:q.players[1].id}));
});

test('reflection damage cap matches preview and global barriers cannot be bypassed',()=>{
 const s=rolled(fixture(['thief']),[1,2,3,5,6]);s.players[0].scores.ones=10;s.players[0].augment.rawUpper=10;s.players[0].augment.curse={id:'thief',from:s.players[1].id};give(s.players[1],['reflect']);
 use(s,'thief',{target:s.players[1].id});const before=playerTotals(s.players[0]).total,preview=scorePreview(s,s.players[0],'choice');recordAugment(s,s.players[0],'choice');assert.equal(playerTotals(s.players[0]).total-before,preview);assert.equal(preview,12);
 const q=fixture(['squid']);use(q,'squid');advanceAugment(q,()=>0);q.augment.event='debt';assert.throws(()=>useAugment(q,q.players[1],{op:'use',id:'debt'},()=>0));
 const r=fixture(['strike']);give(r.players[1],['reflect']);use(r,'strike');assert.equal(r.players[1].augment.curse,null);assert.equal(r.players[0].augment.curse.id,'strike');
});
test('recorded lower score exchange preserves upper accounting, charges and once-per-victim guard',()=>{
 const s=fixture(['closed']),p=s.players[0],q=s.players[1];p.scores.yacht=0;for(const key of SCORE_CATEGORIES)q.scores[key]=0;q.scores.yacht=50;p.augment.rawUpper=30;
 use(s,'closed',{target:q.id,category:'yacht'});assert.equal(p.scores.yacht,50);assert.equal(q.scores.yacht,0);assert.equal(p.augment.rawUpper,30);assert.equal(q.augment.scoreSwapped,true);assert.equal(p.augment.bonus,0);
 give(p,['closed']);assert.throws(()=>use(s,'closed',{target:q.id,category:'yacht'}));
 const x=fixture(['closed']);x.players[0].scores.yacht=0;x.players[1].scores.yacht=50;give(x.players[1],['shield']);use(x,'closed',{target:x.players[1].id,category:'yacht'});assert.equal(x.players[0].scores.yacht,0);assert.equal(x.players[1].augment.scoreSwapped,false);
});

test('flash draw is ten percent in a seeded sample, with at most one card',()=>{
 let seed=83,hits=0;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
 const s=fixture();for(let i=0;i<10000;i++){initAugment(s,random);const flash=s.players[0].augment.offers.filter(id=>AUGMENTS.find(d=>d.id===id).flash);assert.ok(flash.length<=1);hits+=flash.length;}
 assert.ok(hits>=850&&hits<=1150,`observed ${hits}/10000`);
});
test('squid and devil cap multipliers at three and round down half scores',()=>{
 const s=fixture(['devil']);use(s,'devil');s.players[0].augment.curse={id:'squid',from:s.players[1].id,active:true};rolled(s,[6,6,6,6,6]);assert.equal(augmentedScore(s,s.players[0],'choice').score,90);
 s.augment.turn.flags=[];s.dice=[1,2,3,5,6];assert.equal(augmentedScore(s,s.players[0],'choice').score,8);
});

test('limited face edits cannot be spammed in a turn or after exhaustion',()=>{
 for(const [id,charges] of [['nudge',3],['clone',4],['evolution',4]]){
  const s=rolled(fixture([id]));
  for(let n=0;n<charges;n++){
   s.augment.turn.serial++;s.dice=[6,6,6,2,4];
   const args={die:3,value:id==='clone'?0:3};use(s,id,args);
   assert.equal(s.players[0].augment.items[0].remaining,charges-n-1);
   assert.throws(()=>use(s,id,args));
  }
  s.augment.turn.serial++;assert.throws(()=>use(s,id,{die:4,value:5}));
 }
});
test('return defective die uses physical reroll and respects locks and final phase',()=>{
 const s=rolled(fixture(['even']),[1,2,3,4,5]);
 assert.throws(()=>use(s,'even',{die:1}));
 s.augment.turn.locked=0;assert.throws(()=>use(s,'even',{die:0}));s.augment.turn.locked=null;
 s.augment.turn.flags=['final'];assert.throws(()=>use(s,'even',{die:0}));s.augment.turn.flags=[];
 use(s,'even',{die:0});assert.equal(s.rollPhase,'shaking');assert.equal(s.augment.turn.reroll.index,0);
 s.dice[0]=4;s.rollCount++;afterAugmentRoll(s,()=>0);s.rollPhase='idle';
 assert.equal(s.rollCount,1);assert.equal(s.augment.turn.chooseOld,null);assert.equal(s.dice[0],4);
 assert.equal(s.players[0].augment.items[0].remaining,1);assert.throws(()=>use(s,'even',{die:0}));
});
test('risk and recovery rewards need actual actions, do not stack and respect zero records',()=>{
 const s=rolled(fixture(['clockwork','lower'])),p=s.players[0];
 assert.equal(augmentedScore(s,p,'choice').extra,0);
 s.rollCount=2;s.held[0]=true;afterAugmentRoll(s,()=>0);assert.equal(augmentedScore(s,p,'choice').extra,0);
 s.held.fill(false);afterAugmentRoll(s,()=>0);afterAugmentRoll(s,()=>0);
 assert.equal(augmentedScore(s,p,'choice').extra,4);assert.equal(augmentedScore(s,p,'yacht').extra,0);
 p.augment.previousZero=true;assert.equal(augmentedScore(s,p,'choice').extra,12);
 assert.equal(augmentedScore(s,p,'yacht').extra,0);
 const free=rolled(fixture(['clockwork','even']),[1,2,3,4,5]);use(free,'even',{die:0});free.rollCount++;afterAugmentRoll(free,()=>0);
 assert.equal(free.augment.turn.flags.includes('allIn'),false);
});

test('mischief tiers reserve one curse, respect shields and expire after the target turn',()=>{
 for(const id of ['parkingTicket','butterFingers','ordinaryDay']){
  let s=fixture([id]);const target=s.players[1].id;use(s,id,{target});assert.equal(s.players[1].augment.curse.active,false);
  assert.throws(()=>use(s,id,{target}));advanceAugment(s,()=>0);rolled(s,[1,2,3,4,5]);const p=s.players[1];
  if(id==='parkingTicket'){
   const result=applyGameAction(s,target,{type:'setHolds',held:[true,true,true,false,false]},()=>0);assert.equal(result.ok,true);s=result.state;
   assert.equal(scorePreview(s,s.players[1],'choice'),11);
   const released=applyGameAction(s,target,{type:'setHolds',held:Array(5).fill(false)},()=>0);assert.equal(released.ok,true);s=released.state;assert.equal(scorePreview(s,s.players[1],'choice'),11);
  }
  if(id==='butterFingers'){
   assert.equal(applyGameAction(s,target,{type:'setHolds',held:[true,true,false,false,false]},()=>0).ok,false);
   assert.equal(applyGameAction(s,target,{type:'setHolds',held:[true,false,false,false,false]},()=>0).ok,true);
  }
  if(id==='ordinaryDay'){
   give(p,['nudge','clone','wild','odd']);
   for(const ability of ['nudge','clone','wild'])assert.throws(()=>useAugment(s,p,{op:'use',id:ability,die:0,value:2},()=>0));
   assert.equal(p.augment.items[0].remaining,3);s.augment.event='reverse';useAugment(s,p,{op:'use',id:'reverse',die:0},()=>0);
  }
  recordAugment(s,s.players[1],'choice');assert.equal(s.players[1].augment.curse,null);
  const shield=fixture([id]);give(shield.players[1],['shield']);use(shield,id,{target:shield.players[1].id});assert.equal(shield.players[1].augment.curse,null);
 }
});

test('tomorrow stores low face, survives serialization and starts next turn held',()=>{
 const s=rolled(fixture(['tomorrow']),[1,2,3,4,5]);
 assert.throws(()=>use(s,'tomorrow',{die:4}));use(s,'tomorrow',{die:2});
 assert.equal(s.players[0].augment.savedFace,4);assert.equal(roomStateSchema.parse(s).players[0].augment.savedFace,4);assert.ok(!s.augment.turn.flags.includes('final'));s.dice[2]=6;
 assert.equal(s.players[0].augment.items[0].remaining,1);assert.throws(()=>use(s,'tomorrow',{die:0}));
 recordAugment(s,s.players[0],'choice');advanceAugment(s,()=>0);rolled(s);recordAugment(s,s.players[1],'choice');advanceAugment(s,()=>0);
 assert.equal(s.dice[0],4);assert.equal(s.held[0],true);assert.equal(s.players[0].augment.savedFace,null);
});

test('bounty and dinner pay once, are shieldable, and remain separate from multipliers',()=>{
 let s=fixture(['bounty']);const p=s.players[0],q=s.players[1];use(s,'bounty',{target:q.id,value:6});assert.equal(q.augment.curse.other,'6');advanceAugment(s,()=>0);rolled(s,[6,6,6,1,1]);recordAugment(s,q,'sixes');assert.equal(p.augment.bonus,6);assert.equal(q.scores.sixes,18);
 s=fixture(['dinner']);use(s,'dinner');assert.equal(s.players[0].augment.bonus,3);assert.equal(s.players[0].augment.curse.active,false);advanceAugment(s,()=>0);rolled(s,[2,2,2,2,2]);assert.equal(augmentedScore(s,s.players[1],'choice').extra,-2);recordAugment(s,s.players[1],'choice');assert.equal(s.players[1].augment.bonus,-2);
});
test('taste requires an opponent final face and no edits after the first roll',()=>{
 const s=rolled(fixture(['taste','nudge']));s.players[1].augment.lastDice=[1,2,3,4,5];
 assert.throws(()=>use(s,'taste',{target:s.players[1].id,die:0,value:6}));use(s,'taste',{target:s.players[1].id,die:0,value:5});assert.equal(s.dice[0],5);assert.equal(s.players[0].augment.items[0].remaining,1);assert.throws(()=>use(s,'taste',{target:s.players[1].id,die:1,value:4}));
 const x=rolled(fixture(['taste','nudge']));x.players[1].augment.lastDice=[1,2,3,4,5];use(x,'nudge',{die:3,value:3});assert.throws(()=>use(x,'taste',{target:x.players[1].id,die:0,value:5}));
});
test('inspection releases two voluntary holds on second ordinary throw, never forced holds',()=>{
 const s=fixture(['inspection']);use(s,'inspection',{target:s.players[1].id});advanceAugment(s,()=>0);rolled(s,[6,2,1,1,3]);afterAugmentRoll(s,()=>0);
 s.held.fill(true);s.augment.turn.fixed=[0];
 const r=applyGameAction(s,s.players[1].id,{type:'startShake'},()=>0);assert.equal(r.ok,true);assert.deepEqual(r.state.held,[true,false,false,true,true]);assert.equal(r.state.players[1].augment.curse.resolved,true);assert.equal(r.state.augment.turn.pending,undefined);
 assert.equal(roomStateSchema.safeParse(r.state).success,true);
});

test('memory copies only five faces, handles extra physics dice and rejects preheld starts',()=>{
 const s=fixture(['memory']);s.players[0].augment.archive=[{category:'yacht',dice:[6,6,6,6,6,1,2]}];use(s,'memory',{historyIndex:0});assert.deepEqual(s.dice,[6,6,6,6,6]);assert.equal(s.rollCount,1);assert.ok(s.held.every(v=>!v));
 const x=fixture(['memory']);x.players[0].augment.archive=[{category:'choice',dice:[1,2,3,4,5]}];x.dice.push(null);x.held.push(false);use(x,'memory',{historyIndex:0});assert.equal(x.rollCount,0);assert.equal(x.dice[5],null);assert.deepEqual(x.held,[true,true,true,true,true,false]);x.dice[5]=6;x.rollCount=1;afterAugmentRoll(x,()=>0);assert.ok(x.held.every(v=>!v));
 const z=fixture(['memory']);z.players[0].augment.archive=[{category:'choice',dice:[1,2,3,4,5]}];z.held[0]=true;assert.throws(()=>use(z,'memory',{historyIndex:0}));
});
test('parallel roll preserves initial holds, consumes one roll, restores A and locks all premature actions',()=>{
 for(const pick of [0,1]){
 const s=rolled(fixture(['fork']),[6,2,3,4,5]);s.held[0]=true;use(s,'fork');assert.equal(applyGameAction(s,s.players[0].id,{type:'setHolds',held:Array(5).fill(false)},()=>0).ok,false);
 s.dice=[6,6,6,1,1];s.rollCount=2;afterAugmentRoll(s,()=>0);assert.equal(s.augment.turn.pending,'forkSecond');assert.equal(roomStateSchema.safeParse(s).success,true);
 useAugment(s,s.players[0],{op:'resolve',value:0},()=>0);assert.equal(s.rollCount,1);assert.equal(s.held[0],true);assert.equal(s.rollPhase,'shaking');
 s.rollPhase='idle';s.dice=[6,2,2,2,2];s.rollCount=2;afterAugmentRoll(s,()=>0);assert.equal(s.augment.turn.pending,'forkChoice');
 useAugment(s,s.players[0],{op:'resolve',value:pick},()=>0);assert.equal(s.rollCount,2);assert.equal(s.augment.turn.fork,undefined);assert.deepEqual(s.dice,pick===0?[6,6,6,1,1]:[6,2,2,2,2]);
 }
});
test('parcel money transfer covers all faces, zero floor, damage cap and expiry',()=>{
 for(let face=1;face<=6;face++){
 const s=fixture(['bombParcel']);s.players.forEach(p=>p.augment.bonus=30);use(s,'bombParcel',{target:s.players[1].id});advanceAugment(s,()=>0);assert.equal(s.augment.turn.pending,'bombParcel');useAugment(s,s.players[1],{op:'resolve',value:1},()=>face-1);
 assert.equal(s.players[0].augment.bonus,face<=3?40:24);assert.equal(s.players[1].augment.bonus,face<=3?20:36);assert.equal(s.augment.turn.pending,undefined);
 }
 const s=fixture(['bombParcel']);s.players[1].augment.bonus=2;use(s,'bombParcel',{target:s.players[1].id});advanceAugment(s,()=>0);useAugment(s,s.players[1],{op:'resolve',value:0},()=>0);assert.equal(playerTotals(s.players[1]).total,0);assert.equal(s.players[0].augment.bonus,2);
});
test('hostage seals final dice, allows ordered exchange or ransom and honors preheld exclusions',()=>{
 for(const value of [0,1]){
 const s=rolled(fixture(['hostage','nudge']),[1,2,3,4,5]);s.players[1].augment.bonus=20;use(s,'hostage',{target:s.players[1].id,indices:[0,1]});use(s,'nudge',{die:0,value:2});recordAugment(s,s.players[0],'choice');advanceAugment(s,()=>0);rolled(s,[6,6,6,5,5]);afterAugmentRoll(s,()=>0);assert.equal(s.augment.turn.pending,'hostage');
 useAugment(s,s.players[1],{op:'resolve',value,indices:[4,3]},()=>0);if(value===0)assert.equal(s.players[0].augment.bonus,10);else {assert.deepEqual(s.dice,[6,6,6,1,1]);assert.deepEqual(s.augment.turn.fixed,[4,3]);assert.equal(applyGameAction(s,s.players[1].id,{type:'setHolds',held:Array(5).fill(false)},()=>0).ok,false);}assert.equal(s.players[1].augment.curse,null);
 }
});

test('confiscation takes one per unshielded opponent for their next turn and gives only actual steals',()=>{
 const s=fixture(['confiscate','sixth'],4);s.augment.event='overflow';give(s.players[1],['shield']);
 use(s,'confiscate');assert.equal(s.players[0].augment.curse.other,'2');assert.equal(s.players[1].augment.curse,null);
 rolled(s);recordAugment(s,s.players[0],'choice');advanceAugment(s,()=>0);assert.equal(s.dice.length,6);
 rolled(s,Array(6).fill(2));recordAugment(s,s.players[1],'choice');advanceAugment(s,()=>0);assert.equal(s.dice.length,5);
 rolled(s,Array(5).fill(2));recordAugment(s,s.players[2],'choice');advanceAugment(s,()=>0);assert.equal(s.dice.length,5);
 rolled(s,Array(5).fill(2));recordAugment(s,s.players[3],'choice');advanceAugment(s,()=>0);assert.equal(s.dice.length,8);assert.equal(s.players[0].augment.curse.active,true);
 const x=fixture(['confiscate','sixth'],4);use(x,'confiscate');for(let i=0;i<4;i++){rolled(x);recordAugment(x,x.players.find(p=>p.id===x.currentPlayerId),'choice');advanceAugment(x,()=>0);}
 assert.equal(x.dice.length,9);x.augment.event='overflow';x.players[0].augment.curse.active=false;
 assert.equal(categoryScore('choice',[6,6,6,6]),24);assert.equal(categoryScore('yacht',[6,6,6,6]),0);assert.equal(categoryScore('choice',Array(10).fill(6)),60);
 x.dice=Array(10).fill(null);x.held=Array(10).fill(false);assert.equal(roomStateSchema.safeParse(x).success,true);
});
