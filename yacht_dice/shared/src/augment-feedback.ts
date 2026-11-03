import {SCORE_CATEGORIES,type RoomState,type PublicPlayer} from './index.js';
import {AUGMENTS,type AugmentPresentation} from './augments.js';
import {playerTotals} from './augment-game.js';

const players=(s:RoomState)=>s.players.filter((p):p is PublicPlayer=>!!p&&!p.forfeited);
export function captureAugmentFeedback(s:RoomState){
 const totals=players(s).map(p=>({id:p.id,total:playerTotals(p).total}));
 return {
  keys:new Set(s.augment!.results.map(r=>r.key)),dice:[...s.dice],
  jackpot:!!s.augment!.jackpot,duels:s.augment!.duels.length,
  players:players(s).map(p=>({id:p.id,name:p.nickname,total:playerTotals(p).total,rank:1+totals.filter(q=>q.total>playerTotals(p).total).length,scores:{...p.scores},items:p.augment!.items.map(i=>({ref:i,id:i.id,remaining:i.remaining,usedRound:i.usedRound}))})),
 };
}
export function attachAugmentFeedback(s:RoomState,before:ReturnType<typeof captureAugmentFeedback>,actorId:string,stage:AugmentPresentation['stage'],abilityId?:string,targetIds:string[]=[]){
 const result=s.augment!.results.at(-1);if(!result||before.keys.has(result.key))return;
 const current=players(s),totals=current.map(p=>playerTotals(p).total);
 const changes:AugmentPresentation['players']=[],cells:AugmentPresentation['cells']=[],cards:AugmentPresentation['cards']=[],defenses:AugmentPresentation['defenses']=[];
 for(const p of current){
  const old=before.players.find(q=>q.id===p.id);if(!old)continue;
  const total=playerTotals(p).total,rank=1+totals.filter(n=>n>total).length;
  if(total!==old.total||rank!==old.rank)changes.push({id:p.id,name:p.nickname,before:old.total,after:total,beforeRank:old.rank,afterRank:rank});
  for(const category of SCORE_CATEGORIES)if(old.scores[category]!==p.scores[category])cells.push({playerId:p.id,category,before:old.scores[category],after:p.scores[category]});
  for(const item of p.augment!.items){
   const origin=before.players.find(q=>q.items.some(i=>i.ref===item));const prior=origin?.items.find(i=>i.ref===item);
   if(origin&&prior&&origin.id!==p.id)cards.push({from:origin.id,to:p.id,id:item.id,before:prior.remaining,after:item.remaining});
   if((stage==='use'||stage==='resolve')&&prior&&origin?.id===p.id&&((item.id==='shield'&&prior.remaining>item.remaining)||(item.id==='reflect'&&prior.usedRound!==item.usedRound)))defenses.push({defenderId:p.id,reflected:item.id==='reflect'});
  }
 }
 const dice=s.dice.flatMap((n,i)=>n!==before.dice[i]&&before.dice[i]!==undefined?[{index:i,before:before.dice[i]!,after:n}]:[]);
 const reroll=s.augment!.turn.reroll;
 const rerollIndices=reroll?s.held.flatMap((h,i)=>!h?[i]:[]):[];
 const gained=changes.some(p=>p.after-p.before>=20),lost=changes.find(p=>p.id===actorId&&(p.after<p.before));
 const comeback=changes.some(p=>p.beforeRank>1&&p.afterRank===1&&totals.filter(n=>n===p.after).length===1);
 const gamble=(stage==='score'||stage==='resolve')&&['loan','loanDouble','devil','bomb','bombParcel','duel','squid'].includes(abilityId??'');
 const failedContract=stage==='score'&&['loan','loanDouble','devil'].includes(abilityId??'')&&(current.find(p=>p.id===actorId)?.augment?.progress?.lastBase??0)<25;
 const outcome:AugmentPresentation['outcome']=comeback?'comeback':defenses.some(d=>d.reflected)?'counter':gamble&&(lost||failedContract)?'backfire':gamble&&gained?'jackpot':['thief','hostage','bombParcel','taxSix','ordinaryDay'].includes(abilityId??'')&&changes.some(p=>p.after>p.before)&&changes.some(p=>p.after<p.before)?'steal':undefined;
 const major=['closed','strike','goldRush','squid'].includes(abilityId??'')||stage==='acquire'&&AUGMENTS.some(d=>d.id===abilityId&&d.flash&&d.rarity==='prism');
 const emphasis=defenses.length||targetIds.some(id=>id!==actorId)||rerollIndices.length||gained||stage==='acquire'&&AUGMENTS.some(d=>d.id===abilityId&&d.flash);
 result.presentation={stage,level:major?'major':emphasis?'emphasis':'small',actorId,abilityId,targetIds,players:changes,cells,dice,cards,defenses,rerollIndices,outcome};
}
