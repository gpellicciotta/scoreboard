# User Guide

This guide explains how to use the Hinolugi Scoreboard frontend and the optional Google Drive backend.

The purpose of this app is to keep track of scores for multiple players during a game session. It supports local import/export of JSON files as well as cloud save/load via Google Drive using a Google Apps Script backend.

## Opening the App

1. Open [index.html](https://www.pellicciotta.com/scoreboard/) in a modern browser. 
   For development, start a local server (e.g., `live-server`).
2. The main UI shows the list of players and controls to add/subtract points.

## Common Actions

- New Game: Click `New Game` to start a new session with an empty scoreboard.
- Add points: Click the `+` button next to a player's name.
- Subtract points: Click the `-` button next to a player's name.
- Reset scores: Use the `Reset Scores` button to set all scores to zero.
- Auto-sort: Toggle the `Auto-sort` button to sort players by score automatically.
- Export: Click `Export` to download the current scoreboard as a JSON file.
- Import: Click `Import` and select a JSON file to load players and scores.
- Save to Cloud: Click `Save to Cloud` to save the current scoreboard to Google Drive (requires backend setup).
- Load from Cloud: Click `Load from Cloud` to load the saved scoreboard from Google Drive (requires backend setup).
- Configure: Click `Configure` to edit the configuration JSON directly.
- Finish Game: Click `Finish Game` to end the game and display the final winner message via a configured URL. The game' final state is also saved to Google Drive (requires backend setup).

## Import/Export JSON Format

The application uses a simple JSON format compatible across variants. Example:

```json
{
	"game": "Seven Wonders",
	"play-date": "2026-01-01T13:00:00.000Z",
	"status": "ongoing",
	"auto-sort": true,
	"players": [
		{ "name": "Alice", "score": 42 },
		{ "name": "Bob", "score": 50 }
	]
}
```

When importing, the app will merge players found in the file with the current session.

## Cloud Save / Load (Google Drive)

1. Deploy `scoreboard-backend.js` as a Web App in Google Apps Script.
2. Copy the Web App URL and paste it into the app's configuration (use the Configure button in the UI).
3. Use `Save to Cloud` to POST the current state and `Load from Cloud` to GET the saved file.

Note: The Backend requires Drive permissions; you must authorize the script when deploying.

## Configuration

- `celebration-link`: URL template used when finishing a game. Replace `{{MESSAGE}}` with the desired message.
- `auto-sort`: Boolean flag persisted in state.

## Troubleshooting

- If import fails, validate the JSON file is well-formed.
- If cloud save/load fails, verify the Apps Script deployment URL and that the script has Drive permissions.

