import {writeFile,mkdir} from 'node:fs/promises';
import {AUGMENTS,SCORE_CATEGORIES,emptyScorecard,initAugment,augmentedScore,useAugment,playerTotals} from '../shared/dist/index.js';
const state=()=>{const s={roomId:'balance',code:'ABCDEFGH',mode:'augment',capacity:2,disconnectGraceSeconds:60,phase:'playing',players:[0,1].map(slot=>({id:String(slot),slot,nickname:String(slot),scores:emptyScorecard(),connected:true,ready:true,forfeited:false,reconnectDeadline:null})),currentPlayerId:'0',dice:Array(5).fill(null),held:Array(5).fill(false),rollCount:0,rollPhase:'idle',revision:0,reconnectDeadline:null,outcome:null};initAugment(s,()=>0);s.augment.drafting=false;s.players.forEach(p=>p.augment.offers=[]);return s;};
const give=(p,id)=>p.augment.items=[{id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}];
const passive=[];
for(const id of ['cleaner','odd','six','upper','lower','savings','underdog','hunter','erase'])for(const stage of AUGMENTS.find(d=>d.id===id).rarity==='silver'?[1]:id==='hunter'?[4,7]:[10]){
 const s=state(),p=s.players[0];give(p,id);s.rollCount=3;s.augment.round=stage;let total=0,max=0,samples=0;
 // Uniform outcomes/category choices expose numerical scale; they do not model keeping dice or choosing builds.
 for(let code=0;code<7776;code++){let value=code;s.dice=Array.from({length:5},()=>{const n=value%6+1;value=Math.floor(value/6);return n;});for(const category of SCORE_CATEGORIES){const extra=augmentedScore(s,p,category).extra;total+=extra;max=Math.max(max,extra);samples++;}}
 passive.push({id,stage,remainingTurns:13-stage,samples,meanBonusPerRandomRecord:total/samples,maximumSingleRecordBonus:max,condition:id==='savings'?'This first-turn sample has no streak; staged payouts are 3, 5 and 10 across consecutive positive records, two completed cycles and a total cap of 36.':id==='underdog'?'This sample is tied; acquisition gives 8 and qualifying last-place records give 4, capped at 20.':'No held-die strategy or prior progress. Caps are tested separately.'});
}
const attacks=[];
for(const [id,args] of [['ordinaryDay',{target:'1'}],['seal',{target:'1'}],['parkingTicket',{target:'1'}],['dinner',{}]]){
 const s=state(),[p,q]=s.players;give(p,id);p.augment.bonus=q.augment.bonus=100;const before=s.players.map(playerTotals);useAugment(s,p,{op:'use',id,...args},()=>0);
 attacks.push({id,immediateOwnGain:playerTotals(p).total-before[0].total,immediateOpponentLoss:before[1].total-playerTotals(q).total,reservedEffect:q.augment.curse?.id??null});
}
const report={method:'Exhaustive 7776 uniform five-die outcomes × all 12 score categories per listed passive. No strategic reroll policy; not player win rates or causal balance estimates. Early and late gold are reported separately. Opponent damage is separate from self gain.',passive,attacks,limits:{hunter:54,minimumGuarantee:60,parallel:{charges:2,perUse:40},silverInstant:20,savings:36,spectator:30,thief:{uses:2,perUse:18},tariff:25,duel:{winner:40,loser:-10,tie:15,declineTransfer:15,declineBonus:10}}};
await mkdir('artifacts/rework',{recursive:true});await writeFile('artifacts/rework/balance.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passiveRows:passive.length,attackRows:attacks.length,samples:passive.reduce((n,r)=>n+r.samples,0)}));
