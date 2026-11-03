import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/dist/app.js';
import {AUGMENTS,advanceAugment,afterAugmentRoll,recordAugment,useAugment,roomStateSchema} from '../shared/dist/index.js';
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


 const actor=pages[0], baseline=structuredClone(room.state);
 const cases=[['seal','attack'],['seal','defense'],['clone','dice'],['strike','swap'],['loan','gamble'],['parallel','score'],['handsUp','attack']];
 for(const width of [1366,390]){
  await actor.setViewportSize({width,height:768});
  for(const [index,[id,kind]] of cases.entries()){
   room.state=structuredClone(baseline);room.state.revision+=width+index;
   const p=room.state.players[0], q=room.state.players[1];room.state.currentPlayerId=p.id;
   room.state.dice=[1,2,3,4,5];room.state.held=Array(5).fill(false);room.state.rollCount=id==='loan'?0:1;room.state.motion=null;
   room.state.players.forEach((v,i)=>{v.augment.items=[];v.augment.curse=null;v.scores.choice=10*(i+1);});
   p.augment.items=[{id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}];
   if(kind==='defense')q.augment.items=[{id:'shield',remaining:1,usedTurn:-1,usedRound:-1}];
   useAugment(room.state,p,{op:'use',id,target:q.id,die:0,value:1,category:id==='strike'?'choice':'yacht'},()=>0);
   assert.ok(roomStateSchema.safeParse(room.state).success);app.rooms.broadcast(room);
   await actor.waitForFunction(kind=>document.querySelector('.activation-burst')?.getAttribute('data-kind')===kind,kind);
   await actor.waitForTimeout(750);
   const toast=actor.locator('.activation-burst');assert.ok((await toast.locator('.activation-copy p').innerText()).length>15);
   assert.ok(await toast.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}));
   assert.ok(await toast.locator('.activation-copy').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'skill copy fits');
   assert.ok(await actor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(await toast.locator('h3').innerText(),AUGMENTS.find(d=>d.id===id).name);
   assert.equal(await pages[1].locator('.activation-route').innerText(),await actor.locator('.activation-route').innerText());
   await actor.screenshot({path:`artifacts/augments/activation-${width}-${id}-${kind}.png`});
   await actor.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await toast.locator('.activation-emblem').evaluate(el=>getComputedStyle(el).animationName),'none');
   assert.equal(await toast.evaluate(el=>getComputedStyle(el,'::before').display),'none');
   await actor.emulateMedia({reducedMotion:'no-preference'});
   await toast.locator('button').click();
  }
 }
 await actor.reload();await actor.locator('.augment-hand').waitFor();assert.equal(await actor.locator('.activation-burst').count(),0);
 assert.deepEqual(errors,[]);console.log('Activation browser: six themes, flash, two viewports, peers and reconnect passed');
}finally{await browser?.close();await app.close();}
