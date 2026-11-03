import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../dist/app.js';
import {connect} from './network-fixture.mjs';
import {AUGMENTS} from '../../shared/dist/index.js';

test('offer refresh and every single-die reroll synchronize, survive reconnect and preserve all other dice',async t=>{
 const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url=`ws://127.0.0.1:${app.server.address().port}/ws`;let a=await connect(url);const b=await connect(url);
 a.send('createRoom',{nickname:'A',mode:'augment'});await a.until(()=>a.state);b.send('joinRoom',{nickname:'B',code:a.state.code});await b.until(()=>b.state);await a.until(()=>a.state.players.filter(Boolean).length===2);
 await a.command('setReady',{ready:true});await b.until(()=>b.state.revision===a.state.revision);await b.command('setReady',{ready:true});await a.until(()=>a.state.augment?.drafting);
 const before=structuredClone(a.state.players[1].augment),old=[...a.state.players[0].augment.offers],flash=a.state.players[0].augment.flashOffer;
 await a.command('augment',{command:{op:'refresh',offerIndex:0,id:old[0]}});await b.until(()=>b.state.revision===a.state.revision);
 assert.deepEqual(b.state.players[1].augment,before);assert.equal(b.state.players[0].augment.rerolled[0],true);assert.equal(b.state.players[0].augment.flashOffer,flash);assert.ok(!old.includes(b.state.players[0].augment.offers[0]));assert.deepEqual(b.state.players[0].augment.offers.slice(1),old.slice(1));
 const session=a.session;a.ws.close();await b.until(()=>b.state.players.some(p=>!p.connected));a=await connect(url);a.send('resumeRoom',{code:session.code,token:session.token});await a.until(()=>a.state);assert.equal(a.state.players[0].augment.rerolled[0],true);
 await a.command('augment',{command:{op:'pick',id:a.state.players[0].augment.offers[0]}});await b.until(()=>b.state.revision===a.state.revision);await b.command('augment',{command:{op:'pick',id:b.state.players[1].augment.offers[0]}});await a.until(()=>!a.state.augment.drafting);
 let actor=a.state.currentPlayerId===a.session.playerId?a:b;const peer=actor===a?b:a,room=[...app.rooms.rooms.values()][0],baseline=structuredClone(room.state);
 for(const count of [4,10])for(const id of ['collector','choiceRoll','even','chaos','exchange']){
  room.state=structuredClone(baseline);room.state.revision+=100;room.state.rollCount=3;room.state.dice=Array.from({length:count},(_,i)=>i%6+1);room.state.held=Array.from({length:count},(_,i)=>i%2===0);room.state.motion=null;
  const index=count-1;room.state.dice[index]=1;const faces=[...room.state.dice],held=[...room.state.held];
  room.state.players.find(p=>p.id===actor.session.playerId).augment.items=[{id,remaining:2,usedTurn:-1,usedRound:-1}];room.state.augment.event=['chaos','exchange'].includes(id)?id:null;
  app.rooms.broadcast(room);await actor.until(()=>actor.state.revision===room.state.revision);
  await actor.command('augment',{command:{op:'use',id,die:index}});await peer.until(()=>peer.state.rollPhase==='shaking');
  assert.deepEqual(actor.state.held,Array.from({length:count},(_,i)=>id==="even"?faces[i]!==1:i!==index));
  if(count===4&&id==='even'){
   const job=room.physicsJob,remaining=actor.state.players.find(p=>p.id===actor.session.playerId).augment.items[0].remaining;
   app.rooms.physics.send({type:'cancel',roomId:room.state.roomId,id:job.id});
   app.rooms.physicalEvent({type:'failed',roomId:room.state.roomId,id:job.id});
   await actor.until(()=>actor.state.rollPhase==='idle');assert.equal(actor.state.rollCount,3);assert.equal(actor.state.augment.turn.reroll.id,id);
   await actor.command('startShake');assert.equal(actor.state.players.find(p=>p.id===actor.session.playerId).augment.items[0].remaining,remaining);
  }
  const token=actor.session;actor.ws.close();await peer.until(()=>peer.state.players.some(p=>!p.connected));actor=await connect(url);actor.send('resumeRoom',{code:token.code,token:token.token});await actor.until(()=>actor.state?.players.every(p=>!p||p.connected));
  assert.equal(actor.state.augment.turn.reroll.id,id);
  await actor.command('roll');await actor.until(()=>actor.state.rollPhase==='idle'&&!actor.state.augment.turn.reroll,30000);await peer.until(()=>peer.state.revision===actor.state.revision);
  assert.equal(actor.state.rollCount,3);assert.deepEqual(actor.state.held,held);assert.deepEqual(actor.state.dice.filter((_,i)=>id==="even"?faces[i]!==1:i!==index),faces.filter((_,i)=>id==="even"?faces[i]!==1:i!==index));assert.deepEqual(actor.state.motion,peer.state.motion);
  if(actor.state.augment.turn.chooseOld){await actor.command('augment',{command:{op:'keepOld',value:1}});assert.deepEqual(actor.state.dice,faces);}
  assert.equal(actor.state.augment.turn.extra,id==='exchange'?8:0);assert.equal(actor.state.augment.turn.flags.includes('final'),id==='chaos');
 }
});
test('augment draft, authoritative six-dice rolls, edits, free reroll and reconnect synchronize',async t=>{
 const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url=`ws://127.0.0.1:${app.server.address().port}/ws`,a=await connect(url),b=await connect(url);
 a.send('createRoom',{nickname:'A',mode:'augment'});await a.until(()=>a.state);
 b.send('joinRoom',{nickname:'B',code:a.state.code});await b.until(()=>b.state);await a.until(()=>a.state.players.filter(Boolean).length===2);
 await a.command('setReady',{ready:true});await b.until(()=>b.state.revision===a.state.revision);await b.command('setReady',{ready:true});await a.until(()=>a.state.augment?.drafting);
 await a.command('augment',{command:{op:'pick',id:a.state.players[0].augment.offers[0]}});await b.until(()=>b.state.revision===a.state.revision);
 await b.command('augment',{command:{op:'pick',id:b.state.players[1].augment.offers[0]}});await a.until(()=>!a.state.augment.drafting);
 const actor=a.state.currentPlayerId===a.session.playerId?a:b,peer=actor===a?b:a;
 const room=[...app.rooms.rooms.values()][0],p=room.state.players.find(p=>p.id===actor.session.playerId);
 p.augment.items=['sixth','alchemy','choiceRoll'].map(id=>({id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}));
 room.state.dice.push(null);room.state.held.push(false);
 await actor.command('startShake');await peer.until(()=>peer.state.rollPhase==='shaking');await actor.command('roll');await actor.until(()=>actor.state.rollCount===1,30000);await peer.until(()=>peer.state.rollCount===1);
 assert.equal(actor.state.dice.length,6);assert.deepEqual(actor.state.dice,peer.state.dice);assert.deepEqual(actor.state.motion,peer.state.motion);
 await actor.command('augment',{command:{op:'use',id:'alchemy',die:0,value:6}});await peer.until(()=>peer.state.revision===actor.state.revision);assert.equal(peer.state.dice[0],6);assert.deepEqual(peer.state.motion,actor.state.motion);
 await actor.command('augment',{command:{op:'use',id:'choiceRoll',die:1}});assert.equal(actor.state.rollPhase,'shaking');await actor.command('roll');await actor.until(()=>actor.state.rollPhase==='idle'&&!actor.state.augment.turn.reroll,30000);assert.equal(actor.state.rollCount,1);
 const session=actor.session;actor.ws.close();await peer.until(()=>peer.state.players.some(p=>!p.connected));
 const resumed=await connect(url);resumed.send('resumeRoom',{code:session.code,token:session.token});await resumed.until(()=>resumed.state);assert.equal(resumed.state.rollPhase,'idle');
 if(resumed.state.augment.turn.chooseOld)await resumed.command('augment',{command:{op:'keepOld',value:1}});await peer.until(()=>peer.state.revision===resumed.state.revision);assert.deepEqual(peer.state.augment,resumed.state.augment);
});

for(const count of [4,10])test(`parallel physics ${count} dice A/B and reconnect keep every peer identical`,async t=>{
 const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url=`ws://127.0.0.1:${app.server.address().port}/ws`,a=await connect(url),b=await connect(url);
 a.send('createRoom',{nickname:'A',mode:'augment'});await a.until(()=>a.state);b.send('joinRoom',{nickname:'B',code:a.state.code});await b.until(()=>b.state);await a.until(()=>a.state.players.filter(Boolean).length===2);
 await a.command('setReady',{ready:true});await b.until(()=>b.state.revision===a.state.revision);await b.command('setReady',{ready:true});await a.until(()=>a.state.augment?.drafting);
 await a.command('augment',{command:{op:'pick',id:a.state.players[0].augment.offers[0]}});await b.until(()=>b.state.revision===a.state.revision);await b.command('augment',{command:{op:'pick',id:b.state.players[1].augment.offers[0]}});await a.until(()=>!a.state.augment.drafting);
 let actor=a.state.currentPlayerId===a.session.playerId?a:b;const peer=actor===a?b:a,room=[...app.rooms.rooms.values()][0];
 const p=room.state.players.find(p=>p.id===actor.session.playerId);p.augment.items=[{id:'fork',remaining:2,usedTurn:-1,usedRound:-1}];room.state.dice=Array(count).fill(null);room.state.held=Array(count).fill(false);
 await actor.command('augment',{command:{op:'use',id:'fork'}});await actor.command('startShake');await actor.command('roll');await actor.until(()=>actor.state.augment.turn.pending==='forkSecond',30000);await peer.until(()=>peer.state.augment.turn.pending==='forkSecond');assert.deepEqual(actor.state.dice,peer.state.dice);
 const first=[...actor.state.dice],session=actor.session;actor.ws.close();await peer.until(()=>peer.state.players.some(p=>!p.connected));actor=await connect(url);actor.send('resumeRoom',{code:session.code,token:session.token});await actor.until(()=>actor.state);assert.deepEqual(actor.state.augment.turn.fork.first.dice,first);
 await actor.command('augment',{command:{op:'resolve',value:0}});await actor.command('roll');await actor.until(()=>actor.state.augment.turn.pending==='forkChoice',30000);
 await actor.command('augment',{command:{op:'resolve',value:0}});await peer.until(()=>peer.state.revision===actor.state.revision);assert.equal(actor.state.rollCount,1);assert.deepEqual(actor.state.dice,first);assert.deepEqual(actor.state.motion,peer.state.motion);assert.equal(actor.state.augment.turn.pending,undefined);
});
