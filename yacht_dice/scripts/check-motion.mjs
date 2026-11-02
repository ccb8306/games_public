import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {createApp} from "../server/dist/app.js";
const {chromium}=await import(process.argv[2]??"playwright");
const app=createApp();await new Promise(r=>app.server.listen(0,"127.0.0.1",r));
let browser;
try {
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL,args:["--enable-unsafe-swiftshader"]});
 const errors=[],pages=[];
 for(const [i,width] of [1440,390,1366,780].entries()) {
   const p=await browser.newPage({viewport:{width,height:900}});pages.push(p);
   p.on("pageerror",e=>errors.push(e.message));
   await p.addInitScript(({delay,offset})=>{
     const originalNow=Date.now;Date.now=()=>originalNow()+offset;
     const Native=WebSocket;
     window.WebSocket=class extends Native {
       set onmessage(handler) { super.onmessage=e=>setTimeout(()=>handler?.call(this,e),delay); }
       send(data) {setTimeout(()=>{if(this.readyState===Native.OPEN)super.send(data);},delay);}
     };
   },{delay:[0,15,35,70][i],offset:[0,250,-400,700][i]});
   await p.route("**/assets/scene-*.js",async route=>{
     const response=await route.fetch();let body=await response.text();
     body=body.replace(/(\w+)\.render\((\w+),(\w+)\)/g,'($2.type==="Scene"&&(globalThis.__diceScene=$2),$1.render($2,$3))');
     await route.fulfill({response,body});
   });
 }
 const url="http://127.0.0.1:"+app.server.address().port;
 await mkdir("artifacts/server-physics",{recursive:true});
 await pages[0].goto(url);await pages[0].getByLabel("닉네임",{exact:true}).fill("PLAYER 1");
 await pages[0].getByLabel("최대 인원").selectOption("4");
 await pages[0].getByRole("button",{name:"새 방 만들기"}).click();
 await pages[0].getByRole("button",{name:"준비 완료",exact:true}).waitFor();
 const room=[...app.rooms.rooms.values()][0];
 for(let i=1;i<4;i++){
   await pages[i].goto(url+"/?room="+room.state.code);
   await pages[i].getByLabel("닉네임",{exact:true}).fill("PLAYER "+(i+1));
   await pages[i].getByRole("button",{name:"참가",exact:true}).click();
   await pages[i].getByRole("button",{name:"준비 완료",exact:true}).waitFor();
 }
 for(const p of pages) { await p.getByRole("button",{name:"준비 완료",exact:true}).click(); await p.waitForTimeout(400); }
 for(const p of pages) await p.locator('.dice-stage[data-ready="true"]').waitFor();
 const actor=room.state.players.find(x=>x.id===room.state.currentPlayerId),p=pages[actor.slot];
 await p.waitForTimeout(650);
 const poses=page=>page.evaluate(()=>globalThis.__diceScene.children.find(x=>x.type==="Group").children.filter(x=>Array.isArray(x.material)).map(d=>({p:d.position.toArray(),q:d.quaternion.toArray(),visible:d.visible})));
 let heldPose;
 for(let roll=1;roll<=3;roll++){
   assert.equal(await p.locator('.manual-cup-hint').count(),0);
   if(roll===1) {await p.locator('body').click({position:{x:5,y:5}});await p.keyboard.press('Space');}
   else await p.locator('.roll').click();
   await p.waitForTimeout(700);
   await p.screenshot({path:"artifacts/server-physics/shaking-"+roll+".png",fullPage:true});
   if(roll<=2) {
     await p.keyboard.press('Space');
   } else await p.locator('.throw').click();
   await p.waitForTimeout(500);
   await p.screenshot({path:"artifacts/server-physics/pouring-"+roll+".png",fullPage:true});
   await p.waitForFunction(()=>document.querySelector(".dice-tray")?.getAttribute("data-roll-phase")==="result",{},{timeout:15000});
   await p.waitForTimeout(700);
   assert.equal(room.state.rollCount,roll);
   // Background tabs can render later under load; wait for the authoritative final pose.
   await Promise.all(pages.map(page=>page.waitForFunction(({dice,held})=>{
     const meshes=globalThis.__diceScene?.children.find(x=>x.type==="Group")?.children.filter(x=>Array.isArray(x.material));
     return meshes?.every((m,i)=>held[i] || (m.position.toArray().every((n,j)=>Math.abs(n-dice[i].p[j])<1e-6) && m.quaternion.toArray().every((n,j)=>Math.abs(n-dice[i].q[j])<1e-6)));
   },{dice:room.state.motion.dice,held:room.state.held},{timeout:5000})));
   const rendered=await Promise.all(pages.map(poses));
   for(const values of rendered)values.forEach((v,i)=>{
     if(room.state.held[i]){assert.equal(v.visible,false);return;}
     assert.ok(v.p.every((n,j)=>Math.abs(n-room.state.motion.dice[i].p[j])<1e-6));
     assert.ok(v.q.every((n,j)=>Math.abs(n-room.state.motion.dice[i].q[j])<1e-6));
   });
   if(roll===1){heldPose=structuredClone(room.state.motion.dice[0]);await p.locator(".die").first().click();await p.waitForTimeout(350);}
   if(roll===2){assert.deepEqual(room.state.motion.dice[0],heldPose);await p.locator(".die").first().click();await p.waitForTimeout(350);}
 }
 for(const [i,page]of pages.entries()){
   if(i===2) await page.setViewportSize({width:1366,height:768});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(i===0 || i===2) {
     await page.waitForTimeout(300);
     const layout=await page.evaluate(()=>{
       const score=document.querySelector('.score-panel'),play=document.querySelector('.table-area'),chat=document.querySelector('.chat-panel');
       const a=score.getBoundingClientRect(),b=play.getBoundingClientRect(),c=chat.getBoundingClientRect();
       return {columns:a.right<=b.left && b.right<=c.left,fit:Math.max(a.bottom,b.bottom,c.bottom)<=innerHeight,players:document.querySelectorAll('thead th').length-1,scroll:score.scrollHeight>score.clientHeight+1,die:document.querySelector('.die-face').getBoundingClientRect().width};
     });
     assert.ok(layout.columns && layout.fit && !layout.scroll,JSON.stringify(layout));
     assert.equal(layout.players,4);assert.ok(layout.die>=52);
   }
   await page.screenshot({path:"artifacts/server-physics/client-"+i+".png",fullPage:true});
 }
 const final=await poses(pages[1]);
 for(const page of pages) assert.equal(await page.locator(".dice-stage").getAttribute("data-wind"),"false");
 await pages[1].reload();await pages[1].locator('.dice-stage[data-ready="true"]').waitFor();await pages[1].waitForTimeout(500);
 assert.deepEqual(await poses(pages[1]),final);
 await pages[2].emulateMedia({reducedMotion:"reduce"});
 await pages[2].waitForTimeout(200);
 assert.deepEqual(await poses(pages[2]),await poses(pages[0]));
 await p.locator(".dice-stage canvas").evaluate(c=>c.dispatchEvent(new Event("webglcontextlost",{cancelable:true})));
 await p.locator('.dice-stage[data-ready="false"]').waitFor();
 assert.equal(await p.locator(".die").count(),5);
 assert.deepEqual(errors,[]);
 const report={clients:4,rounds:3,widths:[1440,390,1366,780],latencyEachWayMs:[0,15,35,70],clockOffsetMs:[0,250,-400,700],sameFinalTransforms:true,reconnect:true,reducedMotion:true,contextLossFallback:true};
 await writeFile("artifacts/server-physics/browser.json",JSON.stringify(report,null,2));console.log("PASS",report);
} finally {await browser?.close();await app.close();}

