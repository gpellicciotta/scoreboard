import './counter-input.mjs';

// Constants
const APP_NAME = 'scoreboard';
const APP_VERSION = `1.2.0`
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
  "game": "",
  "play-date": null,
  "status": "ongoing",
  "auto-sort": DEFAULT_AUTO_SORT,
  "celebration-link": DEFAULT_CELEBRATION_LINK,
  "players": DEFAULT_NAMES.map(n => ({ name: n, score: 0, 'play-details': {} }))
};
let tpl = null;
let _isConfiguring = false;
let _listControlsInit = false;
let _finishedGamesCache = []; // cached array of { fileName, data, date, gameName, winners }

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
      if (i === 0) {
        lastRank = 1;
      }
      else {
        lastRank = (Number(sortedForRank[i].score) || 0) === (Number(sortedForRank[i - 1].score) || 0) ? lastRank : i + 1;
      }
      ranksByName[sortedForRank[i].name] = lastRank;
    }

    // Sort players so winners (rank 1) appear first, then by rank, then score/name
    const sortedPlayers = [...exportObj.players].slice().sort((a, b) => {
      const ra = ranksByName[a.name] || Infinity;
      const rb = ranksByName[b.name] || Infinity;
      if (ra !== rb) return ra - rb; // Lower rank (1) first
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

// Simple view manager: mount templates into `app-content` and show/hide default views
const appContent = () => el('app-content');
const appToolbar = () => el('app-toolbar');
const defaultViews = () => el('default-view');

function showView(templateId, onMount) {
  const app = appContent();
  const tpl = document.getElementById(templateId);
  if (!app || !tpl) {
    return null;
  }
  // Hide default views
  const def = defaultViews();
  if (def) {
    def.hidden = true;
  }
  // Remove existing mounted view
  const existing = document.getElementById('mounted-view');
  if (existing) existing.remove();
  // Mount new view
  const mount = document.createElement('div');
  mount.id = 'mounted-view';
  mount.appendChild(tpl.content.cloneNode(true));
  app.appendChild(mount);
  // Transfer toolbar content into app-toolbar (which lives in header)
  const toolbar = mount.querySelector('.view-toolbar');
  const toolbarHost = appToolbar();
  if (toolbarHost) {
    toolbarHost.innerHTML = '';
  }
  if (toolbar && toolbarHost) {
    // Clone toolbar children so the persistent default view keeps its toolbar
    Array.from(toolbar.children).forEach(ch => toolbarHost.appendChild(ch.cloneNode(true)));
    // Remove the now-empty toolbar wrapper from the mounted view
    toolbar.remove();
  }


  // If the template provided a view-title, use it as the app title
  let viewTitle = mount.querySelector('.view-title');
  if (!viewTitle && toolbarHost) {
    viewTitle = toolbarHost.querySelector('.view-title');
  }
  if (viewTitle) {
    const titleEl = el('app-title');
    if (titleEl) {
      // For the generic scoreboard view, prepend the active game's name
      // followed by a space; otherwise use the view-title text alone.
      let titleText = viewTitle.textContent || '';
      if (templateId === 'tpl-generic' && state.game && String(state.game).trim().length) {
        titleText = String(state.game).trim() + ' ' + titleText;
      }
      titleEl.textContent = titleText;
    }
    // Remove the view-title element from the DOM so it isn't preserved
    // in the mounted view or toolbar; its text has been copied to the
    // header title and the element itself is no longer needed.
    viewTitle.remove();
  }
  if (typeof onMount === 'function') {
    onMount(mount);
  }
  return mount;
}

function closeView() {
  const mount = document.getElementById('mounted-view');
  if (mount) {
    mount.remove();
  }
  const toolbarHost = appToolbar();
  if (toolbarHost) {
    toolbarHost.innerHTML = '';
  }
  const def = defaultViews();
  if (def) {
    def.hidden = false;
    // If the default view provides a toolbar, move its children into the header toolbar
    try {
      const viewToolbar = def.querySelector && def.querySelector('.view-toolbar');
      if (viewToolbar && toolbarHost) {
        // Clone toolbar children so the persistent default view keeps its toolbar
        Array.from(viewToolbar.children).forEach(ch => toolbarHost.appendChild(ch.cloneNode(true)));
      }
    }
    catch (e) { }
  }
  // Restore title based on current state
  updateTitle();
  render();
}

function save() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }
  catch (e) {
    console.warn('Failed to save', e)
  }
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

function changeScore(name, delta) {
  const p = getPlayer(name);
  if (!p) return;
  // Prevent negative scores
  p.score = Math.max(0, p.score + delta);
  saveAndRender();
}

// # Rendering / ranking

function updateTitle() {
  const titleEl = el('app-title');
  if (!titleEl) {
    return;
  }
  // If the default view is visible and provides a view-title, prefer that
  const def = defaultViews();
  if (def && !def.hidden) {
    const viewTitle = def.querySelector && def.querySelector('.view-title');
    if (viewTitle && viewTitle.textContent && viewTitle.textContent.trim().length) {
      titleEl.textContent = viewTitle.textContent.trim();
      return;
    }
  }
  if (state.game && state.game.trim().length > 0) {
    titleEl.textContent = `${state.game} Scores`;
  }
  else {
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
  if (_isConfiguring) return;
  updateTitle();
  // Choose appropriate template based on current game
  const game = state.game || '';
  if (game === '7 Wonders Duel') {
    showView('tpl-duel', (mount) => {
      const container = mount.querySelector('#seven-wonders-duel-scoreboard');
      renderDuelScoreboard(container, state.players || []);
    });
  }
  else if (game === '7 Wonders') {
    showView('tpl-classic', (mount) => {
      const container = mount.querySelector('#seven-wonders-classic-scoreboard');
      renderClassicScoreboard(container, state.players || []);
    });
  }
  else {
    showView('tpl-generic', (mount) => {
      const list = mount.querySelector('#scoreboard-list');
      // Render generic list: reuse existing rendering logic
      if (list && tpl) {
        list.innerHTML = '';
        // Compute ranks taking ties into account so we can style top-3
        const sorted = [...state.players].slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || a.name.localeCompare(b.name));
        const ranksByName = Object.create(null);
        let lastRank = 0;
        for (let i = 0; i < sorted.length; i++) {
          if (i === 0) lastRank = 1; else lastRank = (Number(sorted[i].score) || 0) === (Number(sorted[i - 1].score) || 0) ? lastRank : i + 1;
          ranksByName[sorted[i].name] = lastRank;
        }
        const isLastByName = {};
        if (MARK_LAST && state.players.length) {
          const minScore = Math.min(...state.players.map(p => Number(p.score) || 0));
          state.players.filter(p => (Number(p.score) || 0) === minScore).forEach(p => { isLastByName[p.name] = true; });
        }

        // If auto-sort is enabled, render the sorted list; otherwise preserve insertion order
        const renderPlayers = Boolean(state['auto-sort']) ? sorted : state.players;

        renderPlayers.forEach(p => {
          const node = tpl.content.cloneNode(true);
          const li = node.querySelector('.score-item');
          if (!li) return;
          li.dataset.name = p.name;
          const nameEl = li.querySelector('.score-name');
          const valueEl = li.querySelector('.score-value');
          if (nameEl) nameEl.textContent = p.name;
          if (valueEl) valueEl.textContent = p.score;
          // Apply rank classes
          const rank = ranksByName[p.name] || null;
          applyRankClasses(li, Number(p.score) || 0, rank, Boolean(isLastByName[p.name]));
          list.appendChild(node);
        });
      }
    });
  }
}

function recalculateDuelScore(player) {
  if (!player || !player['play-details']) return;
  // Immediate victory indicated by `victory-type` in play-details
  const vt = String(player['play-details']['victory-type'] || '').toLowerCase();
  if (vt === 'military domination' || vt === 'scientific domination') {
    player.score = 1000;
    return;
  }
  let total = 0;
  for (const categoryName in DUEL_CATEGORIES) {
    const category = DUEL_CATEGORIES[categoryName];
    const value = Number(player['play-details'][category] || 0);
    if (category === 'money-coins') {
      total += Math.floor(value / 3);
    }
    else {
      total += value;
    }
  }
  player.score = total;
}

function renderDuelScoreboard(container, players) {
  if (!container) return;

  console.log("rendering dual scoreboard");
  const scores = players.map(p => p.score);
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  // Update player names
  players.forEach((p, i) => {
    // select the element that represents the name by attribute (tag may vary)
    const nameHost = container.querySelector(`[data-player-index="${i}"][data-type="name"]`);
    if (nameHost) {
      // Find the inner span used for the visible name, if present
      const nameSpan = nameHost.querySelector('span') || nameHost;
      // Set the displayed name without disturbing sibling icons/images
      nameSpan.textContent = p.name;
      // Determine victory-type: icons + column classes handle visuals
      const vt = (p['play-details'] && p['play-details']['victory-type']) ? String(p['play-details']['victory-type']) : '';
      if (p.score === maxScore && maxScore > 0) {
        nameSpan.classList.add('highest-score');
      }
      else {
        nameSpan.classList.remove('highest-score');
      }
      // Ensure the player column reflects any immediate victory via CSS class
      const playerCol = container.querySelector(`.col.player[data-player-index="${i}"]`);
      if (playerCol) {
        playerCol.classList.toggle('military-victory', vt === 'military domination');
        playerCol.classList.toggle('scientific-victory', vt === 'scientific domination');
        // remove both classes when normal points
        if (vt === 'points' || !vt) {
          playerCol.classList.remove('military-victory');
          playerCol.classList.remove('scientific-victory');
        }
      }
    }
  });

  // Update sub-scores
  for (const categoryName in DUEL_CATEGORIES) {
    const category = DUEL_CATEGORIES[categoryName];
    players.forEach((p, i) => {
      const scoreInput = container.querySelector(`counter-input[data-player-index="${i}"][data-category="${category}"]`);
      if (scoreInput) scoreInput.value = p['play-details'][category] || 0;
      // Update victory toggle state for inputs that represent military/science
      if (category === 'military' || category === 'green-coins') {
        const victoryKind = category === 'military' ? 'military domination' : 'scientific domination';
        const btn = container.querySelector(`button.duel-victory-toggle[data-player-index="${i}"][data-victory="${category === 'military' ? 'military' : 'science'}"]`);
        if (btn) {
          const vt = (p['play-details'] && p['play-details']['victory-type']) ? String(p['play-details']['victory-type']) : 'points';
          if (vt === victoryKind) btn.classList.add('active'); else btn.classList.remove('active');
        }
      }
    });
  }

  // Update total scores
  players.forEach((p, i) => {
    const sumHost = container.querySelector(`[data-player-index="${i}"][data-type="sum"]`);
    if (sumHost) {
      const sumEl = sumHost.querySelector('span') || sumHost;
      const pd = p['play-details'] || p.playDetails || {};
      const isImmediate = pd['victory-type'] === 'military domination' || pd['victory-type'] === 'scientific domination';
      // Show infinity sign for immediate victories; underlying score remains numeric (e.g., 1000) for ranking
      sumEl.textContent = isImmediate ? '∞' : String(p.score);
      if (p.score === maxScore && maxScore > 0) {
        sumEl.classList.add('highest-score');
      }
      else {
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
    }
    else {
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
    const nameHost = container.querySelector(`[data-player-index="${i}"][data-type="name"]`);
    const player = players[i];
    if (nameHost) {
      const nameSpan = nameHost.querySelector('span') || nameHost;
      nameSpan.textContent = player ? player.name : '';
      nameSpan.style.display = i < players.length ? '' : 'none';
      if (player && Number(player.score) === maxScore && maxScore > 0) nameSpan.classList.add('highest-score'); else nameSpan.classList.remove('highest-score');
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
    const sumHost = container.querySelector(`[data-player-index="${i}"][data-type="sum"]`);
    const player = players[i];
    if (sumHost) {
      const sumEl = sumHost.querySelector('span') || sumHost;
      sumEl.textContent = player ? player.score : 0;
      sumEl.style.display = i < players.length ? '' : 'none';
      if (player && Number(player.score) === maxScore && maxScore > 0) sumEl.classList.add('highest-score'); else sumEl.classList.remove('highest-score');
    }
  }
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
  // Ensure state['auto-sort'] exists (default true)
  if (typeof state['auto-sort'] === 'undefined') {
    state['auto-sort'] = true;
  }
  const setUI = () => {
    const on = Boolean(state['auto-sort']);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('active', on);
    // Update visible label to reflect current behavior
    const label = btn.querySelector('.label');
    if (label) {
      label.textContent = on ? "Don't Auto-Sort" : 'Auto-sort';
    }
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
      if (expanded) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-xmark');
      }
      else {
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
      }
    }
  };
  setState(!sidebar.classList.contains('collapsed'));
  sidebarToggle.addEventListener('click', () => {
    const nowExpanded = sidebar.classList.contains('collapsed');
    setState(nowExpanded);
    sidebar.setAttribute('data-expanded', String(nowExpanded));
  });
  // Close the sidebar when any action button inside it is clicked
  // Actions container might now be the sidebar itself (classes moved to aside)
  const actionsContainer = (sidebar.matches && sidebar.matches('.sidebar-actions')) ? sidebar : sidebar.querySelector('.sidebar-actions');
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

function initTheme() {
  const themeToggle = el('theme-toggle');
  if (!themeToggle) return;
  // Determine preferred theme. Behavior:
  // - If a user selection ('light' or 'dark') is stored in localStorage under 'theme', use it.
  // - Otherwise follow the system preference (matchMedia). When following system preference,
  //   the UI will also update if the system preference changes.
  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  const getStoredPreference = () => localStorage.getItem('theme');

  // Set theme; when `persist` is true, update localStorage. When false, do not write (used for
  // following system preference without overwriting the user's stored choice).
  const setTheme = (theme, persist = false) => {
    document.body.dataset.theme = theme;
    if (persist) localStorage.setItem('theme', theme);
    const icon = themeToggle.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-sun', theme === 'light');
      icon.classList.toggle('fa-moon', theme === 'dark');
    }
    try { themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false'); } catch (e) { }
    const lbl = themeToggle.querySelector('.label');
    if (lbl) lbl.textContent = theme === 'dark' ? 'Use Light Theme' : 'Use Dark Theme';
  };

  // Toggle invoked by the user — persist their explicit choice.
  themeToggle.addEventListener('click', () => {
    const current = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
  });

  // Initialize: use stored preference if it is 'dark'|'light'. Otherwise follow system.
  const stored = getStoredPreference();
  if (stored === 'dark' || stored === 'light') {
    setTheme(stored, false);
  }
  else {
    // follow system preference initially (do not persist)
    setTheme(mq.matches ? 'dark' : 'light', false);
    // update theme on system changes only when no explicit user preference exists
    const onPrefChange = (e) => {
      // re-check stored value; if now set, stop following system
      const nowStored = getStoredPreference();
      if (nowStored === 'dark' || nowStored === 'light') return;
      setTheme(e.matches ? 'dark' : 'light', false);
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onPrefChange);
    }
    else if (typeof mq.addListener === 'function') {
      mq.addListener(onPrefChange);
    }
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
            // Persist imported state then close any mounted view (closeView triggers render)
            save();
            try { closeView(); } catch (e) { }
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
  showView('tpl-config-editor', (mount) => {
    _isConfiguring = true;
    const content = mount.querySelector('.view-content');
    if (!content) return;
    const ta = content.querySelector('#config-textarea');
    // Buttons may be moved into the header's app-toolbar by showView();
    const discard = content.querySelector('#config-discard') || (appToolbar() && appToolbar().querySelector('#config-discard'));
    const save = content.querySelector('#config-save') || (appToolbar() && appToolbar().querySelector('#config-save'));
    if (!ta) return;
    // Populate textarea with current configuration
    ta.value = JSON.stringify(getConfigurationObject(), null, 2);
    if (discard) discard.onclick = () => { _isConfiguring = false; closeView(); };
    if (save) save.onclick = () => {
      try {
        const parsed = JSON.parse(ta.value);
        if (loadStateObject(parsed)) {
          saveAndRender();
          _isConfiguring = false;
          closeView();
        }
        else {
          console.error('Invalid configuration JSON: missing players array');
        }
      }
      catch (e) {
        console.error('Invalid configuration JSON: ' + e.message);
      }
    };
  });
}

function initConfigure() {
  const btn = el('configure-json');
  if (!btn) return;
  btn.addEventListener('click', () => enterConfigureMode());
}

function initListControls() {
  if (_listControlsInit) return;
  _listControlsInit = true;

  // Delegate clicks for increase/decrease on generic list
  document.addEventListener('click', (ev) => {
    const inc = ev.target.closest('.increase');
    const dec = ev.target.closest('.decrease');
    const item = ev.target.closest('.score-item');
    if (!item) return;
    const name = item.dataset.name;
    if (inc) { changeScore(name, +1); }
    else if (dec) { changeScore(name, -1); }
  });

  // Delegate clicks for duel victory toggles (if present)
  document.addEventListener('click', (ev) => {
    const duelToggle = ev.target.closest('.duel-victory-toggle');
    if (!duelToggle) return;
    const pidx = Number(duelToggle.dataset.playerIndex);
    const victoryKind = String(duelToggle.dataset.victory || '').toLowerCase();
    if (Number.isNaN(pidx) || !state.players || !state.players[pidx]) return;
    if (!state.players[pidx]['play-details']) state.players[pidx]['play-details'] = {};
    const pd = state.players[pidx]['play-details'];
    const current = String(pd['victory-type'] || 'points');
    const target = (victoryKind === 'military') ? 'military domination' : 'scientific domination';
    if (current === target) {
      // deactivate -> revert this player to points
      pd['victory-type'] = 'points';
    } else {
      // Activating a victory: first clear any existing victory markers from ALL players
      state.players.forEach((other) => {
        if (!other['play-details']) other['play-details'] = {};
        other['play-details']['victory-type'] = 'points';
      });
      // Then set the selected player's victory-type
      pd['victory-type'] = target;
    }
    // Recalculate scores for all players (activation may affect others)
    state.players.forEach(pl => recalculateDuelScore(pl));
    saveAndRender();
  });

  // Delegate change events for any counter-input across mounted views
  document.addEventListener('change', (ev) => {
    const target = ev.target;
    if (!target || !target.matches('counter-input')) return;
    const playerIndex = Number(target.dataset.playerIndex);
    const category = target.dataset.category;
    const value = Number(target.value);
    if (Number.isNaN(playerIndex) || !category) return;
    if (!state.players[playerIndex]) return;
    // ensure play-details object
    if (!state.players[playerIndex]['play-details']) state.players[playerIndex]['play-details'] = {};
    state.players[playerIndex]['play-details'][category] = value;
    // Recalculate according to which category set
    if (Object.values(DUEL_CATEGORIES).includes(category)) recalculateDuelScore(state.players[playerIndex]);
    if (Object.values(CLASSIC_CATEGORIES).includes(category)) recalculateClassicScore(state.players[playerIndex]);
    saveAndRender();
  });
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
    // Choose configured celebration link (support placeholder {{MESSAGE}})
    const cfg = state.celebrationLink || DEFAULT_CELEBRATION_LINK;
    const encoded = encodeURIComponent(msg);
    let finalUrl = cfg;
    if (cfg && cfg.indexOf('{{MESSAGE}}') !== -1) {
      finalUrl = cfg.split('{{MESSAGE}}').join(encoded);
    }
    else {
      // Append message to end of URL; if URL already has query params add '&' otherwise add '?'
      if (cfg && cfg.length) {
        const sep = cfg.indexOf('?') !== -1 ? '&' : '?';
        finalUrl = cfg + sep + encoded;
      }
      else {
        finalUrl = 'celebration.html?s=10&msg=' + encoded;
      }
    }
    await saveFinishedGameToCloud();
    window.open(finalUrl, '_blank', 'noopener');
  });
}

function initNewGame() {
  const newGameBtn = el('new-game');
  if (!newGameBtn) return;
  newGameBtn.addEventListener('click', () => {
    showView('tpl-new-game', (mount) => {
      const content = mount.querySelector('.view-content');
      if (!content) return;
      // Buttons may be moved into the header's app-toolbar by showView();
      const newGameDiscardBtn = content.querySelector('#new-game-discard') || (appToolbar() && appToolbar().querySelector('#new-game-discard'));
      const newGameCreateBtn = content.querySelector('#new-game-create') || (appToolbar() && appToolbar().querySelector('#new-game-create'));
      const gameTypeRadios = content.querySelectorAll('input[name="game-type"]');
      const genericSettings = content.querySelector('#generic-game-settings');
      const duelSettings = content.querySelector('#duel-game-settings');
      const classicSettings = content.querySelector('#classic-game-settings');

      if (newGameDiscardBtn) newGameDiscardBtn.addEventListener('click', () => { closeView(); });

      gameTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
          genericSettings.hidden = radio.value !== 'generic';
          duelSettings.hidden = radio.value !== 'duel';
          classicSettings.hidden = radio.value !== 'classic';
        });
      });

      if (newGameCreateBtn) newGameCreateBtn.addEventListener('click', () => {
        const selectedType = content.querySelector('input[name="game-type"]:checked').value;

        if (selectedType === 'generic') {
          const gameName = (content.querySelector('#game-name') && content.querySelector('#game-name').value) || 'Generic Game';
          const numPlayers = parseInt((content.querySelector('#generic-players') && content.querySelector('#generic-players').value) || 2, 10);
          const players = [];
          for (let i = 0; i < numPlayers; i++) players.push({ name: `Player ${i + 1}`, score: 0, 'play-details': {} });
          state.game = gameName;
          state.players = players;
        }
        else if (selectedType === 'duel') {
          state.game = '7 Wonders Duel';
          const playDetails = {};
          for (const categoryName in DUEL_CATEGORIES) playDetails[DUEL_CATEGORIES[categoryName]] = 0;
          state.players = [{ name: 'Player 1', score: 0, 'play-details': { ...playDetails } }, { name: 'Player 2', score: 0, 'play-details': { ...playDetails } }];
        }
        else if (selectedType === 'classic') {
          state.game = '7 Wonders';
          const numPlayers = parseInt((content.querySelector('#classic-players') && content.querySelector('#classic-players').value) || 3, 10);
          const playDetails = {};
          for (const categoryName in CLASSIC_CATEGORIES) playDetails[CLASSIC_CATEGORIES[categoryName]] = 0;
          state.players = [];
          for (let i = 0; i < numPlayers; i++) {
            state.players.push({ name: `Player ${i + 1}`, score: 0, 'play-details': { ...playDetails } });
          }
        }
        // Persist state then close the new-game view which will trigger render
        save();
        closeView();
      });
    });
  });
}

// # Event handlers

document.addEventListener('DOMContentLoaded', () => {
  tpl = document.getElementById('score-item-template');
  const hasSavedState = Boolean(localStorage.getItem(LOCAL_STORAGE_KEY));
  load();
  if (!state.players || state.players.length === 0) {
    state.players = DEFAULT_NAMES.map(n => ({ name: n, score: 0, 'play-details': {} }));
    // Ensure default celebration link exists
    if (typeof state.celebrationLink === 'undefined') {
      state.celebrationLink = DEFAULT_CELEBRATION_LINK;
    }
    save();
  }
  // If state exists but lacks celebrationLink, ensure default
  if (typeof state.celebrationLink === 'undefined') {
    state.celebrationLink = DEFAULT_CELEBRATION_LINK;
  }
  // If there is saved state, render it; otherwise keep the welcome/default view
  if (hasSavedState) {
    render();
  }
  else {
    // If no saved state, copy default view toolbar into the app toolbar
    const def = defaultViews();
    if (def) {
      const viewToolbar = def.querySelector('.view-toolbar');
      const toolbarHost = appToolbar();
      if (viewToolbar && toolbarHost) {
        toolbarHost.innerHTML = '';
        // Clone toolbar children so the persistent default view keeps its toolbar
        Array.from(viewToolbar.children).forEach(ch => toolbarHost.appendChild(ch.cloneNode(true)));
      }
    }
    // Ensure header title reflects the default view
    updateTitle();
  }
  initSidebar();
  initTheme();
  initImportExport();
  initConfigure();
  initListControls();
  initSettings();
  initFinishGame();
  initCloudSave();
  initNewGame();
  initFinishedGames();
});

// # Finished games viewer
async function fetchFinishedFiles() {
  try {
    const url = CLOUD_SAVE_URL + '?request=list';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Network error');
    const files = await resp.json();
    const fileList = Array.isArray(files) ? files : [];
    // Fetch each file's contents in parallel and build a metadata cache
    const promises = fileList.map(async (fileName) => {
      try {
        const data = await loadFinishedFile(fileName);
        const date = data && data['play-date'] ? new Date(data['play-date']) : null;
        const gameName = data && data.game ? data.game : 'Unknown game';
        let winners = [];
        if (data && Array.isArray(data.players)) {
          const scores = data.players.map(p => Number(p.score) || 0);
          const max = scores.length ? Math.max(...scores) : 0;
          winners = data.players.filter(p => (Number(p.score) || 0) === max).map(p => p.name);
        }
        return { fileName, data, date, gameName, winners };
      }
      catch (e) {
        console.warn('Failed to load finished file', fileName, e);
        return { fileName, data: null, date: null, gameName: 'Unknown', winners: [] };
      }
    });
    const results = await Promise.all(promises);
    // store cache sorted by date desc (fallback to filename)
    _finishedGamesCache = results.slice().sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      if (tb !== ta) return tb - ta;
      return b.fileName.localeCompare(a.fileName);
    });
    return _finishedGamesCache;
  }
  catch (e) {
    console.error('Failed to fetch finished files:', e);
    _finishedGamesCache = [];
    return [];
  }
}

async function loadFinishedFile(fileName) {
  try {
    const url = CLOUD_SAVE_URL + '?request=load&file=' + encodeURIComponent(fileName);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Network error');
    return await resp.json();
  }
  catch (e) {
    console.error('Failed to load finished file:', e);
    return null;
  }
}

function renderFinishedList(files, container) {
  if (!container) return;
  container.innerHTML = '';
  // Container panel (visual grouping only)
  const panel = document.createElement('div');
  panel.className = 'finished-games-panel';

  if (!files || files.length === 0) {
    const p = document.createElement('div'); p.textContent = 'No finished games found.'; panel.appendChild(p); container.appendChild(panel); return;
  }

  const table = document.createElement('table');
  table.className = 'finished-games-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Date (ISO)</th><th>Game</th><th>Winner</th><th>Actions</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  files.forEach((entry) => {
    const tr = document.createElement('tr');
    const dateCell = document.createElement('td');
    dateCell.textContent = entry.date ? entry.date.toISOString() : '';
    const gameCell = document.createElement('td');
    gameCell.textContent = entry.gameName || '';
    const winnerCell = document.createElement('td');
    if (entry.winners && entry.winners.length) {
      // Build DOM: winner name plus icon for victory-type when present
      for (let wi = 0; wi < entry.winners.length; wi++) {
        const w = entry.winners[wi];
        try {
          const player = entry.data && Array.isArray(entry.data.players) ? entry.data.players.find(p => p.name === w) : null;
          const vt = player && player['play-details'] && player['play-details']['victory-type'] ? player['play-details']['victory-type'] : (player && player.playDetails && player.playDetails['victory-type'] ? player.playDetails['victory-type'] : null);
          const span = document.createElement('span'); span.textContent = w;
          winnerCell.appendChild(span);
          if (vt === 'military domination' || vt === 'scientific domination') {
            const img = document.createElement('img');
            img.className = 'duel-victory-badge';
            img.alt = vt;
            img.title = (vt === 'military domination') ? 'Military Domination' : 'Scientific Domination';
            img.src = (vt === 'military domination') ? 'media/7-wonders-military-card.png' : 'media/7-wonders-green-coin-card.png';
            winnerCell.appendChild(img);
          }
          if (wi < entry.winners.length - 1) winnerCell.appendChild(document.createTextNode(', '));
        }
        catch (e) { winnerCell.appendChild(document.createTextNode(w + (wi < entry.winners.length - 1 ? ', ' : ''))); }
      }
    }
    else {
      winnerCell.textContent = '';
    }
    const actionCell = document.createElement('td');
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'View'; btn.className = 'view-finished-btn';
    // Prepare a details row that can be inserted after the entry row
    const detailsRow = document.createElement('tr');
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 4;
    detailsCell.className = 'finished-game-details-cell';
    detailsRow.appendChild(detailsCell);

    btn.addEventListener('click', async () => {
      // If already open, close it
      if (btn.dataset.open === 'true') {
        if (detailsRow.parentNode) detailsRow.parentNode.removeChild(detailsRow);
        btn.textContent = 'View';
        btn.dataset.open = '';
        return;
      }
      // Load data (use cache if available)
      const data = entry.data || await loadFinishedFile(entry.fileName);
      if (!data) return;
      // Build scoreboard content inside the details cell
      detailsCell.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'finished-game-scoreboard';
      const header = document.createElement('div');
      header.style.marginBottom = '0.5rem';
      header.textContent = `Finished: ${entry.gameName} — ${entry.date ? entry.date.toLocaleString() : ''}`;
      wrapper.appendChild(header);
      const players = Array.isArray(data.players) ? data.players : [];
      const listWrap = document.createElement('div');
      listWrap.className = 'finished-game-players';

      // Compute ranks (1-based) taking ties into account and sort so winners appear first
      const sorted = [...players].slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || a.name.localeCompare(b.name));
      const ranksByName = Object.create(null);
      let lastRank = 0;
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0) lastRank = 1; else lastRank = (Number(sorted[i].score) || 0) === (Number(sorted[i - 1].score) || 0) ? lastRank : i + 1;
        ranksByName[sorted[i].name] = lastRank;
      }
      const isLastByName = {};
      if (MARK_LAST && players.length) {
        const minScore = Math.min(...players.map(p => Number(p.score) || 0));
        players.filter(p => (Number(p.score) || 0) === minScore).forEach(p => { isLastByName[p.name] = true; });
      }

      // Render players in sorted order (winner first). Remove controls for finished games.
      sorted.forEach(p => {
        const node = tpl.content.cloneNode(true);
        const li = node.querySelector('.score-item');
        if (!li) return;
        // Remove interactive controls for finished-game view
        const controls = li.querySelector('.score-controls');
        if (controls && controls.parentNode) controls.parentNode.removeChild(controls);
        const nameEl = li.querySelector('.score-name');
        const valueEl = li.querySelector('.score-value');
        if (nameEl) {
          nameEl.textContent = p.name;
          // Show victory-type badge if present in finished game's play-details
          const pd = p['play-details'] || p.playDetails || {};
          if (pd['victory-type'] === 'military domination' || pd['victory-type'] === 'scientific domination') {
            const img = document.createElement('img');
            img.className = 'duel-victory-badge';
            img.alt = pd['victory-type'];
            img.title = pd['victory-type'] === 'military domination' ? 'Military Domination' : 'Scientific Domination';
            img.src = pd['victory-type'] === 'military domination' ? 'media/7-wonders-military-card.png' : 'media/7-wonders-green-coin-card.png';
            nameEl.parentNode.insertBefore(img, nameEl.nextSibling);
          }
        }
        if (valueEl) {
          const pd = p['play-details'] || p.playDetails || {};
          const isImmediate = pd['victory-type'] === 'military domination' || pd['victory-type'] === 'scientific domination';
          valueEl.textContent = isImmediate ? '∞' : String(p.score);
        }
        // apply rank classes (gold/silver/bronze)
        const rank = ranksByName[p.name] || null;
        applyRankClasses(li, Number(p.score) || 0, rank, Boolean(isLastByName[p.name]));
        listWrap.appendChild(li);
      });
      wrapper.appendChild(listWrap);
      detailsCell.appendChild(wrapper);
      // Insert detailsRow after the entry row
      if (tr.parentNode) tr.parentNode.insertBefore(detailsRow, tr.nextSibling);
      btn.textContent = 'Close';
      btn.dataset.open = 'true';
    });
    actionCell.appendChild(btn);
    tr.appendChild(dateCell);
    tr.appendChild(gameCell);
    tr.appendChild(winnerCell);
    tr.appendChild(actionCell);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  panel.appendChild(table);
  container.appendChild(panel);
}

function initFinishedGames() {
  const btn = el('list-finished-games');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    showView('tpl-finished-games', async (mount) => {
      const content = mount.querySelector('.view-content');
      const closeBtn = appToolbar() ? appToolbar().querySelector('#finished-games-close') : null;
      const listContainer = content.querySelector('#finished-games-list');
      const files = _finishedGamesCache.length ? _finishedGamesCache : await fetchFinishedFiles();
      renderFinishedList(files, listContainer);
      if (closeBtn) closeBtn.addEventListener('click', () => closeView());
    });
  });
}
