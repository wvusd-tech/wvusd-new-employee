// src/config.js
// Walnut Valley Unified School District (WVUSD)
// New Employee & Long-Term Substitute Onboarding Access Portal Configuration

export const DISTRICT_NAME = "Walnut Valley Unified School District";
export const APP_TITLE = "WVUSD Employee & Sub Onboarding Access Portal";

export const DISTRICT_LOGO =
  "https://res.cloudinary.com/djv9u4054/image/upload/v1783959106/UPdated_Black_and_White_Logo-removebg-preview_zubeqp.png";

export const DISTRICT_SHIELD =
  "https://res.cloudinary.com/djv9u4054/image/upload/v1793111822/Vintage_Retro_Automotive_Garage_Service_Badge_Logo_2_qcefb6.png";

export const GOOGLE_CLIENT_ID =
  "243489966839-kcopbaj692oat1p2hoq5lrcddq9n4k17.apps.googleusercontent.com";

export const ALLOWED_DOMAINS = ["wvusd.org"];

export const APPS_SCRIPT_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_APPS_SCRIPT_URL) ||
  "https://script.google.com/macros/s/AKfycbwku6NSbPM1gKh9SZURIpLcOV9H5YrBMOqO6Fg-WCKEklRFqkpifdX4W4Aq1tO-KseZ2w/exec";

export const SITE_LOGOS = {
  "diamond bar": "https://res.cloudinary.com/djv9u4054/image/upload/v1783632852/0-DBARBRAHMASWide_q8uled-removebg-preview_x7ta88.png",
  "south pointe": "https://res.cloudinary.com/djv9u4054/image/upload/v1783623577/copy_of_copy_of_spt_logo-removebg-preview_l7eve6.png",
  "maple hill": "https://res.cloudinary.com/djv9u4054/image/upload/v1783459666/copy_of_untitled_design_6_qhbikx.png",
  "chaparral": "https://res.cloudinary.com/djv9u4054/image/upload/v1781797508/CHP_Logo-removebg-preview_npea0e.png",
  "suzanne": "https://res.cloudinary.com/djv9u4054/image/upload/v1780597225/Suzanne_iqsuyo.png",
  "walnut high": "https://res.cloudinary.com/djv9u4054/image/upload/v1780504988/stickerwhs_iwwwxs_rx0om9.png",
  "hockwalt": "https://res.cloudinary.com/djv9u4054/image/upload/v1777564560/Untitled_design_4_tjyhnp.png",
  "collegewood": "https://res.cloudinary.com/djv9u4054/image/upload/v1777485387/Untitled_design_14_on26t9.png",
  "vejar": "https://res.cloudinary.com/djv9u4054/image/upload/v1777485064/Untitled_design_13_ohnd95.png",
  "castle rock": "https://res.cloudinary.com/djv9u4054/image/upload/v1777486030/Untitled_design_15_dt6zmq.png",
  "evergreen": "https://res.cloudinary.com/djv9u4054/image/upload/v1777484631/Untitled_design_12_le66tp.png",
  "quail summit": "https://res.cloudinary.com/djv9u4054/image/upload/v1777484271/Untitled_design_11_bd8mmm.png",
  "walnut elementary": "https://res.cloudinary.com/djv9u4054/image/upload/v1777483405/Untitled_design_10_imwook.png",
  "westhoff": "https://res.cloudinary.com/djv9u4054/image/upload/v1777482954/Untitled_design_9_pkf2df.png",
  "morris": "https://res.cloudinary.com/djv9u4054/image/upload/v1777482304/Untitled_design_7_kyzokr.png"
};

/**
 * Resolves a school site name to its official logo
 */
export function getSiteLogo(siteName) {
  if (!siteName) return DISTRICT_SHIELD;
  const lower = String(siteName).toLowerCase();
  if (lower.includes("walnut") && !lower.includes("high")) {
    return SITE_LOGOS["walnut elementary"];
  }
  for (const [key, url] of Object.entries(SITE_LOGOS)) {
    if (lower.includes(key)) return url;
  }
  return DISTRICT_SHIELD;
}

/**
 * Checks whether an email address is an authorized @wvusd.org staff account
 */
export function isValidWvusdEmail(email) {
  if (!email) return false;
  const clean = String(email).toLowerCase().trim();
  const parts = clean.split("@");
  if (parts.length !== 2) return false;
  if (parts[1] === "stu.wvusd.org") return false; // reject students
  return ALLOWED_DOMAINS.includes(parts[1]);
}

/**
 * Mock personas for local development switcher
 */
export const DEV_PERSONAS = [
  {
    id: "site_admin",
    name: "Dr. Reuben Jones (Principal)",
    email: "principal.dbhs@wvusd.org",
    roleName: "Site Admin (Principal)",
    site: "Diamond Bar High",
    description: "Submit & track requests for Diamond Bar High"
  },
  {
    id: "site_oa",
    name: "Maria Gonzales (Office Assistant)",
    email: "oa.dbhs@wvusd.org",
    roleName: "Site Office Assistant",
    site: "Diamond Bar High",
    description: "Submit & track requests for Diamond Bar High"
  },
  {
    id: "hr_sub",
    name: "Sarah Chen (Sub HR Coordinator)",
    email: "hr-sub@wvusd.org",
    roleName: "Sub HR Coordinator",
    site: "District Office",
    description: "Long-Term Sub onboarding queue"
  },
  {
    id: "hr_classified",
    name: "Rachel Miller (Classified HR)",
    email: "hr-classified@wvusd.org",
    roleName: "Classified HR Coordinator",
    site: "District Office",
    description: "Classified employee onboarding queue"
  },
  {
    id: "hr_certificated",
    name: "David Kim (Certificated HR)",
    email: "hr-certificated@wvusd.org",
    roleName: "Certificated HR Coordinator",
    site: "District Office",
    description: "Certificated employee onboarding queue"
  },
  {
    id: "spec_acagnones",
    name: "Alex Cagnones",
    email: "acagnones@wvusd.org",
    roleName: "Alex Cagnones (Email, Google, Lists)",
    site: "District Technology",
    description: "Oversees Outlook Email, Google Account, Staff Email List, Teacher Accounts"
  },
  {
    id: "spec_sunnygarcia",
    name: "Sunny Garcia",
    email: "sunnygarcia@wvusd.org",
    roleName: "Sunny Garcia (Aeries)",
    site: "District Technology",
    description: "Oversees Aeries SIS Access"
  },
  {
    id: "spec_msakai",
    name: "Melissa Sakai",
    email: "msakai@wvusd.org",
    roleName: "Melissa Sakai (Aeries)",
    site: "District Technology",
    description: "Oversees Aeries SIS Access"
  },
  {
    id: "spec_rrivas",
    name: "Robert Rivas",
    email: "rrivas@wvusd.org",
    roleName: "Robert Rivas (Clever, Illuminate)",
    site: "District Technology",
    description: "Oversees Clever & Illuminate"
  },
  {
    id: "spec_mlewin",
    name: "Melody Lewin",
    email: "mlewin@wvusd.org",
    roleName: "Melody Lewin (CAASPP)",
    site: "District Technology",
    description: "Oversees CAASPP Access"
  },
  {
    id: "super_admin",
    name: "Super Administrator",
    email: "admin@wvusd.org",
    roleName: "Super Administrator",
    site: "All Sites",
    description: "Global view across all sites with full override access"
  }
];
