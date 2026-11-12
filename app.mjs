import {battingXI, createDraft, cycles, overseasCap, slots, simulate, support, teams} from './game.mjs';

const game = document.querySelector('#game');
const status = document.querySelector('#status');
const reset = document.querySelector('#reset');
const slotName = Object.fromEntries(slots.map(([id,,label])=>[id,label]));
const slotRole = Object.fromEntries(slots.map(([id,role])=>[id,role]));
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
const announce = message => { status.textContent=message; };
let players, draft, order, seed, result, sort, showAll;
let hardMode = false;
let spinning = false;
let spinTimer;
let dragged;
let touchDrag;
const spinDuration = 1600;
const teamColors = {
  CSK:'#f5c94b', DC:'#6e9cf4', GT:'#9daeed', KKR:'#bc9bed', LSG:'#7fbbef',
  MI:'#679eea', PBKS:'#f1818e', RR:'#ee87b7', RCB:'#ee7d78', SRH:'#f4a16b',
  DEC:'#88bddf', KTK:'#e5a378', PWI:'#79c9e6', GL:'#ecaa72', RPS:'#d1a2e6'
};
const teamTint = team => teamColors[team] ? ` style="--team-color:${teamColors[team]}"` : '';

function lineup(picks) {
  return `<aside class="panel lineup"><div class="section-head">
    <h2>Your lineup</h2><span class="badge">${picks.size} / 6</span></div>
    <div class="progress" aria-hidden="true"><span style="width:${picks.size/6*100}%"></span></div>
    <ol class="slots">${slots.map(([id,,label],i)=>{
      const p=picks.get(id);
      const moves = p&&!spinning ? slots.filter(([to])=>draft.canMove(id,to)) : [];
      return `<li class="slot ${p?'filled':''}" data-drop-slot="${id}"${teamTint(hardMode?null:p?.team)}><span class="slot-num">${String(i+1).padStart(2,'0')}</span>
        <div class="slot-player" ${moves.length?`draggable="true" data-drag-slot="${id}"`:''}><strong>${p?esc(p.name):label}</strong>
        <small>${p?(hardMode?label:`${label} · ${p.team} · ${cycles[p.cycle]}`):'Open slot'}</small>
        </div>
        ${p?`<span class="rating slot-rating" aria-label="Role rating ${p.ratings[slotRole[id]]}">${p.ratings[slotRole[id]]}</span>`:''}
        ${moves.length?`<select class="role-move" data-role-move="${id}" aria-label="Move ${esc(p.name)} to another role">
          <option value="">Move role…</option>${moves.map(([to,,name])=>`<option value="${to}">${name}${picks.has(to)?' (swap)':''}</option>`).join('')}
        </select>`:''}</li>`;
    }).join('')}</ol>
    <p class="footnote"><strong class="accent">${[...picks.values()].filter(p=>p.overseas).length} / ${overseasCap}</strong> overseas picks used</p>
    <details class="support"><summary>Five fixed domestic support roles</summary><ul>${support.map(role=>`<li>${role}</li>`).join('')}</ul></details>
  </aside>`;
}
function reel(axis, label, choices, selected, flip) {
  const count=draft?.remaining[axis] ?? 1;
  const can=Boolean(draft?.canRespin(axis));
  const active = spinning && (flip===axis || flip==='both');
  const value=choices[selected] ?? '—';
  const values=active?Array.from({length:9},(_,i)=>choices[(selected+i+choices.length*2-8)%choices.length]):[value];
  const tag=draft?'div':'button';
  const description=active?'Spinning':axis==='team'?(teams[value] ?? value):value;
  return `<div class="reel reel-${axis}">
    <${tag} class="reel-front" ${draft?'':'type="button" data-start aria-label="Spin both draft reels"'}>
      <span class="eyebrow">${label}</span><span class="sr-only">${description}</span>
      <span class="reel-window" aria-hidden="true"><span class="reel-strip${active?' spinning':''}" style="--spin-duration:${spinDuration}ms">
        ${values.map(item=>`<span>${item}</span>`).join('')}
      </span></span>
    </${tag}>
    <button class="secondary" data-respin="${axis}" ${can&&!spinning?'':'disabled'} title="${count&&!can?'No valid alternative on this reel':''}">↻ Respin ${axis} <span class="accent">· ${count} left</span></button></div>`;
}
function draftScreen(flip) {
  const pair=draft?.pair;
  return `<section class="panel reel-panel" tabindex="-1"><div class="section-head"><h2>Draft reels</h2><span class="badge">ROUND ${(draft?.picks.size ?? 0)+1} / 6</span></div>
    <div class="reels">${reel('team','TEAM',Object.keys(teams),Object.keys(teams).indexOf(pair?.team),flip)}
    ${reel('cycle','ERA',cycles,pair?.cycle ?? -1,flip)}</div></section>
    <section class="panel pool" id="pool" tabindex="-1" aria-busy="${spinning}">${spinning?'<p class="aside-note">Drawing the next board…</p>':pair?'':`<div class="section-head"><h2>On the board</h2></div>
      <div class="empty"><h3>How to play</h3>
        <p>Spin to draw an IPL franchise and auction cycle. Draft one player per round by dragging them into an eligible slot or tapping their role. Move or swap picks between eligible slots as you go.</p>
        <p>You have one respin per wheel and can draft up to ${overseasCap} overseas players. Draft six players, then simulate 14 matches and try to win them all.</p>
        <fieldset class="mode-toggle"><legend>Difficulty</legend>
          <label><input type="radio" name="difficulty" value="standard" ${!hardMode?'checked':''}><span>Normal</span></label>
          <label><input type="radio" name="difficulty" value="hard" ${hardMode?'checked':''}><span>Hard</span></label>
        </fieldset>
        <p class="footnote">Hard mode reveals ratings after you draft each player.</p>
        <button class="primary" data-start>Spin the reels →</button></div>`}</section>`;
}
const rate = (n,d,m,places=1) => d ? (n/d*m).toFixed(places) : '—';
function card(p,eligible,index) {
  const available=eligible ?? [];
  const actions = available.map(id=>{
    const suffix = hardMode?'':` · ${p.ratings[slotRole[id]]}`;
    return `<button class="pick" data-player="${index}" data-slot="${id}" aria-label="Draft ${esc(p.name)} as ${slotName[id]}${suffix}">${slotName[id]}${suffix}</button>`;
  }).join('') || '<span class="footnote">Unavailable for this lineup</span>';
  const drag = available.length?`draggable="true" data-drag-player="${index}"`:'';
  if (hardMode) return `<article class="card" ${drag}><h3>${esc(p.name)}</h3><div class="actions">${actions}</div></article>`;
  const ratings = available.map(id=>p.ratings[slotRole[id]]);
  const best = ratings.length ? Math.max(...ratings) : '—';
  const {bat,bowl,keeping} = p;
  const batStats = [[bat.runs,'RUNS'],[rate(bat.runs,bat.balls,100),'STRIKE RATE'],
    [rate(bat.runs,bat.wickets,1,2),'AVERAGE'],[bat.fours,'FOURS'],[bat.sixes,'SIXES'],
    [rate(bat.balls,bat.fours+bat.sixes,1),'BALLS / BOUNDARY']];
  const bowlStats = [[rate(bowl.runs,bowl.balls,6,2),'ECONOMY'],[bowl.wickets,'WICKETS'],
    [rate(bowl.balls,bowl.wickets,1),'STRIKE RATE'],[rate(bowl.runs,bowl.wickets,1,2),'AVERAGE'],
    [bowl.dots,'DOT BALLS'],[`${Math.floor(bowl.balls/6)}.${bowl.balls%6}`,'OVERS']];
  const stats = metrics=>`<div class="stats">${metrics.map(([value,label])=>`<div><strong>${value}</strong><span class="stat-label">${label}</span></div>`).join('')}</div>`;
  const showBat = p.roles.some(role=>['bat','wk','ar'].includes(role)) || !bowl.balls;
  const showBowl = p.roles.some(role=>['sp','pc','ar'].includes(role)) || !showBat;
  return `<article class="card" ${drag}>
    <header><div><span class="eyebrow">${p.team} / ${cycles[p.cycle]}</span><h3>${esc(p.name)}</h3>
      <div class="origin">${p.overseas===null?'Country unverified':p.overseas?`Overseas · ${esc(p.country)}`:'Domestic · India'}</div></div>
      <div class="rating" aria-label="Best available slot rating ${best}">${best}<small>RATING</small></div></header>
    <p class="footnote">${p.matches} matches · ${p.innings} batting innings · ${p.fielding.catches} fielding catches</p>
    ${showBat?`<h4>Batting</h4>${stats(batStats)}`:''}
    ${showBowl?`<h4>Bowling</h4>${stats(bowlStats)}`:''}
    ${p.roles.includes('ar')?`<p class="footnote">Batting − bowling average · ${bat.wickets&&bowl.wickets?(bat.runs/bat.wickets-bowl.runs/bowl.wickets).toFixed(2):'—'}</p>`:''}
    ${keeping.matches?`<h4>Wicketkeeping</h4>${stats([[keeping.dismissals,'DISMISSALS'],[keeping.catches,'CATCHES'],[keeping.stumpings,'STUMPINGS']])}`:''}
    <div class="actions">${actions}</div>
  </article>`;
}
let visible = [];
let roleFilter = 'all';
const roleFilters = {all:'All',bat:'Batters',wk:'WK',ar:'AR',sp:'Spinners',pc:'Pacers'};
function renderPool() {
  const pool=document.querySelector('#pool');
  const options=draft.options;
  const best = p => Math.max(0,...(options.get(p) ?? []).map(id=>p.ratings[slotRole[id]]));
  const sorts = {rating:(a,b)=>best(b)-best(a),matches:(a,b)=>b.matches-a.matches,name:(a,b)=>a.name.localeCompare(b.name),
    batting:(a,b)=>b.bat.runs-a.bat.runs,bowling:(a,b)=>b.bowl.wickets-a.bowl.wickets};
  visible=(showAll&&!hardMode?draft.pair.players:[...options.keys()])
    .filter(p=>roleFilter==='all'||p.roles.includes(roleFilter))
    .sort((a,b)=>sorts[hardMode?'name':sort](a,b)||a.name.localeCompare(b.name));
  pool.innerHTML=`<div class="section-head"><h2>On the board <span class="badge">${options.size} eligible</span></h2>
    ${hardMode?'<span class="badge">Hard · names only</span>':`<div class="controls"><label class="sr-only" for="sort">Sort player cards</label><select id="sort">
      ${Object.entries({rating:'Best slot rating',matches:'Most matches',name:'Player name',batting:'Most runs',bowling:'Most wickets'}).map(([id,label])=>`<option value="${id}" ${sort===id?'selected':''}>${label}</option>`).join('')}
    </select><label class="footnote"><input type="checkbox" id="all" ${showAll?'checked':''}> All appearances</label></div>`}</div>
    <div class="role-filters" role="group" aria-label="Filter players by role">${Object.entries(roleFilters).map(([id,label])=>
      `<button type="button" class="quiet" data-filter="${id}" aria-pressed="${roleFilter===id}">${label}</button>`).join('')}</div>
    <p class="aside-note"><span class="drag-hint">Drag a player to an eligible slot, or select a role on their card.</span><span class="tap-hint">Tap a role to draft a player.</span></p>
    <div class="cards">${visible.length?visible.map((p,i)=>card(p,options.get(p),i)).join(''):'<p class="footnote">No players match this role on this board.</p>'}</div>`;
}
function orderScreen() {
  return `<section class="panel order"><div class="section-head"><h2>Your batting XI</h2><span class="badge">6 / 6 DRAFTED</span></div>
    <p class="footnote">The game places your six picks first. Five domestic support players fill the gaps.</p>
    <ol>${order.map(({name,player},i)=>`<li><span class="slot-num">${i<2?'OP':i+1}</span><div><strong>${esc(name)}</strong><small>${[i<2?'Opener':'',!player?'Support':''].filter(Boolean).join(' · ')}</small></div></li>`).join('')}</ol>
    <form id="simulation"><button class="primary" type="submit">Simulate 14 matches →</button></form></section>`;
}
function resultsScreen() {
  const {wins,matches}=result;
  const {opening,middleBat,finishing,spin,death,newBall,allRound,keeping,fielding}=result.strengths;
  const units=[
    ['Opening batting',opening],['Middle-order batting',middleBat],['Finishing',finishing],
    ['Middle-overs spin',spin],['Pace bowling',death+newBall],['All-rounder bowling',allRound],
    ['Wicketkeeping',keeping],['Fielding',fielding]
  ].sort((a,b)=>b[1]-a[1]);
  const closeLosses=matches.filter(match=>!match.won && match.margin<=10).length;
  const [verdict,summary]=wins===14
    ? ['Perfect season','Fourteen played, fourteen won. You completed the 14–0 Challenge.']
    : wins>=10
    ? ['Championship-caliber team','You built a title contender. This XI could make a deep playoff run.']
    : wins===9
    ? ['Playoff team','A strong campaign. This XI could make it as far as Qualifier 2.']
    : wins===8
    ? ['Playoff team','Good enough for a playoff push, with a tough road through the Eliminator.']
    : wins>=6
    ? ['On the playoff bubble',closeLosses>=2
      ? `${closeLosses} losses by 10 runs or fewer. A couple of tight finishes could have changed the season.`
      : 'A couple more wins could have put this XI in the playoff conversation.']
    : wins>=3
    ? ['Out of form','The lineup never quite clicked. The next auction is a chance to shore up a few spots.']
    : ['Back to the auction','A tough season from start to finish. Time to rebuild the core.'];
  return `<section class="panel results"><span class="eyebrow">FINAL RECORD</span>
    <h2 class="record" tabindex="-1" id="record" aria-describedby="season-summary">${wins}–${14-wins}</h2>
    <div class="season-summary" id="season-summary"><strong>${verdict}</strong><p>${summary}</p></div>
    <dl class="team-review">
      <div><dt>Strongest fit</dt><dd>${units[0][0]}</dd></div>
      <div><dt>Weakest link</dt><dd>${units.at(-1)[0]}</dd></div>
    </dl>
    <div class="result-actions">
      <button class="secondary retry" type="button" data-share-team>Share team</button>
      <button class="primary retry" data-retry>Retry game</button>
    </div>
    <div class="share-fallback" hidden><label for="share-roster">Copy your team to share it</label><textarea id="share-roster" readonly rows="6"></textarea></div></section>`;
}
async function shareTeamResult() {
  if (!result) return;
  const currentResult=result;
  const record=`${result.wins}–${14-result.wins}`;
  const url='https://ipl14-0game.vercel.app/';
  const roster=order.filter(({player})=>player).map(({name,player})=>
    `• ${name} (${player.team}, ${cycles[player.cycle]})`).join('\n');
  const message=`I went ${record} in the IPL 14–0 Challenge!\n\nMy six picks:\n${roster}`;
  const copy=`${message}\n\nPlay the challenge: ${url}`;
  try {
    if (navigator.share) {
      await navigator.share({title:`My ${record} IPL team`,text:message,url});
      return;
    }
  } catch (error) {
    if (error.name==='AbortError') return;
  }
  if (result!==currentResult) return;
  try {
    await navigator.clipboard.writeText(copy);
    if (result===currentResult) {
      game.querySelector('[data-share-team]').textContent='Team copied!';
      announce('Your 14–0 team was copied.');
    }
  } catch {
    if (result!==currentResult) return;
    game.querySelector('.share-fallback').hidden=false;
    const field=game.querySelector('#share-roster');
    field.value=copy;
    field.focus();
    field.select();
  }
}
function render(flip) {
  const picks=draft?.picks ?? new Map();
  reset.hidden=!draft||Boolean(result);
  document.querySelector('.hero-index').textContent=result?'03 / THE SEASON':order?'02 / THE ORDER':'01 / THE DRAFT';
  game.innerHTML=result?resultsScreen():
    `<div class="board"><div class="draft-main"${teamTint(spinning&&flip!=='cycle'?null:draft?.pair?.team)}>${order?orderScreen():draftScreen(flip)}</div>${lineup(picks)}</div>`;
  if (draft?.pair && !spinning) renderPool();
}
function spin(axis) {
  const compact = globalThis.matchMedia?.('(max-width: 760px)').matches;
  spinning = true;
  render(axis);
  document.querySelector(compact?'.reel-panel':'#pool').focus();
  announce('Spinning the draft wheel.');
  spinTimer = setTimeout(()=>{
    spinning = false;
    render();
    if (compact) document.querySelector('.reel-panel').focus({preventScroll:true});
    else (document.querySelector('#sort') ?? document.querySelector('#pool')).focus();
    announce(`Round ${draft.picks.size+1}. ${teams[draft.pair.team]}, ${cycles[draft.pair.cycle]}. ${draft.options.size} players available.`);
  },spinDuration);
}
function restart() {
  roleFilter='all';
  clearTimeout(spinTimer);
  spinning=false;
  clearDrag();
  draft=undefined; order=undefined; result=undefined;
  seed=randomSeed(); sort='rating'; showAll=false;
  render();
}
function retry() {
  restart(); announce('New draft ready.');
  game.querySelector('[data-start]').focus();
}
reset.addEventListener('click',retry);
function draftPlayer(player, slot) {
  if (!draft?.pick(player,slot)) return;
  if (draft.picks.size<slots.length) {
    spin('both');
    return;
  }
  order=battingXI(draft.picks);
  render();
  announce(`Drafted ${player.name} as ${slotName[slot]}. Your batting XI is ready.`);
  document.querySelector('#simulation button').focus();
}
function movePlayer(from, to) {
  const pair = draft.pair;
  const player = draft.picks.get(from);
  if (!draft.move(from,to)) return;
  if (draft.pair!==pair) spin('both');
  else {
    render();
    announce(`${player.name} moved to ${slotName[to]}.`);
    game.querySelector(`[data-role-move="${to}"]`)?.focus();
  }
}
function clearDrag() {
  dragged=undefined;
  touchDrag=undefined;
  for (const target of game.querySelectorAll('.drop-ready')) target.classList.remove('drop-ready');
}
game.addEventListener('pointerdown',event=>{
  if (event.pointerType!=='touch' || spinning || touchDrag) return;
  const source=event.target.closest('[data-drag-slot]');
  if (!source) return;
  const from=source.dataset.dragSlot;
  const targets=slots.filter(([to])=>draft.canMove(from,to)).map(([to])=>to);
  if (!targets.length) return;
  source.setPointerCapture(event.pointerId);
  touchDrag={from,targets,id:event.pointerId};
  for (const to of targets) game.querySelector(`[data-drop-slot="${to}"]`)?.classList.add('drop-ready');
});
game.addEventListener('pointerup',event=>{
  if (!touchDrag || touchDrag.id!==event.pointerId) return;
  const {from,targets}=touchDrag;
  const to=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-drop-slot]')?.dataset.dropSlot;
  clearDrag();
  if (!spinning && targets.includes(to)) movePlayer(from,to);
});
game.addEventListener('pointercancel',event=>{
  if (touchDrag?.id===event.pointerId) clearDrag();
});
game.addEventListener('dragstart',event=>{
  const source = event.target.closest('[data-drag-slot], [data-drag-player]');
  if (!source || spinning) return;
  const {dragSlot,dragPlayer}=source.dataset;
  const player = dragSlot ? draft.picks.get(dragSlot) : visible[Number(dragPlayer)];
  const targets = dragSlot ? slots.filter(([to])=>draft.canMove(dragSlot,to)).map(([to])=>to) :
    draft.options.get(player);
  if (!targets?.length) { event.preventDefault(); return; }
  dragged={from:dragSlot,player,targets};
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('text/plain',player.name);
  for (const to of targets) game.querySelector(`[data-drop-slot="${to}"]`)?.classList.add('drop-ready');
});
game.addEventListener('dragover',event=>{
  const slot = event.target.closest('[data-drop-slot]')?.dataset.dropSlot;
  if (dragged?.targets.includes(slot)) {
    event.preventDefault();
    event.dataTransfer.dropEffect='move';
  }
});
game.addEventListener('drop',event=>{
  const slot = event.target.closest('[data-drop-slot]')?.dataset.dropSlot;
  const source = dragged;
  clearDrag();
  if (!source?.targets.includes(slot) || spinning) return;
  event.preventDefault();
  if (source.from) movePlayer(source.from,slot);
  else draftPlayer(source.player,slot);
});
game.addEventListener('dragend',clearDrag);
game.addEventListener('change',event=>{
  const from = event.target.dataset?.roleMove;
  if (from && event.target.value && !spinning) {
    movePlayer(from,event.target.value);
    return;
  }
  if (event.target.name==='difficulty' && !draft) {
    hardMode=event.target.value==='hard';
    return;
  }
  if (spinning || !draft?.pair || hardMode) return;
  if (event.target.id==='sort') sort=event.target.value;
  else if (event.target.id==='all') showAll=event.target.checked;
  else return;
  const id=event.target.id;
  renderPool();
  document.getElementById(id).focus();
});
game.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if (!button || spinning) return;
  const {start,respin,slot,player,filter,shareTeam,retry:retryButton}=button.dataset;
  if (start!==undefined) {
    draft=createDraft(players);
    spin('both');
  } else if (respin && draft.respin(respin)) {
    spin(respin);
  } else if (filter) {
    roleFilter=filter;
    renderPool();
    game.querySelector(`[data-filter="${filter}"]`)?.focus();
  } else if (slot) {
    draftPlayer(visible[Number(player)],slot);
  } else if (shareTeam!==undefined) {
    void shareTeamResult();
  } else if (retryButton!==undefined) {
    retry();
  }
});
game.addEventListener('submit',event=>{
  if (event.target.id!=='simulation') return;
  event.preventDefault();
  result=simulate(draft.picks,seed);
  render();
  document.querySelector('#record').focus();
});
try {
  const response=await fetch('/pool.json');
  if (!response.ok) throw new Error('Pool unavailable');
  players=await response.json();
  restart();
} catch {
  game.innerHTML='<p class="panel loading">The historical draft pool could not load. Run npm run import, then reload this page.</p>';
}
