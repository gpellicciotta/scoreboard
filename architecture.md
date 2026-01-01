# Application Architecture

This document outlines the high-level architecture of the Hinolugi Scoreboard application.

## High-Level Architecture

The application is a lightweight, serverless web application with a vanilla JavaScript frontend and a Google Apps Script backend.

1.  **Frontend:** A Single Page Application (SPA) built with plain JavaScript, HTML, and CSS. The main entry point is `index.html`, which loads the application logic from `scoreboard.mjs`. The state is managed in a simple JavaScript object and persisted in the browser's `localStorage` for session-to-session persistence.

2.  **Backend:** A Google Apps Script (`scoreboard-backend.js`) acts as a simple, serverless backend. It exposes `doGet` and `doPost` methods that are triggered by HTTP requests from the frontend. It uses the Google Drive API (`DriveApp`) to store the scoreboard data as a JSON file (`last-saved-scoreboard.json`) in the user's Google Drive.

There are also separate HTML/JS/CSS files for specific games like "Seven Wonders", which seem to be standalone pages and not part of the main scoreboard's SPA architecture, but likely follow a similar pattern.

## State Object Structure

The core of the frontend application is the `state` object, which holds all the data required to render the scoreboard and manage its settings. This object is persisted to `localStorage` and can be saved to/loaded from the cloud.

Here is the structure of the `state` object with a description of its properties:

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

The communication between the frontend and backend is handled via `fetch` API calls from the frontend JavaScript to the deployed Google Apps Script URL.

### Saving Data (POST Request)

When the user initiates a "save to cloud" action, the frontend sends an HTTP `POST` request to the Google Apps Script URL.

*   **Method:** `POST`
*   **Headers:**
    *   `Content-Type: text/plain;charset=utf-8`
*   **Request Body:** The body contains a JSON string created by the `createStateObject` function. This function packages the current state and sets a `status` (e.g., 'ongoing' or 'finished') and updates the `play-date`.

    *Example Request Body:*
    ```json
    {
      "game": "Seven Wonders",
      "play-date": "2026-01-01T13:00:00.000Z",
      "status": "ongoing",
      "auto-sort": true,
      "celebration-link": "https://example.com/celebrate?msg={{MESSAGE}}",
      "players": [
        { "name": "Alice", "score": 42, "play-details": {} },
        { "name": "Bob", "score": 50, "play-details": {} }
      ]
    }
    ```

*   **Backend Response:** The Google Apps Script's `doPost` function processes the request. It saves the data and returns a JSON response indicating the outcome.

    *Example Success Response:*
    ```json
    {
      "status": "success"
    }
    ```
    *Example Error Response:*
    ```json
    {
      "status": "error",
      "message": "Failed to save file."
    }
    ```

### Loading Data (GET Request)

When the user initiates a "load from cloud" action, the frontend sends an HTTP `GET` request.

*   **Method:** `GET`
*   **Headers:** Standard browser headers.
*   **Request Body:** None.

*   **Backend Response:** The `doGet` function in the script reads the saved JSON file from Google Drive and returns its content in the response body. The frontend parses this JSON to restore its state.

    *Example Response Body:*
    ```json
    {
      "game": "Seven Wonders",
      "play-date": "2026-01-01T13:00:00.000Z",
      "status": "ongoing",
      "auto-sort": true,
      "celebration-link": "https://example.com/celebrate?msg={{MESSAGE}}",
      "players": [
        { "name": "Alice", "score": 42, "play-details": {} },
        { "name": "Bob", "score": 50, "play-details": {} }
      ]
    }
    ```

This architecture is simple and cost-effective, leveraging Google's infrastructure. It requires the user to be logged into a Google account and to grant the necessary permissions for the script to access their Google Drive.