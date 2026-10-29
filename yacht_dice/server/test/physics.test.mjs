import test from "node:test";
import assert from "node:assert/strict";
import { Vec3, Quaternion } from "cannon-es";
import { Simulation, topFace, grounded } from "../dist/simulation.js";
import { faceUp, POUR_TILT, POUR_POSITION } from "../dist/dice-physics.js";
const corners=[-.45,.45].flatMap(x=>[-.45,.45].flatMap(y=>[-.45,.45].map(z=>new Vec3(x,y,z))));

test("readable tilted faces settle without wind, while edges, stacks and movement remain invalid",()=>{
  const sim=new Simulation("tilt",[false,true,true,true,true],[1,2,3,4,5],12);
  const b=sim.physics.bodies[0];
  for(let face=1;face<=6;face++) {
    b.quaternion.copy(new Quaternion().setFromEuler(0,0,Math.PI/6).mult(faceUp(face,.2)));
    b.position.set(0,.7,0);b.velocity.setZero();b.angularVelocity.setZero();
    assert.equal(topFace(b).face,face);assert.ok(grounded(b));
  }
  b.quaternion.setFromEuler(0,0,Math.PI/4);assert.equal(grounded(b),false);
  b.quaternion.copy(faceUp(3,0));b.position.y=1.44;assert.equal(grounded(b),false);
  b.position.y=.7;b.velocity.set(.2,0,0);assert.equal(grounded(b),false);
  b.velocity.setZero();b.angularVelocity.set(0,.3,0);assert.equal(grounded(b),false);
  sim.stop();sim.tick(.3);
  // Freeze the solver at a readable supported tilt to check result/wind policy independently.
  sim.physics.step=()=>{};
  b.quaternion.copy(new Quaternion().setFromEuler(0,0,Math.PI/6).mult(faceUp(4,0)));
  b.position.set(0,.7,0);b.velocity.setZero();b.angularVelocity.setZero();
  sim.throwTime=3;
  for(let i=0;i<20;i++)sim.tick();
  assert.equal(sim.phase,"rest");assert.equal(sim.windCount,0);assert.equal(sim.values()[0],4);
});

test("wind waits for every die to stop, resets on movement, and waits again after a gust",()=>{
  const sim=new Simulation("wind-rest",[false,true,true,true,true],[1,2,3,4,5],42);
  sim.stop(); sim.tick(.3);
  // Hold the solver still so this test controls movement independently of elapsed time.
  sim.physics.step=()=>{};
  const body=sim.physics.bodies[0];
  body.position.set(0,1.44,0); body.velocity.set(1,0,0); body.angularVelocity.setZero();
  for(let i=0;i<240;i++) sim.tick();
  assert.equal(sim.windCount,0,"moving past the old 3-second deadline must not trigger wind");
  body.velocity.setZero(); body.angularVelocity.set(0,1,0);
  for(let i=0;i<60;i++) sim.tick();
  assert.equal(sim.windCount,0,"rotation is movement too");
  body.angularVelocity.setZero();
  for(let i=0;i<25;i++) sim.tick();
  body.velocity.set(1,0,0); sim.tick(); body.velocity.setZero();
  for(let i=0;i<25;i++) sim.tick();
  assert.equal(sim.windCount,0,"movement resets the quiet interval");
  for(let i=0;i<12;i++) sim.tick();
  assert.equal(sim.windCount,1);
  for(let i=0;i<125;i++) sim.tick();
  assert.equal(sim.windCount,1,"a follow-up gust must wait for motion to stop too");
  body.velocity.setZero(); body.angularVelocity.setZero();
  for(let i=0;i<37;i++) sim.tick();
  assert.equal(sim.windCount,2);
});

test("224 hold/duration/fps conditions keep cup walls solid and held dice isolated",()=>{
  for(const [fps,seconds] of [[20,6],[30,6],[60,6],[120,6],[60,.1],[60,.6],[60,2]]) for(let mask=0;mask<32;mask++) {
    const held=Array.from({length:5},(_,i)=>Boolean(mask&(1<<i)));
    const sim=new Simulation("test",held,[1,2,3,4,5],314+mask);
    const before=sim.physics.bodies.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
    for(let i=0;i<seconds*fps;i++) {
      sim.tick(1/fps);
      for(const body of sim.physics.bodies.filter(b=>b.world)) for(const c of corners) {
        const p=body.quaternion.vmult(c).vadd(body.position);
        assert.ok(p.y>.18,"cup floor");
        assert.ok(body.position.y<2.6,"dice do not leave the open cup");
        if(p.y<2.6) assert.ok(Math.hypot(p.x,p.z)<1.7+(p.y-.1)*.1+.04,"shaking cup wall");
      }
    }
    sim.stop();
    const exited=[...held],inverse=new Quaternion().setFromEuler(0,0,-POUR_TILT);
    for(let i=0;i<fps*10.1&&sim.phase!=="rest"&&!sim.failed;i++) {
      sim.tick(1/fps);
      if(sim.throwTime<.28) continue;
      sim.physics.bodies.forEach((b,index)=>{
        if(held[index]) return;
        const local=corners.map(c=>{
          const p=b.quaternion.vmult(c).vadd(b.position).vsub(POUR_POSITION);
          p.y-=sim.physics.cupLift; inverse.vmult(p,p); p.y+=1.35; return p;
        });
        if(!exited[index]) {
          for(const p of local) {
            assert.ok(p.y>.18,"pour bottom");
            if(p.y<2.6) assert.ok(Math.hypot(p.x,p.z)<1.7+(p.y-.1)*.1+.04,"pour wall");
          }
          if(local.every(p=>p.y>2.6)) exited[index]=true;
        }
        for(const c of corners) {
          const p=b.quaternion.vmult(c).vadd(b.position);
          if (!(Math.abs(p.x)<4.365 && Math.abs(p.z)<3.365 && p.y>-.04)) assert.fail("tray containment "+JSON.stringify({fps,seconds,mask,i,index,p}));
        }
      });
    }
    assert.ok(exited.every(Boolean));
    sim.physics.bodies.forEach((b,i)=>{
      if(held[i]) {assert.equal(b.world,null);assert.deepEqual(b.position,before[i].p);assert.deepEqual(b.quaternion,before[i].q);}
      else if(!sim.failed) assert.ok(grounded(b));
    });
  }
});
test("all faces are read from orientation; wind applies force without selecting a face",()=>{
  const sim=new Simulation("test",[true,false,false,false,false],[6,1,1,1,1],42);
  const b=sim.physics.bodies[1];
  for(let face=1;face<=6;face++) {b.quaternion.copy(faceUp(face,.37));assert.equal(topFace(b).face,face);}
  sim.stop(); for(let i=0;i<18;i++)sim.tick();
  assert.equal(sim.phase,"throwing");
  const held=sim.physics.bodies[0].position.clone();
  b.position.set(0,1.44,0);b.velocity.setZero();b.angularVelocity.setZero();
  const q=b.quaternion.clone();
  sim.blow();
  assert.ok(b.velocity.y>0);assert.deepEqual(b.quaternion,q);
  assert.deepEqual(sim.physics.bodies[0].position,held);
  assert.ok(sim.frame(Date.now()).wind);
});
test("same seed and commands produce the same authoritative result; pause preserves simulation",()=>{
  const a=new Simulation("test",[false,false,false,false,false],[null,null,null,null,null],27);
  const b=new Simulation("test",[false,false,false,false,false],[null,null,null,null,null],27);
  for(let i=0;i<40;i++){a.tick();b.tick();}
  const position=a.physics.bodies[0].position.clone();a.paused=true;
  for(let i=0;i<60;i++)a.tick();assert.deepEqual(a.physics.bodies[0].position,position);a.paused=false;
  a.stop();b.stop();while(a.phase!=="rest"&&!a.failed){a.tick();b.tick();}
  assert.equal(a.failed,b.failed);assert.deepEqual(a.values(),b.values());
  assert.deepEqual(a.frame(1).dice,b.frame(1).dice);
});

test("held poses survive later rolls and wind covers all eight server-selected directions",()=>{
  const q=faceUp(6,.3);
  const poses=Array.from({length:5},()=>({p:[2,.48,.8],q:[q.x,q.y,q.z,q.w]}));
  const sim=new Simulation("test",[true,false,false,false,false],[6,1,1,1,1],47,poses);
  const first=sim.frame(0).dice[0];
  sim.stop();
  for(let i=0;i<100;i++)sim.tick();
  assert.deepEqual(sim.frame(1).dice[0],first);
  assert.equal(sim.values()[0],6);
  const directions=new Set();
  for(let i=0;i<100;i++) {sim.blow();directions.add(sim.windDirection);}
  assert.equal(directions.size,8);
  sim.phase="rest";
  assert.equal(sim.frame(2).wind,false);
});
