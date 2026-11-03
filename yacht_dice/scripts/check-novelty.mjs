import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/dist/app.js';
import {AUGMENTS,D12,useAugment,roomStateSchema} from '../shared/dist/index.js';
const {chromium}=await import(process.argv[2]??'playwright');
const app=createApp();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--enable-unsafe-swiftshader']});const pages=[],errors=[];
 await mkdir('artifacts/novelty',{recursive:true});
 for(const width of [1366,390]){const p=await browser.newPage({viewport:{width,height:900}});p.on('pageerror',e=>errors.push(e.message));pages.push(p);await p.goto(`http://127.0.0.1:${app.server.address().port}`);await p.getByLabel('닉네임',{exact:true}).fill('NOVA '+pages.length);}
 await pages[0].getByLabel('게임 모드').selectOption('augment');await pages[0].getByRole('button',{name:'새 방 만들기'}).click();await pages[0].getByRole('button',{name:'준비 완료',exact:true}).waitFor();
 const room=[...app.rooms.rooms.values()][0];await pages[1].getByPlaceholder('방 코드 8자리').fill(room.state.code);await pages[1].getByRole('button',{name:'참가',exact:true}).click();
 for(const p of pages){await p.getByRole('button',{name:'준비 완료',exact:true}).click();await p.waitForTimeout(200);}
 await pages[0].getByRole('dialog',{name:'증강 선택'}).waitFor();
 room.state.players[0].augment.offers=['customDie'];room.state.players[1].augment.offers=['estate'];room.state.revision++;app.rooms.broadcast(room);
 for(const p of pages)await p.locator('.augment-offers .augment-card').first().click();
 const a=pages[0],b=pages[1];await b.locator('.augment-draft .primary').click();
 const choices=b.locator('.augment-dialog .augment-choice button');for(let i=0;i<3;i++)await choices.nth(i).click();await b.getByRole('button',{name:'부지 세 곳 계약'}).click();
 await a.waitForTimeout(400);assert.equal(room.state.augment.drafting,false);
 await a.locator('.augment-hand .augment-card').filter({hasText:'눈금 공장'}).click();await a.screenshot({path:'artifacts/novelty/workshop.png'});await a.getByRole('button',{name:'1 → 6 · 이번 턴 적용',exact:true}).click();await a.waitForTimeout(300);assert.deepEqual(room.state.players[0].augment.customFaces,[6,2,3,4,5,6]);
 const baseline=structuredClone(room.state);room.state.currentPlayerId=room.state.players[0].id;
 room.state.players[0].augment.items.push({id:'monster',remaining:2,usedTurn:-1,usedRound:-1});room.state.revision++;app.rooms.broadcast(room);await a.waitForTimeout(1000);
 await a.locator('.augment-hand .augment-card').filter({hasText:'야추가 주사위를 먹었다'}).click();await a.getByRole('button',{name:'주사위 둘 먹이기 · 12면체 합체'}).click();
 await a.locator('.roll').click();await a.locator('.throw').click();
 for(let i=0;i<400&&room.state.rollPhase!=='idle';i++)await a.waitForTimeout(100);
 assert.equal(room.state.rollPhase,'idle');assert.equal(room.state.rollCount,1);assert.equal(room.state.dice.length,4);assert.ok(roomStateSchema.safeParse(room.state).success);
 await a.waitForTimeout(1000);await a.screenshot({path:'artifacts/novelty/monster.png'});await b.screenshot({path:'artifacts/novelty/monster-mobile.png'});
 const before=[...room.state.dice];await a.getByRole('button',{name:'괴물 분열 · 채점 전에 선택'}).click();await a.locator('.novel-workshop .augment-choice button').first().click();await a.waitForTimeout(300);assert.equal(room.state.dice.length,5);assert.equal(room.state.dice.at(-1)+room.state.dice.at(-2),before[3]===1?2:before[3]);
 await b.reload();await b.locator('.die').first().waitFor();assert.equal(await b.locator('.die').count(),5);
 for(const id of ['custody','crown']){
  room.state=structuredClone(baseline);room.state.currentPlayerId=room.state.players[0].id;room.state.players[0].augment.items.push({id,remaining:1,usedTurn:-1,usedRound:-1});room.state.revision+=100;
  app.rooms.broadcast(room);await a.waitForTimeout(800);await a.locator('.augment-hand .augment-card').filter({hasText:AUGMENTS.find(d=>d.id===id).name}).click();
  await a.getByRole('button',{name:id==='custody'?'NOVA 2와 공동 육아':'왕관 행사 개최 · 즉시 +10점'}).click();await a.waitForTimeout(900);
  assert.ok(id==='custody'?room.state.augment.custody.length:room.state.augment.crown);await a.screenshot({path:`artifacts/novelty/${id}.png`});
 }
 assert.deepEqual(errors,[]);await writeFile('artifacts/novelty/browser.json',JSON.stringify({customEditor:true,estateEditor:true,physicalD12:true,split:true,reconnect:true,custody:true,crown:true,errors},null,2));console.log('Novelty browser checks passed');
}finally{await browser?.close();await app.close();}
