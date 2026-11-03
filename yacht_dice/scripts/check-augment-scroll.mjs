import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/dist/app.js';
import {AUGMENTS,advanceAugment,afterAugmentRoll,recordAugment,roomStateSchema} from '../shared/dist/index.js';
const {chromium}=await import(process.argv[2]??'playwright');
const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,channel:"chrome",args:['--enable-unsafe-swiftshader']});const pages=[],errors=[];await mkdir('artifacts/augments',{recursive:true});
 const url=`http://127.0.0.1:${app.server.address().port}`;
 for(const width of [1366,390,1440,780]){const p=await browser.newPage({viewport:{width,height:width===1366?768:900}});p.on('pageerror',e=>errors.push(e.message));pages.push(p);await p.goto(url);await p.getByLabel('닉네임',{exact:true}).fill('PLAYER '+pages.length);}
 await pages[0].getByLabel('게임 모드').selectOption('augment');await pages[0].getByLabel('최대 인원').selectOption('4');await pages[0].getByRole('button',{name:'새 방 만들기'}).click();await pages[0].getByRole('button',{name:'준비 완료',exact:true}).waitFor();
 const room=[...app.rooms.rooms.values()][0];assert.equal(room.state.mode,'augment');
 for(let i=1;i<4;i++){await pages[i].getByPlaceholder('방 코드 8자리').fill(room.state.code);await pages[i].getByRole('button',{name:'참가',exact:true}).click();await pages[i].getByRole('button',{name:'준비 완료',exact:true}).waitFor();}
 for(const p of pages){await p.getByRole('button',{name:'준비 완료',exact:true}).click();await p.waitForTimeout(100);}
 await pages[0].getByRole('dialog',{name:'증강 선택'}).waitFor();await pages[0].screenshot({path:'artifacts/augments/draft.png',fullPage:true});
 const otherOffers=room.state.players.slice(1).map(p=>[...p.augment.offers]);
 for(let offerIndex=0;offerIndex<3;offerIndex++){
  const old=[...room.state.players[0].augment.offers];await pages[0].locator('.augment-reroll').nth(offerIndex).click();await pages[0].waitForTimeout(200);
  assert.equal(room.state.players[0].augment.rerolled[offerIndex],true);assert.notEqual(room.state.players[0].augment.offers[offerIndex],old[offerIndex]);
  for(let i=0;i<3;i++)if(i!==offerIndex)assert.equal(room.state.players[0].augment.offers[i],old[i]);
  assert.deepEqual(room.state.players.slice(1).map(p=>p.augment.offers),otherOffers);assert.equal(await pages[0].locator('.augment-reroll').nth(offerIndex).isDisabled(),true);
 }
 for(const [i,p] of pages.entries()){await p.screenshot({path:`artifacts/augments/draft-reroll-${i}.png`});assert.ok(await p.locator('.augment-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
 for(const p of pages){await p.locator('.augment-offers .augment-card').first().click();await p.waitForTimeout(120);}
 for(const p of pages)await p.locator('.augment-overlay').waitFor({state:'hidden'});

 const actor=pages[0], player=room.state.players[0];
 player.augment.items=['rest','clone','duel','parallel','squid','strike'].map(id=>({id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}));
 room.state.revision++;app.rooms.broadcast(room);await actor.waitForTimeout(800);
 for(const width of [1366,780,390]){
  await actor.setViewportSize({width,height:768});
  const panel=actor.locator('.augment-panel');
  await panel.evaluate(el=>el.scrollTop=el.scrollHeight);
  await actor.locator('.augment-hand .augment-card').last().scrollIntoViewIfNeeded();
  const before=await panel.evaluate(el=>el.scrollTop);
  const pageY=await actor.evaluate(()=>scrollY);
  await actor.screenshot({path:`artifacts/augments/scroll-before-${width}.png`,fullPage:false});
  await actor.locator('.augment-hand .augment-card').last().click();
  await actor.locator('.augment-overlay').waitFor();
  await actor.screenshot({path:`artifacts/augments/scroll-open-${width}.png`,fullPage:false});
  console.log({width,before,after:await panel.evaluate(el=>el.scrollTop)});
  assert.ok(Math.abs(before-await panel.evaluate(el=>el.scrollTop))<2,'opening must preserve hand scroll');
  assert.equal(await actor.evaluate(()=>document.body.style.overflow),'hidden');
  assert.ok(await actor.locator('.augment-overlay').evaluate(el=>el.parentElement===document.body));
  const dialog=actor.locator('.augment-dialog');
  await dialog.hover();await actor.mouse.wheel(0,1600);await actor.waitForTimeout(200);
  assert.equal(await actor.evaluate(()=>scrollY),pageY,'dialog wheel must not move page');
  assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await actor.locator('.augment-close').click();
  assert.ok(Math.abs(before-await panel.evaluate(el=>el.scrollTop))<2,'closing must preserve hand scroll');
  assert.notEqual(await actor.evaluate(()=>document.body.style.overflow),'hidden');
  await actor.locator('.augment-history summary').click();
  await panel.evaluate(el=>el.scrollTop=el.scrollHeight);
  assert.equal(await actor.locator('.augment-history').evaluate(el=>getComputedStyle(el).position),'static');
  await actor.locator('.augment-history summary').click();
  room.state.augment.results.push({key:`scroll-${width}`,text:'SCORE +36 / AUGMENT +6'});
  room.state.revision++;app.rooms.broadcast(room);
  const burst=actor.locator('.augment-result-burst');await burst.waitFor();
  assert.ok(await burst.evaluate(el=>el.parentElement===document.body));
  assert.ok(await burst.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0}));
  await actor.screenshot({path:`artifacts/augments/scroll-effects-${width}.png`});
  await burst.locator('button').click();
  await actor.keyboard.press('Escape');
  assert.ok(await actor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log({width,scrollPreserved:true,dialog:true,history:true,feedback:true});
 }
 await actor.emulateMedia({reducedMotion:'reduce'});
 room.state.augment.results.push({key:'reduced',text:'REDUCED MOTION'});room.state.revision++;app.rooms.broadcast(room);
 await actor.locator('.augment-result-burst').waitFor();
 assert.equal(await actor.locator('.augment-result-burst').evaluate(el=>getComputedStyle(el,'::after').display),'none');
 room.state.currentPlayerId=player.id;room.state.augment.turn.pending='bombParcel';
 room.state.players[0].augment.curse={id:'bombParcel',from:room.state.players[1].id};
 room.state.revision++;app.rooms.broadcast(room);
 await actor.locator('.augment-overlay').waitFor();
 assert.ok(await actor.locator('.augment-overlay').evaluate(el=>el.parentElement===document.body));
 assert.equal(await actor.evaluate(()=>document.body.style.overflow),'hidden');
 room.state.augment.turn.pending=undefined;room.state.players[0].augment.curse=null;
 room.state.revision++;app.rooms.broadcast(room);await actor.locator('.augment-overlay').waitFor({state:'hidden'});
 assert.notEqual(await actor.evaluate(()=>document.body.style.overflow),'hidden');
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await app.close();}
