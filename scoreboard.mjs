// # Constants
const LOCAL_STORAGE_KEY = 'scoreboard.v2'; // Use for local storage
const DEFAULT_NAMES = ['Player #1', 'Player #2', 'Player #3', 'Player #4']; // Default participants (config)
const DEFAULT_CELEBRATION_LINK = 'https://www.pellicciotta.com/cards/celebrate.html?message={{MESSAGE}}';
const CLOUD_SAVE_URL = 'https://script.google.com/macros/s/AKfycbwW11Xm9k-4WTUNq7LbJcRaYxvDYdwSqit6Nna0_CEWYfIXCrzqTTbrPbvxjeBoUw6P/exec';
const MARK_LAST = false; // Set to `true` to mark the lowest-ranked participant with `rank-last` styling

let state = { players: [] };
let tpl = null;
let _isConfiguring = false;

const el = (id) => document.getElementById(id);

// # Persistence / Helpers

function save() {
  try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn('Failed to save', e) }
}

function load() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try { state = JSON.parse(raw); } catch (e) { state = { players: [] } }
  }
}

function saveAndRender() { save(); render(); }

function getPlayer(name) { return state.players.find(x => x.name === name); }

// # Rendering / ranking

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
  const list = el('scoreboard-list');
  if (!list) return;
  list.innerHTML = '';
  if (!tpl) { console.error('Template not found'); return; }
  // decide ordering: auto-sort (default true) or preserve state order
  const autoSort = (state.autoSort === undefined) ? true : Boolean(state.autoSort);
  const players = autoSort ? [...state.players].sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name)) : [...state.players];

  // compute ranks from a sorted copy (so ranks reflect scores even when autoSort is off)
  const sortedForRank = [...state.players].sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
  const ranksByName = Object.create(null);
  let lastRank = 0;
  for (let i = 0; i < sortedForRank.length; i++) {
    if (i === 0) lastRank = 1;
    else lastRank = (sortedForRank[i].score === sortedForRank[i - 1].score) ? lastRank : i + 1;
    ranksByName[sortedForRank[i].name] = lastRank;
  }
  const maxRank = sortedForRank.length ? ranksByName[sortedForRank[sortedForRank.length - 1].name] : 1;

  players.forEach((p, idx) => {
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
  const top = players.length ? players[0].name + ' (' + players[0].score + ')' : '—';
  const topEl = el('score-top'); if (topEl) topEl.textContent = top;
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
  // remove duplicates while preserving order
  const seen = new Set();
  state.players = names.map(n => ({ name: n.trim(), score: 0 })).filter(p => p.name.length).filter(p => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
  save(); render();
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
    const exportObj = { players: state.players, 'auto-sort': Boolean(state.autoSort), 'celebration-link': state.celebrationLink || DEFAULT_CELEBRATION_LINK };
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
    if (parsed.players && Array.isArray(parsed.players)) {
      state.players = parsed.players.map(pp => ({ name: String(pp.name || '').trim(), score: Math.max(0, Number(pp.score) || 0) })).filter(x => x.name.length);
      if (parsed['auto-sort'] !== undefined) state.autoSort = Boolean(parsed['auto-sort']);
      if (parsed['celebration-link'] !== undefined) state.celebrationLink = String(parsed['celebration-link']);
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
  // ensure state.autoSort exists (default true)
  if (typeof state.autoSort === 'undefined') state.autoSort = true;
  const setUI = () => {
    const on = Boolean(state.autoSort);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('active', on);
  };
  setUI();
  btn.addEventListener('click', () => {
    state.autoSort = !Boolean(state.autoSort);
    save();
    setUI();
    render();
  });
}

function initSidebar() {
  const sidebar = el('scoreboard-sidebar');
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
  // close the sidebar when any action button inside it is clicked
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
      state.players.forEach(p => { if (p && typeof p === 'object') p.score = 0; });
      saveAndRender();
    }
  });

  const exportBtn = el('export-json');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const exportObj = { players: state.players, 'auto-sort': Boolean(state.autoSort), 'celebration-link': state.celebrationLink || DEFAULT_CELEBRATION_LINK };
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
          if (parsed.players && Array.isArray(parsed.players)) {
            state.players = parsed.players.map(pp => ({ name: String(pp.name || '').trim(), score: Math.max(0, Number(pp.score) || 0) })).filter(x => x.name.length);
            if (parsed['auto-sort'] !== undefined) state.autoSort = Boolean(parsed['auto-sort']);
            else if (parsed.autoSort !== undefined) state.autoSort = Boolean(parsed.autoSort);
            if (parsed['celebration-link'] !== undefined) state.celebrationLink = String(parsed['celebration-link']);
            else if (parsed.celebrationLink !== undefined) state.celebrationLink = String(parsed.celebrationLink);
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
  const editor = el('config-editor');
  const ta = el('config-textarea');
  if (!list || !editor || !ta) return;
  _isConfiguring = true;
  // populate textarea with current configuration
  const exportObj = { players: state.players, 'auto-sort': Boolean(state.autoSort), 'celebration-link': state.celebrationLink || DEFAULT_CELEBRATION_LINK };
  ta.value = JSON.stringify(exportObj, null, 2);
  // hide the list and show the editor
  list.setAttribute('hidden', '');
  editor.removeAttribute('hidden');

  // wire up buttons (idempotent)
  const discard = el('config-discard');
  const save = el('config-save');
  if (discard) {
    discard.onclick = () => {
      _isConfiguring = false;
      editor.setAttribute('hidden', '');
      list.removeAttribute('hidden');
      render();
    };
  }
  if (save) {
    save.onclick = () => {
      try {
        const parsed = JSON.parse(ta.value);
        if (parsed.players && Array.isArray(parsed.players)) {
          state.players = parsed.players.map(pp => ({ name: String(pp.name || '').trim(), score: Math.max(0, Number(pp.score) || 0) })).filter(x => x.name.length);
          if (parsed['auto-sort'] !== undefined) state.autoSort = Boolean(parsed['auto-sort']);
          else if (parsed.autoSort !== undefined) state.autoSort = Boolean(parsed.autoSort);
          if (parsed['celebration-link'] !== undefined) state.celebrationLink = String(parsed['celebration-link']);
          else if (parsed.celebrationLink !== undefined) state.celebrationLink = String(parsed.celebrationLink);
          saveAndRender();
          _isConfiguring = false;
          editor.setAttribute('hidden', '');
          list.removeAttribute('hidden');
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
  if (!list) return;
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

function initFinishGame() {
  const btn = el('finish-game');
  if (!btn) return;
  btn.addEventListener('click', () => {
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
      window.open(finalUrl, '_blank', 'noopener');
  });
}

// # Event handlers

document.addEventListener('DOMContentLoaded', () => {
  tpl = document.getElementById('score-item-template');
  load();
  if (!state.players || state.players.length === 0) {
    state.players = DEFAULT_NAMES.map(n => ({ name: n, score: 0 }));
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
});

