import './counter-input.mjs';

// Constants
const APP_NAME = 'scoreboard';
const APP_VERSION = `1.0.1`
const LOCAL_STORAGE_KEY = `${APP_NAME}.v${APP_VERSION}`; // Use for local storage
const CLOUD_SAVE_URL = 'https://script.google.com/macros/s/AKfycbwW11Xm9k-4WTUNq7LbJcRaYxvDYdwSqit6Nna0_CEWYfIXCrzqTTbrPbvxjeBoUw6P/exec';

const DUEL_CATEGORIES = {
  'Civilian': 'blue-cards',
  'Science': 'green-cards',
  'Commercial': 'yellow-cards',
  'Guilds': 'purple-cards',
  'Wonders': 'wonders',
  'Progress': 'green-coins',
  'Coins': 'money-coins',
  'Military': 'military'
};

const CLASSIC_CATEGORIES = {
  'Military': 'military',
  'Coins': 'money-coins',
  'Wonders': 'wonders',
  'Civilian': 'blue-cards',
  'Commercial': 'yellow-cards',
  'Guilds': 'purple-cards',
  'Science': 'green-cards'
};

// Default config choices
const DEFAULT_NAMES = ['Player #1', 'Player #2', 'Player #3', 'Player #4']; // Default participants (config)
const DEFAULT_AUTO_SORT = true; // Default auto-sort
const DEFAULT_CELEBRATION_LINK = 'https://www.pellicciotta.com/cards/celebrate.html?message={{MESSAGE}}';
const MARK_LAST = false; // Set to `true` to mark the lowest-ranked participant with `rank-last` styling

// Scoreboard state
let state = {
  "game": "unknown",
  "play-date": null,
  "status": "ongoing",
  "auto-sort": DEFAULT_AUTO_SORT,
  "celebration-link": DEFAULT_CELEBRATION_LINK,
  "players": DEFAULT_NAMES.map(n => ({ name: n, score: 0, 'play-details': {} }))
};
let tpl = null;
let _isConfiguring = false;

// # Persistence / Helpers

function getConfigurationObject() {
  return {
    'game': state.game,
    'players': state.players,
    'auto-sort': Boolean(state['auto-sort']),
    'celebration-link': state['celebration-link'] || DEFAULT_CELEBRATION_LINK
  };
}

function createStateObject(status, updatePlayDate = true) {
  const exportObj = {
    'game': state['game'],
    'play-date': updatePlayDate ? new Date().toISOString() : state['play-date'],
    'status': status,
    'auto-sort': Boolean(state['auto-sort']),
    'celebration-link': state['celebration-link'] || DEFAULT_CELEBRATION_LINK,
    'players': state.players
  };

  // When exporting a finished game, ensure the players list is sorted
  // with the winner(s) first and include a "rank" field for the
  // first, second and third place participants (handling ties).
  if (status === 'finished' && Array.isArray(exportObj.players)) {
    // Compute ranks (1-based) taking ties into account
    const sortedForRank = [...exportObj.players].slice().sort((a, b) =>
      (Number(b.score) || 0) - (Number(a.score) || 0) || a.name.localeCompare(b.name)
    );
    const ranksByName = Object.create(null);
    let lastRank = 0;
    for (let i = 0; i < sortedForRank.length; i++) {
      if (i === 0) lastRank = 1;
      else lastRank = (Number(sortedForRank[i].score) || 0) === (Number(sortedForRank[i - 1].score) || 0) ? lastRank : i + 1;
      ranksByName[sortedForRank[i].name] = lastRank;
    }

    // Sort players so winners (rank 1) appear first, then by rank, then score/name
    const sortedPlayers = [...exportObj.players].slice().sort((a, b) => {
      const ra = ranksByName[a.name] || Infinity;
      const rb = ranksByName[b.name] || Infinity;
      if (ra !== rb) return ra - rb; // lower rank (1) first
      const sa = Number(a.score) || 0;
      const sb = Number(b.score) || 0;
      if (sb !== sa) return sb - sa;
      return a.name.localeCompare(b.name);
    });

    // Add rank field for top three places (1,2,3) and produce shallow copies
    exportObj.players = sortedPlayers.map(p => {
      const copy = Object.assign({}, p);
      const r = ranksByName[p.name];
      if (r && r <= 3) copy.rank = r;
      return copy;
    });
  }

  return exportObj;
}

function loadStateObject(sourceObj) {
  if (!sourceObj) return false;
  let loaded = false;
  if (sourceObj.players && Array.isArray(sourceObj.players)) {
    state.players = [];
    for (const pp of sourceObj.players) {
      const name = String(pp.name || '').trim();
      const score = Math.max(0, Number(pp.score) || 0);
      const playDetails = pp.playDetails || pp['play-details'] || {};
      if (name.length) {
        state.players.push({ name, score, 'play-details': playDetails });
      }
    }
    loaded = true;
  }
  if (sourceObj.game !== undefined) {
    state.game = sourceObj.game || null;
  }
  if (sourceObj.status !== undefined) {
    state.status = sourceObj.status || "ongoing";
  }
  // Handle different key styles for play-date ('play-date' or 'playDate')
  if (sourceObj['play-date'] !== undefined) {
    state['play-date'] = sourceObj['play-date'] || new Date().toISOString();
  }
  else if (sourceObj.playDate !== undefined) {
    state['play-date'] = sourceObj.playDate || new Date().toISOString();
  }
  // Handle different key styles for auto-sort ('auto-sort' or 'autoSort')
  if (sourceObj['auto-sort'] !== undefined) {
    state['auto-sort'] = Boolean(sourceObj['auto-sort']);
  }
  else if (sourceObj.autoSort !== undefined) {
    state['auto-sort'] = Boolean(sourceObj.autoSort);
  }
  // Handle different key styles for celebration-link
  if (sourceObj['celebration-link'] !== undefined) {
    state['celebration-link'] = String(sourceObj['celebration-link']);
  }
  else if (sourceObj.celebrationLink !== undefined) {
    state['celebration-link'] = String(sourceObj.celebrationLink);
  }
  return loaded;
}

const el = (id) => document.getElementById(id);

function save() {
  try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn('Failed to save', e) }
}

function load() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try {
      loadStateObject(JSON.parse(raw));
    }
    catch (e) {
      state = { players: [] };
    }
  }
}

function saveAndRender() {
  save();
  render();
}

function getPlayer(name) {
  return state.players.find(x => x.name === name);
}

// # Rendering / ranking

function updateTitle() {
  const titleEl = el('app-title');
  if (!titleEl) return;
  if (state.game && state.game.trim().length > 0) {
    titleEl.textContent = `${state.game} Scores`;
  } else {
    titleEl.textContent = 'SCOREBOARD';
  }
}

function applyRankClasses(li, score, rank, isLast) {
  li.classList.remove('rank-gold', 'rank-silver', 'rank-bronze', 'rank-last');
  if (score > 0) {
    if (rank === 1) li.classList.add('rank-gold');
    else if (rank === 2) li.classList.add('rank-silver');
    else if (rank === 3) li.classList.add('rank-bronze');
    if (isLast) li.classList.add('rank-last');
  }
}

function render() {
  updateTitle();
  const genericList = el('scoreboard-list');
  const duelBoard = el('seven-wonders-duel-scoreboard');
  const classicBoard = el('seven-wonders-classic-scoreboard');

  // Default to hiding all boards
  genericList.hidden = true;
  duelBoard.hidden = true;
  classicBoard.hidden = true;

  if (state.game === '7 Wonders Duel') {
    duelBoard.hidden = false;
    renderDuelScoreboard(duelBoard, state.players);
  } else if (state.game === '7 Wonders') {
    classicBoard.hidden = false;
    renderClassicScoreboard(classicBoard, state.players);
  }
  else {
    genericList.hidden = false;
    renderGenericList(genericList, state.players);
  }
}

function renderGenericList(list, players) {
  if (!list) return;
  list.innerHTML = '';
  if (!tpl) { console.error('Template not found'); return; }
  // Decide ordering: auto-sort (default true) or preserve state order
  const autoSort = (state['auto-sort'] === undefined) ? true : Boolean(state['auto-sort']);
  const sortedPlayers = autoSort ? [...players].sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name)) : [...players];
  // Compute ranks from a sorted copy (so ranks reflect scores even when autoSort is off)
  const sortedForRank = [...players].sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
  const ranksByName = Object.create(null);
  let lastRank = 0;
  for (let i = 0; i < sortedForRank.length; i++) {
    if (i === 0) lastRank = 1;
    else lastRank = (sortedForRank[i].score === sortedForRank[i - 1].score) ? lastRank : i + 1;
    ranksByName[sortedForRank[i].name] = lastRank;
  }
  const maxRank = sortedForRank.length ? ranksByName[sortedForRank[sortedForRank.length - 1].name] : 1;

  sortedPlayers.forEach((p, idx) => {
    const rank = ranksByName[p.name] || 1;
    const node = tpl.content.cloneNode(true);
    const li = node.querySelector('.score-item');
    if (!li) return;
    li.dataset.name = p.name;
    const nameEl = li.querySelector('.score-name');
    const valueEl = li.querySelector('.score-value');
    if (nameEl) nameEl.textContent = p.name;
    if (valueEl) valueEl.textContent = p.score;
    // apply ranking classes
    applyRankClasses(li, p.score, rank, MARK_LAST && rank === maxRank && players.length > 1);
    list.appendChild(node);
  });
}

function recalculateDuelScore(player) {
  if (!player || !player['play-details']) return;
  let total = 0;
  for (const categoryName in DUEL_CATEGORIES) {
    const category = DUEL_CATEGORIES[categoryName];
    const value = Number(player['play-details'][category] || 0);
    if (category === 'money-coins') {
      total += Math.floor(value / 3);
    } else {
      total += value;
    }
  }
  player.score = total;
}

function renderDuelScoreboard(container, players) {
  if (!container) return;

  const scores = players.map(p => p.score);
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  // Update player names
  players.forEach((p, i) => {
    const nameEl = container.querySelector(`span[data-player-index="${i}"][data-type="name"]`);
    if (nameEl) {
      nameEl.textContent = p.name;
      if (p.score === maxScore && maxScore > 0) {
        nameEl.classList.add('highest-score');
      } else {
        nameEl.classList.remove('highest-score');
      }
    }
  });

  // Update sub-scores
  for (const categoryName in DUEL_CATEGORIES) {
    const category = DUEL_CATEGORIES[categoryName];
    players.forEach((p, i) => {
      const scoreInput = container.querySelector(`counter-input[data-player-index="${i}"][data-category="${category}"]`);
      if (scoreInput) scoreInput.value = p['play-details'][category] || 0;
    });
  }

  // Update total scores
  players.forEach((p, i) => {
    const sumEl = container.querySelector(`span[data-player-index="${i}"][data-type="sum"]`);
    if (sumEl) {
      sumEl.textContent = p.score;
      if (p.score === maxScore && maxScore > 0) {
        sumEl.classList.add('highest-score');
      } else {
        sumEl.classList.remove('highest-score');
      }
    }
  });
}

function recalculateClassicScore(player) {
  if (!player || !player['play-details']) return;
  let total = 0;
  for (const categoryName in CLASSIC_CATEGORIES) {
    const category = CLASSIC_CATEGORIES[categoryName];
    const value = Number(player['play-details'][category] || 0);
    if (category === 'money-coins') {
      total += Math.floor(value / 3);
    } else {
      total += value;
    }
  }
  player.score = total;
}

function renderClassicScoreboard(container, players) {
  if (!container) return;

  container.style.setProperty('--player-count', players.length);
  // Determine highest score (support ties)
  const scores = players.map(p => Number(p && p.score) || 0);
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  // Update player names and mark highest-score
  for (let i = 0; i < 7; i++) {
    const nameEl = container.querySelector(`span[data-player-index="${i}"][data-type="name"]`);
    const player = players[i];
    if (nameEl) {
      nameEl.textContent = player ? player.name : '';
      nameEl.style.display = i < players.length ? '' : 'none';
      if (player && Number(player.score) === maxScore && maxScore > 0) nameEl.classList.add('highest-score'); else nameEl.classList.remove('highest-score');
    }
  }

  // Update sub-scores
  for (const categoryName in CLASSIC_CATEGORIES) {
    const category = CLASSIC_CATEGORIES[categoryName];
    for (let i = 0; i < 7; i++) {
      const scoreInput = container.querySelector(`counter-input[data-player-index="${i}"][data-category="${category}"]`);
      if (scoreInput) {
        scoreInput.value = (players[i] && players[i]['play-details']) ? (players[i]['play-details'][category] || 0) : 0;
        scoreInput.style.display = i < players.length ? '' : 'none';
      }
    }
  }

  // Update total scores and mark highest-score
  for (let i = 0; i < 7; i++) {
    const sumEl = container.querySelector(`span[data-player-index="${i}"][data-type="sum"]`);
    const player = players[i];
    if (sumEl) {
      sumEl.textContent = player ? player.score : 0;
      sumEl.style.display = i < players.length ? '' : 'none';
      if (player && Number(player.score) === maxScore && maxScore > 0) sumEl.classList.add('highest-score'); else sumEl.classList.remove('highest-score');
    }
  }
}

// # Implementation Support

function changeScore(name, delta) {
  const p = getPlayer(name);
  if (!p) return;
  // prevent negative scores
  p.score = Math.max(0, p.score + delta);
  saveAndRender();
}

// # Public API functions (for external, programmatic usage)

export function setPlayers(names) {
  // Remove duplicates while preserving order
  const seen = new Set();
  state.players = names.map(n => ({ name: n.trim(), score: 0, 'play-details': {} })).filter(p => p.name.length).filter(p => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
  saveAndRender();
}

export function setScore(name, value) {
  const p = getPlayer(name);
  if (!p) return;
  p.score = Math.max(0, value);
  saveAndRender();
}

// Expose public API for external scripts/console
if (typeof window !== 'undefined') {
  window.scoreboard = { setPlayers, setScore };
}

// # Initialization functions

async function saveToCloud() {
  const btn = el('save-to-cloud');
  if (!btn) return;
  btn.disabled = true;
  try {
    const exportObj = createStateObject('ongoing', true);
    const response = await fetch(CLOUD_SAVE_URL, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(exportObj, null, 2),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });
    const result = await response.json();
    if (result.status !== 'success') {
      throw new Error(result.message || 'Unknown error');
    }
    console.log('State saved to cloud!');
  }
  catch (error) {
    console.error('Failed to save state to cloud:', error);
  }
  finally {
    btn.disabled = false;
  }
}

async function saveFinishedGameToCloud() {
  try {
    const exportObj = createStateObject('finished');
    const response = await fetch(CLOUD_SAVE_URL, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(exportObj, null, 2),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });
    const result = await response.json();
    if (result.status !== 'success') {
      throw new Error(result.message || 'Unknown error');
    }
    console.log('Finished game state saved to cloud!');
  }
  catch (error) {
    console.error('Failed to save finished game state to cloud:', error);
  }
}

async function loadFromCloud() {
  const btn = el('load-from-cloud');
  if (!btn) return;
  btn.disabled = true;
  try {
    const response = await fetch(CLOUD_SAVE_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const parsed = await response.json();
    if (loadStateObject(parsed)) {
      saveAndRender();
      console.log('State loaded from cloud!');
    }
    else {
      console.error('Failed to load state from cloud');
    }
  }
  catch (error) {
    console.error('Failed to load state from cloud:', error);
  }
  finally {
    btn.disabled = false;
  }
}

function initCloudSave() {
  const saveBtn = el('save-to-cloud');
  const loadBtn = el('load-from-cloud');
  if (saveBtn) saveBtn.addEventListener('click', saveToCloud);
  if (loadBtn) loadBtn.addEventListener('click', loadFromCloud);
}

function initSettings() {
  const btn = el('auto-sort-toggle');
  if (!btn) return;
  // ensure state['auto-sort'] exists (default true)
  if (typeof state['auto-sort'] === 'undefined') state['auto-sort'] = true;
  const setUI = () => {
    const on = Boolean(state['auto-sort']);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('active', on);
  };
  setUI();
  btn.addEventListener('click', () => {
    state['auto-sort'] = !Boolean(state['auto-sort']);
    save();
    setUI();
    render();
  });
}

function initSidebar() {
  const sidebar = el('app-sidebar');
  const sidebarToggle = el('sidebar-toggle') || el('header-toggle');
  if (!sidebar || !sidebarToggle) return;
  const icon = sidebarToggle.querySelector('i');
  const setState = (expanded) => {
    sidebarToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    sidebar.classList.toggle('collapsed', !expanded);
    sidebar.classList.toggle('expanded', expanded);
    sidebarToggle.classList.toggle('expanded', expanded);
    if (icon) {
      if (expanded) { icon.classList.remove('fa-bars'); icon.classList.add('fa-xmark'); }
      else { icon.classList.remove('fa-xmark'); icon.classList.add('fa-bars'); }
    }
  };
  setState(!sidebar.classList.contains('collapsed'));
  sidebarToggle.addEventListener('click', () => {
    const nowExpanded = sidebar.classList.contains('collapsed');
    setState(nowExpanded);
    sidebar.setAttribute('data-expanded', String(nowExpanded));
  });
  // Close the sidebar when any action button inside it is clicked
  const actionsContainer = sidebar.querySelector('.sidebar-actions');
  if (actionsContainer) {
    actionsContainer.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button');
      if (btn) {
        setState(false);
        sidebar.setAttribute('data-expanded', 'false');
      }
    });
  }
}

function initImportExport() {
  const resetBtn = el('scoreboard-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    // Reset only the scores for existing players; preserve player list and other settings
    if (state.players && Array.isArray(state.players)) {
      state.players.forEach(p => {
        if (p && typeof p === 'object') {
          p.score = 0;
          if (p['play-details']) {
            for (const key in p['play-details']) {
              p['play-details'][key] = 0;
            }
          }
        }
      });
      saveAndRender();
    }
  });

  const exportBtn = el('export-json');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const exportObj = createStateObject(state.status, false);
    const data = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'scoreboard.json'; a.click(); URL.revokeObjectURL(url);
  });

  const importBtn = el('import-json');
  if (importBtn) importBtn.addEventListener('click', () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json';
    input.onchange = () => {
      const f = input.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(r.result);
          if (loadStateObject(parsed)) {
            el('new-game-section').hidden = true;
            el('config-editor').hidden = true;
            saveAndRender();
          }
          else {
            console.error('Failed to import state from JSON file');
          }
        }
        catch (e) {
          console.error('Failed to import state from JSON file: ' + e.message || 'Unknown error');
        }
      };
      r.readAsText(f);
    };
    input.click();
  });
}

// # Configuration editor (opens JSON editor replacing participant list)
function enterConfigureMode() {
  if (_isConfiguring) return;
  const list = el('scoreboard-list');
  const duelBoard = el('seven-wonders-duel-scoreboard');
  const classicBoard = el('seven-wonders-classic-scoreboard');
  const editor = el('config-editor');
  const ta = el('config-textarea');
  if (!list || !editor || !ta) return;
  _isConfiguring = true;
  // Populate textarea with current configuration
  const exportObj = getConfigurationObject();
  ta.value = JSON.stringify(exportObj, null, 2);
  // Hide the scoreboards and show the editor
  list.setAttribute('hidden', '');
  duelBoard.setAttribute('hidden', '');
  classicBoard.setAttribute('hidden', '');
  editor.removeAttribute('hidden');
  // Wire up buttons (idempotent)
  const discard = el('config-discard');
  const save = el('config-save');
  if (discard) {
    discard.onclick = () => {
      _isConfiguring = false;
      editor.setAttribute('hidden', '');
      render(); // re-render to show correct board
    };
  }
  if (save) {
    save.onclick = () => {
      try {
        const parsed = JSON.parse(ta.value);
        if (loadStateObject(parsed)) {
          saveAndRender();
          _isConfiguring = false;
          editor.setAttribute('hidden', '');
        }
        else {
          console.error('Invalid configuration JSON: missing players array');
        }
      }
      catch (e) {
        console.error('Invalid configuration JSON: ' + e.message);
      }
    };
  }
}

function initConfigure() {
  const btn = el('configure-json');
  if (!btn) return;
  btn.addEventListener('click', () => enterConfigureMode());
}

function initListControls() {
  const list = el('scoreboard-list');
  if (list) {
    list.addEventListener('click', (ev) => {
      const inc = ev.target.closest('.increase');
      const dec = ev.target.closest('.decrease');
      const item = ev.target.closest('.score-item');
      if (!item) return;
      const name = item.dataset.name;
      if (inc) { changeScore(name, +1); }
      else if (dec) { changeScore(name, -1); }
    });
  }

  const duelBoard = el('seven-wonders-duel-scoreboard');
  if (duelBoard) {
    duelBoard.addEventListener('change', (ev) => {
      const target = ev.target;
      if (target.matches('counter-input')) {
        const playerIndex = target.dataset.playerIndex;
        const category = target.dataset.category;
        const value = Number(target.value);
        if (state.players[playerIndex] && state.players[playerIndex]['play-details']) {
          state.players[playerIndex]['play-details'][category] = value;
          recalculateDuelScore(state.players[playerIndex]);
          saveAndRender();
        }
      }
    });
  }

  const classicBoard = el('seven-wonders-classic-scoreboard');
  if (classicBoard) {
    classicBoard.addEventListener('change', (ev) => {
      const target = ev.target;
      if (target.matches('counter-input')) {
        const playerIndex = target.dataset.playerIndex;
        const category = target.dataset.category;
        const value = Number(target.value);
        if (state.players[playerIndex] && state.players[playerIndex]['play-details']) {
            state.players[playerIndex]['play-details'][category] = value;
            recalculateClassicScore(state.players[playerIndex]);
            saveAndRender();
        }
      }
    });
  }
}

function initFinishGame() {
  const btn = el('finish-game');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!state.players || state.players.length === 0) return;
    const scores = state.players.map(p => Number(p.score) || 0);
    const max = Math.max(...scores);
    const winners = state.players.filter(p => (Number(p.score) || 0) === max).map(p => p.name);
    let msg = '';
    if (winners.length === 1) msg = winners[0] + ' Has Won!';
    else if (winners.length === 2) msg = winners[0] + ' and ' + winners[1] + ' Have All Won!';
    else msg = winners.slice(0, -1).join(', ') + ' and ' + winners[winners.length - 1] + ' Have All Won!';
    // choose configured celebration link (support placeholder {{MESSAGE}})
    const cfg = state.celebrationLink || DEFAULT_CELEBRATION_LINK;
    const encoded = encodeURIComponent(msg);
    let finalUrl = cfg;
    if (cfg && cfg.indexOf('{{MESSAGE}}') !== -1) {
      finalUrl = cfg.split('{{MESSAGE}}').join(encoded);
    } else {
      // append message to end of URL; if URL already has query params add '&' otherwise add '?'
      if (cfg && cfg.length) {
        const sep = cfg.indexOf('?') !== -1 ? '&' : '?';
        finalUrl = cfg + sep + encoded;
      } else {
        finalUrl = 'celebration.html?s=10&msg=' + encoded;
      }
    }
    await saveFinishedGameToCloud();
    window.open(finalUrl, '_blank', 'noopener');
  });
}

function initNewGame() {
  const newGameBtn = el('new-game');
  const newGameSection = el('new-game-section');
  const scoreboardList = el('scoreboard-list');
  const configEditor = el('config-editor');

  if (!newGameBtn || !newGameSection) return;

  const newGameDiscardBtn = el('new-game-discard');
  const newGameCreateBtn = el('new-game-create');
  const gameTypeRadios = document.querySelectorAll('input[name="game-type"]');
  const genericSettings = el('generic-game-settings');
  const duelSettings = el('duel-game-settings');
  const classicSettings = el('classic-game-settings');

  newGameBtn.addEventListener('click', () => {
    newGameSection.hidden = false;
    scoreboardList.hidden = true;
    configEditor.hidden = true;
    el('seven-wonders-duel-scoreboard').hidden = true;
    el('seven-wonders-classic-scoreboard').hidden = true;
  });

  newGameDiscardBtn.addEventListener('click', () => {
    newGameSection.hidden = true;
    render(); // Re-render to show correct board
  });

  gameTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      genericSettings.hidden = radio.value !== 'generic';
      duelSettings.hidden = radio.value !== 'duel';
      classicSettings.hidden = radio.value !== 'classic';
    });
  });

  newGameCreateBtn.addEventListener('click', () => {
    const selectedType = document.querySelector('input[name="game-type"]:checked').value;

    if (selectedType === 'generic') {
      const gameName = el('game-name').value || 'Generic Game';
      const numPlayers = parseInt(el('generic-players').value, 10);
      const players = [];
      for (let i = 0; i < numPlayers; i++) {
        players.push({ name: `Player ${i + 1}`, score: 0, 'play-details': {} });
      }
      state.game = gameName;
      state.players = players;
    } else if (selectedType === 'duel') {
      state.game = '7 Wonders Duel';
      const playDetails = {};
      for (const categoryName in DUEL_CATEGORIES) {
        playDetails[DUEL_CATEGORIES[categoryName]] = 0;
      }
      state.players = [
        { name: 'Player 1', score: 0, 'play-details': { ...playDetails } },
        { name: 'Player 2', score: 0, 'play-details': { ...playDetails } }
      ];
    } else if (selectedType === 'classic') {
      state.game = '7 Wonders';
      const numPlayers = parseInt(el('classic-players').value, 10);
      const playDetails = {};
      for(const categoryName in CLASSIC_CATEGORIES) {
        playDetails[CLASSIC_CATEGORIES[categoryName]] = 0;
      }
      state.players = [];
      for (let i = 0; i < numPlayers; i++) {
        state.players.push({ name: `Player ${i+1}`, score: 0, 'play-details': {...playDetails} });
      }
    }

    newGameSection.hidden = true;
    saveAndRender();
  });
}

// # Event handlers

document.addEventListener('DOMContentLoaded', () => {
  tpl = document.getElementById('score-item-template');
  load();
  if (!state.players || state.players.length === 0) {
    state.players = DEFAULT_NAMES.map(n => ({ name: n, score: 0, 'play-details': {} }));
    // ensure default celebration link exists
    if (typeof state.celebrationLink === 'undefined') state.celebrationLink = DEFAULT_CELEBRATION_LINK;
    save();
  }
  // if state exists but lacks celebrationLink, ensure default
  if (typeof state.celebrationLink === 'undefined') state.celebrationLink = DEFAULT_CELEBRATION_LINK;

  render();
  initSidebar();
  initImportExport();
  initConfigure();
  initListControls();
  initSettings();
  initFinishGame();
  initCloudSave();
  initNewGame();
});