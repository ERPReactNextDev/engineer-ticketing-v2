# DSI Connect — User Guide

> **DSI Connect** is the official internal platform of Disruptive Solutions Inc.
> Use it to manage service requests, appointments, team collaboration, and more.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Logging In](#2-logging-in)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Service Requests](#4-service-requests)
5. [Site Visit Appointments](#5-site-visit-appointments)
6. [Messages & Collaboration](#6-messages--collaboration)
7. [Notifications & Activity Center](#7-notifications--activity-center)
8. [My Account — Profile](#8-my-account--profile)
9. [My Account — Security](#9-my-account--security)
10. [Installing DSI Connect on Your Phone](#10-installing-dsi-connect-on-your-phone)
11. [Tips & Shortcuts](#11-tips--shortcuts)
12. [Frequently Asked Questions](#12-frequently-asked-questions)

---

## 1. Getting Started

DSI Connect works in any modern web browser. You can also install it on your phone like an app (see [Section 10](#10-installing-dsi-connect-on-your-phone)).

**Supported browsers:**
- Google Chrome (recommended)
- Microsoft Edge
- Safari (iOS/macOS)
- Firefox

**Access URL:** Ask your IT department for the current URL.

---

## 2. Logging In

### Standard Login

1. Open DSI Connect in your browser
2. Enter your **company email address**
3. Enter your **password**
4. Click **Sign In**

If you don't have an account, contact the IT Department or your manager.

### PIN Login

Once you've set up a PIN (see [Section 9](#9-my-account--security)), you can log in faster:

1. On the login screen, tap **"Use PIN"**
2. Enter your 6-digit PIN using the keypad
3. You're in — no password needed

### Biometric Login (Fingerprint / Face ID)

If your device supports it and you've enabled biometrics:

1. On the login screen, tap the **fingerprint icon**
2. Use your fingerprint or face to authenticate
3. You're logged in instantly

### Forgot Password

1. On the login screen, click **"Forgot Password"**
2. Enter your company email
3. Check your email for a reset link
4. Follow the link to set a new password

---

## 3. Dashboard Overview

The dashboard is your home screen. It shows everything happening in real-time.

### What You'll See

```
┌─────────────────────────────────────────────────────┐
│  [≡] DSI Connect          [🔔] [👤]                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  WORKLOAD DISTRIBUTION                      │   │
│  │  Site Visits: 5  │  Job Requests: 12        │   │
│  │  Shop Drawings: 3│  Testing: 2              │   │
│  │  DIAlux: 1       │  Products: 4             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  PRODUCTIVITY HUB                           │   │
│  │  Today's Agenda │ Active Tasks │ Schedule   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────┐  ┌──────────────────────────┐    │
│  │ Quick Actions│  │ Recent Customers         │    │
│  └──────────────┘  └──────────────────────────┘    │
│                                                     │
│                                          [+ FAB]    │
└─────────────────────────────────────────────────────┘
```

### Dashboard Sections

**Workload Distribution**
Shows how many items are currently pending across all service types. Numbers update in real-time — no need to refresh.

**Productivity Hub**
Your personal work center:
- **Today's Agenda** — tasks scheduled for today. Tap any item to open it directly
- **Active Tasks** — total number of open tasks assigned to you
- **Coming Up Next** — the next scheduled item with date and time

**Quick Actions** *(Sales & Managers only)*
Shortcut buttons for the most common actions:
- **Site Visit** — schedule a new site visit
- **Job Request** — submit a new job request
- **Team Report** — view your team's activity
- **User Matrix** — manage engineer assignments *(Admins only)*

**Recent Customers** *(Sales only)*
The latest client accounts you've worked with. Tap any to go to their schedule.

**Floating Action Button (+)**
The red circle button in the bottom-right corner. Tap it to quickly create a new request.

### Navigation Sidebar

Tap the **≡ (hamburger)** icon in the top-left to open the sidebar. From here you can navigate to:
- Dashboard
- All service request types
- Appointments
- Messages
- Notifications
- Admin pages *(if you have access)*
- Your account settings

---

## 4. Service Requests

DSI Connect handles six types of service requests. Each follows the same general workflow:

```
Submit Request → Pending Review → In Progress → Completed
```

### 4.1 Job Requests

Job requests are engineering work orders submitted by the Sales team for client projects.

**To submit a Job Request:**
1. Go to **Sidebar → Job Requests** or tap **+ (FAB) → Job Request**
2. Fill in the required fields:
   - **Project Name** — name of the client project
   - **Client** — client company name
   - **Description** — detailed description of the work needed
   - **Priority** — Low / Medium / High / Urgent
3. Attach any relevant files (drawings, specs, photos)
4. Click **Submit**

**Tracking your Job Request:**
- After submission, the request appears in the Job Requests list
- Status changes from **PENDING → IN PROGRESS → COMPLETED**
- You'll receive a push notification when the status changes
- Open the request to view updates and send messages to the engineering team

**Status meanings:**
| Status | Meaning |
|--------|---------|
| PENDING | Submitted, waiting for engineering to pick up |
| IN PROGRESS | Engineering is actively working on it |
| COMPLETED | Work is done |
| CANCELLED | Request was cancelled |

---

### 4.2 DIAlux Simulation Requests

DIAlux requests are for lighting simulation calculations needed for project proposals.

**To submit a DIAlux Request:**
1. Go to **Sidebar → DIAlux** or tap **+ (FAB) → DIAlux**
2. Fill in:
   - **Project Name**
   - **Client**
   - **Room/Area details** — dimensions, ceiling height, required lux levels
   - **Luminaire preferences** — if any specific products are required
3. Attach floor plans or reference documents if available
4. Click **Submit**

**What happens next:**
- The Engineering team receives your request
- They run the simulation and upload results
- You'll be notified when results are ready
- Open the request to download the simulation report

---

### 4.3 Shop Drawing Requests

Shop drawings are detailed technical drawings for installation purposes.

**To submit a Shop Drawing Request:**
1. Go to **Sidebar → Shop Drawings**
2. Fill in project details and specifications
3. Attach reference drawings or AutoCAD files if available
4. Submit

**Review process:**
- Engineering reviews the request (status: **PENDING_REVIEW**)
- Once accepted, they begin drafting (status: **IN PROGRESS**)
- Final drawings are uploaded and shared via the message thread

---

### 4.4 Testing & Monitoring

The testing tracker manages equipment testing schedules and results.

**To view testing items:**
1. Go to **Sidebar → Testing**
2. See all active testing items with their target dates
3. Items past their target date without a release date are marked as **OVERDUE** (shown in red)

**Overdue alerts:**
- The dashboard shows overdue testing count
- The Notifications page highlights overdue items in red
- Managers receive alerts for overdue items

---

### 4.5 Product Requests (SPF)

SPF product creation requests for custom product configurations.

**To submit a Product Request:**
1. Go to **Sidebar → Product Requests**
2. Fill in product specifications
3. Submit for review

---

### 4.6 Other Requests

For anything that doesn't fit the other categories.

**To submit an Other Request:**
1. Go to **Sidebar → Other Requests**
2. Select the request type
3. Describe what you need
4. Submit

---

### 4.7 Viewing and Managing Your Requests

**List View:**
- All your submitted requests appear in a list
- Filter by status, date, or type
- Search by project name or client

**Request Detail View:**
- Tap any request to open its full detail page
- See all status history and updates
- Send messages to the assigned team
- Download attached files
- View the timeline of changes

**Cancelling a Request:**
- Open the request
- Tap the **⋮ (more options)** menu
- Select **Cancel Request**
- Add a reason for cancellation

> ⚠️ You can only cancel requests that are still **PENDING**. Once work has started, contact the assigned engineer directly.

---

## 5. Site Visit Appointments

Site visits are scheduled client visits managed through the Appointments module.

### 5.1 Scheduling a New Site Visit

1. Go to **Sidebar → Appointments → Site Visits**
2. Tap **+ New Site Visit** or use the **FAB button**
3. You'll go through a multi-step form:

**Step 1 — Client Information**
- Company name
- Contact person
- Phone number
- Email address

**Step 2 — Location**
- Full address
- City
- Map pin (optional — tap the map to set location)

**Step 3 — Schedule**
- Select date from the calendar
- Select time slot
- Add notes or special instructions

**Step 4 — Review & Submit**
- Review all details
- Click **Confirm Appointment**

### 5.2 Viewing Appointments

**List View** (`/appointments/site-visit`):
- See all upcoming and past site visits
- Filter by status: Pending / Confirmed / Completed / Cancelled
- Search by company name or date

**Calendar View:**
- Switch to calendar view to see appointments by date
- Color-coded by status

### 5.3 Appointment Statuses

| Status | Meaning |
|--------|---------|
| PENDING | Submitted, waiting for confirmation |
| CONFIRMED | Appointment is confirmed |
| COMPLETED | Visit has been done |
| CANCELLED | Appointment was cancelled |
| RESCHEDULED | Date/time was changed |

### 5.4 Managing an Appointment

Open any appointment to:
- View full details and location
- Send messages to the assigned engineer
- Update the status *(managers and engineers only)*
- Add visit notes and photos after the visit
- Cancel or reschedule

### 5.5 Booking Slots

The **Slots** page (`/appointments/slots`) shows available time slots for scheduling. If a slot is full, you'll need to choose a different time.

### 5.6 Protocols

The **Protocols** page (`/appointments/protocols`) contains standard operating procedures for site visits. Review these before conducting a visit.

---

## 6. Messages & Collaboration

The **Messages** page is your collaboration hub. Every service request has its own message thread where the Sales team and Engineering team can communicate.

### 6.1 Opening Messages

Go to **Sidebar → Messages** (or the chat icon in the header).

### 6.2 The Collaboration Hub Layout

```
┌──────────────────┬────────────────────────────────────┐
│  PROJECT LIST    │  CHAT AREA                         │
│                  │                                    │
│  🔍 Search...    │  [Project Name]                    │
│                  │  Job Request • PENDING             │
│  [All] [Unread]  │                                    │
│  [DIAlux] [Jobs] │  ┌──────────────────────────────┐ │
│  [Drawings]...   │  │ John: Can you check the specs?│ │
│                  │  │ Engineer: Sure, will review   │ │
│  📌 Project A    │  │ John: Thanks!                 │ │
│     3 unread     │  └──────────────────────────────┘ │
│                  │                                    │
│  Project B       │  [Type a message...]  [Send]       │
│  Project C       │                                    │
└──────────────────┴────────────────────────────────────┘
```

### 6.3 Finding a Project

**Search:** Type in the search box to find by project name or short ID (last 6 characters of the ID).

**Filter by category:**
- **All** — show everything
- **Unread** — only projects with unread messages
- **DIAlux / Job Requests / Shop Drawings / Site Visits / SPF / Others** — filter by type

### 6.4 Sending Messages

1. Select a project from the left panel
2. Type your message in the text box at the bottom
3. Press **Enter** or click **Send**
4. Attach files by clicking the paperclip icon

**Message features:**
- Messages show sender name, role, and timestamp
- Unread messages are highlighted
- Scroll up to see message history
- Search within a conversation using the 🔍 icon in the header

### 6.5 Pinning Projects

To keep important projects at the top of your list:
1. Long-press or right-click a project
2. Select **Pin to Top**
3. Pinned projects show a 📌 icon and stay at the top

To unpin, repeat the same steps.

### 6.6 Opening the Full Project

From any chat, click **"Project Details"** in the top-right to open the full request page with all details, files, and status history.

### 6.7 Who Can See What

| Role | Visible Projects |
|------|-----------------|
| IT / Engineering / Super Admin | All projects from all users |
| Manager / Sales Head | All projects from their team |
| TSM | Their own + their subordinates' projects |
| Member / TSA | Only their own submitted projects |

---

## 7. Notifications & Activity Center

### 7.1 Notification Bell

The 🔔 bell icon in the top-right header shows your unread notification count. Tap it to see recent alerts.

### 7.2 Activity Center (`/notifications`)

The full notifications page shows a summary of all pending items across the system:

| Category | What It Shows |
|----------|--------------|
| Site Visit Appointments | Pending appointments |
| Job Requests | Pending job requests |
| Shop Drawing Requests | Requests pending review |
| DIAlux Simulations | Pending simulations |
| Overdue Testing | Testing items past their target date |
| Misc Requests | Other pending requests |

The **LIVE SYNC** badge means counts update automatically — no need to refresh.

### 7.3 Push Notifications

If you've allowed notifications in your browser, DSI Connect will send you push notifications for:
- New requests assigned to you
- Status changes on your requests
- New messages in your project threads
- Overdue testing alerts

**To enable push notifications:**
1. When prompted by the browser, click **Allow**
2. Or go to **Settings → Notifications** and enable them

### 7.4 Notification Sounds

DSI Connect plays a sound when important notifications arrive. You can manage sound settings in **Admin → Sounds** *(admin only)*.

---

## 8. My Account — Profile

Access your profile at **Sidebar → My Account → Profile** or tap your avatar.

### 8.1 Profile Information

You can update:
- **First Name** and **Last Name**
- **Contact Number** — your mobile number
- **Home Address**

> ⚠️ Your **Department**, **Position**, **Role**, and **Company** are managed by HR/IT and cannot be changed here.

### 8.2 Profile Picture

1. Tap the **camera icon** on your profile photo
2. Select a photo from your device
3. The photo uploads automatically to the system
4. Your new photo appears across the platform

**Tips for a good profile photo:**
- Use a clear, recent photo
- Face should be clearly visible
- Minimum 200x200 pixels recommended

### 8.3 E-Signature

Your digital signature is used on official documents and reports.

**To set up your e-signature:**
1. Scroll to the **E-Signature** section
2. Sign in the white box using your mouse or finger (on touch screens)
3. Click **Sync Signature** to save it
4. Your active signature appears on the right

**To clear and redo:**
- Click the **Clear** button and sign again

### 8.4 Profile Completion

The **Profile Completion** percentage shows how complete your profile is. A complete profile helps the team identify you and ensures documents are properly attributed.

Fields that count toward completion:
- First Name ✓
- Last Name ✓
- Email ✓
- Contact Number
- Address
- Position ✓
- Department ✓
- Company ✓
- Profile Picture

### 8.5 Saving Changes

Click the **Save Changes** button in the top-right corner to save all your edits. You'll see a confirmation toast notification when saved successfully.

---

## 9. My Account — Security

Access security settings at **Sidebar → My Account → Security**.

### 9.1 Security Score

Your security score (0–100) shows how well-protected your account is:

| Score | Level | Meaning |
|-------|-------|---------|
| 80–100 | Strong 🟢 | Excellent protection |
| 50–79 | Good 🔵 | Good, but can improve |
| 25–49 | Fair 🟡 | Some protection, needs improvement |
| 0–24 | Weak 🔴 | Account is at risk |

**How to improve your score:**
- Set a strong password (+30 points)
- Set up a Login PIN (+25 points)
- Enable Biometrics (+25 points)
- Enable 2FA (+20 points)

### 9.2 Changing Your Password

1. In the Security page, click **Change** next to "Account Password"
2. Enter your **current password**
3. Enter a **new password** (minimum 8 characters)
4. Confirm the new password
5. Click **Save New Password**

**Password strength guide:**
- **Weak** — less than 6 characters
- **Fair** — 6–9 characters
- **Good** — 10+ characters, letters and numbers
- **Strong** — 10+ characters with special characters (!@#$%)

**Auto-Generate Password:**
Click **Auto-Generate** to create a strong random password. Make sure to save it somewhere safe before clicking Save.

### 9.3 Setting Up a Login PIN

A PIN lets you log in faster without typing your full password.

1. Click **Set PIN** in the Security page
2. Enter a **6-digit PIN** using the keypad
3. Enter the same PIN again to confirm
4. Your PIN is saved — you can now use it at login

**To remove your PIN:**
- Click **Remove PIN** in the Security page

> ⚠️ Your PIN is stored on this device only. If you log in from a different device, you'll need to set up a new PIN there.

### 9.4 Biometric Authentication

Enable fingerprint or face recognition for instant login.

**Requirements:**
- Your device must support biometrics (fingerprint sensor or Face ID)
- You must be using a supported browser (Chrome, Edge, Safari)
- The app must be accessed via HTTPS

**To enable:**
1. Toggle **Biometrics** to ON
2. Your device will prompt you to scan your fingerprint or face
3. Once registered, you can use biometrics at the login screen

**To disable:**
- Toggle **Biometrics** to OFF

> ⚠️ Biometric credentials are device-specific. You need to register separately on each device you use.

### 9.5 Two-Factor Authentication (2FA)

2FA adds an extra layer of security by requiring a second verification step when logging in.

> ℹ️ 2FA availability depends on your role permissions. Contact your admin if you don't see this option.

### 9.6 Login Activity

The **Login Activity** section shows recent sessions on your account. If you see a session you don't recognize, change your password immediately and contact IT.

---

## 10. Installing DSI Connect on Your Phone

DSI Connect is a **Progressive Web App (PWA)** — you can install it on your phone's home screen for a native app-like experience.

### On Android (Chrome)

1. Open DSI Connect in Chrome
2. Tap the **⋮ (three dots)** menu in the top-right
3. Tap **"Add to Home Screen"** or **"Install App"**
4. Tap **Add** to confirm
5. DSI Connect now appears on your home screen like a regular app

### On iPhone/iPad (Safari)

1. Open DSI Connect in Safari
2. Tap the **Share button** (the box with an arrow pointing up)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add** in the top-right corner
5. DSI Connect appears on your home screen

### Benefits of Installing

- **Faster loading** — app assets are cached locally
- **Full screen** — no browser address bar
- **Works offline** — basic features work without internet
- **Push notifications** — receive alerts even when the app is closed
- **Home screen icon** — quick access like any other app

---

## 11. Tips & Shortcuts

### Keyboard Shortcuts (Desktop)

| Shortcut | Action |
|----------|--------|
| `/` | Focus the search bar (on pages with search) |
| `Esc` | Clear search / close modals |

### Mobile Tips

- **Pull to refresh** — pull down on any list to refresh data
- **Swipe** — swipe left on some list items for quick actions
- **Long press** — long press on project cards to pin/unpin
- **Tap the status badge** — on request cards to see status history

### General Tips

- **Real-time updates** — you don't need to refresh. Data updates automatically
- **Offline mode** — if you lose internet, the app shows cached data. Changes sync when you reconnect
- **Dark mode** — not currently supported, but the app is optimized for both light environments
- **Multiple tabs** — you can open DSI Connect in multiple browser tabs. Data stays in sync across all of them

---

## 12. Frequently Asked Questions

**Q: I forgot my password. What do I do?**
A: Click "Forgot Password" on the login screen and enter your company email. You'll receive a reset link within a few minutes. Check your spam folder if you don't see it.

**Q: My account says "Access Revoked." What does that mean?**
A: Your system access has been disabled by an administrator. Contact your manager or the IT Department to restore access.

**Q: I can't see the Job Requests option in my sidebar. Why?**
A: Your role may not have access to that feature. Contact your manager or IT to update your permissions.

**Q: Why are my notifications not working?**
A: Make sure you've allowed notifications in your browser settings. Go to your browser settings → Site Settings → Notifications → find DSI Connect and set it to "Allow."

**Q: Can I use DSI Connect on my personal phone?**
A: Yes. Open the URL in your phone's browser and install it as a PWA (see Section 10). Your login credentials are the same as on desktop.

**Q: My PIN stopped working after I cleared my browser data.**
A: PINs are stored in your browser's local storage. Clearing browser data removes the PIN. You'll need to set it up again in Security settings.

**Q: How do I know if my request was received?**
A: After submitting, you'll see a success notification and the request will appear in your list with "PENDING" status. You'll also receive a push notification confirming submission.

**Q: Can I edit a request after submitting?**
A: You can add messages and attachments to any request. To change the core details, contact the assigned engineer or your manager.

**Q: The app is slow. What can I do?**
A: Try these steps:
1. Refresh the page (Ctrl+R or pull down on mobile)
2. Clear your browser cache
3. Check your internet connection
4. Try a different browser

**Q: I see someone else's requests. Is that normal?**
A: It depends on your role. Managers and IT staff can see all requests. If you believe you're seeing data you shouldn't, contact IT immediately.

**Q: How do I log out?**
A: Click your avatar or name in the sidebar, then select **Log Out**. On mobile, tap the menu icon and scroll to the bottom.

---

*For technical issues, contact the IT Department.*
*For access issues, contact your manager.*
*Last updated: May 2026*
