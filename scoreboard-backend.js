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

// This function runs when you make a GET request to the script's URL
function doGet(e) {
  try {
    const folder = getOrCreateFolder(FOLDER_PATH);
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
  catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
                         .setMimeType(ContentService.MideType.JSON);
  }
}

// This function runs when you make a POST request to the script's URL
function doPost(e) {
  try {
    const newContent = e.postData.contents;
    const folder = getOrCreateFolder(FOLDER_PATH);
    const files = folder.getFilesByName(FILENAME);
    let file;

    if (files.hasNext()) {
      // File exists, so update its content
      file = files.next();
      file.setContent(newContent);
    } 
    else {
      // File does not exist, so create it inside the target folder
      file = folder.createFile(FILENAME, newContent, MimeType.PLAIN_TEXT);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', filename: file.getName() }))
                         .setMimeType(ContentService.MimeType.JSON);
  } 
  catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}