/**
 * ==============================================================================
 * WALNUT VALLEY UNIFIED SCHOOL DISTRICT (WVUSD)
 * Onboarding & Long-Term Substitute Teacher System Access Portal
 * Google Apps Script Web App Backend (Code.gs)
 * ==============================================================================
 *
 * SHEET TAB STRUCTURE:
 *
 * 1. "Sites" Tab:
 *    - Col A: Site (School Name)
 *    - Col B: Principal Email (comma-separated if multiple)
 *    - Col C: Admin Assistant Email (comma-separated if multiple)
 *
 * 2. "Specialist" (or "Specialists") Tab:
 *    - Cell C1: HR Specialists (comma-separated)
 *    - Cell D1: Super Admin (comma-separated)
 *    - Col A: Topic (System / Service name)
 *    - Col B: Specialist Email (comma-separated if multiple)
 *
 * 3. "Requests" Tab:
 *    - Col A: Request ID (e.g. REQ-1001)
 *    - Col B: Created At (ISO timestamp)
 *    - Col C: Request Type ("New Employee" | "Long-Term Sub")
 *    - Col D: Site
 *    - Col E: First Name
 *    - Col F: Last Name
 *    - Col G: Work Email
 *    - Col H: Original Teacher Name
 *    - Col I: Original Teacher Email
 *    - Col J: Access Requested (comma-separated topics)
 *    - Col K: Access Completed (comma-separated topics)
 *    - Col L: Status ("Pending HR" | "In Progress" | "Completed" | "Cancelled")
 *    - Col M: Submitter Email
 *    - Col N: HR Assigned At
 *    - Col O: Comments
 *    - Col P: Final Notified At
 * ==============================================================================
 */

const DISTRICT_LOGO = "https://res.cloudinary.com/djv9u4054/image/upload/v1783959106/UPdated_Black_and_White_Logo-removebg-preview_zubeqp.png";

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "getInitialData";
    const email = (e && e.parameter && e.parameter.email) || "";

    if (action === "getInitialData") {
      return jsonResponse(getInitialData(email));
    }

    if (action === "ping") {
      return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
    }

    return jsonResponse({ error: "Unsupported GET action: " + action }, 400);
  } catch (err) {
    return jsonResponse({ error: err.toString(), stack: err.stack }, 500);
  }
}

/**
 * Handle HTTP POST Requests
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;

    switch (action) {
      case "getInitialData":
        return jsonResponse(getInitialData(payload.email));

      case "submitRequest":
        return jsonResponse(submitRequest(payload));

      case "assignEmail":
        return jsonResponse(assignEmail(payload));

      case "toggleAccess":
        return jsonResponse(toggleAccess(payload));

      case "addComment":
        return jsonResponse(addComment(payload));

      case "adminOverride":
        return jsonResponse(adminOverride(payload));

      case "sendReminders":
        return jsonResponse(sendPendingSpecialistReminders(Boolean(payload.isDemo || payload.demoMode)));

      case "ensureRequestsTab":
        return jsonResponse(ensureRequestsTab());

      default:
        return jsonResponse({ error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.toString(), stack: err.stack }, 500);
  }
}

/**
 * Helper to return standard JSON with proper MIME type
 */
function jsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Utility: Parse comma-separated emails, trim whitespace, normalize to lowercase
 */
function parseEmailList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(e => String(e).toLowerCase().trim()).filter(Boolean);
  }
  return String(raw)
    .split(/[,;\n]+/)
    .map(e => e.toLowerCase().trim())
    .filter(Boolean);
}

/**
 * Utility: Locate a sheet case-insensitively by candidate names
 */
function findSheet(ss, possibleNames) {
  const sheets = ss.getSheets();
  for (let s = 0; s < sheets.length; s++) {
    const name = sheets[s].getName().trim().toLowerCase();
    for (let p = 0; p < possibleNames.length; p++) {
      if (name === possibleNames[p].trim().toLowerCase()) {
        return sheets[s];
      }
    }
  }
  return null;
}

/**
 * Ensures the "Requests" tab exists with correct headers without touching existing data
 */
function ensureRequestsTab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let reqSheet = findSheet(ss, ["Requests", "Request"]);
  if (!reqSheet) {
    reqSheet = ss.insertSheet("Requests");
  }

  if (reqSheet.getLastRow() === 0) {
    const headers = [
      "Request ID",
      "Created At",
      "Request Type",
      "Site",
      "First Name",
      "Last Name",
      "Work Email",
      "Original Teacher Name",
      "Original Teacher Email",
      "Access Requested",
      "Access Completed",
      "Status",
      "Submitter Email",
      "HR Assigned At",
      "Comments",
      "Final Notified At"
    ];
    reqSheet.appendRow(headers);
    reqSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#0b3f6d")
      .setFontColor("#ffffff");
    reqSheet.setFrozenRows(1);
  }
  return { success: true };
}

/**
 * ------------------------------------------------------------------------------
 * DATA RETRIEVAL (getInitialData)
 * Dynamically reads:
 * 1. "Sites" tab (Col A: Site, Col B: Principal Email, Col C: Admin Assistant Email)
 * 2. "Specialist" tab (C1: HR, D1: Super Admin, Col A: Topic, Col B: Specialist Email)
 * 3. "Requests" tab
 * ------------------------------------------------------------------------------
 */
function getInitialData(userEmail) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRequestsTab();

  const cleanUserEmail = userEmail ? String(userEmail).toLowerCase().trim() : "";

  // 1. Read "Specialist" (or "Specialists") Tab
  const specSheet = findSheet(ss, ["Specialist", "Specialists"]);
  let hrEmails = [];
  let superAdminEmails = [];
  const services = []; // { serviceName, specialistEmails }

  if (specSheet) {
    const specData = specSheet.getDataRange().getValues();

    // Read Cell C1 (HR Specialists) & Cell D1 (Super Admin)
    if (specData.length > 0) {
      const row0 = specData[0];
      if (row0.length > 2) hrEmails = parseEmailList(row0[2]);
      if (row0.length > 3) superAdminEmails = parseEmailList(row0[3]);
    }

    // Read Topics (Col A) and Specialist Emails (Col B)
    // Identify where data starts (skips header rows if Col A is "Topic" or "Service")
    for (let r = 0; r < specData.length; r++) {
      const topicName = String(specData[r][0] || "").trim();
      if (!topicName) continue;

      const lower = topicName.toLowerCase();
      // Skip header labels like "Topic", "Topics", "Service", "Services", or separator dashes
      const forbiddenHeaders = ["topic", "topics", "service", "services", "system", "systems", "topic name", "service name"];
      if (forbiddenHeaders.includes(lower) || lower.startsWith("---") || lower.startsWith("(")) {
        continue;
      }

      const emailsRaw = specData[r][1] || "";
      const emailList = parseEmailList(emailsRaw);

      services.push({
        serviceName: topicName,
        specialistEmails: emailList
      });
    }
  }

  // 2. Read "Sites" (or "Site") Tab
  // Col A: Site | Col B: Principal Email | Col C: Admin Assistant Email
  const siteSheet = findSheet(ss, ["Sites", "Site"]);
  const sites = [];
  const userAuthorizedSites = [];

  if (siteSheet) {
    const siteData = siteSheet.getDataRange().getValues();
    for (let r = 0; r < siteData.length; r++) {
      const siteName = String(siteData[r][0] || "").trim();
      if (!siteName) continue;

      const lower = siteName.toLowerCase();
      // Skip header label row if present
      if (lower === "site" || lower === "site name" || lower === "school") {
        continue;
      }

      const principalEmails = parseEmailList(siteData[r][1] || "");
      const adminAssistantEmails = parseEmailList(siteData[r][2] || "");
      const allSiteEmails = [...new Set([...principalEmails, ...adminAssistantEmails])];

      sites.push({
        siteName: siteName,
        principalEmails: principalEmails,
        officeEmails: adminAssistantEmails,
        allEmails: allSiteEmails
      });

      if (cleanUserEmail && allSiteEmails.includes(cleanUserEmail)) {
        userAuthorizedSites.push(siteName);
      }
    }
  }

  // 3. Determine User Roles
  const isSuperAdmin = cleanUserEmail && superAdminEmails.includes(cleanUserEmail);
  const isHr = cleanUserEmail && hrEmails.includes(cleanUserEmail);
  const isSiteStaff = userAuthorizedSites.length > 0;

  const assignedServices = [];
  if (cleanUserEmail) {
    services.forEach(s => {
      if (s.specialistEmails.includes(cleanUserEmail)) {
        assignedServices.push(s.serviceName);
      }
    });
  }
  const isSpecialist = assignedServices.length > 0;

  // 4. Read "Requests" Tab
  const reqSheet = findSheet(ss, ["Requests", "Request"]);
  const requests = [];

  if (reqSheet && reqSheet.getLastRow() > 1) {
    const reqData = reqSheet.getDataRange().getValues();
    for (let r = 1; r < reqData.length; r++) {
      const row = reqData[r];
      const reqId = String(row[0] || "").trim();
      if (!reqId) continue;

      const accessReqStr = String(row[9] || "");
      const accessCompStr = String(row[10] || "");

      const requestedArr = accessReqStr.split(",").map(s => s.trim()).filter(Boolean);
      const completedArr = accessCompStr.split(",").map(s => s.trim()).filter(Boolean);

      requests.push({
        rowIndex: r + 1,
        id: reqId,
        createdAt: row[1] ? new Date(row[1]).toISOString() : "",
        requestType: String(row[2] || "New Employee").trim(),
        site: String(row[3] || "").trim(),
        firstName: String(row[4] || "").trim(),
        lastName: String(row[5] || "").trim(),
        fullName: `${String(row[4] || "").trim()} ${String(row[5] || "").trim()}`.trim(),
        workEmail: String(row[6] || "").trim(),
        originalTeacherName: String(row[7] || "").trim(),
        originalTeacherEmail: String(row[8] || "").trim(),
        accessRequested: requestedArr,
        accessCompleted: completedArr,
        status: String(row[11] || "Pending HR").trim(),
        submitterEmail: String(row[12] || "").trim(),
        hrAssignedAt: row[13] ? new Date(row[13]).toISOString() : "",
        comments: String(row[14] || "").trim(),
        finalNotifiedAt: row[15] ? new Date(row[15]).toISOString() : ""
      });
    }
  }

  return {
    requests: requests,
    services: services,
    sites: sites,
    hrEmails: hrEmails,
    superAdminEmails: superAdminEmails,
    currentUser: {
      email: cleanUserEmail,
      isSuperAdmin: Boolean(isSuperAdmin),
      isHr: Boolean(isHr),
      isSpecialist: Boolean(isSpecialist),
      isSiteStaff: Boolean(isSiteStaff),
      authorizedSites: userAuthorizedSites,
      assignedServices: assignedServices
    }
  };
}

/**
 * ------------------------------------------------------------------------------
 * INTAKE WORKFLOW: submitRequest
 * ------------------------------------------------------------------------------
 */
function submitRequest(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRequestsTab();
  const reqSheet = findSheet(ss, ["Requests", "Request"]);

  const cleanType = payload.requestType === "Long-Term Sub" ? "Long-Term Sub" : "New Employee";
  const site = String(payload.site || "").trim();
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  const submitterEmail = String(payload.submitterEmail || "").toLowerCase().trim();
  const origName = cleanType === "Long-Term Sub" ? String(payload.originalTeacherName || "").trim() : "";
  const origEmail = cleanType === "Long-Term Sub" ? String(payload.originalTeacherEmail || "").toLowerCase().trim() : "";

  let requestedServices = [];
  if (Array.isArray(payload.requestedServices)) {
    requestedServices = payload.requestedServices.map(s => String(s).trim()).filter(Boolean);
  } else if (typeof payload.requestedServices === "string") {
    requestedServices = payload.requestedServices.split(",").map(s => s.trim()).filter(Boolean);
  }

  // Generate ID: REQ-XXXX
  const lastRow = reqSheet.getLastRow();
  let nextNum = 1001;
  if (lastRow > 1) {
    const ids = reqSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(cell => {
      const match = String(cell[0]).match(/REQ-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= nextNum) nextNum = num + 1;
      }
    });
  }
  const requestId = "REQ-" + nextNum;
  const createdAt = new Date();

  // Row columns matching schema:
  // [ID, CreatedAt, Type, Site, First, Last, WorkEmail, OrigName, OrigEmail, AccessReq, AccessComp, Status, Submitter, HRAssignedAt, Comments, FinalNotifiedAt]
  const rowData = [
    requestId,
    createdAt,
    cleanType,
    site,
    firstName,
    lastName,
    "", // Work Email (to be assigned by HR)
    origName,
    origEmail,
    requestedServices.join(", "),
    "", // Access Completed
    "Pending HR",
    submitterEmail,
    "", // HR Assigned At
    "", // Comments
    ""  // Final Notified At
  ];

  reqSheet.appendRow(rowData);

  // Send HR Intake Alert Email to C1
  try {
    const specSheet = findSheet(ss, ["Specialist", "Specialists"]);
    if (specSheet) {
      const hrEmailsRaw = specSheet.getRange("C1").getValue();
      const hrRecipients = parseEmailList(hrEmailsRaw);

      if (hrRecipients.length > 0) {
        sendHrIntakeAlertEmail({
          hrRecipients: hrRecipients,
          requestId: requestId,
          requestType: cleanType,
          candidateName: `${firstName} ${lastName}`.trim(),
          site: site,
          requestedServices: requestedServices,
          originalTeacherName: origName,
          originalTeacherEmail: origEmail,
          submitterEmail: submitterEmail,
          isDemo: Boolean(payload.demoMode || payload.isDemo)
        });
      }
    }
  } catch (emailErr) {
    Logger.log("Error sending HR alert email: " + emailErr.toString());
  }

  return {
    success: true,
    message: "Request submitted successfully (Status: Pending HR)",
    requestId: requestId
  };
}

/**
 * ------------------------------------------------------------------------------
 * HR ASSIGNMENT WORKFLOW: assignEmail
 * ------------------------------------------------------------------------------
 */
function assignEmail(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reqSheet = findSheet(ss, ["Requests", "Request"]);
  const specSheet = findSheet(ss, ["Specialist", "Specialists"]);

  const requestId = String(payload.requestId || "").trim();
  const workEmail = String(payload.workEmail || "").toLowerCase().trim();

  if (!requestId || !workEmail) {
    return { success: false, error: "Request ID and Work Email are required." };
  }

  const data = reqSheet.getDataRange().getValues();
  let rowIndex = -1;
  let targetRow = null;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim().toUpperCase() === requestId.toUpperCase()) {
      rowIndex = r + 1;
      targetRow = data[r];
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: "Request not found: " + requestId };
  }

  const assignedAt = new Date();

  // Col G (7) = Work Email | Col L (12) = Status | Col N (14) = HR Assigned At
  reqSheet.getRange(rowIndex, 7).setValue(workEmail);
  reqSheet.getRange(rowIndex, 12).setValue("In Progress");
  reqSheet.getRange(rowIndex, 14).setValue(assignedAt);

  // Read requested topics to notify specialists
  const requestedServicesStr = String(targetRow[9] || "");
  const requestedServices = requestedServicesStr.split(",").map(s => s.trim()).filter(Boolean);

  // Map specialists from Col A & Col B of Specialist tab
  const specialistServiceMap = {}; // specialistEmail -> [serviceNames]

  if (specSheet) {
    const specData = specSheet.getDataRange().getValues();
    for (let r = 0; r < specData.length; r++) {
      const topicName = String(specData[r][0] || "").trim();
      if (!topicName) continue;

      const lower = topicName.toLowerCase();
      const forbiddenHeaders = ["topic", "topics", "service", "services", "system", "systems", "topic name", "service name"];
      if (forbiddenHeaders.includes(lower) || lower.startsWith("---") || lower.startsWith("(")) {
        continue;
      }

      if (requestedServices.some(s => s.toLowerCase() === topicName.toLowerCase())) {
        const emails = parseEmailList(specData[r][1]);
        emails.forEach(email => {
          if (!specialistServiceMap[email]) specialistServiceMap[email] = [];
          specialistServiceMap[email].push(topicName);
        });
      }
    }
  }

  // Fire emails to specialists
  try {
    Object.keys(specialistServiceMap).forEach(specEmail => {
      sendSpecialistDispatchEmail({
        specialistEmail: specEmail,
        requestId: requestId,
        candidateName: `${targetRow[4]} ${targetRow[5]}`.trim(),
        workEmail: workEmail,
        requestType: targetRow[2],
        site: targetRow[3],
        assignedServices: specialistServiceMap[specEmail],
        originalTeacherName: targetRow[7],
        originalTeacherEmail: targetRow[8],
        isDemo: Boolean(payload.demoMode || payload.isDemo)
      });
    });
  } catch (emailErr) {
    Logger.log("Error sending specialist dispatch emails: " + emailErr.toString());
  }

  return {
    success: true,
    message: `Work email ${workEmail} assigned. Dispatched to specialists.`,
    requestId: requestId,
    workEmail: workEmail,
    status: "In Progress"
  };
}

/**
 * ------------------------------------------------------------------------------
 * SPECIALIST WORKFLOW: toggleAccess
 * ------------------------------------------------------------------------------
 */
function toggleAccess(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reqSheet = findSheet(ss, ["Requests", "Request"]);
  const specSheet = findSheet(ss, ["Specialist", "Specialists"]);
  const siteSheet = findSheet(ss, ["Sites", "Site"]);

  const requestId = String(payload.requestId || "").trim();
  const serviceName = String(payload.serviceName || "").trim();
  const completed = Boolean(payload.completed);

  if (!requestId || !serviceName) {
    return { success: false, error: "Request ID and Service Name are required." };
  }

  const data = reqSheet.getDataRange().getValues();
  let rowIndex = -1;
  let targetRow = null;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim().toUpperCase() === requestId.toUpperCase()) {
      rowIndex = r + 1;
      targetRow = data[r];
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: "Request not found: " + requestId };
  }

  const requestedArr = String(targetRow[9] || "").split(",").map(s => s.trim()).filter(Boolean);
  let completedArr = String(targetRow[10] || "").split(",").map(s => s.trim()).filter(Boolean);

  if (completed) {
    if (!completedArr.some(s => s.toLowerCase() === serviceName.toLowerCase())) {
      completedArr.push(serviceName);
    }
  } else {
    completedArr = completedArr.filter(s => s.toLowerCase() !== serviceName.toLowerCase());
  }

  const newCompletedStr = completedArr.join(", ");
  reqSheet.getRange(rowIndex, 11).setValue(newCompletedStr);

  // Check if ALL requested topics are now completed
  const allCompleted = requestedArr.length > 0 && requestedArr.every(req =>
    completedArr.map(c => c.toLowerCase()).includes(req.toLowerCase())
  );

  let updatedStatus = targetRow[11];
  let finalNotifiedAt = targetRow[15];

  if (allCompleted) {
    updatedStatus = "Completed";
    finalNotifiedAt = new Date();
    reqSheet.getRange(rowIndex, 12).setValue(updatedStatus); // Col L
    reqSheet.getRange(rowIndex, 16).setValue(finalNotifiedAt); // Col P

    // Send final completion emails to HR (C1), CC: Site Principal & Admin Assistant
    try {
      let hrEmails = [];
      if (specSheet) {
        hrEmails = parseEmailList(specSheet.getRange("C1").getValue());
      }

      // Look up Site Principal (Col B) and Admin Assistant (Col C)
      const siteName = String(targetRow[3] || "").trim();
      let ccEmails = [];

      if (siteSheet) {
        const siteRows = siteSheet.getDataRange().getValues();
        for (let s = 0; s < siteRows.length; s++) {
          if (String(siteRows[s][0] || "").trim().toLowerCase() === siteName.toLowerCase()) {
            const principals = parseEmailList(siteRows[s][1]);
            const assistants = parseEmailList(siteRows[s][2]);
            ccEmails = [...principals, ...assistants];
            break;
          }
        }
      }

      // Add original submitter to CC
      const submitter = String(targetRow[12] || "").toLowerCase().trim();
      if (submitter && !ccEmails.includes(submitter)) {
        ccEmails.push(submitter);
      }

      sendFinalResolutionEmail({
        hrEmails: hrEmails,
        ccEmails: ccEmails,
        requestId: requestId,
        candidateName: `${targetRow[4]} ${targetRow[5]}`.trim(),
        workEmail: targetRow[6],
        requestType: targetRow[2],
        site: siteName,
        completedServices: completedArr,
        originalTeacherName: targetRow[7],
        isDemo: Boolean(payload.demoMode || payload.isDemo)
      });
    } catch (emailErr) {
      Logger.log("Error sending final resolution email: " + emailErr.toString());
    }
  } else if (targetRow[11] === "Completed") {
    // If an item was unchecked, return to In Progress
    updatedStatus = "In Progress";
    reqSheet.getRange(rowIndex, 12).setValue(updatedStatus);
  }

  return {
    success: true,
    requestId: requestId,
    serviceName: serviceName,
    completed: completed,
    accessCompleted: completedArr,
    allCompleted: allCompleted,
    status: updatedStatus
  };
}

/**
 * ------------------------------------------------------------------------------
 * COMMENTS / NOTES: addComment
 * ------------------------------------------------------------------------------
 */
function addComment(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reqSheet = findSheet(ss, ["Requests", "Request"]);
  const specSheet = findSheet(ss, ["Specialist", "Specialists"]);

  const requestId = String(payload.requestId || "").trim();
  const commentText = String(payload.commentText || "").trim();
  const userEmail = String(payload.userEmail || "").toLowerCase().trim();

  if (!requestId || !commentText) {
    return { success: false, error: "Request ID and comment text are required." };
  }

  const data = reqSheet.getDataRange().getValues();
  let rowIndex = -1;
  let targetRow = null;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim().toUpperCase() === requestId.toUpperCase()) {
      rowIndex = r + 1;
      targetRow = data[r];
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: "Request not found: " + requestId };
  }

  const existingComments = String(targetRow[14] || "").trim();
  const nowStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  const newCommentEntry = `[${nowStamp} ${userEmail || "staff"}]: ${commentText}`;
  const updatedComments = existingComments ? `${existingComments}\n${newCommentEntry}` : newCommentEntry;

  reqSheet.getRange(rowIndex, 15).setValue(updatedComments);

  // Send Comment Alert Email to HR (C1)
  try {
    if (specSheet) {
      const hrEmails = parseEmailList(specSheet.getRange("C1").getValue());
      if (hrEmails.length > 0) {
        sendCommentAlertEmail({
          hrEmails: hrEmails,
          requestId: requestId,
          candidateName: `${targetRow[4]} ${targetRow[5]}`.trim(),
          site: targetRow[3],
          authorEmail: userEmail,
          commentText: commentText,
          workEmail: targetRow[6],
          isDemo: Boolean(payload.demoMode || payload.isDemo)
        });
      }
    }
  } catch (emailErr) {
    Logger.log("Error sending comment alert email: " + emailErr.toString());
  }

  return {
    success: true,
    requestId: requestId,
    comments: updatedComments
  };
}

/**
 * ------------------------------------------------------------------------------
 * SUPER ADMIN OVERRIDES: adminOverride
 * ------------------------------------------------------------------------------
 */
function adminOverride(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reqSheet = findSheet(ss, ["Requests", "Request"]);
  const specSheet = findSheet(ss, ["Specialist", "Specialists"]);

  const requestId = String(payload.requestId || "").trim();
  const adminEmail = String(payload.adminEmail || "").toLowerCase().trim();

  // Validate admin permissions against Cell D1
  if (specSheet) {
    const adminEmailsRaw = specSheet.getRange("D1").getValue();
    const superAdminList = parseEmailList(adminEmailsRaw);
    if (!superAdminList.includes(adminEmail)) {
      return { success: false, error: "Unauthorized: Super Admin credentials required (Cell D1)." };
    }
  }

  const data = reqSheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim().toUpperCase() === requestId.toUpperCase()) {
      rowIndex = r + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: "Request not found: " + requestId };
  }

  if (payload.status) reqSheet.getRange(rowIndex, 12).setValue(payload.status);
  if (payload.workEmail !== undefined) reqSheet.getRange(rowIndex, 7).setValue(payload.workEmail);
  if (payload.accessCompleted !== undefined) {
    const compStr = Array.isArray(payload.accessCompleted) ? payload.accessCompleted.join(", ") : String(payload.accessCompleted);
    reqSheet.getRange(rowIndex, 11).setValue(compStr);
  }

  return { success: true, message: "Admin override applied successfully." };
}

/**
 * ==============================================================================
 * HTML EMAIL TEMPLATES
 * ==============================================================================
 */

/**
 * Safe helper to send emails using GmailApp with HTML support, fallback, and sender name
 */
function sendEmailWithGmailApp_(to, subject, htmlBody, cc, isDemo) {
  if (isDemo) {
    Logger.log("[DEMO MODE ACTIVE] Live email dispatch suppressed. Target: " + (Array.isArray(to) ? to.join(",") : to) + " | Subject: " + subject);
    return;
  }
  if (!to) return;
  const toStr = Array.isArray(to) ? to.filter(Boolean).join(",") : String(to).trim();
  if (!toStr) return;

  const options = {
    htmlBody: htmlBody,
    name: "WVUSD Onboarding Portal"
  };

  if (cc) {
    const ccStr = Array.isArray(cc) ? cc.filter(Boolean).join(",") : String(cc).trim();
    if (ccStr) {
      options.cc = ccStr;
    }
  }

  GmailApp.sendEmail(
    toStr,
    subject,
    "Please view this notification using an HTML-compatible email client.",
    options
  );
}

function sendHrIntakeAlertEmail(params) {
  const subject = `[WVUSD Onboarding] New Access Request: ${params.candidateName} (${params.site})`;

  const subInfoHtml = params.requestType === "Long-Term Sub" ? `
    <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin: 16px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #92400e;">Substitute Assignment Details:</p>
      <p style="margin: 0; font-size: 12px; color: #78350f;">
        Covering for: <strong>${params.originalTeacherName || "N/A"}</strong> (${params.originalTeacherEmail || "No email provided"})
      </p>
    </div>
  ` : "";

  const servicesBadges = params.requestedServices.map(s =>
    `<span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; margin: 2px 4px 2px 0;">${s}</span>`
  ).join("");

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #0b3f6d 0%, #0170c5 100%); padding: 24px; text-align: center; color: #ffffff;">
          <img src="${DISTRICT_LOGO}" alt="WVUSD Logo" style="height: 52px; width: auto; margin-bottom: 8px;" />
          <h2 style="margin: 0; font-size: 18px; font-weight: 800;">WVUSD Onboarding & Access Portal</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">New Employee / Long-Term Sub Access Request</p>
        </div>

        <div style="padding: 24px; color: #1e293b;">
          <div style="display: inline-block; background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; margin-bottom: 12px;">
            ACTION REQUIRED: HR WORK EMAIL ASSIGNMENT
          </div>

          <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
            ${params.candidateName}
          </h3>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;">Request ID:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${params.requestId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Request Type:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0284c7;">${params.requestType}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">School / Site:</td>
              <td style="padding: 6px 0; font-weight: 600;">${params.site}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Submitted By:</td>
              <td style="padding: 6px 0; color: #334155;">${params.submitterEmail}</td>
            </tr>
          </table>

          ${subInfoHtml}

          <div style="margin: 16px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Requested Topics & Services:</p>
            <div>${servicesBadges}</div>
          </div>

          <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-top: 20px;">
            Please log into the WVUSD Onboarding Portal to assign the candidate's official district work email. Entering the email transitions the status to <strong>In Progress</strong> and notifies the assigned specialists.
          </p>
        </div>

        <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          Walnut Valley Unified School District • Human Resources
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmailWithGmailApp_(params.hrRecipients, subject, htmlBody, null, params.isDemo);
}

function sendSpecialistDispatchEmail(params) {
  const subject = `[WVUSD Access Task] System Provisioning for ${params.candidateName} (${params.site})`;

  const servicesHtml = params.assignedServices.map(s =>
    `<li style="margin-bottom: 4px; font-weight: 600; color: #0284c7;">${s}</li>`
  ).join("");

  const subInfoHtml = params.requestType === "Long-Term Sub" ? `
    <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 10px; margin: 12px 0; font-size: 12px; color: #78350f;">
      <strong>Substitute Assignment:</strong> Covering for <em>${params.originalTeacherName || "N/A"}</em> (${params.originalTeacherEmail || "N/A"}).
    </div>
  ` : "";

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #0b3f6d 0%, #0170c5 100%); padding: 20px; text-align: center; color: #ffffff;">
          <img src="${DISTRICT_LOGO}" alt="WVUSD Logo" style="height: 48px; width: auto; margin-bottom: 6px;" />
          <h2 style="margin: 0; font-size: 17px; font-weight: 800;">WVUSD System Provisioning Task</h2>
        </div>

        <div style="padding: 24px; color: #1e293b;">
          <p style="font-size: 14px; margin-top: 0;">
            A new employee or long-term substitute has been assigned an official District Work Email. Please provision access for your assigned topic(s):
          </p>

          <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #64748b; font-weight: 600; width: 130px; padding: 4px 0;">Candidate:</td>
                <td style="font-weight: 800; color: #0f172a; padding: 4px 0;">${params.candidateName}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Work Email:</td>
                <td style="font-weight: 700; color: #0369a1; padding: 4px 0; font-family: monospace;">${params.workEmail}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Type / Site:</td>
                <td style="padding: 4px 0;">${params.requestType} • <strong>${params.site}</strong></td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Request ID:</td>
                <td style="padding: 4px 0; font-weight: bold;">${params.requestId}</td>
              </tr>
            </table>
          </div>

          ${subInfoHtml}

          <div style="margin: 16px 0;">
            <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #0f172a;">Your Responsible System Topics:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
              ${servicesHtml}
            </ul>
          </div>

          <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-top: 20px;">
            Once you have provisioned access or verified the account, please check off the corresponding items in the WVUSD Onboarding Portal.
          </p>
        </div>

        <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          WVUSD System Provisioning Task Notification
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmailWithGmailApp_(params.specialistEmail, subject, htmlBody, null, params.isDemo);
}

function sendCommentAlertEmail(params) {
  const subject = `[WVUSD Note] Specialist Comment on ${params.candidateName} (${params.requestId})`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: #0f172a; padding: 18px 24px; color: #ffffff;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Specialist Note Logged</h3>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Candidate: ${params.candidateName} • ${params.site}</p>
        </div>

        <div style="padding: 24px; color: #1e293b;">
          <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 16px;">
            <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #64748b;">
              Note from ${params.authorEmail}:
            </p>
            <p style="margin: 0; font-size: 14px; color: #0f172a; line-height: 1.5; white-space: pre-wrap;">${params.commentText}</p>
          </div>

          <table style="font-size: 12px; color: #64748b;">
            <tr><td>Request ID:</td><td style="font-weight: 600; color: #1e293b; padding-left: 8px;">${params.requestId}</td></tr>
            <tr><td>Work Email:</td><td style="font-weight: 600; color: #1e293b; padding-left: 8px;">${params.workEmail || "Pending Assignment"}</td></tr>
          </table>
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmailWithGmailApp_(params.hrEmails, subject, htmlBody, null, params.isDemo);
}

function sendFinalResolutionEmail(params) {
  const subject = `[COMPLETED] System Access Fully Provisioned: ${params.candidateName} (${params.site})`;

  const servicesBadges = params.completedServices.map(s =>
    `<span style="display: inline-block; background-color: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; margin: 2px 4px 2px 0;">✓ ${s}</span>`
  ).join("");

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #065f46 0%, #059669 100%); padding: 24px; text-align: center; color: #ffffff;">
          <img src="${DISTRICT_LOGO}" alt="WVUSD Logo" style="height: 52px; width: auto; margin-bottom: 8px;" />
          <h2 style="margin: 0; font-size: 18px; font-weight: 800;">System Access Provisioning Complete</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">All requested system credentials have been activated</p>
        </div>

        <div style="padding: 24px; color: #1e293b;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; width: 44px; height: 44px; background: #dcfce7; color: #16a34a; border-radius: 50%; font-size: 24px; line-height: 44px; font-weight: bold;">
              ✓
            </div>
            <h3 style="margin: 10px 0 2px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
              ${params.candidateName}
            </h3>
            <p style="margin: 0; font-size: 13px; color: #64748b;">
              ${params.requestType} • <strong>${params.site}</strong>
            </p>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #64748b; font-weight: 600; width: 130px; padding: 4px 0;">Work Email:</td>
                <td style="font-weight: 700; color: #059669; padding: 4px 0; font-family: monospace;">${params.workEmail}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Request ID:</td>
                <td style="padding: 4px 0; font-weight: bold;">${params.requestId}</td>
              </tr>
              ${params.originalTeacherName ? `
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Covering For:</td>
                <td style="padding: 4px 0;">${params.originalTeacherName}</td>
              </tr>
              ` : ""}
            </table>
          </div>

          <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Completed Topics & Systems:</p>
            <div>${servicesBadges}</div>
          </div>

          <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
            All system provisioning tasks have been checked off. The candidate is fully activated and ready for site duties.
          </p>
        </div>

        <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          Walnut Valley Unified School District • Automated Resolution Alert
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmailWithGmailApp_(params.hrEmails, subject, htmlBody, params.ccEmails, params.isDemo);
}

/**
 * ------------------------------------------------------------------------------
 * AUTOMATED 3-DAY REMINDER WORKFLOW
 * Runs via daily Time-Driven trigger in Apps Script or can be called via web API.
 * Finds all requests in "In Progress" where >= 3 days have elapsed since
 * assignment without all specialist items being completed.
 * ------------------------------------------------------------------------------
 */
function sendPendingSpecialistReminders(isDemo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reqSheet = findSheet(ss, ["Requests", "Request"]);
  const specSheet = findSheet(ss, ["Specialist", "Specialists"]);

  if (!reqSheet || !specSheet || reqSheet.getLastRow() < 2) {
    return { success: true, message: "No requests found to evaluate.", remindersSent: 0 };
  }

  const now = new Date();
  const nowMs = now.getTime();
  const reqData = reqSheet.getDataRange().getValues();
  const specData = specSheet.getDataRange().getValues();

  // Build topic -> [specialistEmails] map
  const topicMap = {};
  const forbiddenHeaders = ["topic", "topics", "service", "services", "system", "systems", "topic name", "service name"];
  for (let r = 0; r < specData.length; r++) {
    const topic = String(specData[r][0] || "").trim();
    if (!topic) continue;
    const lower = topic.toLowerCase();
    if (forbiddenHeaders.includes(lower) || lower.startsWith("---") || lower.startsWith("(")) continue;
    topicMap[lower] = parseEmailList(specData[r][1]);
  }

  let remindersSent = 0;
  const logEntries = [];

  for (let r = 1; r < reqData.length; r++) {
    const row = reqData[r];
    const status = String(row[11] || "").trim();
    if (status !== "In Progress") continue;

    const requestId = String(row[0] || "").trim();
    const candidateName = `${row[4]} ${row[5]}`.trim();
    const site = String(row[3] || "").trim();
    const workEmail = String(row[6] || "").trim();
    const comments = String(row[14] || "").trim();

    // Determine baseline date: HR Assigned At (Col N), fallback Created At (Col B)
    const assignedDate = row[13] ? new Date(row[13]) : (row[1] ? new Date(row[1]) : now);
    const daysSinceAssigned = Math.floor((nowMs - assignedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceAssigned < 3) continue;

    // Remaining incomplete topics
    const requestedArr = String(row[9] || "").split(",").map(s => s.trim()).filter(Boolean);
    const completedArr = String(row[10] || "").split(",").map(s => s.trim()).filter(Boolean);
    const pendingTopics = requestedArr.filter(reqTopic =>
      !completedArr.some(c => c.toLowerCase() === reqTopic.toLowerCase())
    );

    if (pendingTopics.length === 0) continue;

    // Check last reminder timestamp recorded in comments to enforce 3-day spacing
    const lastReminderMatch = comments.match(/\[Reminder Sent:\s*(\d{4}-\d{2}-\d{2})\]/g);
    if (lastReminderMatch && lastReminderMatch.length > 0) {
      const lastEntry = lastReminderMatch[lastReminderMatch.length - 1];
      const dateMatch = lastEntry.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const lastDate = new Date(dateMatch[1]);
        const daysSinceLastReminder = Math.floor((nowMs - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastReminder < 3) {
          continue; // Already reminded within the last 3 days
        }
      }
    }

    // Map each pending specialist email to the topics they still owe
    const specialistOwedTopics = {}; // email -> [topics]
    pendingTopics.forEach(topic => {
      const emails = topicMap[topic.toLowerCase()] || [];
      emails.forEach(email => {
        if (!specialistOwedTopics[email]) specialistOwedTopics[email] = [];
        specialistOwedTopics[email].push(topic);
      });
    });

    const nowStampDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
    const nowStampTime = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");

    // Fire reminders to each specialist
    Object.keys(specialistOwedTopics).forEach(specEmail => {
      sendSpecialistReminderEmail({
        specialistEmail: specEmail,
        requestId: requestId,
        candidateName: candidateName,
        workEmail: workEmail,
        site: site,
        pendingTopics: specialistOwedTopics[specEmail],
        daysPending: daysSinceAssigned,
        isDemo: isDemo
      });
      remindersSent++;
    });

    // Append reminder note into record
    const reminderLog = `[${nowStampTime} System Reminder Sent: ${nowStampDate}]: Dispatched 3-day reminder for pending items (${pendingTopics.join(", ")})`;
    const updatedComments = comments ? `${comments}\n${reminderLog}` : reminderLog;
    reqSheet.getRange(r + 1, 15).setValue(updatedComments);
    logEntries.push(`${requestId} (${candidateName}): Reminded ${Object.keys(specialistOwedTopics).join(", ")}`);
  }

  return {
    success: true,
    remindersSent: remindersSent,
    log: logEntries,
    timestamp: now.toISOString()
  };
}

function sendSpecialistReminderEmail(params) {
  const subject = `[ACTION REQUIRED - 3-DAY REMINDER] Pending Provisioning: ${params.candidateName} (${params.site})`;

  const topicsListHtml = params.pendingTopics.map(t =>
    `<li style="margin-bottom: 6px; font-weight: 700; color: #b45309; font-size: 14px;">${t}</li>`
  ).join("");

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #fde68a; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #78350f 0%, #b45309 100%); padding: 22px; text-align: center; color: #ffffff;">
          <img src="${DISTRICT_LOGO}" alt="WVUSD Logo" style="height: 48px; width: auto; margin-bottom: 6px;" />
          <h2 style="margin: 0; font-size: 18px; font-weight: 800;">Pending System Provisioning Reminder</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Action required: ${params.daysPending} days since assignment</p>
        </div>

        <div style="padding: 24px; color: #1e293b;">
          <p style="font-size: 14px; margin-top: 0; color: #334155; line-height: 1.5;">
            This is an automated 3-day reminder that system access for <strong>${params.candidateName}</strong> is still pending your action:
          </p>

          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #92400e; font-weight: 600; width: 130px; padding: 4px 0;">Candidate:</td>
                <td style="font-weight: 800; color: #78350f; padding: 4px 0;">${params.candidateName}</td>
              </tr>
              <tr>
                <td style="color: #92400e; font-weight: 600; padding: 4px 0;">Work Email:</td>
                <td style="font-weight: 700; color: #0284c7; padding: 4px 0; font-family: monospace;">${params.workEmail}</td>
              </tr>
              <tr>
                <td style="color: #92400e; font-weight: 600; padding: 4px 0;">School / Site:</td>
                <td style="padding: 4px 0; font-weight: 600;">${params.site}</td>
              </tr>
              <tr>
                <td style="color: #92400e; font-weight: 600; padding: 4px 0;">Request ID:</td>
                <td style="padding: 4px 0; font-weight: bold;">${params.requestId}</td>
              </tr>
            </table>
          </div>

          <div style="margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase;">Your Pending Systems to Complete:</p>
            <ul style="margin: 0; padding-left: 20px;">
              ${topicsListHtml}
            </ul>
          </div>

          <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-top: 20px;">
            Please log into the WVUSD Onboarding Portal to mark your assigned system items as completed once provisioned.
          </p>
        </div>

        <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          Walnut Valley Unified School District • Automated Reminder Service
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmailWithGmailApp_(params.specialistEmail, subject, htmlBody, null, params.isDemo);
}
