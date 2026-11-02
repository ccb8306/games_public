import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../dist/app.js';
import {createGroup,connect} from './network-fixture.mjs';
import {AUGMENTS,initAugment} from '../../shared/dist/index.js';

test('practice automatically throws again, preserves other physical dice and synchronizes reconnect',async t=>{
 const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url=`ws://127.0.0.1:${app.server.address().port}/ws`,clients=await createGroup(url,2),room=[...app.rooms.rooms.values()][0];
 room.state.mode='augment';initAugment(room.state,n=>n===100?99:0);room.state.augment.drafting=false;for(const p of room.state.players)p.augment.offers=[];
 const actor=clients.find(c=>c.session.playerId===room.state.currentPlayerId),peer=clients.find(c=>c!==actor),p=room.state.players.find(p=>p.id===actor.session.playerId);
 p.augment.curse={id:'practice',from:peer.session.playerId,active:true};room.state.revision++;app.rooms.broadcast(room);await actor.until(()=>!!actor.state.augment);
 const completions=[],original=app.rooms.physicalEvent.bind(app.rooms);app.rooms.physicalEvent=event=>{if(event.type==='done')completions.push(structuredClone(event));original(event);};
 await actor.command('startShake');await actor.command('roll');
 await actor.until(()=>completions.length===2&&actor.state.rollPhase==='idle'&&!actor.state.augment.turn.reroll,60000);await peer.until(()=>peer.state.revision===actor.state.revision);
 const first=completions[0].dice,second=completions[1].dice,changed=first.flatMap((v,i)=>v!==second[i]?[i]:[]);
 assert.ok(changed.length<=1);if(changed.length)assert.equal(first[changed[0]],Math.max(...first));
 assert.equal(actor.state.rollCount,1);assert.deepEqual(actor.state.dice,peer.state.dice);assert.deepEqual(actor.state.motion,peer.state.motion);assert.deepEqual(actor.state.augment,peer.state.augment);assert.equal(actor.state.augment.turn.first.dice.join(),second.join());
 const session=actor.session;actor.ws.close();await peer.until(()=>peer.state.players.some(p=>!p.connected));const resumed=await connect(url);resumed.send('resumeRoom',{code:session.code,token:session.token});await resumed.until(()=>resumed.state);assert.equal(resumed.state.rollCount,1);assert.equal(resumed.state.players.find(p=>p.id===session.playerId).augment.curse.resolved,true);
});

for(const count of [2,3,4])test(`flash reservations and reconnect synchronize across ${count} clients`,async t=>{
 const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url=`ws://127.0.0.1:${app.server.address().port}/ws`,clients=await createGroup(url,count),room=[...app.rooms.rooms.values()][0];
 room.state.mode='augment';initAugment(room.state,n=>n===100?99:0);room.state.augment.drafting=false;for(const p of room.state.players)p.augment.offers=[];
 const actor=clients.find(c=>c.session.playerId===room.state.currentPlayerId),p=room.state.players.find(p=>p.id===actor.session.playerId);
 p.augment.items=['strike','closed'].map(id=>({id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}));room.state.revision++;app.rooms.broadcast(room);
 await Promise.all(clients.map(c=>c.until(()=>!!c.state.augment)));
 await actor.command('augment',{command:{op:'use',id:'strike'}});
 await Promise.all(clients.map(c=>c.until(()=>c.state.revision===actor.state.revision)));
 for(const c of clients){assert.deepEqual(c.state.augment,actor.state.augment);assert.ok(c.state.players.every(p=>p.augment.curse?.id==='strike'&&!p.augment.curse.active));}
 const session=actor.session;actor.ws.close();await clients.find(c=>c!==actor).until(()=>clients.find(c=>c!==actor).state.players.some(p=>!p.connected));
 const resumed=await connect(url);resumed.send('resumeRoom',{code:session.code,token:session.token});await resumed.until(()=>resumed.state);
 assert.ok(resumed.state.players.every(p=>p.augment.curse?.id==='strike'));
 room.state.dice=[6,6,6,6,6];room.state.rollCount=1;room.state.revision++;app.rooms.broadcast(room);await resumed.until(()=>resumed.state.rollCount===1);
 await resumed.command('score',{category:'choice'});
 assert.equal(resumed.state.players.find(p=>p.id===session.playerId).augment.curse.active,false);
 assert.equal(resumed.state.players.find(p=>p.id===resumed.state.currentPlayerId).augment.curse.active,true);
});
