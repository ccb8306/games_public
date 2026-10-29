import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import assert from "node:assert/strict";
import { decodeServerMessage } from "../../shared/dist/index.js";
export async function connect(url, observe=()=>{}) {
  const ws=new WebSocket(url), waits=[];
  const client={ws,state:null,session:null,frames:[],bytes:0,
    send(type,fields={}) {
      const requestId=randomUUID();
      ws.send(JSON.stringify({type,requestId,...(client.state&&!["resumeRoom","joinRoom","createRoom","clock"].includes(type)?{roomId:client.state.roomId,expectedRevision:client.state.revision}:{}),...fields}));
      return requestId;
    },
    until(predicate,timeout=15000) {
      if(predicate())return Promise.resolve();
      return new Promise((resolve,reject)=>{
        const entry={predicate,resolve,timer:setTimeout(()=>{waits.splice(waits.indexOf(entry),1);reject(new Error("Condition timeout"));},timeout)};
        waits.push(entry);
      });
    },
    async command(type,fields={}) {
      const rev=client.state?.revision??-1;
      client.send(type,fields);
      await client.until(()=>client.state && client.state.revision>rev);
    }
  };
  ws.on("message",raw=>{
    client.bytes+=raw.length;
    const parsed=decodeServerMessage(raw.toString());assert.ok(parsed.success,raw.toString());
    const msg=parsed.data;
    if(msg.type==="session")client.session=msg;
    if(msg.type==="roomState")client.state=msg.state;
    if(msg.type==="motion")client.frames.push(...msg.frames);
    if(client.frames.length>1000)client.frames.splice(0,client.frames.length-1000);
    observe(msg);
    for(const entry of [...waits])if(entry.predicate()){
      clearTimeout(entry.timer);waits.splice(waits.indexOf(entry),1);entry.resolve();
    }
  });
  await new Promise((resolve,reject)=>{ws.once("open",resolve);ws.once("error",reject);});
  return client;
}
export async function createGroup(url,count=4) {
  const clients=[await connect(url)];
  clients[0].send("createRoom",{nickname:"P0",capacity:count});
  await clients[0].until(()=>clients[0].state);
  for(let i=1;i<count;i++) {
    const c=await connect(url);clients.push(c);
    c.send("joinRoom",{nickname:"P"+i,code:clients[0].state.code});
    await c.until(()=>c.state);await clients[0].until(()=>clients[0].state.players.filter(Boolean).length===i+1);
  }
  for(const c of clients) {
    const revision=Math.max(...clients.map(c=>c.state.revision));
    await c.until(()=>c.state.revision>=revision);await c.command("setReady",{ready:true});
    await Promise.all(clients.map(peer=>peer.until(()=>peer.state.revision>=c.state.revision)));
  }
  return clients;
}
