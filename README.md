# Scoreboard

A very simple leaderboard page to keep track of points during a game with multiple participants.

## How to use

Just open the index.html file in a web browser, via live-server. 
You can click on the names to add points as participants answer questions correctly.

This can also be prepared by uploading a JSON file with participant names.

Via [Github Pages](https://github.com/gpellicciotta/scoreboard), the scoreboard will also be hosted at: [https://www.pellicciotta.com/scoreboard/](https://www.pellicciotta.com/scoreboard/)

## Available actions

- Click on a participant's "+" or "-" buttons to add or subtract a point.
- Use the "Reset Scores" button to set all scores back to zero.
- Click the "Auto-sort" button to toggle automatic sorting of participants by their scores.
- Use the "Export" button to download the current scores as a JSON file.
- Use the "Import" button to upload a JSON file with participant names and scores.
- Use the "Save to Cloud" button to save the current scores to a cloud service.
- Use the "Load from Cloud" button to load scores from a cloud service.
- Click the "Configure" button to directly edit the configuration JSON.
- Click the "Finish Game" button to end the game and display the final winner message via a configured URL.

## Google Drive Backend

The scoreboard supports saving and loading scores from Google Drive. To use this feature, you need to set up a Google Cloud project and enable the Google Drive API.
Follow these steps:
1. Create the Google Apps Script
   1. Open Google Apps Script: Go to script.google.com.
   2. Start a New Project: In the top-left corner, click < > New project.
   3. Name Your Project: Click on Untitled project at the top. Rename it to 'Scoreboard Backend' and click Rename.
   4. Replace the Code with the contents of scoreboard-backend.js
   5. Save the Script: Click on the floppy disk icon or press Ctrl + S (Cmd + S on Mac) to save your script.  
2. Deploy the Script and Get Your URL
   1. Open Deployment Menu: In the Apps Script editor, click the blue Deploy button in the top-right corner, then select New deployment.
   2. Select Deployment Type: A new window will appear. Click the gear icon next to "Select type" and choose Web app.
   3. Configure the Web App: Fill in the settings as follows:
      - Description: You can give it a name, like Scoreboard API.
      - Execute as: Set this to Me. (This means the script runs with your authority).
      - Who has access: Set this to Anyone. (Note: This makes the endpoint public, but the URL is long, complex, and unguessable, which is secure enough for a personal project like this. It is the simplest option that avoids login complications.)
   4. Deploy: Click the Deploy button
   5. Authorize the Script: This is the most important part.   
      - A new window will ask for permission. Click Authorize access.
      - Choose your Google Account.  You will almost certainly see a warning screen saying "Google hasn't verified this app". This is normal for personal scripts. Click Advanced, then click Go to [Your Project Name] (unsafe).
      - On the next screen, review the permissions the script needs (it will ask to access Google Drive to store the file) and click Allow.
   6. Copy the URL: After you allow access, a final dialog will appear with a Web app URL. This is the private URL for your API. Click the Copy button to copy it to your clipboard.