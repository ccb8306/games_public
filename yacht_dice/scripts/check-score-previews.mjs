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


 const actor=pages[0],p=room.state.players[0];room.state.currentPlayerId=p.id;
 p.augment.items=[{id:'rest',remaining:0,usedTurn:-1,usedRound:-1}];room.state.dice=[6,6,6,6,1];room.state.held=Array(5).fill(false);room.state.rollCount=1;room.state.motion=null;
 room.state.revision++;app.rooms.broadcast(room);await actor.waitForTimeout(800);
 for(const width of [1366,390]){
  await actor.setViewportSize({width,height:768});const cell=actor.locator('[data-category="sixes"] button');
  await cell.waitFor();assert.equal(await cell.innerText(),'24(+6)');
  assert.ok(await cell.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.equal(await actor.locator('.preview-score[aria-pressed="true"]').count(),0);
  await cell.scrollIntoViewIfNeeded();await actor.screenshot({path:`artifacts/augments/score-inline-${width}.png`,fullPage:true});
  assert.ok(await actor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 p.augment.items=[{id:'scoreRemodel',remaining:1,usedTurn:-1,usedRound:-1}];p.scores.yacht=50;
 room.state.rollCount=0;room.state.dice=Array(5).fill(null);room.state.held=Array(5).fill(false);
 room.state.revision++;app.rooms.broadcast(room);await actor.waitForTimeout(500);
 await actor.locator('.augment-hand button').filter({hasText:'점수판 이사가는 날'}).click();
 await actor.getByLabel('다시 열 하단 칸').selectOption('yacht');
 await actor.getByRole('button',{name:/초이스에 0점/}).click();await actor.waitForTimeout(500);
 assert.equal(room.state.players[0].scores.yacht,null);assert.equal(room.state.players[0].scores.choice,0);assert.equal(room.state.players[0].augment.bonus,50);
 assert.deepEqual(errors,[]);console.log('Score preview and remodel UI verified on desktop/mobile');
}finally{await browser?.close();await app.close();}
