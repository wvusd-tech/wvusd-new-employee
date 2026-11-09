# WVUSD Employee & Sub Onboarding Access Portal

A full-stack dashboard for Walnut Valley Unified School District (WVUSD) to automate and coordinate system access provisioning for new employees and long-term substitute teachers.

---

## 🏛 Architecture & Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide React
- **Authentication:** WVUSD Google Workspace Single Sign-On (`@react-oauth/google`, `jwt-decode`) with strict `@wvusd.org` domain lock
- **Development Tooling:** Integrated top **Dev Persona Switcher** allowing instant 1-click toggling between the 5 personas
- **Backend & Database:** Google Apps Script Web App (`backend/Code.gs`) communicating with a Google Spreadsheet (`Requests`, `Specialists`, and `Sites` tabs)

---

## 🔐 Role-Based Access Control (RBAC)

When a staff member signs in, their permissions and view authorizations are resolved directly from the Google Spreadsheet:

| Role | Sheet Location | Permissions & Workflows |
|---|---|---|
| **Site Staff** (Principal & Office Assistant) | **`Sites`** tab: Col B (Principal emails) or Col C (Office Assistant emails) | • Submit new access intake requests for authorized school sites<br>• Track real-time provisioning progress of their site's candidates |
| **HR Specialist** | **`Specialists`** tab: **Cell `C1`** (comma-separated emails) | • Access **"Pending HR"** intake queue<br>• Generate and assign candidate's official `@wvusd.org` work email<br>• Dispatches automated notification emails to assigned specialists<br>• Receives specialist comments and progress alerts |
| **Service Specialist** | **`Specialists`** tab: **Col B** (rows 3+) matching service in Col A | • Filtered view showing requests requiring their assigned system(s)<br>• Check off completed systems<br>• Post notes to HR<br>• Triggers final resolution email when all systems are complete |
| **Super Admin** | **`Specialists`** tab: **Cell `D1`** (comma-separated emails) | • Master dashboard across all district sites and statuses<br>• Manual status, email, and service checkoff overrides<br>• Full audit log & CSV export |

---

## 📋 Google Spreadsheet Schema

The backend uses a single Google Spreadsheet with three designated tabs:

### 1. `Requests` Tab
Holds all candidate onboarding records:
- **Col A:** `Request ID` (e.g. `REQ-1001`)
- **Col B:** `Created At` (ISO timestamp)
- **Col C:** `Request Type` (`New Employee` or `Long-Term Sub`)
- **Col D:** `Site` (School name, e.g. `Diamond Bar High`)
- **Col E:** `First Name`
- **Col F:** `Last Name`
- **Col G:** `Work Email` (Assigned by HR)
- **Col H:** `Original Teacher Name` (Required for Long-Term Subs)
- **Col I:** `Original Teacher Email` (Long-Term Subs)
- **Col J:** `Access Requested` (Comma-separated list of systems)
- **Col K:** `Access Completed` (Comma-separated list of completed systems)
- **Col L:** `Status` (`Pending HR`, `In Progress`, `Completed`, `Cancelled`)
- **Col M:** `Submitter Email`
- **Col N:** `HR Assigned At` (Timestamp when work email was assigned)
- **Col O:** `Comments` (Log of timestamped specialist & HR notes)
- **Col P:** `Final Notified At` (Timestamp when all items completed)

### 2. `Specialists` Tab
Defines system services, responsible specialists, and HR/Admin coordinates:
- **Cell C1:** HR Specialist Email(s) (comma-separated, e.g. `hr@wvusd.org, hr.director@wvusd.org`)
- **Cell D1:** Super Admin Email(s) (comma-separated, e.g. `admin@wvusd.org, sysadmin@wvusd.org`)
- **Row 1 & 2:** Headers / Descriptions
- **Col A (Rows 3+):** Service / System Name (e.g., `Google Workspace`, `Aeries SIS Access`, `Door Badge & Physical Access`, `Active Directory & Network Login`)
- **Col B (Rows 3+):** Specialist Email(s) (comma-separated) responsible for that service

### 3. `Sites` Tab
Maps school sites to authorized principals and office assistants:
- **Col A:** `Site Name` (e.g. `Diamond Bar High`, `Walnut High`, `Chaparral Middle`)
- **Col B:** `Principal Email(s)` (comma-separated)
- **Col C:** `Office Assistant / Admin Email(s)` (comma-separated)

---

## 🚀 Google Apps Script Backend Deployment

1. Open your target Google Spreadsheet.
2. In the top menu, navigate to **Extensions** → **Apps Script**.
3. Replace the contents of `Code.gs` with the code in [`backend/Code.gs`](file:///home/kwendland/wvusd-new-employee/backend/Code.gs).
4. Run `initializeSpreadsheetStructure()` once from the Apps Script editor to auto-create and format any missing tabs, headers, and seed lists.
5. In the top right, click **Deploy** → **New deployment**:
   - **Select type:** Web app
   - **Description:** WVUSD Onboarding Portal Backend
   - **Execute as:** `Me (your Google account)`
   - **Who has access:** `Anyone` (or `Anyone within Walnut Valley Unified School District`)
6. Copy the resulting **Web App URL** (ends in `/exec`).
7. Paste this URL into your `.env` file:
   ```bash
   VITE_APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycby4W0lXlh8cWhHt55VoOUgS4t3iAx2DegY99JKp94yUrBZ3fnM3oFzYhj5HrkJSl6PNuQ/exec"
   ```

---

## 🛡️ Demo Mode (Safe Exploration)

Click the **DEMO BUTTON** in the top navigation bar at any time to toggle Demo Mode:
- **Demo Mode ON:** Full UI and backend functionality are enabled (submitting intake, assigning work email, dispatching tasks, checking off items, logging comments), but **all outbound Gmail notifications are suppressed and logged**.
- **Demo Mode OFF:** Live email notifications are dispatched via `GmailApp.sendEmail`.

---

## 👑 Super Admin Impersonation & Role Toggling

Super Admins (emails listed in Cell `D1`) have access to a view-as switcher in the top toolbar:
- **👑 Master Admin:** Complete district audit table with manual status and email overrides.
- **📋 HR Queue:** Test the HR Specialist intake and email assignment workflow.
- **🔧 Specialist:** Test the specialist checkoff flow with a dropdown to filter by specific topic (e.g. Google, Aeries, Badges) or view all.
- **🏫 Site Intake:** Test the Site Principal / Office Assistant intake flow with a dropdown to switch between any school site.

---

## 🛠 Local Development Quick Start

### 1. Install & Run
```bash
cd wvusd-new-employee
npm run dev
```

The application runs at `http://localhost:5173`.

### 2. Dev Persona Switcher
In local development, the app includes a persistent **Dev Role Switcher toolbar** at the top of the viewport. Click any persona to instantly test that role's interface:
- **Site Admin (Principal):** `principal.dbhs@wvusd.org`
- **Site Office Assistant:** `oa.dbhs@wvusd.org`
- **HR Specialist (Cell C1):** `hr@wvusd.org`
- **Service Specialist (Col B rows 3+):** `tech@wvusd.org`
- **Super Admin (Cell D1):** `admin@wvusd.org`

Click **"Reset Mock"** in the toolbar at any time to restore factory seed records in local storage.

### 3. Production Build
```bash
npm run build
```
Creates an optimized production bundle in `dist/`.

---

## 📧 Automated Notification Workflows

The Apps Script backend includes responsive HTML email templates:
1. **HR Intake Alert:** Fired when Site Staff submits a request. Sent to HR (`C1`).
2. **Specialist Task Assignment:** Fired when HR assigns the district work email and dispatches. Sent to each specialist responsible for requested services.
3. **Specialist Note Alert:** Fired when a specialist logs a progress note. Sent to HR (`C1`).
4. **Final Resolution Alert:** Fired when the last remaining service is completed. Sent to HR (`C1`) and CC'd to the Site Principal and Office Assistant.

---

© 2026 Walnut Valley Unified School District • Human Resources & Technology Services
