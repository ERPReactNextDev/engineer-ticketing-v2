# DSI Connect — Admin Guide

> This guide is for **System Administrators**, **IT Staff**, and **Super Admins**.
> It covers staff management, permissions, system configuration, and maintenance.

---

## Table of Contents

1. [Admin Access Overview](#1-admin-access-overview)
2. [Staff Directory](#2-staff-directory)
3. [Permissions Manager](#3-permissions-manager)
4. [Assignment Matrix](#4-assignment-matrix)
5. [Booking Rules](#5-booking-rules)
6. [System Settings](#6-system-settings)
7. [Notification Subscriptions](#7-notification-subscriptions)
8. [Notification Sounds](#8-notification-sounds)
9. [System Logs](#9-system-logs)
10. [Protocols Management](#10-protocols-management)
11. [User Onboarding Checklist](#11-user-onboarding-checklist)
12. [User Offboarding Checklist](#12-user-offboarding-checklist)
13. [Security Best Practices](#13-security-best-practices)

---

## 1. Admin Access Overview

Admin pages are accessible from the sidebar under the **Admin** section. Visibility depends on your role:

| Admin Page | Who Can Access |
|-----------|---------------|
| Staff Directory | SUPER ADMIN, IT, MANAGER |
| Permissions Manager | SUPER ADMIN, IT |
| Assignment Matrix | SUPER ADMIN, IT, MANAGER |
| Booking Rules | SUPER ADMIN, IT |
| System Settings | SUPER ADMIN, IT |
| Notification Subscriptions | SUPER ADMIN, IT |
| Sounds | SUPER ADMIN, IT |
| Logs | SUPER ADMIN, IT |
| Protocols | SUPER ADMIN, IT, MANAGER |

If you need access to a page you can't see, contact a Super Admin to update your permissions.

---

## 2. Staff Directory

**Path:** `/admin/staff`

The Staff Directory is the central hub for managing all employee accounts and their system access.

### 2.1 Overview Dashboard

At the top of the page, four stat cards show:
- **Total Staff** — all employees in the system
- **Active** — employees with ACTIVE employment status
- **Authorized** — employees who can currently log in (`isActive: true` in Firestore)
- **Revoked** — employees whose access has been disabled

Click any card to filter the list to that group.

### 2.2 Searching and Filtering

- **Search bar** — type a name or email. Press `/` to focus, `Esc` to clear
- **Department filter** — filter by department (IT, Sales, Engineering, etc.)
- **Status tabs** — switch between Active / Inactive / All employees
- **Sort** — click column headers to sort by Name, Department, Role, Status, or Last Activity

### 2.3 Granting System Access

New employees need to be granted access before they can log in.

1. Find the employee in the list
2. Click their row to open the detail panel
3. Toggle **"System Access"** to ON
4. Confirm the action in the dialog

> ℹ️ Granting access sets `isActive: true` in Firestore. The employee can now log in with their credentials.

### 2.4 Revoking System Access

To temporarily disable an employee's access (e.g., on leave, under investigation):

1. Find the employee
2. Open their detail panel
3. Toggle **"System Access"** to OFF
4. Confirm

The employee will be logged out on their next session check and cannot log back in until access is restored.

### 2.5 Changing Roles

Roles control what an employee can see and do in the system.

1. Find the employee
2. Open their detail panel
3. Select a new role from the **Role** dropdown
4. Click **Apply Role Change**
5. Confirm in the dialog

**Available roles by department:**

| Department | Available Roles |
|-----------|----------------|
| IT | MEMBER, LEADER, MANAGER, SUPER ADMIN |
| Engineering | MEMBER, LEADER, MANAGER, SUPER ADMIN |
| Sales | TERRITORY SALES ASSOCIATE, TERRITORY SALES MANAGER, SALES HEAD, SUPER ADMIN |
| Procurement | MEMBER, LEADER, MANAGER, SUPER ADMIN |
| Warehouse | MEMBER, LEADER, MANAGER, SUPER ADMIN |

### 2.6 Terminating an Account

For employees who have left the company:

1. Find the employee
2. Open their detail panel
3. Click **Terminate Account**
4. Confirm

This sets `isActive: false` and `sessionRevoked: true` in Firestore, immediately ending any active sessions.

> ⚠️ Termination is different from revoking access. Termination also flags the account as permanently disabled. The employee's data is preserved for audit purposes.

### 2.7 Batch Operations

To perform actions on multiple employees at once:

1. Check the checkboxes next to employee names
2. A batch action bar appears at the bottom
3. Choose:
   - **Grant Access** — enable all selected
   - **Revoke Access** — disable all selected
   - **Change Role** — set the same role for all selected
4. Confirm the action

### 2.8 Exporting Staff Data

Click the **Export CSV** button to download a spreadsheet of all visible staff records. The export includes: ID, Name, Email, Department, Role, Status, and Last Security Update.

### 2.9 Organization Tree View

Toggle to **Tree View** to see staff organized by department hierarchy. This is useful for understanding reporting structures.

### 2.10 Warning Alerts

The page shows a yellow warning banner if any staff accounts have revoked access. Click **"Review →"** to filter to those accounts.

---

## 3. Permissions Manager

**Path:** `/admin/permissions`

The Permissions Manager controls what each **Department + Role** combination can access in DSI Connect. Changes take effect immediately for all users with that role.

### 3.1 How Permissions Work

Permissions are stored in Firestore under `role_permissions/{DEPT}_{ROLE}`.

Example document IDs:
- `SALES_MEMBER`
- `SALES_TERRITORY SALES MANAGER`
- `IT_SUPER ADMIN`
- `ENGINEERING_MEMBER`

When a user logs in, the app reads their department and role, looks up the matching permission document, and shows/hides features accordingly.

### 3.2 Selecting a Department and Role

1. On the left panel, click a **Department** (e.g., Sales)
2. Then click a **Role** within that department (e.g., Territory Sales Associate)
3. The permission toggles on the right update to show that role's current settings

### 3.3 Permission Categories

**App Features (Services)**
Controls which service tiles appear in the sidebar and dashboard:
- Site Visits
- Job Requests
- DIAlux Simulations
- Product Recommendations
- Shop Drawings
- Testing & Monitoring
- Product Requests
- Other Requests

**Navigation**
Controls which sidebar sections are visible:
- Team Directory (Staff page)
- Access & Permissions (Admin pages)
- Analytics
- System Settings
- Help Center

**Security**
Controls which security features the user can manage:
- Change Password
- Login PIN
- Biometrics
- Two-Factor Authentication
- Login Activity Log

**Profile**
Controls what the user can do with their profile:
- View Profile
- Edit Profile
- App Preferences

**Home Screen (Dashboard)**
Controls which dashboard sections are visible:
- Stats Cards
- Recent Activity
- Overview Tabs
- Schedule
- Alerts
- My Tasks

### 3.4 Enabling/Disabling Permissions

- **Individual toggle** — click the switch next to any permission to enable/disable it
- **Section toggle** — click the **"Enabled / Disabled / Partial"** button at the top of each section to toggle all items in that section at once

### 3.5 Saving Permissions

Click **Save Permissions** to apply changes. A success toast confirms the save. Changes are live immediately — users with that role will see the updated interface on their next page load.

### 3.6 Copying Permissions

To give one role the same permissions as another:
1. Select the source role and note its settings
2. Select the target role
3. Manually match the settings

> ℹ️ A "Copy from role" feature is planned for a future version.

### 3.7 Managing Departments and Roles

Click **"Manage Departments"** to:
- **Add a new department** — type the name and click Add
- **Edit roles** — click "Edit Roles" on any department to add, rename, or remove roles
- **Delete a department** — removes the department from the selector (existing permission docs are not deleted from Firestore)

> ⚠️ Deleting a department from the config does not delete existing users or their data. It only removes the department from the permissions editor UI.

### 3.8 Recommended Permission Setups

**Sales Member (TSA):**
- Services: Site Visits ✓, Job Requests ✓, DIAlux ✓, Product Recommendations ✓
- Nav: Help Center ✓ only
- Security: All basic options ✓
- Dashboard: Stats ✓, My Tasks ✓, Schedule ✓

**Sales Manager:**
- Services: All ✓
- Nav: Team Directory ✓, Analytics ✓
- Security: All ✓
- Dashboard: All ✓

**Engineering Member:**
- Services: Job Requests ✓, Shop Drawings ✓, Testing ✓, DIAlux ✓
- Nav: Help Center ✓
- Security: All basic ✓
- Dashboard: Stats ✓, My Tasks ✓

**IT / Super Admin:**
- Services: All ✓
- Nav: All ✓
- Security: All ✓
- Dashboard: All ✓

---

## 4. Assignment Matrix

**Path:** `/admin/assignment-matrix`

The Assignment Matrix maps **Sales Managers** to **Engineering PICs** (Person In Charge). This determines which engineers are available to be assigned to a manager's requests.

### 4.1 How It Works

When a Sales Manager submits a request, the system uses the assignment matrix to suggest or auto-assign the appropriate engineer. The matrix is a many-to-many relationship: one manager can have multiple engineers, and one engineer can be assigned to multiple managers.

### 4.2 Viewing Assignments

The main page shows all Sales Managers as expandable cards. Each card shows:
- Manager name and reference ID
- Number of assigned engineers
- Expand to see the full list

### 4.3 Assigning Engineers

1. Click on a manager's card to expand it
2. You'll see a list of all available engineers
3. Click an engineer's name to assign them to this manager
4. A confirmation dialog appears — click **Confirm**
5. The assignment saves to Firestore in real-time

Assigned engineers show a ✓ checkmark. Click again to unassign.

### 4.4 Bulk Operations

Inside each manager's expanded card:
- **Assign All** — assigns every engineer to this manager
- **Clear All** — removes all engineer assignments for this manager

Both actions require confirmation.

### 4.5 Searching

- **Main search bar** — search managers by name or reference ID
- **Engineer search** (inside each manager card) — search engineers within that manager's assignment panel

### 4.6 Filters

- **All Managers** — show everyone
- **Assigned Only** — show only managers who have at least one engineer assigned

### 4.7 Real-time Sync

All changes sync to Firestore instantly. If another admin is viewing the same page, they'll see your changes in real-time without refreshing.

---

## 5. Booking Rules

**Path:** `/admin/booking_rules`

Configure rules for appointment booking:
- Maximum appointments per day
- Blackout dates (holidays, company events)
- Advance booking requirements (minimum days ahead)
- Time slot durations

---

## 6. System Settings

**Path:** `/admin/system-settings`

System-wide configuration options:
- **Allowed iframe origins** — domains that can embed DSI Connect (used for CSP headers)
- **Maintenance mode** — temporarily disable access for non-admin users
- **System announcements** — broadcast messages to all users

---

## 7. Notification Subscriptions

**Path:** `/admin/notifications/subscriptions`

Manage push notification subscriptions:
- View all registered devices and their push tokens
- Remove stale subscriptions (devices that no longer exist)
- Test push notifications to specific users or all users
- View delivery statistics

---

## 8. Notification Sounds

**Path:** `/admin/sounds`

Configure notification sounds:
- Upload custom notification sounds (MP3 format)
- Assign sounds to different notification types
- Set volume levels
- Preview sounds before saving

**Current sounds:**
- `reminder-notification.mp3` — general reminders
- `ticket-endorsed.mp3` — when a ticket is approved/endorsed

---

## 9. System Logs

**Path:** `/admin/logs`

View system activity logs:
- User login/logout events
- Permission changes
- Staff access grants/revocations
- Request status changes
- Admin actions

**Filtering logs:**
- By date range
- By user
- By action type
- By department

> ℹ️ Logs are stored in Firestore and retained for 90 days by default.

---

## 10. Protocols Management

**Path:** `/admin/protocols` and `/appointments/protocols`

Manage standard operating procedures:
- Create and edit protocol documents
- Assign protocols to specific request types or departments
- Version control for protocol updates
- Mark protocols as required reading

---

## 11. User Onboarding Checklist

When a new employee joins, follow these steps to set them up in DSI Connect:

### Step 1: Create MongoDB Account
- Add the employee to the MongoDB `users` collection via HR system or direct database entry
- Required fields: Firstname, Lastname, Email, Password (bcrypt hashed), Department, Position, Company, Status: "ACTIVE"

### Step 2: Grant System Access
1. Go to **Admin → Staff Directory**
2. Find the new employee (they'll appear with "Revoked" status)
3. Open their profile
4. Toggle **System Access** to ON
5. Set their **Role** appropriately

### Step 3: Set Permissions
1. Go to **Admin → Permissions**
2. Select their Department and Role
3. Verify the permissions are correct for their job function
4. Adjust if needed and save

### Step 4: Assign to Manager (Sales only)
1. Go to **Admin → Assignment Matrix**
2. Find their manager
3. Ensure the new employee's manager is set up correctly

### Step 5: Communicate Credentials
- Send the employee their login URL, email, and temporary password
- Instruct them to change their password on first login
- Share the User Guide link

### Step 6: Verify Access
- Ask the employee to log in and confirm they can see the correct features
- Have them set up their PIN and biometrics for faster future logins

---

## 12. User Offboarding Checklist

When an employee leaves the company:

### Immediate Actions (Day of departure)
1. Go to **Admin → Staff Directory**
2. Find the employee
3. Click **Terminate Account** — this immediately revokes access and ends active sessions
4. Update their employment status in MongoDB to "RESIGNED" or "TERMINATED"

### Within 24 Hours
- Remove them from any active request assignments
- Reassign their pending requests to another team member
- Update the Assignment Matrix if they were a manager or engineer

### Data Retention
- All their submitted requests and messages are preserved for audit purposes
- Their account data remains in MongoDB but is flagged as inactive
- Firestore security data is retained with `isActive: false`

---

## 13. Security Best Practices

### For Administrators

**Account Security:**
- Use a strong, unique password for your admin account
- Enable biometrics and PIN for faster but secure access
- Never share your credentials with anyone
- Log out when using shared computers

**Access Management:**
- Follow the principle of least privilege — give users only the access they need
- Review the Staff Directory monthly for accounts that should be revoked
- Immediately revoke access when an employee leaves or is suspended
- Audit the Permissions Manager quarterly to ensure roles are appropriate

**Monitoring:**
- Check System Logs weekly for unusual activity
- Investigate any login attempts from unknown locations
- Monitor for accounts with multiple failed login attempts

### For All Users

- Never share your password or PIN
- Log out when using a shared or public computer
- Report suspicious activity to IT immediately
- Keep your profile information up to date
- Use a strong password (12+ characters, mixed case, numbers, symbols)

### Firestore Security Rules

The Firestore database should have rules that:
- Require authentication for all reads/writes
- Restrict writes to the `users` collection to admin SDK only
- Allow users to read only their own data (except for admin roles)
- Prevent deletion of audit log documents

Contact the development team to review and update Firestore security rules.

---

*For technical issues, contact the development team.*
*For HR-related access issues, coordinate with HR and IT.*
*Last updated: May 2026*
