# Dashboard Logic & Role-Based Access Control (RBAC) Documentation

> **Version:** 2.8.0-ProductivityPlus  
> **Last Updated:** April 16, 2026  
> **Purpose:** Comprehensive guide for dashboard capabilities, filtering logic, and AI support bot knowledge base

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Department Capabilities Matrix](#2-department-capabilities-matrix)
3. [Role-Based Access Control (RBAC)](#3-role-based-access-control-rbac)
4. [Feature Visibility Matrix](#4-feature-visibility-matrix)
5. [Data Filtering Logic](#5-data-filtering-logic)
6. [Support Bot Knowledge Base](#6-support-bot-knowledge-base)
7. [Troubleshooting Guide](#7-troubleshooting-guide)
8. [Admin Configuration Guide](#8-admin-configuration-guide)

---

## 1. Architecture Overview

### 1.1 Core Philosophy
The Engiconnect Dashboard implements **multi-layered security** with three primary access control mechanisms:

1. **Department-Based Access** - Determines which services/modules are visible
2. **Role-Based Filtering** - Controls data visibility within accessible modules
3. **Subordinate Hierarchy** - Enables manager/TSM oversight capabilities

### 1.2 Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    ACCESS CONTROL FLOW                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Department Check → Module Visibility              │
│  Layer 2: Role Check → Data Filtering Scope                 │
│  Layer 3: Subordinate Check → Team Data Access              │
│  Layer 4: Ownership Check → Personal Data Access            │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Key Concepts

| Term | Definition | Example |
|------|------------|---------|
| **Global Access** | See all records regardless of ownership | IT, Super Admin, Manager, Leader |
| **Subordinate Filtering** | See own + team's records | TSM sees their TSAs' data |
| **Personal Filtering** | See only own records | TSA, Member see only their data |
| **Department Scope** | Services available based on department | Sales sees Job Requests, Site Visits |

---

## 2. Department Capabilities Matrix

### 2.1 Primary Departments

| Department | Default Services | Dashboard Tabs | Special Features |
|------------|------------------|----------------|------------------|
| **SALES** | Site Visit, Job Request, Dialux, Product Request | Job Requests, My Tasks, Site Visits | TSM/TSA hierarchy, Customer management |
| **ENGINEERING** | Shop Drawing, Testing, Site Visit | Monitoring, My Tasks, Schedule | PIC assignment, Technical review |
| **PROCUREMENT** | Product Requests, Testing | Product Requests, Testing | SPF processing, Vendor management |
| **IT** | All Services | Monitoring, System, Schedule | Full visibility, Counter admin, User management |
| **WAREHOUSE OPERATIONS** | Product Requests, Testing | Product Requests, Testing | Inventory sync, Release tracking |

> **⚠️ IMPORTANT:** Service access is **NOT hardcoded by department**. It is configured dynamically via `/admin/permissions` page in Firestore `role_permissions` collection. Department determines default suggestions, but actual visibility is controlled by permission documents.

### 2.2 Permission-Based Service Access

Services are controlled by the **Permissions System** (`role_permissions` collection in Firestore). Each role+department combination has a document ID like `SALES_TSM` or `ENGINEERING_MANAGER`.

#### Permission Document Structure

```typescript
type PermissionDoc = {
    services: {
        siteVisit:      boolean  // Site Visit Appointment tile
        jobRequest:     boolean  // Job Request tile
        dialux:         boolean  // Dialux Simulation tile
        recommendation: boolean  // Product Recommendation tile
        shopDrawing:    boolean  // Shop Drawing tile
        testing:        boolean  // Testing Monitoring tile
        productRequest: boolean  // SPF Product Request tile
        others:         boolean  // Other Request tile
    }
    nav: {
        team:           boolean  // Staff Directory sidebar item
        admin:          boolean  // Admin/Access Rights sidebar item
        analytics:      boolean  // Analytics page access
        systemSettings: boolean  // System Settings (IT only)
        helpCenter:     boolean  // Help Center access
    }
    security: {
        changePassword:   boolean
        managePin:        boolean
        manageBiometrics: boolean
        manage2FA:        boolean
        viewActivityLog:  boolean
    }
    account: {
        viewProfile:  boolean
        editProfile:  boolean
        preferences:  boolean
    }
    dashboard: {
        showStats:          boolean
        showRecentActivity: boolean
        showOverviewTabs:   boolean
        showSchedule:       boolean
        showAlertBanner:    boolean
        showMyTasks:        boolean
    }
}
```

#### How Service Access is Determined

```typescript
// Target permission document ID
const targetId = `${DEPT}_${ROLE}`  // e.g., "SALES_TSM"

// Lookup permissions
const perms = dynamicPermissions.find(p => p.id === targetId)

// Filter available services
const availableServices = allServices.filter(s => 
    perms.services[s.key] === true
)
```

> **Key Point:** Two users in the same department (e.g., SALES) can have **different service access** based on their role permissions. A TSM might see 4 services while a TSA sees only 2, based on what's configured in `/admin/permissions`.

### 2.3 Staff Management & Role Assignment

The Staff Management page (`/admin/staff`) is where user profiles, roles, and department assignments are configured.

#### Role Availability by Department

| Department | Available Roles | Hierarchy |
|------------|-----------------|-----------|
| **SALES** | SUPER ADMIN, SALES HEAD, TERRITORY SALES MANAGER, TERRITORY SALES ASSOCIATE | Manager → TSM → TSA |
| **ENGINEERING** | SUPER ADMIN, MANAGER, LEADER, MEMBER | Manager → Leader → Member |
| **PROCUREMENT** | SUPER ADMIN, MANAGER, LEADER, MEMBER | Manager → Leader → Member |
| **IT** | SUPER ADMIN, MANAGER, LEADER, MEMBER | Manager → Leader → Member |
| **WAREHOUSE OPERATIONS** | SUPER ADMIN, MANAGER, LEADER, MEMBER | Manager → Leader → Member |

#### Key User Fields for Subordinate Detection

| Field | Purpose | Used By |
|-------|---------|---------|
| **ReferenceID** | Unique identifier (e.g., TT-PH-S0824) | Subordinate matching |
| **TSM** / **TSMName** | Links TSA to their manager | Subordinate filtering for TSM |
| **Manager** / **ManagerName** | Links user to department head | Subordinate filtering for Managers |
| **Department** | Primary department assignment | Permission lookup |
| **Position** | Job title / role display | Role detection fallback |

#### Subordinate Relationship Logic

```typescript
// TSM subordinate detection (Strict Territory Isolation)
subordinates = allUsers.filter(u => {
    // 1. ROLE CHECK: Subordinate must be a MEMBER/TSA (not another TSM)
    const uRole = (u.Role || "MEMBER").toUpperCase()
    const uPosition = (u.Position || "").toUpperCase()
    if (uRole === "TSM" || uPosition.includes("TERRITORY SALES MANAGER")) return false

    // 2. OWNERSHIP CHECK: Must match current TSM's identity
    const uTSM = clean(u.TSM)           
    const uTSMName = clean(u.TSMName)   
    const myName = clean(currentUser.name)
    const myRefId = currentUser.ReferenceID
    
    return (uTSM && (uTSM === myName || uTSM === myRefId)) ||
           (uTSMName && uTSMName === myName)
})
```

> **Security Note:** TSMs are explicitly prevented from seeing other TSMs' data. The system only populates `subordinateIds` with users whose `Role` is strictly below TSM.

> **Important:** Subordinate detection is **case-insensitive** and **cleans special characters** to ensure matching works even with formatting differences.

---

## 3. Role-Based Access Control (RBAC)

### 3.1 Role Hierarchy

```
SUPER ADMIN
    ↓
MANAGER / SALES HEAD
    ↓
TERRITORY SALES MANAGER (TSM)
    ↓
TERRITORY SALES ASSOCIATE (TSA) / MEMBER
```

### 3.2 Role Detection Logic

Roles are determined from **three synchronized sources** (in priority order):

1. **Firestore `users` Collection** - Primary source for the `Role` field.
2. **MongoDB `Position` Field** - Secondary source, especially critical for the SALES department hierarchy.
3. **Department Mapping** - Ensures global access is restricted to authorized personnel.

#### Strict Detection Protocol:

- **MANAGER / SALES HEAD**: 
  - `Firestore Role === "MANAGER"` or `"SALES HEAD"`
  - OR (if in **SALES** department) `Position === "MANAGER"`, `"SALES HEAD"`, or contains `"GENERAL MANAGER"`.
- **TERRITORY SALES MANAGER (TSM)**: 
  - `Firestore Role === "TSM"` or `"TERRITORY SALES MANAGER"`
  - OR (if in **SALES** department) `Position` contains `"TERRITORY SALES MANAGER"`.
- **LEADER**: 
  - `Firestore Role === "LEADER"`.
- **SUPER ADMIN**: 
  - `Firestore Role === "SUPER ADMIN"`.
- **MEMBER / TSA**: 
  - Default if no higher role is detected.

> **Note:** Detection is strict to prevent TSMs from being incorrectly elevated to global Manager status, which would bypass territory security.

### 3.3 Role Capabilities Detail

#### SUPER ADMIN
| Capability | Value |
|------------|-------|
| **Data Visibility** | ALL records across all departments |
| **User Management** | Full access (via Admin panel) |
| **Service Access** | All 8 services |
| **Notification Scope** | All pending items |
| **Special Features** | System configuration, Role assignment, Counter admin |

#### MANAGER / SALES HEAD
| Capability | Value |
|------------|-------|
| **Data Visibility** | ALL records in their department |
| **Team Oversight** | All subordinates (TSMs and TSAs under them) |
| **Service Access** | All department-relevant services |
| **Special Features** | Department analytics, Team performance, Assignment matrix |

#### TERRITORY SALES MANAGER (TSM)
| Capability | Value |
|------------|-------|
| **Data Visibility** | Own records + Subordinate (TSA) records |
| **Subordinate Detection** | Users with `TSM` field matching TSM's name or ReferenceID **AND** whose role is `MEMBER`/`TSA` |
| **Service Access** | Full Sales services (create, view, manage) |
| **Strict Exclusion** | Cannot see other TSMs' records, even if they share the same manager |
| **Special Features** | Team agenda view, Subordinate tracking, Customer assignment |

#### TERRITORY SALES ASSOCIATE (TSA) / MEMBER
| Capability | Value |
|------------|-------|
| **Data Visibility** | OWN records only |
| **Service Access** | Can create and view own records only |
| **Cannot See** | Any other user's records, even in same territory |
| **Special Features** | Personal task management, Own customer list |

---

## 4. Feature Visibility Matrix

### 4.1 Dashboard Sections

| Section | Super Admin | Manager | TSM | TSA/Member |
|---------|-------------|---------|-----|------------|
| **Services Grid** | All 8 services | Dept services | Dept services | Dept services |
| **Productivity Hub** | All items | All dept items | Own + Subordinates | Own only |
| **Today's Agenda** | All appointments | All dept appointments | Own + TSA appointments | Own only |
| **Active Tasks** | All tasks | All dept tasks | Own + TSA tasks | Own only |
| **Recent Updates** | All activities | All dept activities | Own + TSA activities | Own only |
| **Quick Actions** | All | Dept-relevant | Dept-relevant | Dept-relevant |
| **Customer Stats** | All customers | Dept customers | Own + TSA customers | Own customers |
| **Department Pulse** | All departments | Own department | Own territory | Own metrics only |

### 4.2 Service-Specific Permissions

| Service | Create | View Own | View Subordinates | View All | Admin |
|---------|--------|----------|-------------------|----------|-------|
| **Site Visit** | Sales, Eng | ✓ | TSM only | IT, Manager | IT |
| **Job Request** | Sales, Eng | ✓ | TSM only | IT, Manager | IT |
| **Dialux** | Sales, IT | ✓ | TSM only | IT, Manager | IT |
| **Shop Drawing** | Eng, IT | ✓ | Manager only | IT, Manager | IT |
| **Testing** | Eng, Proc | ✓ | Manager only | IT, Manager | IT |
| **Product Request** | Sales, Proc | ✓ | TSM only (if sales) | IT, Manager | IT |
| **Other Request** | All | ✓ | Manager only | IT, Manager | IT |

---

## 5. Data Filtering Logic

### 5.1 Filtering Decision Tree

```
User Accesses Dashboard
    ↓
Check Department → Determine Available Services
    ↓
Check Role
    ├── SUPER ADMIN / MANAGER / LEADER / IT
    │   └── Show ALL data (Global Access)
    ├── TSM (Territory Sales Manager)
    │   └── Show OWN data + SUBORDINATE data
    └── TSA / MEMBER
        └── Show OWN data only (Personal Access)
```

### 5.2 Code Implementation Reference

#### 5.2.1 TSM Detection
```typescript
// Critical: Must detect both short and full role names
const isTSM = userRole === "TSM" || userRole?.includes("TERRITORY SALES MANAGER")
```

#### 5.2.2 Global Access Check
```typescript
const isManager = userRole === "MANAGER" || userRole === "SALES HEAD" || userRole === "SUPER ADMIN"
const hasGlobalAccess = userDept === "IT" || userDept === "ENGINEERING" || isManager || userRole === "LEADER"
```

#### 5.2.3 Filtering Logic Pattern
```typescript
if (!hasGlobalAccess) {
    if (isTSM) {
        // TSM: Filter to own + subordinates (TSAs)
        data = data.filter(item => {
            const ownerId = item.submittedBy || item.createdBy || item.pic || item.assignedTo
            return ownerId === userId || subordinateIds.includes(ownerId)
        })
    } else {
        // TSA/Member: Filter to own only
        data = data.filter(item => {
            const ownerId = item.submittedBy || item.createdBy || item.pic || item.assignedTo
            return ownerId === userId
        })
    }
}
```

#### 5.2.4 Subordinate Detection (for TSM)
```typescript
// Subordinates are TSAs whose TSM field matches current TSM user
subordinates = allUsers.filter(u => {
    // Exclude other TSMs from the list
    if (isUserTSM(u)) return false; 

    const uTSM = clean(u.TSM)
    const uTSMName = clean(u.TSMName)
    const myCleanName = clean(myName)
    const myRefId = myReferenceID
    
    return (uTSM && (uTSM === myCleanName || uTSM === myRefId)) ||
           (uTSMName && uTSMName === myCleanName)
})
```

### 5.3 Filtering Locations in Code

| Section | File | Line | Logic |
|---------|------|------|-------|
| Site Visit Notifications | `dashboard/page.tsx` | 802-812 | Firebase listener with TSM filter |
| Recent Activity | `dashboard/page.tsx` | 1022-1077 | Activity feed filtering |
| Schedule & Tasks | `dashboard/page.tsx` | 1079-1168 | Agenda filtering |
| Site Visit List | `appointments/site-visit/page.tsx` | 602-682 | TSM + Manager filtering |

---

## 6. Support Bot Knowledge Base

### 6.1 AI-Friendly Dictionary

```json
{
  "roles": {
    "TSM": {
      "full_name": "Territory Sales Manager",
      "access_level": "subordinate_filtered",
      "can_see": ["own_data", "tsa_data"],
      "cannot_see": ["other_tsm_data", "unassigned_data"],
      "key_responsibility": "Manage territory sales associates and oversee their activities"
    },
    "TSA": {
      "full_name": "Territory Sales Associate",
      "access_level": "personal_only",
      "can_see": ["own_data"],
      "cannot_see": ["other_tsa_data", "tsm_data", "team_data"],
      "key_responsibility": "Execute sales activities within assigned territory"
    },
    "MANAGER": {
      "full_name": "Sales Head / Department Manager",
      "access_level": "global_department",
      "can_see": ["all_department_data", "all_subordinates"],
      "cannot_see": ["other_department_data"],
      "key_responsibility": "Oversee entire department operations and team performance"
    },
    "SUPER_ADMIN": {
      "full_name": "System Administrator",
      "access_level": "global_all",
      "can_see": ["all_data", "all_users", "all_departments"],
      "cannot_see": [],
      "key_responsibility": "System administration and user management"
    }
  },
  "departments": {
    "SALES": {
      "services": ["site_visit", "job_request", "dialux", "product_request"],
      "roles": ["TSM", "TSA", "MANAGER"],
      "hierarchy": "Manager → TSM → TSA"
    },
    "ENGINEERING": {
      "services": ["shop_drawing", "testing", "site_visit_execution"],
      "roles": ["ENGINEER", "MANAGER", "PIC"],
      "hierarchy": "Manager → Lead Engineer → Engineer"
    },
    "PROCUREMENT": {
      "services": ["product_request", "testing_tracking"],
      "roles": ["PROCUREMENT_OFFICER", "MANAGER"],
      "hierarchy": "Manager → Officer"
    },
    "IT": {
      "services": ["all_services", "administration"],
      "roles": ["SUPER_ADMIN", "IT_SUPPORT"],
      "hierarchy": "Admin → Support"
    }
  },
  "permissions_system": {
    "collection": "role_permissions",
    "document_id_format": "{DEPT}_{ROLE}",
    "examples": ["SALES_TSM", "ENGINEERING_MANAGER", "IT_SUPER ADMIN"],
    "config_location": "/admin/permissions",
    "controls": {
      "services": "8 service tiles visibility",
      "nav": "Sidebar navigation items",
      "security": "Account security features",
      "account": "Profile management features",
      "dashboard": "Dashboard section visibility"
    }
  },
  "staff_management": {
    "location": "/admin/staff",
    "purpose": "Manage user profiles, roles, department assignments",
    "role_hierarchy": {
      "SALES": ["SUPER ADMIN", "SALES HEAD", "TERRITORY SALES MANAGER", "TERRITORY SALES ASSOCIATE"],
      "OTHER_DEPTS": ["SUPER ADMIN", "MANAGER", "LEADER", "MEMBER"]
    },
    "key_fields": ["ReferenceID", "Department", "Position", "TSM", "TSMName", "Manager"]
  },
  "filtering_rules": {
    "rule_1": "IT/SuperAdmin/Manager/Leader = NO filtering (global access)",
    "rule_2": "TSM = Filter to own + subordinates with matching TSM field",
    "rule_3": "TSA/Member = Filter to own records only",
    "rule_4": "Subordinate detection uses TSM/Manager field matching (case-insensitive)",
    "rule_5": "Service visibility is DYNAMIC via permissions system (not hardcoded)"
  }
}
```

### 6.2 Common Support Questions & Answers

#### Q: Why can't I see my team's site visits?
**A:** Check role detection:
- If you're TSM but see `isTSM: false` in console → Role detection failed
- If `userRole` shows "TSM" but not working → Check line 799 in dashboard/page.tsx
- If subordinates empty → Check TSM field matching in user profile

#### Q: Why am I seeing other TSM's data?
**A:** This indicates filtering is NOT working:
1. Check `hasGlobalAccess` is not incorrectly true
2. Verify `isTSM` detection includes full role name
3. Confirm `subordinateIds` is populated
4. Check filtering logic is applied before setting state

#### Q: What's the difference between TSM and TSA view?
**A:** 
- **TSM**: Sees `own records + all TSAs assigned to them`
- **TSA**: Sees `own records only`
- TSM uses `subordinateIds` array for filtering, TSA uses `userId` only

#### Q: How is subordinate relationship determined?
**A:** 
- System checks MongoDB `TSM` or `TSMName` field on subordinate's profile
- Must match TSM's `name` or `ReferenceID` (case-insensitive, cleaned)
- Fields checked: `TSM`, `TSMName`, `tsm`, `tsmName`

#### Q: Why can't I see a specific service tile (e.g., Site Visit)?
**A:** Service visibility is controlled by the Permissions System:
1. Go to `/admin/permissions` page
2. Find the permission document for your `{DEPT}_{ROLE}` (e.g., `SALES_TSM`)
3. Check that `services.siteVisit` is set to `true`
4. If missing, the document may need to be created or updated

#### Q: Where do I configure which services a role can access?
**A:** Two admin pages control access:
- **`/admin/permissions`** - Configure which services/features each role can see (toggles for services, nav, security, dashboard sections)
- **`/admin/staff`** - Assign users to departments and roles (Sales uses TSM/TSA hierarchy, other depts use Manager/Leader/Member)

#### Q: How do I make a TSA report to a TSM?
**A:** In Staff Management (`/admin/staff`):
1. Edit the TSA user's profile
2. Set the `TSM` or `TSMName` field to the TSM's **name** or **ReferenceID**
3. Save - the TSM will now see this TSA's data in their dashboard

### 6.3 Diagnostic Commands for Support

```javascript
// Check current user role detection
const role = localStorage.getItem("userRole");
const upperRole = (role || "").toUpperCase();
const isTSM = upperRole === "TSM" || upperRole.includes("TERRITORY SALES MANAGER");
const hasGlobal = ["IT", "SUPER ADMIN", "LEADER", "MANAGER"].includes(upperRole);
console.log({role, isTSM, hasGlobalAccess: hasGlobal});

// Check subordinate detection
console.log("Subordinate IDs:", subordinateIds);
console.log("Subordinate count:", subordinateIds?.length || 0);

// Check if specific record should be visible
const recordSubmittedBy = "someUserId"; // from Firestore
const shouldBeVisible = hasGlobal || 
    (isTSM && (recordSubmittedBy === userId || subordinateIds.includes(recordSubmittedBy))) ||
    (!isTSM && recordSubmittedBy === userId);
console.log("Should be visible:", shouldBeVisible);
```

---

## 7. Troubleshooting Guide

### 7.1 Common Issues

| Issue | Symptoms | Root Cause | Fix |
|-------|----------|------------|-----|
| **Wrong data showing** | TSM sees other TSM's records | `isTSM` detection failed | Check role detection logic |
| **Empty dashboard** | No records visible when should have some | Filtering too aggressive | Check `subordinateIds` population |
| **Missing notifications** | Count shows 0 but records exist | Filter applied before count | Check filter scope |
| **All data visible** | TSA seeing everything | `hasGlobalAccess` incorrectly true | Check department/role mapping |
| **Missing service tile** | Can't see Site Visit/Job Request tile | Permissions not configured | Check `/admin/permissions` for `{DEPT}_{ROLE}` |
| **Can't access admin page** | 403 or missing sidebar item | Role lacks nav.admin permission | Update permissions in Firestore |
| **TSM not seeing TSA data** | TSA records missing from dashboard | TSM field not set on TSA profile | Edit TSA in `/admin/staff`, set TSM field |
| **Permission changes not applied** | Still seeing old access after update | Cached permissions | Refresh page or clear localStorage |

### 7.2 Debug Checklist

When user reports filtering issues:

1. **Verify Role Detection**
   ```javascript
   console.log("userRole from localStorage:", localStorage.getItem("userRole"));
   ```
   - Should show "TSM" or "TERRITORY SALES MANAGER"
   - If empty or wrong, check auth flow

2. **Verify isTSM Flag**
   ```javascript
   const role = localStorage.getItem("userRole")?.toUpperCase();
   console.log("isTSM:", role === "TSM" || role?.includes("TERRITORY SALES MANAGER"));
   ```
   - Should be `true` for TSMs

3. **Verify Subordinates Loaded**
   ```javascript
   console.log("Subordinate count:", subordinateIds?.length);
   ```
   - Should be > 0 for TSMs with team
   - If 0, check TSM field matching in user profiles

4. **Verify hasGlobalAccess**
   ```javascript
   const dept = localStorage.getItem("userDepartment")?.toUpperCase();
   const role = localStorage.getItem("userRole")?.toUpperCase();
   console.log("hasGlobalAccess:", dept === "IT" || ["SUPER ADMIN", "LEADER", "MANAGER"].includes(role));
   ```
   - Should be `false` for TSM/TSA (unless IT dept)

5. **Verify Permissions Loaded**
   ```javascript
   // Check Firestore for permission document
   const targetId = `${localStorage.getItem("userDepartment")}_${localStorage.getItem("userRole")}`;
   console.log("Expected permission ID:", targetId);
   // Navigate to /admin/permissions and verify this document exists
   ```
   - Document should exist in Firestore `role_permissions` collection
   - Check that `services.{serviceKey}` is `true` for missing tiles

### 7.3 Critical Code Locations

| File | Lines | Purpose |
|------|-------|---------|
| `app/dashboard/page.tsx` | 799 | TSM detection in Firebase listeners |
| `app/dashboard/page.tsx` | 807 | Filter condition for notifications |
| `app/dashboard/page.tsx` | 1036 | TSM detection in Recent Activity |
| `app/dashboard/page.tsx` | 1093 | TSM detection in Schedule & Tasks |
| `app/appointments/site-visit/page.tsx` | 621 | TSM detection in Site Visit list |

---

## 8. Admin Configuration Guide

### 8.1 Permissions Configuration (`/admin/permissions`)

This page controls what each role can see and access across the application.

#### Permission Document Format

Each document in the `role_permissions` Firestore collection follows this naming convention:

```
Document ID: {DEPARTMENT}_{ROLE}

Examples:
- SALES_TSM                    (Territory Sales Manager in Sales dept)
- SALES_TERRITORY SALES MANAGER (Alternative full name format)
- ENGINEERING_MANAGER          (Engineering department manager)
- IT_SUPER ADMIN             (IT super administrator)
```

#### Configuration Sections

| Section | Controls | Typical Settings |
|---------|----------|------------------|
| **Services** | 8 service tiles visibility on dashboard | TSM: 4-5 services, TSA: 2-3 services |
| **Navigation** | Sidebar menu items | Manager: +Admin, Team; Member: basic only |
| **Security** | Account security page features | All roles: password, pin; Manager+: 2FA, activity log |
| **Account** | Profile management capabilities | Most roles: view/edit profile |
| **Dashboard** | Dashboard section visibility | TSM: stats + schedule + team tasks |

#### Creating New Permission Documents

1. Navigate to `/admin/permissions`
2. Click "Add Role Permission"
3. Select Department and Role
4. Toggle desired services/features
5. Save - document will be created as `{DEPT}_{ROLE}`

> **Note:** Changes take effect immediately. Users will see updated access on next page refresh.

---

### 8.2 Staff Management (`/admin/staff`)

This page manages user profiles, department assignments, and role hierarchies.

#### Key Actions

| Action | How To | Impact |
|--------|--------|--------|
| **Assign Department** | Edit user → Select Department | Determines which permission document applies |
| **Assign Role** | Edit user → Select Role | Controls access level and filtering scope |
| **Link TSA to TSM** | Edit TSA → Set TSM/TSMName field | TSM will see this TSA's data in dashboard |
| **Update ReferenceID** | Edit user → Set unique ID | Used for subordinate matching |

#### Sales Department Hierarchy Setup

For TSM/TSA reporting to work:

1. **TSM Profile:**
   - Department: SALES
   - Role: TERRITORY SALES MANAGER (or TSM)
   - ReferenceID: e.g., "TT-PH-S0824"
   - Name: e.g., "John Smith"

2. **TSA Profile:**
   - Department: SALES
   - Role: TERRITORY SALES ASSOCIATE (or TSA)
   - TSM field: "John Smith" OR "TT-PH-S0824"
   - Must match TSM's name or ReferenceID

3. **Verification:**
   - TSM logs in → Should see own + TSA's records
   - Check `/admin/staff` to verify TSM field is set correctly

#### Standard Department Setup (Non-Sales)

For Engineering, Procurement, IT, Warehouse:

| Level | Role | Typical Permissions |
|-------|------|---------------------|
| 1 | SUPER ADMIN | Full system access |
| 2 | MANAGER | Department-wide data visibility |
| 3 | LEADER | Team oversight (subset of manager) |
| 4 | MEMBER | Personal data only |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Global Access** | Permission to view all records without filtering |
| **Subordinate Filtering** | Data visibility limited to user's own records plus their direct reports |
| **Personal Filtering** | Data visibility limited to user's own records only |
| **TSM** | Territory Sales Manager - oversees a sales territory with multiple TSAs |
| **TSA** | Territory Sales Associate - sales representative under a TSM |
| **PIC** | Person In Charge - assigned executor for site visits |
| **ReferenceID** | Unique identifier for users (e.g., TT-PH-S0824) |
| **SubmittedBy** | User ID of the person who created a record |
| **SubordinateIds** | Array of user IDs belonging to a manager's/TSM's team |

## Appendix B: File Structure Reference

```
app/
├── dashboard/
│   └── page.tsx              # Main dashboard with filtering logic
├── appointments/
│   └── site-visit/
│       └── page.tsx          # Site visit list with TSM filtering
├── api/
│   └── user/
│       └── route.ts          # User data including TSM/subordinate info
└── admin/
    ├── permissions/
    │   └── page.tsx          # Role permission configuration (services/nav/dashboard visibility)
    └── staff/
        └── page.tsx          # Staff management (role assignment, department, TSM linking)
components/
└── app-sidebar.tsx           # Role-based navigation
lib/
└── ModuleCSR/
    └── mongodb.ts            # User profile queries (TSM field)
```

---

**Document Owner:** Engineering Team  
**Review Cycle:** Monthly or after major RBAC changes  
**AI Training Version:** 1.0 (for support bot integration)
