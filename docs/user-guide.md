# User Guide

This guide explains how to use the Hinolugi Scoreboard frontend and the optional Google Drive backend.

The app tracks scores for multiple players in a game session. It supports local import/export of JSON files and optional cloud save/load via a Google Apps Script backend.

## Testing the app locally

1. Serve the project directory on a local HTTP server and open `http://localhost:<port>/` in a modern browser. Example commands:

```bash
# Python 3 built-in server
python -m http.server 8000

# Node: http-server
npx http-server -c-1

# Node: live-server (auto-reload)
npx live-server
```

2. The main UI shows the players list and the action sidebar.

Note: The UI uses modern CSS features (Grid / Flexbox). Use an up-to-date Chromium, Edge, Firefox, or Safari for the best experience.

## Common actions

- `New Game`: start a new session with default player names.
- `Reset Scores`: set all player scores to zero.
- `Auto-sort`: toggle automatic sorting of players by score.
- `Export State`: download the current app state as a JSON file.
- `Import State`: import a previously exported JSON file (see format below).
- `Save to Cloud`: POST the current state to the configured cloud backend.
- `Load from Cloud`: GET the last saved state from the configured cloud backend.
- `Configure`: edit configuration JSON directly in the UI.
- `Finish Game`: mark the game finished and optionally open the configured celebration URL.

Buttons live in the sidebar; their exact labels are shown above to match the UI.

## JSON import / export format

The app uses a compact JSON structure. Example export:

```json
{
  "game": "Seven Wonders",
  "play-date": "2026-01-01T13:00:00.000Z",
  "status": "ongoing",
  "auto-sort": true,
  "celebration-link": "https://example.com/celebrate?message={{MESSAGE}}",
  "players": [
    { "name": "Alice", "score": 42, "play-details": {} },
    { "name": "Bob", "score": 50, "play-details": {} }
  ]
}
```

Supported keys and alternatives:

- `game`: string
- `play-date` (or `playDate`): ISO timestamp string
- `status`: `ongoing` | `finished`
- `auto-sort` (or `autoSort`): boolean
- `celebration-link` (or `celebrationLink`): URL template
- `players`: array of player objects
  - each player: `{ "name": string, "score": number, "play-details"?: object }`

Import behavior and normalization:

- When importing, the `players` array from the file replaces the current player list (names are trimmed; empty names are ignored).
- Scores are coerced to numbers; negative values are clamped to `0`.
- If the file uses alternate key names (e.g., `playDate`, `autoSort`, `celebrationLink`), the app recognizes them.
- Exported `finished` games include a `rank` field for the top three players.

### Duel-mode / `play-details`

When using the 7 Wonders Duel view, each player may include a `play-details` object describing per-category subtotals. Keys expected by Duel mode match the internal mapping:

- `blue-cards`, `green-cards`, `yellow-cards`, `purple-cards`, `wonders`, `green-coins`, `money-coins`, `military`

Additionally, `play-details` may include a `victory-type` string. If `victory-type` equals `military domination` or `scientific domination`, the player is treated as having an immediate victory in Duel mode (the app assigns a large score to represent the win).

When importing Duel data, category values are read and the Duel score is recalculated accordingly.

## Cloud save / load (Google Apps Script)

The repository includes an example backend (`scoreboard-backend.js`) that can be deployed as a Google Apps Script Web App.

Steps (high level):

1. Open the Apps Script editor, create a new project and paste `scoreboard-backend.js`.
2. Deploy the script as a **Web App**. Recommended settings:
   - Execute the app as: **Me**
   - Who has access: choose according to your needs (e.g., **Anyone** or a restricted group).
3. Grant Drive permissions when prompted (the backend stores files in Google Drive).
4. Copy the Web App URL and paste it into the app via the `Configure` button (enter it as the cloud endpoint).
5. Use `Save to Cloud` to POST the current state and `Load from Cloud` to retrieve it.

Common failure modes:

- Wrong Web App URL: ensure the deployed URL (not the editor URL) is used.
- Missing Drive permissions: redeploy/authorize the script with Drive access.
- Deployment access level incompatible with your users: double-check the "Who has access" setting.

## Configuration

Note: the app's runtime "configuration" editor (the `Configure` button) edits the persisted application *state* (game, players, auto-sort, celebration link). There is no separate runtime config loader — the example `scoreboard-config.json` in the repo is an example/import file and is not automatically applied by the running app.

Persisted keys (what the app actually reads/writes)

- `game` (string | null): current game name.
- `players` (array): array of player objects. Each player: `{ "name": string, "score": number, "play-details"?: object }`.
- `play-date` (string | null): ISO timestamp (set when saving/exporting).
- `status` (string): `ongoing` | `finished`.
- `auto-sort` (boolean): whether the UI auto-sorts players by score.
- `celebration-link` (string): celebration URL template using `{{MESSAGE}}`.

Where to change values

- In the running app: open the sidebar `Configure` button, edit the JSON and click `Save` — this updates the persisted state in `localStorage` and updates the UI.
- For development/example data: edit `scoreboard-config.json` in the repository and use the app's `Import State` to load it (the app does not automatically read this file on startup).
- To change the cloud endpoint used for `Save to Cloud` / `Load from Cloud`: edit the `CLOUD_SAVE_URL` constant in `scoreboard.mjs` (search for `CLOUD_SAVE_URL` and replace the URL), then rebuild/refresh the page.

Local storage key

- The app persists state under the key `scoreboard.v${APP_VERSION}` (for this release the key is `scoreboard.v1.2.0`). Clearing this key resets the app state. Example to clear from the console:

```js
localStorage.removeItem('scoreboard.v1.2.0');
```

Security & operational notes

- Do not assume `scoreboard-config.json` is a secure place for secrets; the app does not use it at runtime.
- The example backend (`scoreboard-backend.js`) is deployed as a Google Apps Script Web App and will require Drive permissions when used.

## Troubleshooting & debugging

- If import fails, validate the JSON syntax (e.g., `jq . file.json` or copy into an online JSON validator).
- Check the browser console for runtime errors (DevTools  Console).
- To clear local data, remove the app's local storage key from the console:

```js
localStorage.removeItem('scoreboard.v1.2.0');
```

- The storage key follows the pattern `scoreboard.v<version>`; the app's `APP_VERSION` is visible in `scoreboard.mjs`.
- For cloud errors, open the Web App URL in a browser to test it directly and review Apps Script logs for failures.



