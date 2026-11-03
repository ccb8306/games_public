import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { mkdir, writeFile } from "node:fs/promises";
import { Simulation } from "../dist/simulation.js";

if (!isMainThread) {
  const counts=Array.from({length:5},()=>Array(6).fill(0));
  const durations=Array.from({length:4},()=>Array(6).fill(0));
  const pairs=Array.from({length:6},()=>Array(6).fill(0));
  const masks=Array.from({length:31},()=>Array(6).fill(0));
  const pairTables=Array.from({length:10},()=>Array.from({length:6},()=>Array(6).fill(0)));
  let failures=0,winds=0,total=0;
  for (let n=workerData.start;n<workerData.end;n++) {
    const bucket=n%4, shake=[0.1,0.6,2,6][bucket];
    const mask=workerData.mode === "held" ? n%31 : 0;
    const held=Array.from({length:5},(_,i)=>Boolean(mask&(1<<i)));
    const sim=new Simulation("audit",held,[1,1,1,1,1],n+918721);
    for(let i=0;i<Math.round(shake*60);i++) sim.tick();
    sim.stop();
    while(sim.phase!=="rest"&&!sim.failed) sim.tick();
    if(sim.failed) failures++;
    else {
      const values=sim.values();
      values.forEach((v,i)=>{if(held[i])return;counts[i][v-1]++;durations[bucket][v-1]++;masks[mask][v-1]++;total++;});
      if(!held[0]&&!held[1]) pairs[values[0]-1][values[1]-1]++;
      let pair=0;for(let i=0;i<5;i++)for(let j=i+1;j<5;j++,pair++)if(!held[i]&&!held[j])pairTables[pair][values[i]-1][values[j]-1]++;
    }
    winds+=sim.windCount;
    if((n-workerData.start+1)%25===0) parentPort.postMessage({progress:n-workerData.start+1});
  }
  parentPort.postMessage({counts,durations,pairs,pairTables,masks,failures,winds,total});
} else {
  const rolls=Number(process.argv[2]??20000), mode=process.argv[3]??"all", start=performance.now();
  const results=[];
  let next=0, completed=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(next<rolls) {
      const begin=next;next=Math.min(rolls,next+250);const end=next;
      const result=await new Promise((resolve,reject)=>{
        const worker=new Worker(new URL(import.meta.url),{resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16},workerData:{start:begin,end,mode}});
        worker.on("message",m=>{if(!m.progress)resolve(m);});
        worker.on("error",reject);
        worker.on("exit",code=>{if(code)reject(new Error("Audit worker exited "+code));});
      });
      results.push(result); completed+=end-begin; console.log("audit_progress",completed,rolls);
    }
  }));
  const sumMatrix=key=>results[0][key].map((row,i)=>row.map((_,j)=>results.reduce((sum,r)=>sum+r[key][i][j],0)));
  const counts=sumMatrix("counts"),durations=sumMatrix("durations"),pairs=sumMatrix("pairs");
  const faceCounts=Array.from({length:6},(_,i)=>counts.reduce((sum,row)=>sum+row[i],0));
  const total=results.reduce((s,r)=>s+r.total,0),expected=total/6;
  const chiSquare=faceCounts.reduce((s,n)=>s+(n-expected)**2/expected,0);
  const pairTables=results[0].pairTables.map((table,k)=>table.map((row,i)=>row.map((_,j)=>results.reduce((sum,r)=>sum+r.pairTables[k][i][j],0))));
  const report={rolls,mode,pairTables,masks:sumMatrix("masks"),total,failures:results.reduce((s,r)=>s+r.failures,0),winds:results.reduce((s,r)=>s+r.winds,0),seconds:(performance.now()-start)/1000,faceCounts,chiSquare,counts,durations,pairs};
  await mkdir("artifacts/server-physics",{recursive:true});
  await writeFile("artifacts/server-physics/probability"+(mode==="all"?"":"-"+mode)+".json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
