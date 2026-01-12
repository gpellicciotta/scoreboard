# Application Architecture

This document outlines the high-level architecture of the Hinolugi Scoreboard application.

## High-Level Architecture

The application is a lightweight, serverless web application with a vanilla JavaScript frontend and a Google Apps Script backend.

### Frontend

A Single Page Application (SPA) built with plain JavaScript, HTML, and CSS. 
The main entry point is `index.html`, which loads the application logic from `scoreboard.mjs`. 
The state is managed in a simple JavaScript object and persisted in the browser's `localStorage` for session-to-session persistence.

### Backend

A Google Apps Script (`scoreboard-backend.js`) acts as a simple, serverless backend. 
It exposes `doGet` and `doPost` methods that are triggered by HTTP requests from the frontend. 
It uses the Google Drive API (`DriveApp`) to store the scoreboard data as a JSON file (`last-saved-scoreboard.json`) in the user's Google Drive.

There are also separate HTML/JS/CSS files for specific games like "Seven Wonders", which seem to be standalone pages and not part of the main scoreboard's SPA architecture, but likely follow a similar pattern.

## State Object Structure

The core of the frontend application is the `state` object, which holds all the data required to render the scoreboard and manage its settings. This object is persisted to `localStorage` and can be saved to/loaded from the cloud.

Here is the structure of the `state` object:

```javascript
{
  "game": "Seven Wonders",
  "play-date": "2026-01-01T12:00:00.000Z",
  "status": "ongoing",
  "auto-sort": true,
  "celebration-link": "https://example.com/celebrate?msg={{MESSAGE}}",
  "players": [
    { "name": "Alice", "score": 42, "play-details": {} },
    { "name": "Bob", "score": 50, "play-details": {} }
  ]
}
```

It exposes following properties:

*   `game` (string | null): The name of the game being played.
*   `play-date` (string | null): An ISO 8601 string representing the date and time of the game session.
*   `status` (string | null): The current status of the game (e.g., "ongoing", "finished").
*   `auto-sort` (boolean): A flag indicating whether the scoreboard should automatically sort players by score in descending order.
*   `celebration-link` (string): A URL template for the celebration page, which can include a `{{MESSAGE}}` placeholder.
*   `players` (Array<Object>): An array of player objects.
    *   `name` (string): The player's name.
    *   `score` (number): The player's current score.
    *   `play-details` (Object): A flexible object to store game-specific details for a player.

## Frontend-to-Backend Communication

The frontend and backend communicate over HTTP using `fetch`. 

The implementation details are:
- The frontend uses a constant named `CLOUD_SAVE_URL` in `scoreboard.mjs` as the request target. To change the target used by the shipped frontend, edit `CLOUD_SAVE_URL` in `scoreboard.mjs` and reload the page.
- Save: frontend sends a `POST` to `CLOUD_SAVE_URL` with the JSON string produced by `createStateObject()` as the request body. The frontend sets the header `Content-Type: text/plain;charset=utf-8` and calls `response.json()` on the reply.
- Load: frontend sends a `GET` to `CLOUD_SAVE_URL` and expects a JSON body containing the saved state.
- Finished games: the frontend uses query parameters to enumerate and load finished-game files: `?request=list` returns a list of filenames, and `?request=load&file=<fileName>` returns the JSON content for a specific finished-game file. The frontend expects JSON responses for these calls.

The backend exposed by `scoreboard-backend.js` implements `doGet` and `doPost` and uses Google Drive (via `DriveApp`) to store and retrieve JSON files. The frontend expects the backend responses to be valid JSON objects representing saved state or operation results.

Operational note: the repository includes `scoreboard-config.json` as an example/import file; the running app does not automatically read it.

### Request / Response Schemas

The JSON Schema for saved state looks as follows:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "game": { "type": ["string", "null"] },
    "play-date": { "type": ["string", "null"], "format": "date-time" },
    "status": { "type": ["string", "null"] },
    "auto-sort": { "type": "boolean" },
    "celebration-link": { "type": "string" },
    "players": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name","score"],
        "properties": {"name":{"type":"string"},"score":{"type":"number"},"play-details":{"type":"object"}}
      }
    }
  },
  "required": ["players"]
}
```

POST save response (success):

```json
{ "status": "success", "savedAt": "2026-01-01T13:00:00.000Z" }
```

Error response pattern:

```json
{ "status": "error", "code": "SAVE_FAILED", "message": "Human-readable error" }
```

### Headers & Content-Type

- The frontend as shipped sets `Content-Type: text/plain;charset=utf-8` for POST requests (see `saveToCloud()` / `saveFinishedGameToCloud()` in `scoreboard.mjs`). The backend in `scoreboard-backend.js` parses the request body as JSON.
- Responses are expected to be JSON and the frontend calls `response.json()` after fetch.
- CORS: Apps Script must be deployed and return appropriate CORS headers when the frontend origin differs from the script's origin; ensure `doGet`/`doPost` include `Access-Control-Allow-Origin` as needed for your deployment.

### Backend query parameters for finished games

- The frontend requests a list of finished files using `CLOUD_SAVE_URL + '?request=list'` and loads individual finished-game files with `CLOUD_SAVE_URL + '?request=load&file=' + encodeURIComponent(fileName)`; the backend should support these query patterns and return JSON.

### Authentication & Scopes

- The Apps Script runs under the end-user's Google account. The user must authorize the script to use Drive APIs. Typical scopes: `https://www.googleapis.com/auth/drive.file` (recommended) or `https://www.googleapis.com/auth/drive` (broader).
- No separate API key is required for the typical per-user Drive file approach; Apps Script will show an authorization prompt when the user first runs an action that requires Drive access.

### Operational Notes

- To deploy: open the Apps Script editor, select **Deploy → New deployment → Web app**, choose appropriate access (e.g., "Only myself" or "Anyone within domain"), and copy the web app URL into `scoreboard-config.json`.
- To debug: use `Logger.log()` in `scoreboard-backend.js` and view logs via **Executions** or **My Executions** in the Apps Script console.
