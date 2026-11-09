/**
 * ==============================================================================
 * WALNUT VALLEY UNIFIED SCHOOL DISTRICT (WVUSD)
 * Onboarding & Long-Term Substitute Teacher System Access Portal
 * Google Apps Script Web App Backend (Code.gs)
 * ==============================================================================
 *
 * SPREADSHEET STRUCTURE:
 *
 * 1. "Sites" Tab:
 *    - Col A: Site (School Name)
 *    - Col B: Principal Email (comma-separated if multiple)
 *    - Col C: Admin Assistant Email (comma-separated if multiple)
 *
 * 2. "Specialist" (or "Specialists") Tab:
 *    - Col A: Topic (System / Service name)
 *    - Col B: Specialist Email (comma-separated if multiple)
 *    - Cell C1: Sub HR Specialists (comma-separated)
 *    - Cell D1: Super Admin (comma-separated)
 *    - Cell E1: Classified HR Specialists (comma-separated)
 *    - Cell F1: Certificated HR Specialists (comma-separated)
 *
 * 3. "Requests" Tab:
 *    - Col A: Request ID (e.g. REQ-1001)
 *    - Col B: Created At (ISO timestamp)
 *    - Col C: Request Type ("New Employee" | "Long-Term Sub")
 *    - Col D: Employee Type ("Classified" | "Certificated" | "Substitute")
 *    - Col E: Site
 *    - Col F: First Name
 *    - Col G: Last Name
 *    - Col H: Work Email
 *    - Col I: Original Teacher Name
 *    - Col J: Original Teacher Email
 *    - Col K: Access Requested (comma-separated topics)
 *    - Col L: Access Completed (comma-separated topics)
 *    - Col M: Status ("Pending HR" | "In Progress" | "Completed" | "Cancelled")
 *    - Col N: Submitter Email
 *    - Col O: HR Assigned At
 *    - Col P: Comments
 *    - Col Q: Final Notified At
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
 * Helper: Routes request to the correct HR specialists based on Sub (C1), Classified (E1), Certificated (F1)
 * Rule:
 * 1. All sub requests (classified or certificated) -> Specialist!C1 (Sub HR)
 * 2. All classified new employees -> Specialist!E1 (Classified HR)
 * 3. All certificated new employees -> Specialist!F1 (Certificated HR)
 */
function getHrEmailsForRequest(specSheet, requestType, employeeType) {
  if (!specSheet) return [];
  const row0 = specSheet.getRange(1, 1, 1, 6).getValues()[0];
  const subEmails = parseEmailList(row0[2] || "");          // C1: Sub HR
  const classifiedEmails = parseEmailList(row0[4] || "");   // E1: Classified HR
  const certificatedEmails = parseEmailList(row0[5] || ""); // F1: Certificated HR
  const allHr = [...new Set([...subEmails, ...classifiedEmails, ...certificatedEmails])];

  const reqType = String(requestType || "").toLowerCase().trim();
  const empType = String(employeeType || "").toLowerCase().trim();

  // All sub requests (classified or certificated) go to Specialist!C1
  if (reqType.includes("sub") || empType === "substitute") {
    return subEmails.length > 0 ? subEmails : allHr;
  }
  // All classified new employees go to Specialist!E1
  if (empType.includes("class")) {
    return classifiedEmails.length > 0 ? classifiedEmails : allHr;
  }
  // All certificated new employees go to Specialist!F1
  if (empType.includes("cert")) {
    return certificatedEmails.length > 0 ? certificatedEmails : allHr;
  }

  return allHr;
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
      "Employee Type",
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
 * 2. "Specialist" tab (C1: Sub HR, D1: Super Admin, E1: Classified HR, F1: Certificated HR, Col A: Topic, Col B: Specialist Email)
 * 3. "Requests" tab (17 columns: A through Q)
 * ------------------------------------------------------------------------------
 */
function getInitialData(userEmail) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRequestsTab();

  const cleanUserEmail = userEmail ? String(userEmail).toLowerCase().trim() : "";

  // 1. Read "Specialist" (or "Specialists") Tab
  const specSheet = findSheet(ss, ["Specialist", "Specialists"]);
  let hrSubEmails = [];
  let hrClassifiedEmails = [];
  let hrCertificatedEmails = [];
  let superAdminEmails = [];
  const services = []; // { serviceName, specialistEmails }

  if (specSheet) {
    const specData = specSheet.getDataRange().getValues();

    // Read Cell C1 (Sub HR), D1 (Super Admin), E1 (Classified HR), F1 (Certificated HR)
    if (specData.length > 0) {
      const row0 = specData[0];
      if (row0.length > 2) hrSubEmails = parseEmailList(row0[2]);          // C1
      if (row0.length > 3) superAdminEmails = parseEmailList(row0[3]);     // D1
      if (row0.length > 4) hrClassifiedEmails = parseEmailList(row0[4]);   // E1
      if (row0.length > 5) hrCertificatedEmails = parseEmailList(row0[5]); // F1
    }

    // Read Topics (Col A) and Specialist Emails (Col B)
    for (let r = 0; r < specData.length; r++) {
      const topicName = String(specData[r][0] || "").trim();
      if (!topicName) continue;

      const lower = topicName.toLowerCase();
      // Skip header labels
      const forbiddenHeaders = ["topic", "topics", "service", "services", "system", "systems", "topic name", "service name", "all topics"];
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

  const allHrEmails = [...new Set([...hrSubEmails, ...hrClassifiedEmails, ...hrCertificatedEmails])];

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
  const isHrSub = cleanUserEmail && hrSubEmails.includes(cleanUserEmail);
  const isHrClassified = cleanUserEmail && hrClassifiedEmails.includes(cleanUserEmail);
  const isHrCertificated = cleanUserEmail && hrCertificatedEmails.includes(cleanUserEmail);
  const isHr = cleanUserEmail && (allHrEmails.includes(cleanUserEmail) || isHrSub || isHrClassified || isHrCertificated);
  const isSiteStaff = cleanUserEmail && userAuthorizedSites.length > 0;

  // Check Specialist role: user is listed in Col B of any service topic
  const assignedServices = [];
  services.forEach(srv => {
    if (cleanUserEmail && srv.specialistEmails.includes(cleanUserEmail)) {
      assignedServices.push(srv.serviceName);
    }
  });
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

      const accessReqStr = String(row[10] || "");
      const accessCompStr = String(row[11] || "");

      const requestedArr = accessReqStr.split(",").map(s => s.trim()).filter(Boolean);
      const completedArr = accessCompStr.split(",").map(s => s.trim()).filter(Boolean);

      requests.push({
        rowIndex: r + 1,
        id: reqId,
        createdAt: row[1] ? new Date(row[1]).toISOString() : "",
        requestType: String(row[2] || "New Employee").trim(),
        employeeType: String(row[3] || "").trim(),
        site: String(row[4] || "").trim(),
        firstName: String(row[5] || "").trim(),
        lastName: String(row[6] || "").trim(),
        fullName: `${String(row[5] || "").trim()} ${String(row[6] || "").trim()}`.trim(),
        workEmail: String(row[7] || "").trim(),
        originalTeacherName: String(row[8] || "").trim(),
        originalTeacherEmail: String(row[9] || "").trim(),
        accessRequested: requestedArr,
        accessCompleted: completedArr,
        status: String(row[12] || "Pending HR").trim(),
        submitterEmail: String(row[13] || "").trim(),
        hrAssignedAt: row[14] ? new Date(row[14]).toISOString() : "",
        comments: String(row[15] || "").trim(),
        finalNotifiedAt: row[16] ? new Date(row[16]).toISOString() : ""
      });
    }
  }

  return {
    requests: requests,
    services: services,
    sites: sites,
    hrEmails: allHrEmails,
    hrSubEmails: hrSubEmails,
    hrClassifiedEmails: hrClassifiedEmails,
    hrCertificatedEmails: hrCertificatedEmails,
    superAdminEmails: superAdminEmails,
    currentUser: {
      email: cleanUserEmail,
      isSuperAdmin: Boolean(isSuperAdmin),
      isHr: Boolean(isHr),
      isHrSub: Boolean(isHrSub),
      isHrClassified: Boolean(isHrClassified),
      isHrCertificated: Boolean(isHrCertificated),
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
 * Appends row to "Requests" tab with Status: "Pending HR"
 * Dispatches intake alert email to Sub HR (C1), Classified HR (E1), or Certificated HR (F1)
 * ------------------------------------------------------------------------------
 */
function submitRequest(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRequestsTab();
  const reqSheet = findSheet(ss, ["Requests", "Request"]);

  const cleanType = String(payload.requestType || "New Employee").trim();
  const employeeType = String(payload.employeeType || "Classified").trim();
  const site = String(payload.site || "").trim();
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  const origName = cleanType === "Long-Term Sub" ? String(payload.originalTeacherName || "").trim() : "";
  const origEmail = cleanType === "Long-Term Sub" ? String(payload.originalTeacherEmail || "").trim() : "";
  const submitterEmail = String(payload.submitterEmail || "").toLowerCase().trim();

  let requestedServices = [];
  if (Array.isArray(payload.requestedServices)) {
    requestedServices = payload.requestedServices;
  } else if (payload.requestedServices) {
    requestedServices = String(payload.requestedServices).split(",").map(s => s.trim()).filter(Boolean);
  }

  // Filter out header labels from requested services
  const forbiddenHeaders = ["topic", "topics", "service", "services", "system", "systems", "topic name", "service name", "all topics"];
  requestedServices = requestedServices.filter(s => !forbiddenHeaders.includes(s.toLowerCase()));

  if (!site || !firstName || !lastName) {
    return { success: false, error: "Site, First Name, and Last Name are required." };
  }

  if (cleanType === "Long-Term Sub" && !origName) {
    return { success: false, error: "Original Teacher Name is required for Long-Term Subs." };
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

  // 17 columns schema: A through Q
  // [ID, CreatedAt, Type, EmployeeType, Site, First, Last, WorkEmail, OrigName, OrigEmail, AccessReq, AccessComp, Status, Submitter, HRAssignedAt, Comments, FinalNotifiedAt]
  const rowData = [
    requestId,
    createdAt,
    cleanType,
    employeeType,
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
    `[${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")} Submitter]: Initial access request submitted.`, // Comments
    ""  // Final Notified At
  ];

  reqSheet.appendRow(rowData);

  // Send HR Intake Alert Email to appropriate specialist (Sub -> C1, Classified -> E1, Certificated -> F1)
  try {
    const specSheet = findSheet(ss, ["Specialist", "Specialists"]);
    if (specSheet) {
      const hrRecipients = getHrEmailsForRequest(specSheet, cleanType, employeeType);

      if (hrRecipients.length > 0) {
        sendHrIntakeAlertEmail({
          hrRecipients: hrRecipients,
          requestId: requestId,
          requestType: cleanType,
          employeeType: employeeType,
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
 * HR WORKFLOW: assignEmail
 * Updates Work Email (Col H), Status -> "In Progress" (Col M), logs HR Assigned At (Col O)
 * Dispatches automated notification emails to specialists assigned to requested services
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

  // Col H (8): Work Email
  // Col M (13): Status -> "In Progress"
  // Col O (15): HR Assigned At
  reqSheet.getRange(rowIndex, 8).setValue(workEmail);
  reqSheet.getRange(rowIndex, 13).setValue("In Progress");
  reqSheet.getRange(rowIndex, 15).setValue(assignedAt);

  // Read requested services from Col K (index 10)
  const requestedServicesStr = String(targetRow[10] || "");
  const requestedServices = requestedServicesStr
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // Group services by specialist email from Specialist tab
  const specialistServiceMap = {};
  if (specSheet) {
    const specData = specSheet.getDataRange().getValues();
    const forbiddenHeaders = ["topic", "topics", "service", "services", "system", "systems", "topic name", "service name", "all topics"];
    for (let r = 0; r < specData.length; r++) {
      const topicName = String(specData[r][0] || "").trim();
      if (!topicName) continue;

      const lower = topicName.toLowerCase();
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
        candidateName: `${targetRow[5]} ${targetRow[6]}`.trim(),
        workEmail: workEmail,
        requestType: targetRow[2],
        employeeType: targetRow[3],
        site: targetRow[4],
        assignedServices: specialistServiceMap[specEmail],
        originalTeacherName: targetRow[8],
        originalTeacherEmail: targetRow[9],
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
 * Marks/unmarks service in Access Completed (Col L).
 * If all requested items are complete:
 * - Status -> "Completed" (Col M)
 * - Final Notified At recorded (Col Q)
 * - Final completion email sent to HR (looked up by type) and CCs Site Leadership
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

  // Col K (index 10): Access Requested
  // Col L (index 11): Access Completed
  const requestedArr = String(targetRow[10] || "").split(",").map(s => s.trim()).filter(Boolean);
  let completedArr = String(targetRow[11] || "").split(",").map(s => s.trim()).filter(Boolean);

  if (completed) {
    if (!completedArr.some(s => s.toLowerCase() === serviceName.toLowerCase())) {
      completedArr.push(serviceName);
    }
  } else {
    completedArr = completedArr.filter(s => s.toLowerCase() !== serviceName.toLowerCase());
  }

  const newCompletedStr = completedArr.join(", ");
  reqSheet.getRange(rowIndex, 12).setValue(newCompletedStr); // Col L (12)

  // Check if ALL requested services are completed
  const allCompleted = requestedArr.length > 0 && requestedArr.every(reqService =>
    completedArr.some(c => c.toLowerCase() === reqService.toLowerCase())
  );

  let updatedStatus = targetRow[12]; // Col M (13)
  let finalNotifiedAt = targetRow[16]; // Col Q (17)

  if (allCompleted && updatedStatus !== "Completed") {
    updatedStatus = "Completed";
    finalNotifiedAt = new Date();

    reqSheet.getRange(rowIndex, 13).setValue(updatedStatus); // Col M
    reqSheet.getRange(rowIndex, 17).setValue(finalNotifiedAt); // Col Q

    // Send final completion emails to appropriate HR and CC Site Leadership
    try {
      let hrEmails = [];
      if (specSheet) {
        hrEmails = getHrEmailsForRequest(specSheet, targetRow[2], targetRow[3]);
      }

      // Lookup site leadership from Sites tab
      const siteName = String(targetRow[4] || "").trim();
      let siteCcEmails = [];
      if (siteSheet && siteName) {
        const siteData = siteSheet.getDataRange().getValues();
        for (let s = 1; s < siteData.length; s++) {
          if (String(siteData[s][0]).toLowerCase().trim() === siteName.toLowerCase().trim()) {
            const principalEmails = parseEmailList(siteData[s][1]);
            const officeEmails = parseEmailList(siteData[s][2]);
            siteCcEmails = [...new Set([...principalEmails, ...officeEmails])];
            break;
          }
        }
      }

      const submitter = String(targetRow[13] || "").toLowerCase().trim();
      if (submitter && !siteCcEmails.includes(submitter)) {
        siteCcEmails.push(submitter);
      }

      sendFinalResolutionEmail({
        hrEmails: hrEmails,
        ccEmails: siteCcEmails,
        requestId: requestId,
        candidateName: `${targetRow[5]} ${targetRow[6]}`.trim(),
        workEmail: targetRow[7],
        requestType: targetRow[2],
        employeeType: targetRow[3],
        site: targetRow[4],
        completedServices: completedArr,
        originalTeacherName: targetRow[8],
        isDemo: Boolean(payload.demoMode || payload.isDemo)
      });
    } catch (emailErr) {
      Logger.log("Error sending final completion email: " + emailErr.toString());
    }
  } else if (targetRow[12] === "Completed" && !allCompleted) {
    updatedStatus = "In Progress";
    reqSheet.getRange(rowIndex, 13).setValue(updatedStatus);
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
 * Logs comment to Col P (16) and emails appropriate HR specialist(s)
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

  const existingComments = String(targetRow[15] || "").trim();
  const nowStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  const newCommentEntry = `[${nowStamp} ${userEmail || "staff"}]: ${commentText}`;
  const updatedComments = existingComments ? `${existingComments}\n${newCommentEntry}` : newCommentEntry;

  reqSheet.getRange(rowIndex, 16).setValue(updatedComments); // Col P (16)

  // Send Comment Alert Email to appropriate HR specialist(s)
  try {
    if (specSheet) {
      const hrEmails = getHrEmailsForRequest(specSheet, targetRow[2], targetRow[3]);
      if (hrEmails.length > 0) {
        sendCommentAlertEmail({
          hrEmails: hrEmails,
          requestId: requestId,
          candidateName: `${targetRow[5]} ${targetRow[6]}`.trim(),
          requestType: targetRow[2],
          employeeType: targetRow[3],
          site: targetRow[4],
          authorEmail: userEmail,
          commentText: commentText,
          workEmail: targetRow[7],
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
 * Full privilege updates validated against Cell D1
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

  // Col D (4): Employee Type
  if (payload.employeeType !== undefined) reqSheet.getRange(rowIndex, 4).setValue(payload.employeeType);
  // Col H (8): Work Email
  if (payload.workEmail !== undefined) reqSheet.getRange(rowIndex, 8).setValue(payload.workEmail);
  // Col L (12): Access Completed
  if (payload.accessCompleted !== undefined) {
    const compStr = Array.isArray(payload.accessCompleted) ? payload.accessCompleted.join(", ") : String(payload.accessCompleted);
    reqSheet.getRange(rowIndex, 12).setValue(compStr);
  }
  // Col M (13): Status
  if (payload.status) reqSheet.getRange(rowIndex, 13).setValue(payload.status);

  return { success: true, message: "Admin override applied successfully." };
}

/**
 * ==============================================================================
 * HTML EMAIL DISPATCH VIA GMAILAPP
 * ==============================================================================
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
  const typeTag = params.employeeType ? `[${params.employeeType}] ` : "";
  const subject = `[WVUSD Onboarding] ${typeTag}New Access Request: ${params.candidateName} (${params.site})`;

  const servicesBadges = params.requestedServices
    .map(s => `<span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; padding: 4px 10px; margin: 2px 4px 2px 0; border-radius: 6px; font-size: 12px; font-weight: 600; border: 1px solid #bfdbfe;">${s}</span>`)
    .join(" ");

  const isSub = params.requestType === "Long-Term Sub";

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <div style="background: linear-gradient(135deg, #0b3f6d 0%, #1e3a8a 100%); color: #ffffff; padding: 24px; text-align: left;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #93c5fd;">Walnut Valley Unified School District</span>
                <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff;">New System Access Request Submitted</h1>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding: 24px;">
          <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #64748b; font-weight: 600; width: 130px; padding: 4px 0;">Request ID:</td>
                <td style="font-weight: 700; color: #0b3f6d; padding: 4px 0;">${params.requestId}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Candidate:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 4px 0;">${params.candidateName}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Request Type:</td>
                <td style="padding: 4px 0;"><span style="background-color: ${isSub ? '#f3e8ff' : '#e0e7ff'}; color: ${isSub ? '#6b21a8' : '#3730a3'}; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${params.requestType}</span></td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Employee Type:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 4px 0;">${params.employeeType || "N/A"}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">School / Site:</td>
                <td style="font-weight: 600; color: #334155; padding: 4px 0;">${params.site}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Submitted By:</td>
                <td style="color: #334155; padding: 4px 0;">${params.submitterEmail || 'Site Staff'}</td>
              </tr>
              ${isSub ? `
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Covering For:</td>
                <td style="font-weight: 600; color: #7e22ce; padding: 4px 0;">${params.originalTeacherName} (${params.originalTeacherEmail || 'No email provided'})</td>
              </tr>
              ` : ""}
            </table>
          </div>

          <div style="margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Requested Systems & Services:</p>
            <div>${servicesBadges}</div>
          </div>

          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #92400e; margin-bottom: 20px;">
            <strong>Action Required by HR:</strong> Please log into the Onboarding Portal to assign the official district email address. Assigning the email will automatically dispatch task notices to all assigned system specialists.
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          Walnut Valley Unified School District • Human Resources Automation
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmailWithGmailApp_(params.hrRecipients, subject, htmlBody, null, params.isDemo);
}

function sendSpecialistDispatchEmail(params) {
  const subject = `[Action Required] System Access Task: ${params.candidateName} (${params.site})`;

  const servicesBadges = params.assignedServices
    .map(s => `<span style="display: inline-block; background-color: #ecfdf5; color: #047857; padding: 4px 10px; margin: 2px 4px 2px 0; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid #a7f3d0;">✓ ${s}</span>`)
    .join(" ");

  const isSub = params.requestType === "Long-Term Sub";

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <div style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); color: #ffffff; padding: 24px;">
          <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #99f6e4;">WVUSD System Specialist Dispatch</span>
          <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff;">System Access Provisioning Required</h1>
        </div>

        <div style="padding: 24px;">
          <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #64748b; font-weight: 600; width: 130px; padding: 4px 0;">Candidate:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 4px 0;">${params.candidateName}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Assigned Work Email:</td>
                <td style="font-weight: 700; color: #0284c7; padding: 4px 0; font-family: monospace;">${params.workEmail}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">School / Site:</td>
                <td style="font-weight: 600; color: #334155; padding: 4px 0;">${params.site}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Employee Type:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 4px 0;">${params.employeeType || "N/A"}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Request ID:</td>
                <td style="padding: 4px 0;">${params.requestId}</td>
              </tr>
              ${isSub ? `
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Sub Covering For:</td>
                <td style="font-weight: 600; color: #7e22ce; padding: 4px 0;">${params.originalTeacherName} (${params.originalTeacherEmail || 'No email'})</td>
              </tr>
              ` : ""}
            </table>
          </div>

          <div style="margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Your Assigned Tasks:</p>
            <div>${servicesBadges}</div>
          </div>

          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #065f46;">
            <strong>Instructions:</strong> Please provision the requested access for the candidate above. When completed, open the Onboarding Portal to check off your item.
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          Walnut Valley Unified School District • Technology & Specialist Services
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmailWithGmailApp_(params.specialistEmail, subject, htmlBody, null, params.isDemo);
}

function sendFinalResolutionEmail(params) {
  const typeTag = params.employeeType ? `[${params.employeeType}] ` : "";
  const subject = `[COMPLETED] ${typeTag}All Systems Provisioned: ${params.candidateName} (${params.site})`;

  const servicesBadges = params.completedServices
    .map(s => `<span style="display: inline-block; background-color: #ecfdf5; color: #047857; padding: 3px 8px; margin: 2px 4px 2px 0; border-radius: 4px; font-size: 11px; font-weight: 600;">✓ ${s}</span>`)
    .join(" ");

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; padding: 24px;">
          <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #a7f3d0;">Onboarding Access Resolution</span>
          <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff;">System Provisioning 100% Completed</h1>
        </div>

        <div style="padding: 24px;">
          <p style="font-size: 14px; color: #334155; line-height: 1.5; margin-top: 0;">
            All requested system credentials and access permissions have been verified and activated for <strong>${params.candidateName}</strong> at <strong>${params.site}</strong>.
          </p>

          <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #64748b; font-weight: 600; width: 130px; padding: 4px 0;">Work Email:</td>
                <td style="font-weight: 700; color: #059669; padding: 4px 0; font-family: monospace;">${params.workEmail}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Employee Type:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 4px 0;">${params.employeeType || "N/A"}</td>
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

function sendCommentAlertEmail(params) {
  const typeTag = params.employeeType ? `[${params.employeeType}] ` : "";
  const subject = `[Staff Note] ${typeTag}${params.candidateName} (${params.requestId})`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: #ffffff; padding: 20px 24px;">
          <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8;">WVUSD Onboarding Note Alert</span>
          <h2 style="margin: 4px 0 0 0; font-size: 18px; font-weight: 800; color: #ffffff;">Specialist Comment Added</h2>
        </div>

        <div style="padding: 24px;">
          <p style="font-size: 13px; color: #64748b; margin-top: 0;">
            A comment was logged regarding <strong>${params.candidateName}</strong> (${params.site}) by <strong>${params.authorEmail}</strong>:
          </p>

          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 8px; font-size: 13px; color: #1e293b; line-height: 1.5; margin: 16px 0; font-style: italic;">
            "${params.commentText}"
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #64748b;">
            <tr>
              <td style="padding: 3px 0; width: 120px;">Request ID:</td>
              <td style="padding: 3px 0; font-weight: bold; color: #334155;">${params.requestId}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0;">Employee Type:</td>
              <td style="padding: 3px 0; font-weight: bold; color: #334155;">${params.employeeType || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0;">Work Email:</td>
              <td style="padding: 3px 0; color: #334155;">${params.workEmail || 'Pending HR'}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f8fafc; padding: 12px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          Walnut Valley Unified School District • Onboarding Portal Communications
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmailWithGmailApp_(params.hrEmails, subject, htmlBody, null, params.isDemo);
}

function sendSpecialistReminderEmail(params) {
  const typeTag = params.employeeType ? `[${params.employeeType}] ` : "";
  const subject = `[Reminder - 3+ Days Pending] ${typeTag}Incomplete Access Task: ${params.candidateName} (${params.site})`;

  const pendingBadges = params.pendingTopics
    .map(t => `<span style="display: inline-block; background-color: #fff1f2; color: #e11d48; padding: 4px 10px; margin: 2px 4px 2px 0; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid #fecdd3;">⏳ ${t}</span>`)
    .join(" ");

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <div style="background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); color: #ffffff; padding: 24px;">
          <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #fca5a5;">WVUSD Task Reminder Notice</span>
          <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff;">Action Required: Incomplete Provisioning</h1>
        </div>

        <div style="padding: 24px;">
          <div style="background-color: #fff1f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #991b1b; margin-bottom: 20px;">
            <strong>Notice:</strong> This request has been assigned for <strong>${params.daysPending} days</strong> and is still awaiting completion.
          </div>

          <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #64748b; font-weight: 600; width: 130px; padding: 4px 0;">Candidate:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 4px 0;">${params.candidateName}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Assigned Work Email:</td>
                <td style="font-weight: 700; color: #0284c7; padding: 4px 0; font-family: monospace;">${params.workEmail}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">School / Site:</td>
                <td style="font-weight: 600; color: #334155; padding: 4px 0;">${params.site}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Employee Type:</td>
                <td style="font-weight: 700; color: #0f172a; padding: 4px 0;">${params.employeeType || "N/A"}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 600; padding: 4px 0;">Request ID:</td>
                <td style="padding: 4px 0;">${params.requestId}</td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Your Outstanding Items:</p>
            <div>${pendingBadges}</div>
          </div>

          <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
            Please complete setup for these services and check them off in the portal as soon as possible to ensure timely onboarding.
          </p>
        </div>

        <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          Walnut Valley Unified School District • Automated Reminder Dispatch
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmailWithGmailApp_(params.specialistEmail, subject, htmlBody, null, params.isDemo);
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
  const forbiddenHeaders = ["topic", "topics", "service", "services", "system", "systems", "topic name", "service name", "all topics"];
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
    const status = String(row[12] || "").trim(); // Col M (13)
    if (status !== "In Progress") continue;

    const requestId = String(row[0] || "").trim();
    const candidateName = `${row[5]} ${row[6]}`.trim();
    const site = String(row[4] || "").trim();
    const workEmail = String(row[7] || "").trim();
    const comments = String(row[15] || "").trim(); // Col P (16)

    // Determine baseline date: HR Assigned At (Col O / index 14), fallback Created At (Col B / index 1)
    const assignedDate = row[14] ? new Date(row[14]) : (row[1] ? new Date(row[1]) : now);
    const daysSinceAssigned = Math.floor((nowMs - assignedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceAssigned < 3) continue;

    // Remaining incomplete topics: Col K (10) and Col L (11)
    const requestedArr = String(row[10] || "").split(",").map(s => s.trim()).filter(Boolean);
    const completedArr = String(row[11] || "").split(",").map(s => s.trim()).filter(Boolean);
    const pendingTopics = requestedArr.filter(reqTopic =>
      !completedArr.some(c => c.toLowerCase() === reqTopic.toLowerCase())
    );

    if (pendingTopics.length === 0) continue;

    // Check last reminder timestamp recorded in comments to enforce 3-day spacing
    const lastReminderMatch = comments.match(/\[Reminder Sent: (\d{4}-\d{2}-\d{2})\]/g);
    if (lastReminderMatch && lastReminderMatch.length > 0) {
      const lastEntry = lastReminderMatch[lastReminderMatch.length - 1];
      const dateMatch = lastEntry.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const lastDate = new Date(dateMatch[1]);
        const daysSinceLastReminder = Math.floor((nowMs - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastReminder < 3) {
          continue; // Less than 3 days since the previous reminder
        }
      }
    }

    // Group pending topics by specialist email
    const specialistPendingMap = {};
    pendingTopics.forEach(topic => {
      const emails = topicMap[topic.toLowerCase()] || [];
      emails.forEach(email => {
        if (!specialistPendingMap[email]) specialistPendingMap[email] = [];
        specialistPendingMap[email].push(topic);
      });
    });

    // Send reminder email to each specialist
    const todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
    let sentToSpecialist = false;

    Object.keys(specialistPendingMap).forEach(specEmail => {
      try {
        sendSpecialistReminderEmail({
          specialistEmail: specEmail,
          requestId: requestId,
          candidateName: candidateName,
          workEmail: workEmail,
          site: site,
          requestType: row[2],
          employeeType: row[3],
          pendingTopics: specialistPendingMap[specEmail],
          daysPending: daysSinceAssigned,
          isDemo: Boolean(isDemo)
        });
        sentToSpecialist = true;
        remindersSent++;
      } catch (remErr) {
        Logger.log(`Failed to send reminder for ${requestId} to ${specEmail}: ${remErr.toString()}`);
      }
    });

    if (sentToSpecialist) {
      const reminderLog = `[${Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")} System]: [Reminder Sent: ${todayStr}] 3-day reminder notice sent for pending tasks: ${pendingTopics.join(", ")}`;
      const updatedComments = comments ? `${comments}\n${reminderLog}` : reminderLog;
      reqSheet.getRange(r + 1, 16).setValue(updatedComments); // Col P (16)
      logEntries.push(`Sent reminder for ${requestId} (${candidateName}) to ${Object.keys(specialistPendingMap).join(", ")}`);
    }
  }

  return {
    success: true,
    remindersSent: remindersSent,
    log: logEntries
  };
}
