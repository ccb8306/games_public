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
 const slot=room.state.players.find(p=>p.id===room.state.currentPlayerId).slot,actor=pages[slot];
 const current=room.state.players[slot];current.augment.items=['nudge','clone','choiceRoll','sixth'].map(id=>({id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}));room.state.dice.push(null);room.state.held.push(false);
 await actor.waitForTimeout(600);await actor.locator('.roll').click();await actor.waitForTimeout(500);await actor.locator('.throw').click();await actor.waitForFunction(()=>document.querySelectorAll('.die-value').length===6&&[...document.querySelectorAll('.die-value')].every(e=>/[1-6]/.test(e.textContent)));await actor.waitForTimeout(3200);
 // Exercise direct inputs against real server validation, without choosing a strategy for the player.
 await actor.locator('.augment-hand').getByRole('button',{name:/\uC190\uB05D \uBCF4\uC815/}).click();
 assert.equal(await actor.getByRole('dialog').locator('select').count(),0);
 const old=room.state.dice[0],delta=old===6?-1:1;
 await actor.locator('.augment-die-actions').first().getByRole('button',{name:new RegExp(`^${delta>0?'\\+1':'-1'}`)}).click();
 await actor.waitForTimeout(250);assert.equal(room.state.dice[0],old+delta);
 const source=0,target=room.state.dice.findIndex(n=>n!==room.state.dice[source]);assert.ok(target>=0);
 await actor.locator('.augment-hand').getByRole('button',{name:/\uBCF5\uC81C\uC220/}).click();
 const choices=actor.getByRole('dialog').locator('.augment-choice');
 await choices.first().getByRole('button').nth(source).click();
 await choices.nth(1).getByRole('button',{name:new RegExp(`^${target+1}\uBC88`)}).click();
 await actor.waitForTimeout(250);assert.equal(room.state.dice[source],room.state.dice[target]);
 const rerollFaces=[...room.state.dice],rerollCount=room.state.rollCount;
 await actor.locator('.augment-hand').getByRole('button',{name:/\uCD5C\uD6C4\uC758 \uC120\uD0DD/}).click();await actor.locator('.augment-dialog .augment-choice button').first().click();
 await actor.locator('.throw').click();for(let n=0;n<300&&room.state.rollPhase!=='idle';n++)await actor.waitForTimeout(100);
 assert.equal(room.state.augment.turn.reroll,null);assert.equal(room.state.rollCount,rerollCount);assert.deepEqual(room.state.dice.slice(1),rerollFaces.slice(1));
 if(room.state.augment.turn.chooseOld){await actor.getByRole('button',{name:/^\uC774\uC804 \uB208/}).click();await actor.waitForTimeout(200);assert.deepEqual(room.state.dice,rerollFaces);}
 for(const p of room.state.players) if(p.id!==current.id) p.augment.items=['even','clockwork','lower','mirror'].map(id=>({id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}));
 room.state.revision++;app.rooms.broadcast(room);await actor.waitForTimeout(200);
 for(const page of [actor,pages[1]]) {
  const icon=page.locator('.player-augments button').first();
  assert.ok((await icon.getAttribute('title')).length>20);await icon.hover();await icon.click();
  const detail=page.locator('.player-augment-dialog[open]');await detail.waitFor();
  assert.ok((await detail.locator('p').first().innerText()).length>10);
  const beforePhase=room.state.rollPhase;await page.keyboard.press('Space');assert.equal(room.state.rollPhase,beforePhase);if(await detail.count())await detail.getByRole('button').click();assert.equal(await page.locator('.player-augment-dialog[open]').count(),0);
 }
 for(const [i,p] of pages.entries()){
  await p.screenshot({path:`artifacts/augments/player-${i}.png`,fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(i===0){const metrics=await p.evaluate(()=>{const score=document.querySelector('.score-panel'),play=document.querySelector('.table-area');return {scoreScroll:score.scrollHeight>score.clientHeight+1,bottom:play.getBoundingClientRect().bottom,viewport:innerHeight,players:document.querySelectorAll('thead th').length-1};});console.log(JSON.stringify(metrics));assert.equal(metrics.players,4);assert.equal(metrics.scoreScroll,false);}
 }
 await actor.setViewportSize({width:1366,height:768});await actor.waitForTimeout(2000);await actor.screenshot({path:'artifacts/augments/actor-desktop.png',fullPage:true});
 const dock=await actor.evaluate(()=>{const tray=document.querySelector('.dice-tray').getBoundingClientRect(),dice=[...document.querySelectorAll('.die')].map(e=>e.getBoundingClientRect());return {bottom:Math.max(...dice.map(d=>d.bottom)),trayBottom:tray.bottom,panelBottom:document.querySelector('.table-area').getBoundingClientRect().bottom,viewport:innerHeight};});console.log(JSON.stringify(dock));assert.ok(dock.bottom<=dock.trayBottom&&dock.panelBottom<=dock.viewport);
 room.state.augment.event='exchange';room.state.augment.turn.locked=0;room.state.players[slot].augment.curse={id:'lock',from:room.state.players[(slot+1)%4].id};
 const crowded=await actor.evaluate(()=>({dice:Math.max(...[...document.querySelectorAll('.die')].map(e=>e.getBoundingClientRect().bottom)),tray:document.querySelector('.dice-tray').getBoundingClientRect().bottom}));console.log(JSON.stringify(crowded));assert.ok(crowded.dice<=crowded.tray);await actor.screenshot({path:'artifacts/augments/event-and-curse.png',fullPage:true});
 await pages[1].reload();await pages[1].locator('.augment-hand').waitFor();assert.equal(await pages[1].locator('.die').count(),6);
 await actor.getByRole('button',{name:'능력 도감'}).click();assert.equal(await actor.locator('.augment-catalog > button.augment-card').count(),AUGMENTS.filter(d=>!d.retired).length);await actor.screenshot({path:'artifacts/augments/catalog.png',fullPage:true});
 assert.equal(await actor.locator('.augment-event-catalog article').count(),8);
 const expectedCatalog=AUGMENTS.filter(d=>!d.retired).toSorted((a,b)=>['silver','gold','prism'].indexOf(a.rarity)-['silver','gold','prism'].indexOf(b.rarity)||a.name.localeCompare(b.name,'ko'));
 const checkCatalog=async cards=>assert.deepEqual(await actor.locator('.augment-catalog > button strong').allTextContents(),cards.map(d=>(d.flash?'\u2726 \uBC88\uB729\uC784 \u00b7 ':'')+d.name));
 await checkCatalog(expectedCatalog);
 await actor.locator('.augment-catalog-tools input').fill(AUGMENTS.find(d=>d.id==='goldRush').name);assert.equal(await actor.locator('.augment-catalog > button').count(),1);
 await actor.locator('.augment-catalog-tools select').selectOption('silver');assert.equal(await actor.locator('.augment-catalog > button').count(),0);
 await actor.locator('.augment-catalog-tools input').fill('');await actor.locator('.augment-catalog-tools select').selectOption('all');await checkCatalog(expectedCatalog);

 assert.ok(await actor.locator('.augment-dialog').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+100));}),'event banner must stay behind catalog');

 for(const width of [1366,780,390]){
  await actor.setViewportSize({width,height:768});
  const dialog=actor.locator('.augment-dialog');
  for(const position of [0,.5,1]){
   await dialog.evaluate((el,fraction)=>{el.scrollTop=(el.scrollHeight-el.clientHeight)*fraction;},position);
   await actor.screenshot({path:`artifacts/augments/catalog-${width}-${position}.png`});
   assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'catalog must not overflow horizontally');
   assert.ok(await actor.locator('.augment-catalog .augment-card').evaluateAll(cards=>cards.every(card=>{const box=card.getBoundingClientRect();return [...card.querySelectorAll('strong,small')].every(text=>{const r=text.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right+1&&r.bottom<=box.bottom+1;});})), 'every catalog description must fit its card');
  }
 }

 await actor.locator('.augment-close').click();await actor.setViewportSize({width:1366,height:768});
 const baseline=structuredClone(room.state);
 room.state=structuredClone(baseline);room.state.revision+=40;
 const scoringPlayer=room.state.players[slot];scoringPlayer.augment.items=[{id:'rest',remaining:0,usedTurn:-1,usedRound:-1}];scoringPlayer.augment.curse=null;scoringPlayer.augment.bonus=0;
 room.state.augment.event=null;Object.assign(room.state.augment.turn,{flags:[],locked:null,fixed:[],sealed:[],erase:null,parallel:null});
 room.state.dice=[6,6,6,6,6];room.state.held=Array(5).fill(false);room.state.motion=null;room.state.rollCount=1;room.state.rollPhase='idle';app.rooms.broadcast(room);await actor.waitForTimeout(250);
 for(const width of [1366,390]){
  await actor.setViewportSize({width,height:768});const cell=actor.locator('[data-category="choice"] button');await cell.click();
  assert.equal(await cell.innerText(),'30(+6)');assert.ok((await actor.locator('.score-breakdown').innerText()).includes('+6'));assert.ok((await actor.locator('.score-breakdown').innerText()).includes('+36'));
  assert.ok((await actor.locator('.score-confirm button').innerText()).includes('30'));
  assert.ok(await actor.locator('.score-breakdown').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.ok(await actor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===1366)assert.ok(await actor.locator('.score-panel').evaluate(el=>el.scrollHeight<=el.clientHeight+1));
  await actor.screenshot({path:`artifacts/augments/score-breakdown-${width}.png`,fullPage:true});
 }
 await actor.setViewportSize({width:1366,height:768});
 for(const id of ['thief','duel','loan']){
  room.state=structuredClone(baseline);room.state.revision+=80;
  for(const q of room.state.players){q.augment.curse=null;q.augment.items=[];q.augment.bonus=30;}
  room.state.players[slot].augment.items=[{id,remaining:1,usedTurn:-1,usedRound:-1}];
  room.state.augment.duels=[];room.state.augment.jackpot=undefined;room.state.augment.event=null;
  Object.assign(room.state.augment.turn,{flags:[],locked:null,fixed:[],sealed:[],pending:undefined,hostage:undefined,saveIndex:undefined});
  room.state.rollCount=0;room.state.dice=Array(5).fill(null);room.state.held=Array(5).fill(false);room.state.motion=null;room.state.rollPhase='idle';app.rooms.broadcast(room);await actor.waitForTimeout(250);
  await actor.locator('.augment-hand .augment-card').click();const dialog=actor.locator('.augment-dialog');
  if(id==='loan'){
   await dialog.getByRole('button',{name:'능력 사용',exact:true}).click();await actor.waitForTimeout(250);
   room.state.rollCount=2;room.state.dice=Array(5).fill(6);room.state.revision++;app.rooms.broadcast(room);await actor.waitForTimeout(250);
   await actor.getByRole('button',{name:'두 배 걸고 한 번 더!'}).click();await actor.locator('.throw').click();
   for(let wait=0;room.state.rollPhase!=='idle'&&wait<300;wait++)await actor.waitForTimeout(100);
   assert.ok(room.state.augment.turn.flags.includes('loanDouble'));await actor.screenshot({path:'artifacts/augments/chaos-double.png'});
  }else{
   await dialog.locator('.augment-choice button:enabled').first().click();await actor.waitForTimeout(200);
   const target=room.state.players.find(q=>q.augment.curse?.id===id);
   for(let i=0;i<4&&room.state.currentPlayerId!==target.id;i++)advanceAugment(room.state,()=>0);
   room.state.revision++;app.rooms.broadcast(room);const page=pages[target.slot];await page.reload();
   const pending=page.getByRole('dialog',{name:'능력 결과 선택'});await pending.waitFor();await page.screenshot({path:`artifacts/augments/chaos-${id}.png`});
   await pending.locator('.primary').click();await page.waitForTimeout(200);assert.equal(room.state.augment.turn.pending,undefined);
  }
 }
 for(const id of ['artisan','fakeHouse','chance','collector']){
  room.state=structuredClone(baseline);room.state.revision+=50;
  const p=room.state.players[slot];p.augment.curse=null;p.augment.items=[{id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}];
  Object.assign(room.state.augment.turn,{flags:[],locked:null,fixed:[],sealed:[],pending:undefined,hostage:undefined,saveIndex:undefined});
  room.state.dice=[1,2,2,4,5];room.state.held=Array(5).fill(false);room.state.motion=null;room.state.rollCount=1;room.state.rollPhase='idle';
  app.rooms.broadcast(room);await actor.waitForTimeout(250);
  await actor.locator('.augment-hand .augment-card').click();const dialog=actor.locator('.augment-dialog');
  await actor.screenshot({path:`artifacts/augments/rework-${id}.png`,fullPage:true});
  if(id==='artisan'){
   await dialog.locator('.augment-choice').first().locator('button').nth(1).click();
   await dialog.locator('.augment-choice').nth(1).locator('button').first().click();
  }else if(id==='chance')await dialog.locator('.primary').click();
  else await dialog.locator('.augment-choice button:enabled').first().click();
  await actor.waitForTimeout(250);
  assert.equal(room.state.players[slot].augment.items[0].remaining,AUGMENTS.find(d=>d.id===id).charges-1,id);
  if(id==='collector'){
   await actor.locator('.throw').click();
   for(let wait=0;room.state.rollPhase!=='idle'&&wait<300;wait++)await actor.waitForTimeout(100);
   assert.equal(room.state.rollPhase,'idle');assert.equal(room.state.rollCount,1);assert.deepEqual(room.state.dice.filter((_,i)=>i!==1),[1,2,4,5]);
  }
  if(id==='artisan')assert.deepEqual(room.state.dice,[1,3,2,4,5]);
  if(id==='fakeHouse')assert.deepEqual(room.state.dice,[2,2,2,3,5]);
  if(id==='chance')assert.ok(room.state.augment.turn.flags.includes('final'));
 }
 for(const id of ['confiscate','parkingTicket','butterFingers','ordinaryDay','taxSix','broken','construction','closed','practice','receipt','dropIt','goldRush','handsUp','strike','squid']){
  room.state=structuredClone(baseline);room.state.revision+=100;
  for(const q of room.state.players){q.augment.curse=null;q.augment.items=[{id:'clone',remaining:4,usedTurn:-1,usedRound:-1}];}
  const p=room.state.players[slot];p.augment.items=[{id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}];
  if(['closed','strike'].includes(id)){for(const q of room.state.players)q.scores.yacht=q.id===p.id?0:50;}
  if(id==='squid')for(const q of room.state.players)q.augment.bonus=30;
  if(id==='goldRush')p.augment.items.push({id:'alchemy',remaining:2,usedTurn:-1,usedRound:-1});
  app.rooms.broadcast(room);await actor.waitForTimeout(200);
  await actor.locator('.augment-hand .augment-card').first().click();const dialog=actor.getByRole('dialog');
  assert.equal(await dialog.locator('select').count(),0);
  if(id==='closed'){
   await dialog.locator('section').first().getByRole('button').first().click();
  }else if(id==='strike')await dialog.locator('.augment-choice button:enabled').first().click();
  else if(['handsUp','squid','confiscate','goldRush'].includes(id))await dialog.getByRole('button').last().click();
  else await dialog.locator('section').first().getByRole('button').first().click();
  await actor.waitForTimeout(250);if(id==='closed')assert.equal(room.state.players[slot].scores.yacht,50);else if(id==='strike')assert.ok(room.state.players.some(q=>q.augment.scoreSwapped));else if(id==='goldRush')assert.ok(room.state.players[slot].augment.items.some(i=>i.id==='clone'));else assert.ok(room.state.players.some(q=>q.augment.curse?.id===id),id);
  await actor.screenshot({path:`artifacts/augments/flash-${id}.png`,fullPage:true});
  assert.ok(await actor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 room.state.augment.turn.maxRolls=2;room.state.augment.duels=[{a:room.state.players[slot].id,b:room.state.players[(slot+1)%4].id,aScore:null,bScore:24,after:room.state.augment.turn.serial-1}];room.state.revision++;app.rooms.broadcast(room);await actor.waitForTimeout(200);
 await actor.waitForTimeout(2000);await actor.screenshot({path:'artifacts/augments/duel-live.png',fullPage:true});
 assert.equal(await actor.locator('.augment-duels article').count(),1);
 await actor.getByRole('button',{name:'\uB2A5\uB825 \uB3C4\uAC10'}).click();await actor.getByRole('button',{name:'\uBC88\uB729\uC784',exact:true}).click();assert.equal(await actor.locator('.augment-catalog > button').count(),16);
 await checkCatalog(expectedCatalog.filter(d=>d.flash));
 await actor.screenshot({path:'artifacts/augments/flash-catalog.png',fullPage:true});
 await actor.locator('.augment-close').click();
 for(const id of ['tomorrow','taste','misdelivery','memory','fork','bounty','inspection','dinner','bombParcel','hostage']){
  room.state=structuredClone(baseline);room.state.revision+=1000;
  for(const q of room.state.players){q.augment.curse=null;q.augment.items=[];q.augment.lastDice=[6,6,6,6,6];q.augment.archive=[{category:'yacht',dice:[6,6,6,6,6]}];q.augment.bonus=30;}
  room.state.currentPlayerId=room.state.players[slot].id;
  room.state.players[slot].augment.items=[{id,remaining:AUGMENTS.find(d=>d.id===id).charges,usedTurn:-1,usedRound:-1}];
  Object.assign(room.state.augment.turn,{flags:[],pending:undefined,fork:undefined,saveIndex:undefined,hostage:undefined,preheld:[],locked:null,reroll:null,chooseOld:null,oldWorld:null,maxRolls:3});
  room.state.dice=[1,2,3,4,5,6];room.state.held=Array(6).fill(false);room.state.motion=null;room.state.rollPhase='idle';room.state.rollCount=['memory','fork'].includes(id)?0:1;
  app.rooms.broadcast(room);await actor.waitForTimeout(250);
  await actor.locator('.augment-hand .augment-card').click();const dialog=actor.locator('.augment-dialog');
  if(id==='tomorrow')await dialog.getByRole('button',{name:/1\uBC88.*\uC800\uC7A5/}).click();
  else if(['taste','misdelivery'].includes(id)){await dialog.locator('.augment-choice').first().getByRole('button').first().click();await dialog.locator('.augment-choice').nth(1).getByRole('button').first().click();}
  else if(id==='bounty')await dialog.getByRole('button',{name:/\uC218\uBC30$/}).first().click();
  else if(id==='hostage')await dialog.locator('section').first().getByRole('button').first().click();
  else if(id==='memory')await dialog.locator('.augment-choice button').first().click();
  else if(id==='dinner')await dialog.getByRole('button',{name:'\uB09C\uC7A5\uD310 \uC2DC\uC791!'}).click();
  else if(['inspection','bombParcel'].includes(id))await dialog.locator('section').first().getByRole('button').first().click();
  else await dialog.getByRole('button',{name:'\uB2A5\uB825 \uC0AC\uC6A9',exact:true}).click();
  await actor.waitForTimeout(250);
  if(['fork','memory'].includes(id)){
   await actor.locator('.roll').click();await actor.locator('.throw').click();
   await actor.waitForFunction(id=>id==='fork'?document.querySelector('[aria-label="\uB2A5\uB825 \uACB0\uACFC \uC120\uD0DD"]'):!document.querySelector('.throw:not(:disabled)')&&[...document.querySelectorAll('.die-value')].every(e=>/[1-6]/.test(e.textContent)),id);await actor.waitForTimeout(500);
   for(let wait=0;room.state.rollPhase!=='idle'&&wait<300;wait++)await actor.waitForTimeout(100);assert.equal(room.state.rollPhase,'idle');
   if(id==='fork'){
    const pending=actor.getByRole('dialog',{name:'\uB2A5\uB825 \uACB0\uACFC \uC120\uD0DD'});await pending.getByRole('button',{name:/B \uACB0\uACFC/}).click();await actor.locator('.throw').click();await pending.getByRole('button',{name:/^A ?/}).waitFor();await actor.screenshot({path:'artifacts/augments/new-fork-choice.png',fullPage:true});await pending.getByRole('button',{name:/^A ?/}).click();await actor.waitForTimeout(200);assert.equal(room.state.rollCount,1);
   }
  }
  if(['bombParcel','hostage'].includes(id)){
   const target=room.state.players.find(q=>q.augment.curse?.id===id);
   for(let i=0;i<4&&room.state.currentPlayerId!==target.id;i++)advanceAugment(room.state,()=>0);
   if(id!=='bombParcel'){room.state.dice=[6,6,6,5,5];room.state.held=Array(5).fill(false);room.state.rollCount=1;afterAugmentRoll(room.state,()=>0);}
   room.state.revision++;app.rooms.broadcast(room);const page=pages[target.slot];const pending=page.getByRole('dialog',{name:'\uB2A5\uB825 \uACB0\uACFC \uC120\uD0DD'});await pending.waitFor();await page.screenshot({path:`artifacts/augments/new-${id}-choice.png`,fullPage:true});
   await pending.getByRole('button').first().click();await page.waitForTimeout(200);assert.equal(room.state.augment.turn.pending,undefined);
  }
  assert.equal(room.state.players[slot].augment.items[0].remaining,AUGMENTS.find(d=>d.id===id).charges-1,id);
 }
 room.state=structuredClone(baseline);room.state.revision+=2000;room.state.augment.round=6;room.state.augment.event='overflow';app.rooms.broadcast(room);
 await actor.locator('.round-event-banner').waitFor();await actor.waitForTimeout(400);await actor.screenshot({path:'artifacts/augments/event-banner.png',fullPage:true});
 assert.ok(await actor.locator('.round-event-banner').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
 await actor.locator('.round-event-banner button').click();await actor.waitForTimeout(100);assert.equal(await actor.locator('.round-event-banner').count(),0);
 for(const count of [4,10]){
  room.state=structuredClone(baseline);room.state.revision+=3000;room.state.currentPlayerId=room.state.players[slot].id;
  room.state.augment.event=null;room.state.augment.turn.flags=[];room.state.augment.turn.locked=null;room.state.augment.turn.fixed=[];
  room.state.dice=Array(count).fill(null);room.state.held=Array(count).fill(false);room.state.motion=null;room.state.rollCount=0;room.state.rollPhase='idle';app.rooms.broadcast(room);await actor.waitForTimeout(250);
  await actor.locator('.roll').click();await actor.locator('.throw').click();
  for(let wait=0;room.state.rollPhase!=='idle'&&wait<300;wait++)await actor.waitForTimeout(100);
  assert.equal(room.state.rollPhase,'idle');await actor.waitForTimeout(1500);
  assert.equal(await actor.locator('.die-value').count(),count);assert.ok(await actor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await actor.screenshot({path:`artifacts/augments/dice-${count}.png`,fullPage:true});
 }
 for(const sealed of [false,true]){
  room.state=structuredClone(baseline);room.state.revision+=4000+(sealed?1:0);room.state.currentPlayerId=room.state.players[slot].id;
  room.state.dice=sealed?[1,1,3,4,5]:[6,2,3,4,5];room.state.held=sealed?[true,true,false,false,false]:Array(5).fill(false);room.state.motion=null;room.state.rollPhase='idle';room.state.rollCount=1;
  room.state.augment.turn.fixed=sealed?[0,1]:[];room.state.augment.turn.sealed=sealed?[0,1]:[];room.state.augment.turn.locked=null;
  room.state.players[slot].augment.curse=sealed?null:{id:'receipt',from:room.state.players[(slot+1)%4].id,active:true,die:1};
  app.rooms.broadcast(room);await actor.waitForTimeout(350);
  for(const page of pages){assert.equal(await page.locator(sealed?'.sealed-die':'.bomb-die').count(),sealed?2:1);if(sealed)assert.equal(await page.locator('.sealed-die:disabled').count(),2);}
  await actor.screenshot({path:`artifacts/augments/${sealed?'sealed':'bomb'}-dice.png`,fullPage:true});
 }
 room.state=structuredClone(baseline);room.state.revision+=5000;
 const paid=room.state.players[slot];paid.augment.items=[];paid.augment.curse=null;paid.augment.bonus=0;
 room.state.dice=[1,2,3,4,5];room.state.held=Array(5).fill(false);room.state.motion=null;room.state.rollCount=1;room.state.rollPhase='idle';
 Object.assign(room.state.augment.turn,{erase:'bonus',parallel:null,flags:[],pending:undefined,reroll:null,oldWorld:null,chooseOld:null,fork:undefined});
 recordAugment(room.state,paid,'choice');const checked=roomStateSchema.safeParse(room.state);assert.ok(checked.success,JSON.stringify(checked.error));app.rooms.broadcast(room);
 await actor.waitForFunction(()=>document.querySelector('.augment-result-burst')?.textContent.includes('+20'));
 await actor.locator('.augment-receipts summary').click();
 assert.ok((await actor.locator('.augment-receipts').innerText()).includes('+20'));
 await actor.screenshot({path:'artifacts/augments/payout-receipt.png',fullPage:true});
 await actor.reload();await actor.locator('.augment-receipts').waitFor();assert.equal(await actor.locator('.augment-result-burst').count(),0);
 await actor.locator('.augment-receipts summary').click();assert.ok((await actor.locator('.augment-receipts').innerText()).includes('+20'));
 assert.deepEqual(errors,[]);await writeFile('artifacts/augments/browser.json',JSON.stringify({clients:4,modeSelection:true,draft:true,sixDice:true,clone:true,allDiceScoring:true,reconnect:true,catalog:AUGMENTS.filter(d=>!d.retired).length,bombMarkers:true,sealedMarkers:true,payoutReceipt:true,errors},null,2));console.log('Augment browser checks passed');
}finally{await browser?.close();await app.close();}
