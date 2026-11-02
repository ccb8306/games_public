import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3} from 'cannon-es';
import {Simulation,grounded} from '../dist/simulation.js';
const corners=[-.45,.45].flatMap(x=>[-.45,.45].flatMap(y=>[-.45,.45].map(z=>new Vec3(x,y,z))));
test('immediate ten-dice throws have time to recover stacked dice after the third wind',()=>{
 for(const seed of [1,2,8,12,14,18,19]){
  const sim=new Simulation('stacked',Array(10).fill(false),Array(10).fill(null),seed);
  sim.stop();while(sim.phase!=='rest'&&!sim.failed)sim.tick();
  assert.equal(sim.failed,false,`seed ${seed}`);
  assert.ok(sim.physics.bodies.every(grounded));
 }
});
test('six and seven dice remain in cup and tray; held extra dice stay isolated',()=>{
 for(const count of [6,7])for(const seed of [1,12,42,314])for(const mask of [0,1,(1<<count)-2]){
  const held=Array.from({length:count},(_,i)=>!!(mask&(1<<i))),sim=new Simulation('extra',held,Array(count).fill(3),seed);
  const before=sim.physics.bodies.map(b=>b.position.clone());
  for(let t=0;t<60;t++){sim.tick();for(const b of sim.physics.bodies.filter(b=>b.world))for(const c of corners){const v=b.quaternion.vmult(c).vadd(b.position);assert.ok(v.y>.18);assert.ok(Math.hypot(v.x,v.z)<1.7+(v.y-.1)*.1+.04);}}
  sim.stop();for(let t=0;t<610&&sim.phase!=='rest'&&!sim.failed;t++){sim.tick();if(sim.throwTime<.28)continue;for(const b of sim.physics.bodies.filter(b=>b.world))for(const c of corners){const v=b.quaternion.vmult(c).vadd(b.position);assert.ok(Math.abs(v.x)<4.365&&Math.abs(v.z)<3.365&&v.y>-.04);}}
  assert.equal(sim.values().length,count);for(let i=0;i<count;i++){if(held[i])assert.deepEqual(sim.physics.bodies[i].position,before[i]);else if(!sim.failed)assert.ok(grounded(sim.physics.bodies[i]));}
 }
});

test('confiscation supports four to ten dice without overlaps, cup clipping or held displacement',()=>{
 for(const count of [4,8,9,10])for(const seed of [1,42])for(const mask of [0,(1<<count)-2]){
  const held=Array.from({length:count},(_,i)=>!!(mask&(1<<i))),sim=new Simulation('confiscate',held,Array(count).fill(3),seed),before=sim.physics.bodies.map(b=>b.position.clone());
  const active=sim.physics.bodies.filter(b=>b.world);for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)assert.ok(active[i].position.distanceTo(active[j].position)>.96);
  for(let t=0;t<40;t++){sim.tick();for(const b of active)for(const c of corners){const v=b.quaternion.vmult(c).vadd(b.position);assert.ok(v.y>.17);assert.ok(Math.hypot(v.x,v.z)<1.7*(count>8?1.25:1)+(v.y-.1)*.1+.1);}}
  sim.stop();for(let t=0;t<610&&sim.phase!=='rest'&&!sim.failed;t++){sim.tick();if(sim.throwTime<.28)continue;for(const b of active)for(const c of corners){const v=b.quaternion.vmult(c).vadd(b.position);assert.ok(Math.abs(v.x)<4.365&&Math.abs(v.z)<3.365&&v.y>-.04);}}
  assert.equal(sim.failed,false);assert.equal(sim.phase,'rest');assert.equal(sim.values().length,count);for(let i=0;i<count;i++){if(held[i])assert.deepEqual(sim.physics.bodies[i].position,before[i]);else assert.ok(grounded(sim.physics.bodies[i]));}
 }
});
