import assert from "node:assert/strict";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { createApp } from "../dist/app.js";
import { createGroup } from "./network-fixture.mjs";
const app=createApp();await new Promise(r=>app.server.listen(0,"127.0.0.1",r));
const url="ws://127.0.0.1:"+app.server.address().port+"/ws";
try {
  const groups=[];for(let i=0;i<10;i++)groups.push(await createGroup(url));
  const actors=groups.map(group=>group.find(c=>c.state.currentPlayerId===c.session.playerId));
  const delay=monitorEventLoopDelay({resolution:10});delay.enable();
  const cpu=process.cpuUsage(),start=performance.now();
  await Promise.all(actors.map(a=>a.command("startShake")));
  await new Promise(r=>setTimeout(r,2500));
  await Promise.all(actors.map(a=>a.command("roll")));
  await Promise.all(actors.map(a=>a.until(()=>a.state.rollPhase==="idle",20000)));
  let retries=0;
  for(let attempt=0;attempt<3;attempt++){
    const retry=actors.filter(a=>a.state.rollCount===0);
    if(!retry.length)break;
    retries+=retry.length;
    await Promise.all(retry.map(a=>a.command("startShake")));
    await new Promise(r=>setTimeout(r,600));
    await Promise.all(retry.map(a=>a.command("roll")));
    await Promise.all(retry.map(a=>a.until(()=>a.state.rollPhase==="idle",20000)));
  }
  const elapsed=performance.now()-start;
  delay.disable();
  const times=actors.flatMap(a=>a.frames.slice(1).map((f,i)=>f.at-a.frames[i].at)).sort((a,b)=>a-b);
  const usage=process.cpuUsage(cpu);
  const report={rooms:10,clients:40,retries,seconds:elapsed/1000,cpuSeconds:(usage.user+usage.system)/1e6,rssMB:process.memoryUsage().rss/2**20,mainLoopP99Ms:delay.percentile(99)/1e6,frameGapP99Ms:times[Math.floor(times.length*.99)],receivedMB:groups.flat().reduce((s,c)=>s+c.bytes,0)/2**20,completed:actors.filter(a=>a.state.rollCount===1).length};
  await mkdir("artifacts/server-physics",{recursive:true});
  await writeFile("artifacts/server-physics/load.json",JSON.stringify(report,null,2));
  console.log(report);assert.equal(report.completed,10);assert.ok(report.mainLoopP99Ms<100);
}finally{await app.close();}
