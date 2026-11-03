import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/dist/app.js';
import {AUGMENTS,advanceAugment,afterAugmentRoll,recordAugment,roomStateSchema,drawAugmentOffers,useAugment} from '../shared/dist/index.js';
const {chromium}=await import(process.argv[2]??'playwright');
const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,channel:"chrome",args:['--enable-unsafe-swiftshader']});const pages=[],errors=[];await mkdir('artifacts/rework',{recursive:true});
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
  await p.waitForTimeout(950);await p.screenshot({path:`artifacts/rework/draft-${i}.png`});
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
 const actor=pages[0];let p=room.state.players[0];room.state.currentPlayerId=p.id;give(p,['parallel']);
 for(const key of Object.keys(p.scores))p.scores[key]=0;p.scores.sixes=null;
 room.state.dice=[6,6,6,6,6];room.state.held=Array(5).fill(false);room.state.rollCount=1;room.state.motion=null;
 room.state.revision++;app.rooms.broadcast(room);await actor.waitForTimeout(800);
 await actor.locator('.augment-hand button').filter({hasText:'한 턴에 두 탕'}).click();
 await actor.getByRole('button',{name:/요트.* · 별도 \+40점/}).click();await actor.waitForTimeout(350);
 assert.equal(room.state.augment.turn.parallel,'yacht');
 await actor.locator('.augment-overlay').waitFor({state:'hidden'});
 assert.equal(await actor.locator('[data-category="sixes"] button').innerText(),'30(+40)');
 for(const peer of pages){await peer.waitForTimeout(80);assert.equal(await peer.locator('.die').count(),5);}
 await actor.screenshot({path:'artifacts/rework/final-turn-parallel.png'});
 p=room.state.players[0];room.state.augment.turn.parallel=null;room.state.rollCount=0;room.state.dice.fill(null);give(p,['customDie']);room.state.revision++;app.rooms.broadcast(room);await actor.waitForTimeout(300);
 await actor.locator('.augment-hand button').filter({hasText:'눈금 공장'}).click();await actor.getByRole('button',{name:'1 → 6 · 이번 턴 적용',exact:true}).click();await actor.waitForTimeout(300);
 assert.deepEqual(room.state.players[0].augment.customFaces,[6,2,3,4,5,6]);await actor.screenshot({path:'artifacts/rework/factory.png'});await actor.locator('.augment-overlay').waitFor({state:'hidden'});
 await actor.reload();await actor.locator('.augment-hand button').filter({hasText:'눈금 공장'}).waitFor();assert.equal(await actor.locator('.augment-result-burst').count(),0);
 for(const width of [1366,780,390]){
  await actor.setViewportSize({width,height:768});
  give(room.state.players[0],['cleaner','odd','six','erase','parallel','duel','ordinaryDay','estate']);room.state.revision++;app.rooms.broadcast(room);await actor.waitForTimeout(250);
  const panel=actor.locator('.augment-panel');await actor.locator('.augment-hand button').last().scrollIntoViewIfNeeded();const scroll=await panel.evaluate(el=>el.scrollTop);
  await actor.locator('.augment-hand button').last().click();await actor.locator('.augment-dialog').waitFor();assert.ok(await actor.locator('.augment-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await actor.screenshot({path:`artifacts/rework/hand-${width}.png`});await actor.locator('.augment-close').click();assert.ok(Math.abs(scroll-await panel.evaluate(el=>el.scrollTop))<2);
  assert.ok(await actor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);assert.ok(roomStateSchema.safeParse(room.state).success);
 await writeFile('artifacts/rework/browser.json',JSON.stringify({peers:4,viewports:[1366,780,390],fourthSlotReroll:true,finalTurnParallel:true,score:'30(+40)',factory:true,reconnect:true,handScroll:true,errors},null,2));console.log('Rework browser checks passed');
}finally{await browser?.close();await app.close();}
 const give=(p,ids)=>p.augment.items=ids.map(id=>({id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}));
