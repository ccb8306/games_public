import assert from 'node:assert/strict';
import {randomInt,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {AUGMENTS,emptyScorecard,initAugment,drawAugmentOffers,FLASH_CHANCE} from '../shared/dist/index.js';
const samples=Number(process.argv[2]??100000),report=[];
for(const [round,rarity] of [[1,'silver'],[4,'gold'],[7,'gold'],[10,'prism']]){
 const seats=Array.from({length:4},()=>({flash:0,positions:Array.from({length:4},()=>({}))}));let sameOrdered=0,sameSet=0,sharedCards=0;
 const s={phase:'playing',mode:'augment',players:Array.from({length:4},(_,slot)=>({id:String(slot),slot,nickname:String(slot),scores:emptyScorecard(),connected:true,forfeited:false})),currentPlayerId:'0',dice:[],held:[],rollPhase:'idle',rollCount:0};
 initAugment(s,randomInt);s.augment.round=round;
 if(round!==1)for(const p of s.players)p.augment.items=[{id:'fourth',remaining:0,usedTurn:-1,usedRound:-1}];
 for(let sample=0;sample<samples;sample++){
  for(const p of s.players)drawAugmentOffers(s,p,randomInt);
  for(let slot=0;slot<4;slot++){
   const p=s.players[slot],ids=p.augment.offers;assert.equal(new Set(ids).size,ids.length);assert.ok(ids.length===3||ids.length===4);assert.ok(ids.slice(0,3).every(id=>!AUGMENTS.find(d=>d.id===id).flash));if(ids[3])assert.ok(AUGMENTS.find(d=>d.id===ids[3]).flash);
   const flash=ids.filter(id=>AUGMENTS.find(d=>d.id===id).flash).length;assert.ok(flash<=1);seats[slot].flash+=flash;
   for(let position=0;position<ids.length;position++){
    const id=ids[position],def=AUGMENTS.find(d=>d.id===id);assert.equal(def.rarity,rarity);
    seats[slot].positions[position][id]=(seats[slot].positions[position][id]??0)+1;
   }
   for(let other=0;other<slot;other++){
    const theirs=s.players[other].augment.offers;
    if(ids.join()===theirs.join())sameOrdered++;
    if([...ids].sort().join()===[...theirs].sort().join())sameSet++;
    sharedCards+=ids.filter(id=>theirs.includes(id)).length;
   }
  }
 }
 for(const seat of seats){
  const eligible=AUGMENTS.filter(d=>!d.retired&&!d.flash&&!["erase","scoreRemodel"].includes(d.id)&&d.rarity===rarity&&d.id!=='evolution'&&(round===1||d.id!=='fourth'));
  assert.deepEqual(Object.keys(seat.positions[0]).sort(),eligible.map(d=>d.id).sort(),'every eligible card must appear in every seat');
  const expectedRate=FLASH_CHANCE[round]/100;
  assert.ok(Math.abs(seat.flash/samples-expectedRate)<.025,'flash rate must match the draft stage for each seat');
  for(const position of seat.positions){
   for(const flash of [false,true]){
    const counts=Object.entries(position).filter(([id])=>Boolean(AUGMENTS.find(d=>d.id===id).flash)===flash).map(([,n])=>n);if(!counts.length)continue;
    const mean=counts.reduce((a,b)=>a+b,0)/counts.length;
    assert.ok(counts.every(n=>Math.abs(n-mean)<6*Math.sqrt(mean)),'card frequency has an extreme deviation');
   }
  }
 }
 assert.ok(sameOrdered<samples*.06,'offers must not be copied across seats');
 report.push({round,rarity,samples,seatFlashRates:seats.map(s=>s.flash/samples),pairComparisons:samples*6,sameOrdered,sameSet,sharedCards,seats});
 console.log(JSON.stringify({round,samples,seatFlashRates:report.at(-1).seatFlashRates,sameOrdered,sameSet}));
}
await mkdir('artifacts/augments',{recursive:true});
await writeFile('artifacts/augments/offer-randomness.json',JSON.stringify({randomSource:'node:crypto.randomInt (same as production server)',method:'Four equal-eligibility seats; At least 100,000 drafts per round when run with default arguments. Each later tier starts a fresh independently drawn draft. Statistical screening, not proof of all possible random sequences.',report},null,2));
