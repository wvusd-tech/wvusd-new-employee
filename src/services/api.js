// src/services/api.js
// Client API for WVUSD Onboarding Portal with Google Apps Script Web App support & offline dev fallback

import { APPS_SCRIPT_URL } from '../config.js';

// Local storage key for persisting dev mode changes across refreshes
const STORAGE_KEY_LOCAL_DATA = "wvusd_onboarding_local_data_v1";

// Default Seed Data
const DEFAULT_SEED_DATA = {
  requests: [
    {
      id: "REQ-1001",
      createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
      requestType: "New Employee",
      employeeType: "Certificated",
      site: "Diamond Bar High",
      firstName: "Marcus",
      lastName: "Vance",
      fullName: "Marcus Vance",
      workEmail: "mvance@wvusd.org",
      originalTeacherName: "",
      originalTeacherEmail: "",
      accessRequested: ["Google Workspace", "Aeries SIS Access", "Active Directory & Network Login", "Door Badge & Physical Access"],
      accessCompleted: ["Google Workspace", "Active Directory & Network Login", "Aeries SIS Access", "Door Badge & Physical Access"],
      status: "Completed",
      submitterEmail: "oa.dbhs@wvusd.org",
      hrAssignedAt: new Date(Date.now() - 3600 * 1000 * 40).toISOString(),
      comments: "[2026-11-07 09:30 hr@wvusd.org]: Work email provisioned and dispatched.\n[2026-11-07 14:15 tech@wvusd.org]: Network and Google accounts provisioned.\n[2026-11-08 11:00 facilities@wvusd.org]: Keycard badge printed and encoded.",
      finalNotifiedAt: new Date(Date.now() - 3600 * 1000 * 20).toISOString()
    },
    {
      id: "REQ-1002",
      createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
      requestType: "Long-Term Sub",
      employeeType: "Substitute",
      site: "Diamond Bar High",
      firstName: "Elena",
      lastName: "Rostova",
      fullName: "Elena Rostova",
      workEmail: "sub.erostova@wvusd.org",
      originalTeacherName: "Katherine Miller",
      originalTeacherEmail: "kmiller@wvusd.org",
      accessRequested: ["Google Workspace", "Aeries SIS Access", "Door Badge & Physical Access"],
      accessCompleted: ["Google Workspace"],
      status: "In Progress",
      submitterEmail: "oa.dbhs@wvusd.org",
      hrAssignedAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
      comments: "[2026-11-08 16:00 hr@wvusd.org]: Sub email generated. Assigned to coverage for Katherine Miller (Maternity leave).",
      finalNotifiedAt: ""
    },
    {
      id: "REQ-1003",
      createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      requestType: "New Employee",
      employeeType: "Classified",
      site: "Walnut High",
      firstName: "Brian",
      lastName: "O'Connor",
      fullName: "Brian O'Connor",
      workEmail: "",
      originalTeacherName: "",
      originalTeacherEmail: "",
      accessRequested: ["Google Workspace", "Aeries SIS Access", "Active Directory & Network Login", "Keypad & Room Entry Code"],
      accessCompleted: [],
      status: "Pending HR",
      submitterEmail: "oa.whs@wvusd.org",
      hrAssignedAt: "",
      comments: "",
      finalNotifiedAt: ""
    },
    {
      id: "REQ-1004",
      createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      requestType: "Long-Term Sub",
      site: "Chaparral Middle",
      firstName: "Samantha",
      lastName: "Wu",
      fullName: "Samantha Wu",
      workEmail: "",
      originalTeacherName: "David Henderson",
      originalTeacherEmail: "dhenderson@wvusd.org",
      accessRequested: ["Google Workspace", "Aeries SIS Access", "Door Badge & Physical Access", "Voicemail & District Extension"],
      accessCompleted: [],
      status: "Pending HR",
      submitterEmail: "oa.chms@wvusd.org",
      hrAssignedAt: "",
      comments: "",
      finalNotifiedAt: ""
    }
  ],
  services: [
    { serviceName: "Outlook Email", specialistEmails: ["tech@wvusd.org"] },
    { serviceName: "Aeries", specialistEmails: ["aeries-support@wvusd.org", "sis@wvusd.org"] },
    { serviceName: "Google Account", specialistEmails: ["tech@wvusd.org", "google-admin@wvusd.org"] },
    { serviceName: "Clever", specialistEmails: ["clever-admin@wvusd.org", "tech@wvusd.org"] },
    { serviceName: "Door Badge & Physical Access", specialistEmails: ["facilities@wvusd.org", "security@wvusd.org"] },
    { serviceName: "Active Directory & Network Login", specialistEmails: ["tech@wvusd.org", "sysadmin@wvusd.org"] }
  ],
  sites: [
    { siteName: "Diamond Bar High", principalEmails: ["principal.dbhs@wvusd.org"], officeEmails: ["oa.dbhs@wvusd.org", "kwendland@wvusd.org"] },
    { siteName: "Walnut High", principalEmails: ["principal.whs@wvusd.org"], officeEmails: ["oa.whs@wvusd.org"] },
    { siteName: "Chaparral Middle", principalEmails: ["principal.chms@wvusd.org"], officeEmails: ["oa.chms@wvusd.org"] },
    { siteName: "Suzanne Middle", principalEmails: ["principal.sms@wvusd.org"], officeEmails: ["oa.sms@wvusd.org"] },
    { siteName: "South Pointe Middle", principalEmails: ["principal.spms@wvusd.org"], officeEmails: ["oa.spms@wvusd.org"] },
    { siteName: "Castle Rock Elementary", principalEmails: ["principal.cres@wvusd.org"], officeEmails: ["oa.cres@wvusd.org"] },
    { siteName: "Collegewood Elementary", principalEmails: ["principal.cwes@wvusd.org"], officeEmails: ["oa.cwes@wvusd.org"] },
    { siteName: "Evergreen Elementary", principalEmails: ["principal.eves@wvusd.org"], officeEmails: ["oa.eves@wvusd.org"] },
    { siteName: "Maple Hill Elementary", principalEmails: ["principal.mhes@wvusd.org"], officeEmails: ["oa.mhes@wvusd.org"] },
    { siteName: "Morris Elementary", principalEmails: ["principal.mres@wvusd.org"], officeEmails: ["oa.mres@wvusd.org"] },
    { siteName: "Quail Summit Elementary", principalEmails: ["principal.qses@wvusd.org"], officeEmails: ["oa.qses@wvusd.org"] },
    { siteName: "Vejar Elementary", principalEmails: ["principal.vres@wvusd.org"], officeEmails: ["oa.vres@wvusd.org"] },
    { siteName: "Walnut Elementary", principalEmails: ["principal.wes@wvusd.org"], officeEmails: ["oa.wes@wvusd.org"] },
    { siteName: "Westhoff Elementary", principalEmails: ["principal.wtes@wvusd.org"], officeEmails: ["oa.wtes@wvusd.org"] },
    { siteName: "Ron Hockwalt Academies", principalEmails: ["principal.rha@wvusd.org"], officeEmails: ["oa.rha@wvusd.org"] },
    { siteName: "District Office", principalEmails: ["do-admin@wvusd.org"], officeEmails: ["do-secretary@wvusd.org"] }
  ],
  hrEmails: ["hr@wvusd.org", "kwendland@wvusd.org"],
  superAdminEmails: ["admin@wvusd.org", "kwendland@wvusd.org"]
};

/**
 * Loads mock data from localStorage or sets default
 */
function getLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_DATA);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.requests)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error reading local mock store:", e);
  }
  saveLocalData(DEFAULT_SEED_DATA);
  return DEFAULT_SEED_DATA;
}

/**
 * Saves mock data to localStorage
 */
function saveLocalData(data) {
  try {
    localStorage.setItem(STORAGE_KEY_LOCAL_DATA, JSON.stringify(data));
  } catch (e) {
    console.warn("Error saving to local mock store:", e);
  }
}

/**
 * Reset local mock data to default seed
 */
export function resetMockData() {
  saveLocalData(DEFAULT_SEED_DATA);
  return DEFAULT_SEED_DATA;
}

/**
 * Helper to compute roles from datasets given an email
 */
export function computeUserRoles(email, { hrEmails, superAdminEmails, services, sites }) {
  const cleanEmail = email ? String(email).toLowerCase().trim() : "";
  if (!cleanEmail) {
    return {
      email: "",
      isSuperAdmin: false,
      isHr: false,
      isSpecialist: false,
      isSiteStaff: false,
      authorizedSites: [],
      assignedServices: []
    };
  }

  const isSuperAdmin = superAdminEmails.map(e => e.toLowerCase()).includes(cleanEmail);
  const isHr = hrEmails.map(e => e.toLowerCase()).includes(cleanEmail);

  const assignedServices = [];
  services.forEach(s => {
    if (s.specialistEmails.map(e => e.toLowerCase()).includes(cleanEmail)) {
      assignedServices.push(s.serviceName);
    }
  });
  const isSpecialist = assignedServices.length > 0;

  const authorizedSites = [];
  sites.forEach(site => {
    const all = [...(site.principalEmails || []), ...(site.officeEmails || [])].map(e => e.toLowerCase());
    if (all.includes(cleanEmail)) {
      authorizedSites.push(site.siteName);
    }
  });
  const isSiteStaff = authorizedSites.length > 0;

  return {
    email: cleanEmail,
    isSuperAdmin,
    isHr,
    isSpecialist,
    isSiteStaff,
    authorizedSites,
    assignedServices
  };
}

/**
 * Executes a call to the Google Apps Script Web App or falls back to local mock
 */
async function callBackend(action, payload = {}, userEmail = "") {
  // If APPS_SCRIPT_URL is provided, attempt live fetch first
  if (APPS_SCRIPT_URL && APPS_SCRIPT_URL.startsWith("http")) {
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...payload, email: userEmail })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const json = await response.json();
      if (json && !json.error) {
        if (Array.isArray(json.services)) {
          const forbidden = ['topic', 'topics', 'service', 'services', 'system', 'systems', 'topic name', 'service name', 'all topics'];
          json.services = json.services.filter(s => {
            const name = (typeof s === 'string' ? s : s?.serviceName || '').trim().toLowerCase();
            return !forbidden.includes(name) && !name.startsWith('---') && !name.startsWith('(');
          });
        }
        return json;
      }
      console.warn("Backend error returned:", json?.error);
    } catch (err) {
      console.warn(`Live Apps Script call failed for action "${action}", falling back to local simulation:`, err);
    }
  }

  // --- LOCAL SIMULATION FALLBACK ---
  await new Promise(r => setTimeout(r, 220)); // slight latency feel
  const db = getLocalData();

  if (action === "getInitialData") {
    const roles = computeUserRoles(userEmail, db);
    return {
      requests: db.requests,
      services: db.services,
      sites: db.sites,
      hrEmails: db.hrEmails,
      superAdminEmails: db.superAdminEmails,
      currentUser: roles
    };
  }

  if (action === "submitRequest") {
    const reqType = payload.requestType === "Long-Term Sub" ? "Long-Term Sub" : "New Employee";
    const nextNum = db.requests.reduce((max, r) => {
      const match = String(r.id).match(/REQ-(\d+)/i);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 1000) + 1;

    const newReq = {
      id: `REQ-${nextNum}`,
      createdAt: new Date().toISOString(),
      requestType: reqType,
      employeeType: payload.employeeType || (reqType === "Long-Term Sub" ? "Substitute" : "Classified"),
      site: payload.site,
      firstName: payload.firstName,
      lastName: payload.lastName,
      fullName: `${payload.firstName} ${payload.lastName}`.trim(),
      workEmail: "",
      originalTeacherName: reqType === "Long-Term Sub" ? payload.originalTeacherName || "" : "",
      originalTeacherEmail: reqType === "Long-Term Sub" ? payload.originalTeacherEmail || "" : "",
      accessRequested: Array.isArray(payload.requestedServices) ? payload.requestedServices : [],
      accessCompleted: [],
      status: "Pending HR",
      submitterEmail: payload.submitterEmail || userEmail,
      hrAssignedAt: "",
      comments: "",
      finalNotifiedAt: ""
    };

    db.requests.unshift(newReq);
    saveLocalData(db);
    return { success: true, message: "Request submitted successfully", request: newReq };
  }

  if (action === "assignEmail") {
    const req = db.requests.find(r => r.id === payload.requestId);
    if (!req) return { success: false, error: "Request not found" };

    req.workEmail = payload.workEmail;
    req.status = "In Progress";
    req.hrAssignedAt = new Date().toISOString();
    saveLocalData(db);
    return { success: true, message: "Work email assigned and dispatched", request: req };
  }

  if (action === "toggleAccess") {
    const req = db.requests.find(r => r.id === payload.requestId);
    if (!req) return { success: false, error: "Request not found" };

    const serviceName = payload.serviceName;
    const completed = Boolean(payload.completed);

    if (completed) {
      if (!req.accessCompleted.includes(serviceName)) {
        req.accessCompleted.push(serviceName);
      }
    } else {
      req.accessCompleted = req.accessCompleted.filter(s => s !== serviceName);
    }

    const allCompleted = req.accessRequested.length > 0 &&
      req.accessRequested.every(s => req.accessCompleted.includes(s));

    if (allCompleted) {
      req.status = "Completed";
      req.finalNotifiedAt = new Date().toISOString();
    } else if (req.status === "Completed") {
      req.status = "In Progress";
    }

    saveLocalData(db);
    return {
      success: true,
      request: req,
      allCompleted: allCompleted,
      status: req.status
    };
  }

  if (action === "addComment") {
    const req = db.requests.find(r => r.id === payload.requestId);
    if (!req) return { success: false, error: "Request not found" };

    const dateStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    const commentLine = `[${dateStr} ${payload.userEmail || userEmail || "staff"}]: ${payload.commentText}`;
    req.comments = req.comments ? `${req.comments}\n${commentLine}` : commentLine;

    saveLocalData(db);
    return { success: true, comments: req.comments, request: req };
  }

  if (action === "adminOverride") {
    const req = db.requests.find(r => r.id === payload.requestId);
    if (!req) return { success: false, error: "Request not found" };

    if (payload.status) req.status = payload.status;
    if (payload.workEmail !== undefined) req.workEmail = payload.workEmail;
    if (payload.accessCompleted !== undefined) req.accessCompleted = payload.accessCompleted;

    saveLocalData(db);
    return { success: true, request: req, message: "Admin override applied" };
  }

  return { error: "Unknown action" };
}

// Exported public API methods
export const api = {
  getInitialData: (userEmail) => callBackend("getInitialData", {}, userEmail),
  submitRequest: (payload, userEmail) => callBackend("submitRequest", payload, userEmail),
  assignEmail: (payload, userEmail) => callBackend("assignEmail", payload, userEmail),
  toggleAccess: (payload, userEmail) => callBackend("toggleAccess", payload, userEmail),
  addComment: (payload, userEmail) => callBackend("addComment", payload, userEmail),
  adminOverride: (payload, userEmail) => callBackend("adminOverride", payload, userEmail)
};
