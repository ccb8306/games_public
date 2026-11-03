import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/dist/app.js';
import {AUGMENTS,advanceAugment,afterAugmentRoll,recordAugment,roomStateSchema,drawAugmentOffers,useAugment} from '../shared/dist/index.js';
const {chromium}=await import(process.argv[2]??'playwright');
const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,channel:"chrome",args:['--enable-unsafe-swiftshader']});const pages=[],errors=[];await mkdir('artifacts/overhaul',{recursive:true});
 const url=`http://127.0.0.1:${app.server.address().port}`;
 for(const width of [1366,390,1440,780]){const p=await browser.newPage({viewport:{width,height:width===1366?768:900}});p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});pages.push(p);await p.goto(url);await p.getByLabel('닉네임',{exact:true}).fill('PLAYER '+pages.length);}
 await pages[0].getByLabel('게임 모드').selectOption('augment');await pages[0].getByLabel('최대 인원').selectOption('4');await pages[0].getByRole('button',{name:'새 방 만들기'}).click();await pages[0].getByRole('button',{name:'준비 완료',exact:true}).waitFor();
 const room=[...app.rooms.rooms.values()][0];assert.equal(room.state.mode,'augment');
 for(let i=1;i<4;i++){await pages[i].getByPlaceholder('방 코드 8자리').fill(room.state.code);await pages[i].getByRole('button',{name:'참가',exact:true}).click();await pages[i].getByRole('button',{name:'준비 완료',exact:true}).waitFor();}
 for(const p of pages){await p.getByRole('button',{name:'준비 완료',exact:true}).click();await p.waitForTimeout(100);}
 for(const p of room.state.players)drawAugmentOffers(room.state,p,()=>0);
 room.state.revision++;app.rooms.broadcast(room);
 for(const [i,p] of pages.entries()){
  await p.locator('.augment-offer-slot').nth(3).waitFor();
  assert.equal(await p.locator('.augment-offers .augment-card').count(),4);
  await p.waitForTimeout(950);await p.screenshot({path:`artifacts/overhaul/draft-${i}.png`});
  assert.ok(await p.locator('.augment-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 }
 const normal=room.state.players[0].augment.offers.slice(0,3);
 await pages[0].locator('.augment-reroll').nth(3).click();await pages[0].waitForTimeout(150);
 assert.deepEqual(room.state.players[0].augment.offers.slice(0,3),normal);
 await pages[0].reload();await pages[0].locator('.augment-offer-slot').nth(3).waitFor();
 assert.equal(await pages[0].locator('.augment-reroll').nth(3).isDisabled(),true);
 assert.equal(await pages[0].locator('.augment-offer-slot').nth(3).getAttribute('data-reveal'),'false');
 for(const p of pages)await p.locator('.augment-offers .augment-card').nth(3).click();
 for(const p of pages)await p.locator('.augment-overlay').waitFor({state:'hidden'});
 await pages[0].waitForTimeout(1600);
 const give=(p,ids)=>p.augment.items=ids.map(id=>({id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}));
 let actor=room.state.players[0],target=room.state.players[1];
 room.state.currentPlayerId=actor.id;give(actor,['closed']);actor.scores.yacht=0;target.scores.yacht=50;
 room.state.revision++;app.rooms.broadcast(room);await pages[0].waitForTimeout(200);
 useAugment(room.state,actor,{op:'use',id:'closed',target:target.id,category:'yacht'},()=>0);
 room.state.revision++;app.rooms.broadcast(room);
 await Promise.all(pages.map(async(p,i)=>{await p.locator('.effect-closed').waitFor();assert.ok((await p.locator('.effect-closed').innerText()).includes('50'));await p.screenshot({path:`artifacts/overhaul/swap-${i}.png`});}));
 await pages[1].reload();await pages[1].locator('.die').first().waitFor();assert.equal(await pages[1].locator('.augment-result-burst').count(),0);
 await pages[0].waitForTimeout(1400);
 for(const id of ['hostage','goldRush','squid']){
  actor=room.state.players[0];target=room.state.players[1];
  give(actor,[id,'alchemy']);give(target,['clone']);target.augment.curse=null;delete room.state.augment.jackpot;
  room.state.revision++;app.rooms.broadcast(room);await pages[0].waitForTimeout(100);
  if(id==='squid')room.state.players.forEach(p=>p.augment.bonus=30);
  useAugment(room.state,actor,{op:'use',id,target:target.id},()=>0);room.state.revision++;app.rooms.broadcast(room);
  assert.ok(roomStateSchema.safeParse(room.state).success,JSON.stringify(roomStateSchema.safeParse(room.state).error));await pages[0].locator(`.effect-${id}`).waitFor();await pages[0].screenshot({path:`artifacts/overhaul/${id}.png`});await pages[0].waitForTimeout(1500);
 }
 await pages[0].emulateMedia({reducedMotion:'reduce'});
 give(actor,['closed']);give(target,['reflect']);target.augment.scoreSwapped=false;target.scores.yacht=0;actor.scores.yacht=50;
 useAugment(room.state,actor,{op:'use',id:'closed',target:target.id,category:'yacht'},()=>0);room.state.revision++;app.rooms.broadcast(room);
 await pages[0].locator('.effect-shield').waitFor();await pages[0].screenshot({path:'artifacts/overhaul/reflect.png'});
 await pages[0].waitForTimeout(500);assert.equal(await pages[0].locator('.augment-result-burst').count(),0);
 const cdp=await pages[0].context().newCDPSession(pages[0]);
 await cdp.send('HeapProfiler.collectGarbage');const heapBefore=(await cdp.send('Runtime.getHeapUsage')).usedSize;
 const nodeBefore=await pages[0].locator('*').count();
 const sample=structuredClone(room.state.augment.results.at(-1));
 for(let batch=0;batch<50;batch++){
  for(let i=0;i<20;i++)room.state.augment.results.push({...sample,key:`stress:${batch}:${i}`});
  room.state.augment.results=room.state.augment.results.slice(-40);room.state.revision++;app.rooms.broadcast(room);await pages[0].waitForTimeout(30);
 }
 await pages[0].getByRole('button',{name:/연출 넘기기/}).click();await pages[0].waitForTimeout(1600);
 await cdp.send('HeapProfiler.collectGarbage');const heapAfter=(await cdp.send('Runtime.getHeapUsage')).usedSize;
 const nodeAfter=await pages[0].locator('*').count();assert.ok(nodeAfter<=nodeBefore+150);assert.equal(await pages[0].locator('.effect-flights>span').count(),0);
 const frames=await pages[0].evaluate(()=>new Promise(resolve=>{let first=performance.now(),last=first;const times=[];function frame(now){times.push(now-last);last=now;if(now-first<1500)requestAnimationFrame(frame);else resolve({frames:times.length,meanMs:times.reduce((a,b)=>a+b,0)/times.length,maxMs:Math.max(...times)});}requestAnimationFrame(frame);}));
 await writeFile('artifacts/overhaul/performance.json',JSON.stringify({events:1000,history:room.state.augment.results.length,heapBefore,heapAfter,nodeBefore,nodeAfter,frames},null,2));
 assert.deepEqual(errors,[]);assert.ok(roomStateSchema.safeParse(room.state).success);
 await writeFile('artifacts/overhaul/browser.json',JSON.stringify({fourPeers:true,fourthReroll:true,selection:true,reconnectNoReplay:true,swap:true,hostage:true,goldRush:true,squid:true,reflect:true,reducedMotion:true,responsive:[1366,390,1440,780],errors},null,2));
 console.log('Presentation browser checks passed');
}finally{await browser?.close();await app.close();}
