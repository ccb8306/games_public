import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyScorecard,initAugment,useAugment,recordAugment,playerTotals,roomStateSchema} from '../dist/index.js';

test('cashNow pays once on selection, survives serialization, and never fills or boosts scorecard slots',()=>{
 const s={roomId:'cash-test',code:'ABC12345',mode:'augment',capacity:2,disconnectGraceSeconds:60,phase:'playing',players:[0,1].map(slot=>({id:`p${slot}`,slot,nickname:`P${slot}`,connected:true,ready:true,forfeited:false,reconnectDeadline:null,scores:emptyScorecard()})),currentPlayerId:'p0',dice:Array(5).fill(null),held:Array(5).fill(false),rollCount:0,rollPhase:'idle',revision:0,reconnectDeadline:null,outcome:null};
 s.roomId=crypto.randomUUID();for(const p of s.players)p.id=crypto.randomUUID();s.currentPlayerId=s.players[0].id;
 initAugment(s,()=>0);
 const p=s.players[0];p.augment.offers=['cashNow'];
 const scores=structuredClone(p.scores);
 useAugment(s,p,{op:'pick',id:'cashNow'},()=>0);
 assert.equal(p.augment.bonus,20);assert.equal(playerTotals(p).total,20);
 assert.deepEqual(p.scores,scores);assert.equal(p.augment.rawUpper,0);
 assert.equal(p.augment.items[0].remaining,0);
 const receipt=s.augment.results.find(r=>r.activation?.id==='cashNow');
 assert.deepEqual(receipt.payouts,[{playerId:p.id,amount:20,reason:'일시불로 주세요'}]);
 assert.throws(()=>useAugment(s,p,{op:'pick',id:'cashNow'},()=>0));
 assert.equal(p.augment.bonus,20);
 const restored=roomStateSchema.parse(JSON.parse(JSON.stringify(s)));
 assert.equal(restored.players[0].augment.items[0].earned,20);
 const q=s.players[1];useAugment(s,q,{op:'pick',id:q.augment.offers[0]},()=>0);
 assert.throws(()=>useAugment(s,p,{op:'use',id:'cashNow'},()=>0));
 s.dice=[6,6,6,6,6];s.rollCount=1;
 recordAugment(s,p,'sixes');
 assert.equal(p.scores.sixes,30);assert.equal(p.augment.rawUpper,30);
 assert.equal(p.augment.bonus,20);assert.equal(playerTotals(p).total,50);
});
