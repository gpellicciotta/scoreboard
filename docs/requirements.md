# Requirements

This document lists the system and configuration requirements for running and developing the Hinolugi Scoreboard project.

## Supported Environments

- Modern desktop browsers: Chrome, Edge, Firefox, Safari (latest two versions).
- Mobile browsers are usable but UI is optimized for desktop/tablet.

## Runtime Requirements

- The app is a static web application; no server is required to run the frontend.
- Optional backend: Google Apps Script (`scoreboard-backend.js`) can be used to save/load scoreboards to Google Drive.

## Development Tools (optional)

- A lightweight static file server for local development (e.g., `live-server`, VS Code Live Server, or Python's `http.server`).
- Node.js and npm are not required to run the project, but may be useful for tools like `live-server`:

```bash
npm install -g live-server
live-server
```

## Files of Interest

- `index.html` — main frontend of the SPA
- `scoreboard.mjs` — frontend application logic
- `scoreboard-styles.css` — main stylesheet
- `scoreboard-backend.js` — Google Apps Script backend (optional deploy to enable cloud save/load)

## Google Drive Backend Requirements

- A Google account to deploy and run the Apps Script.
- The Apps Script must be deployed as a Web App with appropriate permissions to read/write Google Drive.

## Security & Privacy

- The deployed Apps Script can be configured to run as the script owner or the end user. Running as `Me` simplifies usage but means the script runs with the deployer's account.
- If you choose `Anyone` access, the URL is unguessable but publicly accessible; treat the URL as a secret.

## Recommended Workflow

1. Use `live-server` or similar to preview frontend changes.
2. Edit `scoreboard.mjs` and `scoreboard-styles.css` for UI/behavior changes.
3. If using cloud save, deploy `scoreboard-backend.js` into Apps Script and update the endpoint URL in the app configuration.
