import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,topFace} from '../dist/simulation.js';
import {D12} from '../../shared/dist/index.js';
test('custom faces and real dodecahedron agree with final orientations and replay deterministically',()=>{
 const faces=[1,1,1,6,6,6],counts=Array(12).fill(0);
 for(let seed=1;seed<=24;seed++){
  const run=()=>{const sim=new Simulation('test',Array(4).fill(false),Array(4).fill(null),seed,undefined,faces,3);for(let i=0;i<60;i++)sim.tick();sim.stop();for(let i=0;i<1200&&sim.phase!=='rest'&&!sim.failed;i++)sim.tick();assert.equal(sim.failed,false,`seed ${seed}`);assert.equal(sim.phase,'rest');return sim;};
  const sim=run(),values=sim.values();
  for(let i=0;i<3;i++)assert.equal(values[i],faces[topFace(sim.physics.bodies[i]).face-1]);assert.equal(values[3],topFace(sim.physics.bodies[3]).face);assert.ok(values[3]>=1&&values[3]<=12);counts[values[3]-1]++;
  assert.equal(sim.physics.bodies[3].shapes[0].faces.length,12);
  for(const body of sim.physics.bodies){assert.ok(Math.abs(body.position.x)<4.4);assert.ok(Math.abs(body.position.z)<3.4);}
  if(seed<=3)assert.deepEqual(run().frame(1).dice,sim.frame(1).dice);
 }
 assert.ok(counts.filter(Boolean).length>=9);assert.equal(D12.faces.length,12);
});
