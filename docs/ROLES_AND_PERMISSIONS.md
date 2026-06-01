# DSI Connect — Roles & Permissions Reference

> Complete reference for all roles, their capabilities, and the permission system.

---

## Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                            │
│              Full access to everything                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
    │  MANAGER   │  │ SALES HEAD  │  │  IT DEPT   │
    │ (Standard) │  │  (Sales)    │  │ (All depts)│
    └─────┬──────┘  └──────┬──────┘  └────────────┘
          │                │
    ┌─────▼──────┐  ┌──────▼──────────────────┐
    │   LEADER   │  │  TERRITORY SALES MANAGER │
    │            │  │         (TSM)            │
    └─────┬──────┘  └──────┬───────────────────┘
          │                │
    ┌─────▼──────┐  ┌──────▼──────────────────┐
    │   MEMBER   │  │ TERRITORY SALES ASSOCIATE│
    │            │  │         (TSA)            │
    └────────────┘  └─────────────────────────┘
```

---

## Role Definitions

### SUPER ADMIN
- Full unrestricted access to all features
- Can manage all staff, permissions, and system settings
- Can see all requests from all users
- Can modify any data in the system
- Typically assigned to IT Department heads and system owners

### MANAGER / SALES HEAD
- Can see all requests from their team members
- Can access Staff Directory (read-only or limited write)
- Can view analytics and reports
- Can manage team assignments
- Cannot modify system-level settings

### TSM (Territory Sales Manager)
- Can see their own requests AND their subordinates' requests
- Subordinates are determined by the `TSM` field in MongoDB user records
- Can view team performance metrics
- Cannot access admin pages

### LEADER
- Similar to Manager but typically scoped to a smaller group
- Can see team members' requests
- Limited admin access

### MEMBER / TSA (Territory Sales Associate)
- Can only see their own submitted requests
- Can send messages on their own requests
- Cannot see other users' data
- Basic profile and security management

### IT Department (Cross-cutting)
- IT staff have global access regardless of their role level
- Can see all requests, all messages, all staff data
- Typically have SUPER ADMIN or MANAGER role

### ENGINEERING Department (Cross-cutting)
- Engineering staff have global access to all requests
- This is necessary for them to receive and process requests from all Sales staff

---

## Permission Matrix

The table below shows the default permissions for each role. These can be customized per department in the Permissions Manager.

### App Features (Services)

| Feature | SUPER ADMIN | MANAGER | TSM | LEADER | MEMBER/TSA |
|---------|:-----------:|:-------:|:---:|:------:|:----------:|
| Site Visits | ✅ | ✅ | ✅ | ✅ | ✅ |
| Job Requests | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIAlux | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product Recommendations | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shop Drawings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Testing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product Requests | ✅ | ✅ | ✅ | ✅ | ✅ |
| Other Requests | ✅ | ✅ | ✅ | ✅ | ✅ |

> ℹ️ Service access is typically enabled for all roles. The difference is in **data visibility** (what requests they can see), not feature access.

### Navigation

| Nav Item | SUPER ADMIN | MANAGER | TSM | LEADER | MEMBER/TSA |
|---------|:-----------:|:-------:|:---:|:------:|:----------:|
| Team Directory | ✅ | ✅ | ❌ | ❌ | ❌ |
| Access & Permissions | ✅ | ❌ | ❌ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Help Center | ✅ | ✅ | ✅ | ✅ | ✅ |

### Security Features

| Feature | SUPER ADMIN | MANAGER | TSM | LEADER | MEMBER/TSA |
|---------|:-----------:|:-------:|:---:|:------:|:----------:|
| Change Password | ✅ | ✅ | ✅ | ✅ | ✅ |
| Login PIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| Biometrics | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2FA | ✅ | ✅ | ❌ | ❌ | ❌ |
| Activity Log | ✅ | ✅ | ✅ | ✅ | ✅ |

### Dashboard Sections

| Section | SUPER ADMIN | MANAGER | TSM | LEADER | MEMBER/TSA |
|---------|:-----------:|:-------:|:---:|:------:|:----------:|
| Stats Cards | ✅ | ✅ | ✅ | ✅ | ✅ |
| Recent Activity | ✅ | ✅ | ✅ | ✅ | ✅ |
| Overview Tabs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Schedule | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alert Banner | ✅ | ✅ | ✅ | ❌ | ❌ |
| My Tasks | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Data Visibility Rules

These rules are enforced in the code, not just the UI:

### Messages / Collaboration Hub

```
IT Department     → See ALL requests from ALL users
Engineering Dept  → See ALL requests from ALL users
SUPER ADMIN       → See ALL requests from ALL users
MANAGER           → See ALL requests from ALL users
LEADER            → See ALL requests from ALL users
TSM               → See own requests + subordinates' requests
MEMBER / TSA      → See ONLY their own requests
```

### Subordinate Detection (TSM)

A user is considered a TSM's subordinate if any of these fields in their MongoDB record match the TSM's name or reference ID:
- `TSM`
- `TSMName`
- `tsm`
- `tsmName`

### Subordinate Detection (Manager)

A user is considered a Manager's subordinate if any of these fields match:
- `Manager`
- `ManagerName`
- `manager`
- `managerName`

---

## Firestore Permission Document Structure

Each permission document in `role_permissions` collection:

**Document ID format:** `{DEPARTMENT_UPPERCASE}_{ROLE_UPPERCASE}`

**Examples:**
- `SALES_MEMBER`
- `SALES_TERRITORY SALES MANAGER`
- `IT_SUPER ADMIN`
- `ENGINEERING_MEMBER`
- `PROCUREMENT_MANAGER`

**Full document structure:**
```json
{
  "services": {
    "siteVisit": true,
    "jobRequest": true,
    "dialux": true,
    "recommendation": true,
    "shopDrawing": true,
    "testing": true,
    "productRequest": true,
    "others": true
  },
  "nav": {
    "team": false,
    "admin": false,
    "analytics": false,
    "systemSettings": false,
    "helpCenter": true
  },
  "security": {
    "changePassword": true,
    "managePin": true,
    "manageBiometrics": true,
    "manage2FA": false,
    "viewActivityLog": true
  },
  "account": {
    "viewProfile": true,
    "editProfile": true,
    "preferences": true
  },
  "dashboard": {
    "showStats": true,
    "showRecentActivity": true,
    "showOverviewTabs": true,
    "showSchedule": true,
    "showAlertBanner": false,
    "showMyTasks": true
  }
}
```

---

## How Permissions Are Applied in Code

### Loading Permissions

```typescript
// Runs on any page that needs permission checks
useEffect(() => {
  const dept = localStorage.getItem("userDepartment") || ""
  const role = localStorage.getItem("userRole") || "MEMBER"
  const docId = `${dept.toUpperCase().trim()}_${role.toUpperCase().trim()}`

  const unsub = onSnapshot(collection(db, "role_permissions"), snap => {
    // Try exact match first
    let raw = snap.docs.find(d => d.id === docId)?.data()
    // Fallback: match by role only
    if (!raw) raw = snap.docs.find(d => d.id.endsWith(`_${role.toUpperCase().trim()}`))?.data()
    if (raw) setPermissions(raw)
  })

  return () => unsub()
}, [])
```

### Applying Permissions in UI

```tsx
// Show/hide navigation items
{permissions?.nav?.admin && <AdminNavItem />}
{permissions?.nav?.team && <TeamNavItem />}

// Show/hide service tiles
{permissions?.services?.jobRequest && <JobRequestTile />}

// Show/hide dashboard sections
{permissions?.dashboard?.showStats && <StatsSection />}

// Show/hide security features
{permissions?.security?.managePin && <PinSection />}
```

---

*For permission changes, contact your System Administrator.*
*Last updated: May 2026*
