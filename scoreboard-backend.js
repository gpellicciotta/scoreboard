const FOLDER_PATH = "app-data/hinolugi-scoreboard";
const FILENAME = "last-saved-scoreboard.json";

/**
 * Finds a folder by path (e.g., "folder/subfolder") or creates it if it doesn't exist.
 * @param {string} path - The path of the folder, separated by slashes.
 * @returns {GoogleAppsScript.Drive.Folder} The final folder in the path.
 */
function getOrCreateFolder(path) {
  let currentFolder = DriveApp.getRootFolder();
  const folderNames = path.split('/');

  for (const folderName of folderNames) {
    const folders = currentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      // Folder exists, move into it for the next iteration
      currentFolder = folders.next();
    } else {
      // Folder does not exist, create it and move into it
      currentFolder = currentFolder.createFolder(folderName);
    }
  }
  return currentFolder;
}

/**
 * Handles GET requests to load the latest scoreboard state or a previously stored finished game state.
 */
function doGet(e) {
  try {
    const folder = getOrCreateFolder(FOLDER_PATH);
    const requestType = e.parameter.request;

    if (requestType === 'list') {
      const files = folder.getFiles();
      const fileList = [];
      while (files.hasNext()) {
        const file = files.next();
        const fileName = file.getName();
        if (fileName.startsWith('final-scores-') && fileName.endsWith('.json')) {
          fileList.push(fileName);
        }
      }
      return ContentService.createTextOutput(JSON.stringify(fileList))
                           .setMimeType(ContentService.MimeType.JSON);

    } 
    else if (requestType === 'load') {
      const fileName = e.parameter.file;
      if (!fileName || !fileName.startsWith('final-scores-')) {
        throw new Error("Invalid or missing file name for 'load' request.");
      }
      
      const files = folder.getFilesByName(fileName);
      if (files.hasNext()) {
        const file = files.next();
        const content = file.getBlob().getDataAsString();
        return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
      } 
      else {
        throw new Error(`File not found: ${fileName}`);
      }

    } 
    else { // Default action: get last saved scoreboard
      const files = folder.getFilesByName(FILENAME);
      if (files.hasNext()) {
        const file = files.next();
        const content = file.getBlob().getDataAsString();
        return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
      } 
      else {
        // If the file doesn't exist, return an empty players array.
        const defaultContent = JSON.stringify({ players: [] });
        return ContentService.createTextOutput(defaultContent)
                            .setMimeType(ContentService.MimeType.JSON);
      }
    }
  } 
  catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles POST requests to save the scoreboard's active state or finished game state.
 */
function doPost(e) {
  try {
    const folder = getOrCreateFolder(FOLDER_PATH);
    let file;
    const newContent = e.postData.contents;
    const scoreboardData = JSON.parse(newContent);

    if (scoreboardData && (scoreboardData.status === 'finished')) {      
      // Fall-back in case no play-date was provided
      const finishDate = new Date();
      if (!scoreboardData['play-date']) {
        scoreboardData['play-date'] = finishDate.toISOString();
      }
        
      // If the incoming object already marks the game as finished and
      // contains a `play-date`, derive the filename from that ISO string.
      const playDateIso = scoreboardData['play-date'];
      const parsed = new Date(playDateIso);
      if (isNaN(parsed)) {
        parsed = new Date();
      }
      let fileNameDate = playDateIso.replace(/[:-]/g, '').replace(/\.\d{3}Z$/, '');

      const fileName = `final-scores-${fileNameDate}.json`;
      const fileContent = JSON.stringify(scoreboardData, null, 2);
      file = folder.createFile(fileName, fileContent, MimeType.PLAIN_TEXT);
    }
    else {
      // Existing logic for saving the latest scoreboard
      const files = folder.getFilesByName(FILENAME);
      if (files.hasNext()) {
        file = files.next();
        file.setContent(newContent);
      } 
      else {
        file = folder.createFile(FILENAME, newContent, MimeType.PLAIN_TEXT);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', filename: file.getName() }))
                         .setMimeType(ContentService.MimeType.JSON);
  } 
  catch (error) {
    console.error("Error in doPost:", error); // Log error for debugging
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}