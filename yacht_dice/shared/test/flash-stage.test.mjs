import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyScorecard,initAugment,advanceAugment,useAugment} from '../dist/index.js';

test('every draft uses its own exact percentage and rerolls preserve the lottery',()=>{
 for(const [round,percent] of [[1,8],[4,12],[7,14],[10,12]])for(let draw=0;draw<100;draw++){
  const s={phase:'playing',mode:'augment',players:Array.from({length:4},(_,slot)=>({id:String(slot),slot,nickname:String(slot),scores:emptyScorecard(),connected:true,forfeited:false})),currentPlayerId:'0',dice:[],held:[],rollPhase:'idle',rollCount:0};
  const random=n=>n===100?draw:0;
  initAugment(s,random);
  if(round!==1){s.augment.round=round-1;s.augment.done=s.players.map(p=>p.id);advanceAugment(s,random);}
  for(const p of s.players){
   assert.equal(p.augment.flashOffer,draw<percent,`${round}/${draw}`);
   useAugment(s,p,{op:'refresh',offerIndex:p.augment.offers.length-1,id:p.augment.offers.at(-1)},n=>n===100?99-draw:0);
   assert.equal(p.augment.flashOffer,draw<percent);
  }
 }
});
