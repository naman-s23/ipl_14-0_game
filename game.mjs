export const cycles = ['2008–2010','2011–2013','2014–2017','2018–2021','2022–2024','2025–2026'];
export const overseasCap = 2;
export const averageRating = 60;
export const teams = {
  CSK: 'Chennai Super Kings', DC: 'Delhi Capitals', GT: 'Gujarat Titans',
  KKR: 'Kolkata Knight Riders', LSG: 'Lucknow Super Giants', MI: 'Mumbai Indians',
  PBKS: 'Punjab Kings', RR: 'Rajasthan Royals', RCB: 'Royal Challengers Bengaluru',
  SRH: 'Sunrisers Hyderabad', DEC: 'Deccan Chargers', KTK: 'Kochi Tuskers Kerala',
  PWI: 'Pune Warriors', GL: 'Gujarat Lions', RPS: 'Rising Pune Supergiant'
};
export const roles = {bat:'Batter', wk:'Wicketkeeper', ar:'All-rounder', sp:'Spinner', pc:'Pacer'};
export const slots = [
  ['bat1','bat','Batter 1'], ['bat2','bat','Batter 2'], ['wk','wk','Wicketkeeper'],
  ['ar','ar','All-rounder'], ['sp','sp','Spinner'], ['pc','pc','Pacer']
];

export function seeded(seed) {
  let state = 2166136261;
  for (const ch of String(seed)) state = Math.imul(state ^ ch.codePointAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createDraft(players, random = Math.random) {
  const groups = new Map();
  const byRole = Object.fromEntries(Object.keys(roles).map(role => [role, new Map()]));
  for (const player of players) {
    const key = player.team + '/' + player.cycle;
    if (!groups.has(key)) groups.set(key, {team:player.team, cycle:player.cycle, players:[]});
    groups.get(key).players.push(player);
    if (player.overseas == null) continue;
    for (const role of player.roles) byRole[role].set(player.id, player);
  }
  const candidates = Object.fromEntries(Object.entries(byRole).map(([role, people]) =>
    [role, [...people.values()].sort((a,b) => Number(a.overseas) - Number(b.overseas))]));
  const picks = new Map();
  const remaining = {team:1, cycle:1};
  let pair, choices, viable;
  function canFinish(open, used, budget) {
    if (budget < 0) return false;
    if (!open.length) return true;
    const available = open.map(slot => candidates[slot[1]].filter(p => !used.has(p.id) && (!p.overseas || budget)));
    const smallest = available.reduce((best, list, index) => list.length < available[best].length ? index : best, 0);
    return available[smallest].some(p => {
      used.add(p.id);
      const possible = canFinish(open.filter((_, i) => i !== smallest), used, budget - Number(p.overseas));
      used.delete(p.id);
      return possible;
    });
  }
  function refresh() {
    const open = slots.filter(([key]) => !picks.has(key));
    const used = new Set([...picks.values()].map(p => p.id));
    const budget = overseasCap - [...picks.values()].filter(p => p.overseas).length;
    const memo = new Map();
    choices = new Map();
    for (const group of groups.values()) {
      const options = new Map();
      for (const p of group.players) {
        if (p.overseas == null || used.has(p.id) || (p.overseas && !budget)) continue;
        const eligible = open.filter(([key, role]) => {
          if (!p.roles.includes(role)) return false;
          const cacheKey = p.id + '/' + role;
          if (!memo.has(cacheKey)) {
            used.add(p.id);
            memo.set(cacheKey, canFinish(open.filter(s => s[0] !== key), used, budget - Number(p.overseas)));
            used.delete(p.id);
          }
          return memo.get(cacheKey);
        });
        if (eligible.length) options.set(p, eligible.map(s => s[0]));
      }
      choices.set(group, options);
    }
    viable = [...groups.values()].filter(group => choices.get(group).size);
  }
  function alternatives(axis) {
    if (!pair || !remaining[axis]) return [];
    const fixed = axis === 'team' ? 'cycle' : 'team';
    return viable.filter(group => group[fixed] === pair[fixed] && group[axis] !== pair[axis]);
  }
  function draw(groupsToDraw) {
    if (!groupsToDraw.length) return false;
    pair = groupsToDraw[Math.floor(random() * groupsToDraw.length)];
    return true;
  }
  function canMove(from, to) {
    const player = picks.get(from);
    const displaced = picks.get(to);
    const targetRole = slots.find(([key])=>key===to)?.[1];
    const sourceRole = slots.find(([key])=>key===from)?.[1];
    if (from===to || !player?.roles.includes(targetRole)) return false;
    if (displaced) return displaced.roles.includes(sourceRole);
    const open = slots.filter(([key])=>key===from || (key!==to && !picks.has(key)));
    const used = new Set([...picks.values()].map(p=>p.id));
    const budget = overseasCap - [...picks.values()].filter(p=>p.overseas).length;
    return canFinish(open,used,budget);
  }
  refresh();
  draw(viable);
  return {
    get pair() {return pair;},
    get picks() {return new Map(picks);},
    get remaining() {return {...remaining};},
    get options() {return new Map(choices.get(pair));},
    canRespin: axis => alternatives(axis).length > 0,
    canMove,
    move(from, to) {
      if (!canMove(from,to)) return false;
      const player = picks.get(from);
      const displaced = picks.get(to);
      if (displaced) picks.set(from,displaced);
      else picks.delete(from);
      picks.set(to,player);
      if (picks.size<slots.length) {
        refresh();
        if (!viable.includes(pair)) draw(viable);
      }
      return true;
    },
    respin(axis) {
      if (!draw(alternatives(axis))) return false;
      remaining[axis]--;
      return true;
    },
    pick(player, slot) {
      if (!choices.get(pair)?.get(player)?.includes(slot)) return false;
      picks.set(slot, player);
      refresh();
      pair = undefined;
      draw(viable);
      return true;
    }
  };
}

export const support = ['Domestic top-order batter','Domestic middle-order batter','Domestic seam all-rounder','Domestic spinner','Domestic seamer'];

// Opponent strength, venue scoring environment, and bowling conditions are fixed game profiles.
export const slate = [
  ['MI','Wankhede',187, 2, .88,1.20], ['CSK','Chepauk',169, 1,1.25,.92],
  ['RCB','Chinnaswamy',195, 3,.88,1.15], ['RR','Jaipur',177,-1,1.12,.96],
  ['GT','Ahmedabad',183, 2,.94,1.11], ['PBKS','Mullanpur',179,-2,1,1.05],
  ['KKR','Eden Gardens',189, 1,1.15,1.01], ['SRH','Hyderabad',199, 2,.83,1.20],
  ['LSG','Ekana',166,-2,1.26,.85], ['DC','Delhi',193,-1,.93,1.12],
  ['CSK','Chepauk',169, 1,1.25,.92], ['MI','Wankhede',187, 2,.88,1.20],
  ['GT','Ahmedabad',183, 2,.94,1.11], ['RCB','Chinnaswamy',195, 3,.88,1.15]
];
const average = (values, weights) => values.reduce((sum, value, i) => sum + value * weights[i], 0);
const battingPlan = [
  [.69,.285,.025], [.69,.285,.025], [.37,.54,.09], [.18,.62,.20],
  [.10,.55,.35], [.04,.44,.52], [.02,.34,.64], [0,.25,.75],
  [0,.15,.85], [0,.10,.90], [0,.10,.90]
];
const battingExposure = [26,26,22,18,15,12,8,4,2,1,.5];
// Preserve the previous perfect-season rate after replacing the fixed batting slots.
const automaticOrderCalibration = 4.75;
const positionFit = (p, i) => {
  const usual = p.pos ?? 9;
  return Math.abs((i < 2 ? 2 : i+1) - Math.max(2, usual));
};
export function battingXI(picks) {
  if (slots.some(([key]) => !picks.has(key))) throw new Error('Complete the lineup first.');
  // Use a stable player order so drafting or swapping eligible roles does not change batting ties.
  const core = [...picks.values()].sort((a,b)=>a.name.localeCompare(b.name));
  const costs = battingPlan.map((weights,i)=>core.map(p=>
    positionFit(p,i) - average(p.bat.edge,weights)*2));
  const full = (1 << core.length)-1;
  const best = Array.from({length:12},()=>Array(full+1).fill(Infinity));
  best[11][full]=0;
  for (let i=10;i>=0;i--) {
    for (let mask=0;mask<=full;mask++) {
      let cost=best[i+1][mask];
      for (let j=0;j<core.length;j++) if (!(mask & (1<<j))) {
        cost=Math.min(cost,costs[i][j]+best[i+1][mask | (1<<j)]);
      }
      best[i][mask]=cost;
    }
  }
  let mask=0, backup=0;
  return costs.map((row,i)=>{
    const j=row.findIndex((cost,j)=>!(mask & (1<<j)) && cost+best[i+1][mask | (1<<j)]===best[i][mask]);
    if (j<0) return {name:support[backup++]};
    mask|=1<<j;
    return {name:core[j].name, player:core[j]};
  });
}
export function profile(picks) {
  const contributions = battingXI(picks).map(({player:p}, i) => {
    if (!p) return 0;
    const phase = average(p.bat.edge, battingPlan[i]);
    return (phase * .70 + p.bat.overall * .30) * battingExposure[i];
  });
  const spinner = picks.get('sp').bowl;
  const pacer = picks.get('pc').bowl;
  const all = picks.get('ar').bowl;
  return {
    opening: contributions[0]+contributions[1],
    middleBat: contributions.slice(2,5).reduce((a,b)=>a+b,0),
    finishing: contributions.slice(5).reduce((a,b)=>a+b,0),
    spin: spinner.edge[1]*22,
    death: pacer.edge[2]*14,
    newBall: pacer.edge[0]*9 + pacer.edge[1]*3,
    allRound: average(all.edge,[.25,.55,.20])*16,
    keeping: (picks.get('wk').ratings.wk-averageRating)*.12,
    fielding: slots.reduce((sum,[key])=>sum+(picks.get(key).fielding?.edge ?? 0),0)
  };
}
export function simulate(picks, seed, strengths = profile(picks)) {
  const {opening, middleBat, finishing, spin, death, newBall, allRound, keeping, fielding} = strengths;
  const random = seeded(seed);
  const noise = () => (random()+random()+random()+random()+random()+random()-3)*18.3;
  const matches = slate.map(([opponent, venue, par, difficulty, spinFit, paceFit], i) => {
    const balance = Math.min(2, Math.max(0, opening), Math.max(0, finishing));
    const bat = opening + middleBat + finishing + balance - automaticOrderCalibration;
    const defense = spin*spinFit + (death+newBall)*paceFit + allRound + keeping + fielding;
    const own = Math.max(65, Math.round(par+bat+noise()));
    let against = Math.max(65, Math.round(par+difficulty-defense+noise()));
    if (own === against) against += random() < .5 ? -1 : 1;
    return {number:i+1, opponent, venue, own, against, won:own>against, margin:Math.abs(own-against)};
  });
  return {wins:matches.filter(m => m.won).length, matches, strengths};
}
