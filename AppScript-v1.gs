// AppScript-v1.gs
// Project Management App - Google Apps Script Backend
// Version: 1.0
// Deploy as: Web App > Anyone > Execute as: Me

var SHEET_NAMES = {
  PROJECTS: 'Projects',
  NOTES: 'Notes',
  LINKS: 'Links',
  ATTACHMENTS: 'Attachments'
};

// ─── CORS + Response Helper ───────────────────────────────────────────────────
function corsResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var action = e.parameter.action;
    var data = e.parameter.data ? JSON.parse(e.parameter.data) : {};

    switch (action) {
      case 'getProjects':      return corsResponse(getProjects());
      case 'getProject':       return corsResponse(getProject(data.projectId));
      case 'addProject':       return corsResponse(addProject(data));
      case 'updateProject':    return corsResponse(updateProject(data));
      case 'deleteProject':    return corsResponse(deleteProject(data.projectId));
      case 'addNote':          return corsResponse(addNote(data));
      case 'updateNote':       return corsResponse(updateNote(data));
      case 'deleteNote':       return corsResponse(deleteNote(data.noteId));
      case 'addLink':          return corsResponse(addLink(data));
      case 'updateLink':       return corsResponse(updateLink(data));
      case 'deleteLink':       return corsResponse(deleteLink(data.linkId));
      case 'addAttachment':    return corsResponse(addAttachment(data));
      case 'updateAttachment': return corsResponse(updateAttachment(data));
      case 'deleteAttachment': return corsResponse(deleteAttachment(data.attachmentId));
      case 'initSheets':       return corsResponse(initSheets());
      default:
        return corsResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return corsResponse({ success: false, error: err.toString() });
  }
}

// ─── Sheet Initialization ─────────────────────────────────────────────────────
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var schemas = {
    Projects:    ['ProjectID', 'Title', 'Status', 'Description', 'DateCreated', 'DateModified'],
    Notes:       ['NoteID', 'ProjectID', 'NoteText', 'DateCreated', 'DateModified'],
    Links:       ['LinkID', 'ProjectID', 'Label', 'URL', 'DateCreated', 'DateModified'],
    Attachments: ['AttachmentID', 'ProjectID', 'FileName', 'FileURL', 'DateCreated', 'DateModified']
  };

  for (var name in schemas) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // Only write headers if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(schemas[name]);
      sheet.getRange(1, 1, 1, schemas[name].length)
        .setFontWeight('bold')
        .setBackground('#1a1a2e')
        .setFontColor('#ffffff');
    }
  }

  return { success: true, message: 'Sheets initialized' };
}

// ─── ID Generator ─────────────────────────────────────────────────────────────
function generateId(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
}

// ─── Timestamp ────────────────────────────────────────────────────────────────
function now() {
  return new Date().toISOString();
}

// ─── Sheet Reader Helper ──────────────────────────────────────────────────────
function sheetToObjects(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      // Convert Date objects to ISO string
      if (val instanceof Date) {
        obj[headers[j]] = val.toISOString();
      } else {
        obj[headers[j]] = val;
      }
    }
    results.push(obj);
  }
  return results;
}

// ─── Find Row By ID ───────────────────────────────────────────────────────────
function findRowById(sheet, idColumn, idValue) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var colIdx = headers.indexOf(idColumn);
  if (colIdx === -1) return -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(idValue)) {
      return i + 1; // 1-indexed row number
    }
  }
  return -1;
}

// ─── UPDATE Row By ID ─────────────────────────────────────────────────────────
function updateRowById(sheetName, idColumn, idValue, updates) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rowNum = findRowById(sheet, idColumn, idValue);

  if (rowNum === -1) return { success: false, error: 'Record not found' };

  for (var key in updates) {
    var colIdx = headers.indexOf(key);
    if (colIdx !== -1) {
      sheet.getRange(rowNum, colIdx + 1).setValue(updates[key]);
    }
  }
  return { success: true };
}

// ─── DELETE Row By ID ─────────────────────────────────────────────────────────
function deleteRowById(sheetName, idColumn, idValue) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  var rowNum = findRowById(sheet, idColumn, idValue);
  if (rowNum === -1) return { success: false, error: 'Record not found' };
  sheet.deleteRow(rowNum);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════════════════════════

function getProjects() {
  return { success: true, data: sheetToObjects(SHEET_NAMES.PROJECTS) };
}

function getProject(projectId) {
  var projects = sheetToObjects(SHEET_NAMES.PROJECTS);
  var project = projects.find(function(p) { return p.ProjectID === projectId; });
  if (!project) return { success: false, error: 'Project not found' };

  var notes       = sheetToObjects(SHEET_NAMES.NOTES).filter(function(n) { return n.ProjectID === projectId; });
  var links       = sheetToObjects(SHEET_NAMES.LINKS).filter(function(l) { return l.ProjectID === projectId; });
  var attachments = sheetToObjects(SHEET_NAMES.ATTACHMENTS).filter(function(a) { return a.ProjectID === projectId; });

  return { success: true, data: { project: project, notes: notes, links: links, attachments: attachments } };
}

function addProject(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.PROJECTS);
  var timestamp = now();
  var id = generateId('PRJ');

  sheet.appendRow([
    id,
    data.title || '',
    data.status || 'Active',
    data.description || '',
    timestamp,
    timestamp
  ]);

  return { success: true, data: { projectId: id } };
}

function updateProject(data) {
  var updates = {};
  if (data.title !== undefined)       updates.Title = data.title;
  if (data.status !== undefined)      updates.Status = data.status;
  if (data.description !== undefined) updates.Description = data.description;
  updates.DateModified = now();

  return updateRowById(SHEET_NAMES.PROJECTS, 'ProjectID', data.projectId, updates);
}

function deleteProject(projectId) {
  // Cascade delete children
  var notes       = sheetToObjects(SHEET_NAMES.NOTES).filter(function(n) { return n.ProjectID === projectId; });
  var links       = sheetToObjects(SHEET_NAMES.LINKS).filter(function(l) { return l.ProjectID === projectId; });
  var attachments = sheetToObjects(SHEET_NAMES.ATTACHMENTS).filter(function(a) { return a.ProjectID === projectId; });

  notes.forEach(function(n)       { deleteRowById(SHEET_NAMES.NOTES, 'NoteID', n.NoteID); });
  links.forEach(function(l)       { deleteRowById(SHEET_NAMES.LINKS, 'LinkID', l.LinkID); });
  attachments.forEach(function(a) { deleteRowById(SHEET_NAMES.ATTACHMENTS, 'AttachmentID', a.AttachmentID); });

  return deleteRowById(SHEET_NAMES.PROJECTS, 'ProjectID', projectId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════════════════════════════════════

function addNote(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.NOTES);
  var timestamp = now();
  var id = generateId('NOTE');

  sheet.appendRow([id, data.projectId, data.noteText || '', timestamp, timestamp]);

  // Update parent DateModified
  updateRowById(SHEET_NAMES.PROJECTS, 'ProjectID', data.projectId, { DateModified: timestamp });

  return { success: true, data: { noteId: id } };
}

function updateNote(data) {
  var updates = {};
  if (data.noteText !== undefined) updates.NoteText = data.noteText;
  updates.DateModified = now();
  updateRowById(SHEET_NAMES.PROJECTS, 'ProjectID', data.projectId, { DateModified: now() });
  return updateRowById(SHEET_NAMES.NOTES, 'NoteID', data.noteId, updates);
}

function deleteNote(noteId) {
  return deleteRowById(SHEET_NAMES.NOTES, 'NoteID', noteId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINKS
// ═══════════════════════════════════════════════════════════════════════════════

function addLink(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.LINKS);
  var timestamp = now();
  var id = generateId('LNK');

  sheet.appendRow([id, data.projectId, data.label || '', data.url || '', timestamp, timestamp]);
  updateRowById(SHEET_NAMES.PROJECTS, 'ProjectID', data.projectId, { DateModified: timestamp });

  return { success: true, data: { linkId: id } };
}

function updateLink(data) {
  var updates = {};
  if (data.label !== undefined) updates.Label = data.label;
  if (data.url   !== undefined) updates.URL   = data.url;
  updates.DateModified = now();
  updateRowById(SHEET_NAMES.PROJECTS, 'ProjectID', data.projectId, { DateModified: now() });
  return updateRowById(SHEET_NAMES.LINKS, 'LinkID', data.linkId, updates);
}

function deleteLink(linkId) {
  return deleteRowById(SHEET_NAMES.LINKS, 'LinkID', linkId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ATTACHMENTS
// ═══════════════════════════════════════════════════════════════════════════════

function addAttachment(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.ATTACHMENTS);
  var timestamp = now();
  var id = generateId('ATT');

  sheet.appendRow([id, data.projectId, data.fileName || '', data.fileUrl || '', timestamp, timestamp]);
  updateRowById(SHEET_NAMES.PROJECTS, 'ProjectID', data.projectId, { DateModified: timestamp });

  return { success: true, data: { attachmentId: id } };
}

function updateAttachment(data) {
  var updates = {};
  if (data.fileName !== undefined) updates.FileName = data.fileName;
  if (data.fileUrl  !== undefined) updates.FileURL  = data.fileUrl;
  updates.DateModified = now();
  updateRowById(SHEET_NAMES.PROJECTS, 'ProjectID', data.projectId, { DateModified: now() });
  return updateRowById(SHEET_NAMES.ATTACHMENTS, 'AttachmentID', data.attachmentId, updates);
}

function deleteAttachment(attachmentId) {
  return deleteRowById(SHEET_NAMES.ATTACHMENTS, 'AttachmentID', attachmentId);
}
