import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {Vec3} from 'cannon-es';
import {Simulation} from '../server/dist/simulation.js';
const corners=[-.45,.45].flatMap(x=>[-.45,.45].flatMap(y=>[-.45,.45].map(z=>new Vec3(x,y,z))));
const report=[];
for(let count=4;count<=10;count++){
 const row={count,throws:0,failed:[],winds:0,maxSeconds:0,faceCounts:Array(6).fill(0)};
 for(let seed=100;seed<112;seed++){
  const held=Array.from({length:count},(_,i)=>seed%3===0&&i%2===0);
  const sim=new Simulation('audit',held,Array(count).fill(3),seed),before=sim.physics.bodies.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
  for(let n=0;n<[0,6,36,120][seed%4];n++)sim.tick();sim.stop();
  while(!sim.failed&&sim.phase!=='rest'){
   sim.tick();if(sim.throwTime<.28)continue;
   for(const b of sim.physics.bodies.filter(b=>b.world))for(const corner of corners){const p=b.quaternion.vmult(corner).vadd(b.position);assert.ok(Math.abs(p.x)<4.365&&Math.abs(p.z)<3.365&&p.y>-.04,`wall penetration count=${count} seed=${seed}`);}
  }
  for(let i=0;i<count;i++)if(held[i]){assert.deepEqual(sim.physics.bodies[i].position,before[i].p);assert.deepEqual(sim.physics.bodies[i].quaternion,before[i].q);}
  row.throws++;row.winds+=sim.windCount;row.maxSeconds=Math.max(row.maxSeconds,sim.throwTime);
  if(sim.failed)row.failed.push(seed);else sim.values().forEach((value,i)=>{if(!held[i])row.faceCounts[value-1]++;});
 }
 report.push(row);console.log(JSON.stringify(row));
}
await mkdir('artifacts/augments',{recursive:true});
await writeFile('artifacts/augments/extra-physics-audit.json',JSON.stringify({method:'84 seeded physical throws, 4-10 dice, immediate and mixed shake durations, partial holds. Failures mean bounded no-cost retry, not assigned faces. Sample too small to establish statistical fairness.',report},null,2));
