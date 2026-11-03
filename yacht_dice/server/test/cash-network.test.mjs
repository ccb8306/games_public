import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../dist/app.js';
import {connect} from './network-fixture.mjs';

test('instant silver payout reaches both peers and reconnect never pays again',async t=>{
 const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url=`ws://127.0.0.1:${app.server.address().port}/ws`;
 const a=await connect(url),b=await connect(url);t.after(()=>{a.ws.close();b.ws.close();});
 a.send('createRoom',{nickname:'A',mode:'augment'});await a.until(()=>a.state);
 b.send('joinRoom',{nickname:'B',code:a.state.code});await b.until(()=>b.state);await a.until(()=>a.state.players.filter(Boolean).length===2);
 await a.command('setReady',{ready:true});await b.until(()=>b.state.revision===a.state.revision);
 await b.command('setReady',{ready:true});await a.until(()=>a.state.augment?.drafting);
 const room=[...app.rooms.rooms.values()][0];room.state.players[0].augment.offers=['cashNow','nudge','mirror'];room.state.revision++;app.rooms.broadcast(room);
 await a.until(()=>a.state.revision===room.state.revision);
 await a.command('augment',{command:{op:'pick',id:'cashNow'}});await b.until(()=>b.state.revision===a.state.revision);
 for(const c of [a,b]){assert.equal(c.state.players[0].augment.bonus,20);assert.equal(c.state.players[0].augment.items[0].remaining,0);assert.equal(c.state.augment.results.filter(r=>r.activation?.id==='cashNow').length,1);}
 const session=a.session;a.ws.close();await b.until(()=>!b.state.players[0].connected);
 const resumed=await connect(url);t.after(()=>resumed.ws.close());resumed.send('resumeRoom',{code:session.code,token:session.token});await resumed.until(()=>resumed.state);
 assert.equal(resumed.state.players[0].augment.bonus,20);
 assert.equal(resumed.state.augment.results.filter(r=>r.activation?.id==='cashNow').length,1);
});
