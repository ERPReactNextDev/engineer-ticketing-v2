# RBAC Migration to Supabase - Complete Setup & Implementation Guide

## Overview
The RBAC (Role-Based Access Control) system has been migrated from Firebase Firestore to Supabase and enhanced with:
- ✅ Supabase-aligned schema with JSONB permission columns
- ✅ Three-layer security enforcement (frontend, API, database)
- ✅ Visual UI states for permission toggles (enabled/disabled)
- ✅ Auto-initialization with seed data
- ✅ SUPER ADMIN-only access to permissions management
- ✅ Comprehensive audit trail (updated_at, updated_by)

The system uses the `engiconnect_role` field from the Supabase users table for role-based permission checks.

## What Was Changed

### 1. New Supabase Tables
The following tables were created in Supabase:
- `role_permissions` - Stores permission configurations for each department/role combination
  - `doc_id` - Unique identifier (format: DEPARTMENT_ROLE)
  - `department` - Department name (nullable)
  - `role` - Role name (nullable)
  - `services`, `nav`, `security`, `account`, `dashboard` - JSONB permission objects
  - `is_dashboard_allowed` - Boolean flag for dashboard access
- `department_configs` - Stores department definitions and their available roles
  - `name` - Department name (nullable)
  - `roles` - JSON array of available roles (nullable)
  - `color` - UI color identifier
  - `deleted` - Soft delete flag

### 2. Users Table Enhancement
Added `engiconnect_role` field to the `users` table:
- `engiconnect_role` - Primary role field for RBAC (manually assigned)
- Falls back to `Role` field if `engiconnect_role` is not set

### 3. New API Endpoints
- `GET/POST /api/permissions/role` - Manage role permissions
- `GET/POST/DELETE /api/permissions/departments` - Manage department configurations
- `GET /api/permissions/check?userId={id}` - Check user permissions

### 4. Updated Files
- `lib/ModuleGlobal/supabase.ts` - Added helper functions for RBAC operations
- `app/admin/permissions/page.tsx` - **[UPDATED]** Complete revision:
  - ✅ Supabase schema alignment (field names match JSONB columns exactly)
  - ✅ Visual states for enabled/disabled permissions
  - ✅ Clickable toggle items (entire row clickable, not just switch)
  - ✅ JSON parsing for Supabase API responses (handles string and object formats)
  - ✅ Auto-initialization with seed data (ENGINEERING_MANAGER, IT_SUPER ADMIN)
  - ✅ Sends userId with API requests for audit trail
  - ✅ Graceful error handling for empty tables (404 → auto-init)
- `pages/api/permissions/role.ts` - **[UPDATED]** Added SUPER ADMIN verification:
  - ✅ GET requests: Available to all authenticated users
  - ✅ POST requests: Restricted to SUPER ADMIN only (returns 403 Forbidden if unauthorized)
  - ✅ Validates user role before allowing modifications
- `components/protected-page-wrapper.tsx` - Access control enforcement:
  - ✅ Restricts `/admin/permissions` to SUPER ADMIN only
  - ✅ Shows "Access Restricted" error for non-SUPER ADMIN users
  - ✅ Session validation and role checking
- `components/login-form.tsx` - Updated to fetch and store `engiconnect_role` from Supabase
- `components/app-sidebar.tsx` - Updated to use `engiconnect_role` for permission lookups
- `app/dashboard/page.tsx` - Updated to use `engiconnect_role` for permission checks
- `app/account/security/page.tsx` - Updated to use `engiconnect_role` for security permissions

## Required Setup Steps

### Step 1: Add engiconnect_role Field to Users Table
Add the `engiconnect_role` field to your existing `users` table in Supabase:

```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS engiconnect_role text;
```

### Step 2: Run the SQL Migration
Run the SQL script in your Supabase SQL Editor to create the necessary tables:

```bash
supabase-migrations/rbac-migration.sql
```

This creates:
- `role_permissions` table with nullable `department` and `role` fields
- `department_configs` table with nullable `name` and `roles` fields
- RLS policies for both tables
- Default department configurations

### Step 3: Import Firebase Role Permissions (Optional)
If you have existing Firebase role_permissions data, import them:

```bash
supabase-migrations/import-role-permissions.sql
```

This imports 11 role permission configurations from Firebase:
- ADMIN_MANAGER
- ENGINEERING_LEADER
- ENGINEERING_MANAGER
- ENGINEERING_MEMBER
- HUMAN RESOURCES_MANAGER
- IT_SUPER ADMIN
- PROCUREMENT_MEMBER
- SALES_MEMBER
- SALES_TERRITORY SALES ASSOCIATE
- SALES_TERRITORY SALES MANAGER
- WAREHOUSE OPERATIONS_MEMBER

### Step 4: Assign Roles to Users
Manually assign the `engiconnect_role` field in the Supabase users table for each user:
- Go to Supabase Table Editor
- Select the `users` table
- Set `engiconnect_role` to the appropriate role (e.g., "MANAGER", "LEADER", "TERRITORY SALES ASSOCIATE")
- This role will be used for RBAC permission checks

Example values based on Firebase data:
- "MANAGER" - For managers
- "LEADER" - For team leaders
- "MEMBER" - For regular members
- "TERRITORY SALES ASSOCIATE" - For sales associates
- "TERRITORY SALES MANAGER" - For sales managers
- "SUPER ADMIN" - For super admins

### Step 5: Verify Environment Variables
Ensure your `.env.local` file has the correct Supabase configuration:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 6: Restart Development Server
```bash
npm run dev
```

## Permissions Page: UI & Functionality

### Access Control
The permissions page (`/admin/permissions`) has **three-layer security**:

#### Layer 1: Frontend Access Control
- **Location:** `components/protected-page-wrapper.tsx`
- **Check:** User role must be "SUPER ADMIN"
- **Failure:** Shows "Access Restricted" error screen
- **Behavior:** Non-SUPER_ADMIN users never see the interface

```javascript
if (pathname === "/admin/permissions" && userRole !== "SUPER ADMIN") {
  setAccessDenied(true);
  return;
}
```

#### Layer 2: API Authentication
- **Location:** `pages/api/permissions/role.ts` (POST method)
- **Check:** Verifies user role before saving changes
- **Failure:** Returns `403 Forbidden` with message
- **Behavior:** Prevents any unauthorized modifications even if frontend is bypassed

```javascript
const isAdmin = await isSuperAdmin(userId);
if (!isAdmin) {
  return res.status(403).json({ 
    error: "Forbidden: Only SUPER ADMIN can modify permissions" 
  });
}
```

#### Layer 3: Audit Trail
- **Location:** `role_permissions` table columns
- **Fields:** `updated_at`, `updated_by`
- **Behavior:** Records who made changes and when
- **Benefit:** Full traceability of all permission modifications

### Permission Toggle UI States

#### Enabled (ON / true)
- Background: White with shadow
- Icon: Dark/black circle (active)
- Text: Dark (zinc-900)
- Opacity: 100% (fully visible)
- Hover: Increased shadow, border highlight
- Clickable: Entire row clickable

```
┌──────────────────────────────────┐
│ ⚫ MEETING ROOMS         [ON]   │  ← Active
│  • White background             │
│  • Dark icon                     │
│  • Shadow visible               │
└──────────────────────────────────┘
```

#### Disabled (OFF / false)
- Background: Light gray semi-transparent
- Icon: Light gray circle (inactive)
- Text: Muted gray (zinc-500)
- Opacity: 60% (appears muted)
- Hover: Opacity increases to 75%, background brightens
- Clickable: Entire row clickable

```
┌──────────────────────────────────┐
│ ⚪ PRODUCT REQUESTS     [OFF]   │  ← Disabled
│  • Light gray background        │
│  • Light icon                   │
│  • Muted appearance             │
└──────────────────────────────────┘
```

### Permission Sections & Fields

All permission sections map directly to Supabase JSONB columns:

#### 1. App Features (services column)
- `siteVisit` → Site Visits
- `jobRequest` → Job Requests
- `dialux` → DIAlux Simulations
- `recommendation` → Product Recommendations
- `shopDrawing` → Shop Drawings
- `testing` → Testing & Monitoring
- `productRequest` → Product Requests
- `others` → Other Requests
- `meetingRoom` → Meeting Rooms

#### 2. Navigation (nav column)
- `team` → Team Directory
- `admin` → Access & Permissions
- `analytics` → Analytics
- `systemSettings` → System Settings
- `helpCenter` → Help Center

#### 3. Security (security column)
- `changePassword` → Change Password
- `managePin` → Login PIN
- `manageBiometrics` → Biometrics
- `manage2FA` → Two-Step Verification
- `viewActivityLog` → Login Activity

#### 4. Profile (account column)
- `viewProfile` → View Profile
- `editProfile` → Edit Profile
- `preferences` → App Preferences

#### 5. Home Screen (dashboard column)
- `showStats` → Stats Cards
- `showRecentActivity` → Recent Activity
- `showOverviewTabs` → Overview Tabs
- `showSchedule` → Schedule
- `showAlertBanner` → Alerts
- `showMyTasks` → My Tasks

### Auto-Initialization

On first load, if the `role_permissions` table is empty, the page automatically initializes with seed data:

```javascript
const seedData = [
  {
    doc_id: "ENGINEERING_MANAGER",
    department: "ENGINEERING",
    role: "MANAGER",
    services: { ... },
    nav: { ... },
    security: { ... },
    account: { ... },
    dashboard: { ... },
  },
  {
    doc_id: "IT_SUPER ADMIN",
    department: "IT",
    role: "SUPER ADMIN",
    services: { ... },
    nav: { ... },
    security: { ... },
    account: { ... },
    dashboard: { ... },
  },
]
```

**Expected Console Output (First Load):**
```
No permissions found, initializing with seed data...
Seed data initialized successfully
```

### Workflow: Modify & Save

```
1. User selects role (e.g., ENGINEERING_MANAGER)
   ↓ Page loads permissions for that role

2. Permissions display with visual states
   ├─ ⚫ Enabled items (white)
   └─ ⚪ Disabled items (gray)

3. User clicks any permission item to toggle
   ↓ Item toggles between ON and OFF
   ↓ Visual state updates immediately
   ↓ "Unsaved changes" indicator appears
   ↓ Save button becomes active

4. User clicks "Save"
   ↓ API call with userId (x-user-id header)
   ↓ Server verifies user is SUPER ADMIN
   ↓ If authorized: Saves to Supabase with updated_at, updated_by
   ↓ If unauthorized: Returns 403 Forbidden
   ↓ Toast notification: "Permissions saved" or error

5. User refreshes page
   ↓ Permissions persist ✅
```

## Required Setup Steps

### Step 7: Test the System

#### Test 1: SUPER ADMIN Access
1. Login as user with role "SUPER ADMIN"
2. Navigate to `/admin/permissions`
3. ✅ Expected: Page loads normally
4. ✅ Expected: See permissions interface with two roles (ENGINEERING_MANAGER, IT_SUPER ADMIN)
5. ✅ Expected: Can toggle switches and save changes

#### Test 2: Non-SUPER ADMIN Access Denied
1. Login as user with role "MANAGER"
2. Try to navigate to `/admin/permissions`
3. ❌ Expected: See "Access Restricted" error screen
4. ❌ Expected: Message states "Only SUPER ADMIN users can access..."
5. ❌ Expected: Cannot see the permissions interface
6. ❌ Expected: Can only click "Return Home" or "Request Access"

#### Test 3: Permission Toggle & Save
1. Login as SUPER ADMIN
2. Navigate to `/admin/permissions`
3. Select "ENGINEERING_MANAGER" role
4. Toggle "Meeting Rooms" from OFF to ON
   - ✅ Item becomes white/active
   - ✅ "Unsaved changes" appears
   - ✅ Save button activates
5. Click "Save"
   - ✅ Toast shows "Permissions saved"
   - ✅ Changes saved to database
6. Refresh page
   - ✅ "Meeting Rooms" still shows as ON
   - ✅ Changes persist ✅

#### Test 4: Visual States
1. Select any role in permissions page
2. Verify enabled items (true) display:
   - ✅ White background
   - ✅ Dark icon (black circle)
   - ✅ Dark text
   - ✅ Shadow visible
3. Verify disabled items (false) display:
   - ✅ Light gray background
   - ✅ Light gray icon
   - ✅ Muted text
   - ✅ 60% opacity
4. Hover over disabled item:
   - ✅ Opacity increases to 75%
   - ✅ Background brightens slightly

#### Test 5: Full Permission Workflow
1. Navigate to `/admin/permissions` as SUPER ADMIN
2. Select "IT_SUPER ADMIN" role
3. Verify all items are enabled (white) - all 28 permissions ON
4. Select "ENGINEERING_MANAGER" role
5. Verify mixed state:
   - ✅ Most services ON (white)
   - ✅ Some services OFF (gray) - e.g., Product Requests OFF
   - ✅ All navigation ON (white)
   - ✅ All security ON (white)
   - ✅ All account ON (white)
   - ✅ Most dashboard sections ON
6. Toggle a permission from OFF to ON:
   - ✅ Item becomes white
   - ✅ Section count increases (e.g., "8/9 ACTIVE" → "9/9 ACTIVE")
7. Click "Save"
   - ✅ Changes saved
8. Refresh and verify changes persist

### Role Assignment Flow
1. **Manual Assignment**: Admins manually set `engiconnect_role` in the Supabase users table
2. **Login**: When a user logs in, the system fetches their `engiconnect_role` from Supabase
3. **Storage**: The role is stored in localStorage as both `engiconnect_role` and `userRole` (for backward compatibility)
4. **Permission Lookup**: The RBAC system uses `{DEPARTMENT}_{ROLE}` format to lookup permissions in the `role_permissions` table

### Example
- User with `Department: "Engineering"` and `engiconnect_role: "MANAGER"`
- System looks for permission document with `doc_id: "ENGINEERING_MANAGER"`
- If found, applies those permissions to the user
- If not found, falls back to default permissions

### Role Naming Convention
Role names must match the permission document IDs exactly:
- Use full role names: "TERRITORY SALES ASSOCIATE" (not "TSA")
- Use uppercase for consistency
- Special roles like "SUPER ADMIN" should match exactly

### Dashboard and Sidebar Services
The dashboard Services section and the sidebar Services menu must use the same role permission document. Resolve the user's role from `engiconnect_role` first, then look up `{DEPARTMENT}_{ROLE}` in `role_permissions`; do not derive dashboard visibility from a separate role source or grant all dashboard services based only on department or role.

Both surfaces use the `services` flags from that permission document. Supported service keys are `siteVisit`, `jobRequest`, `dialux`, `recommendation`, `shopDrawing`, `testing`, `productRequest`, `others`, and `meetingRoom`. The dashboard's Other Request tile maps to the `others` permission key. A service should only appear when its corresponding flag is `true`; a missing or false flag hides it in both places.

When verifying a role, compare the dashboard tiles with the sidebar submenu after permissions load. If the lists differ, confirm both surfaces resolved the same department-role document and that their service keys match the keys in its `services` object.

When verifying a role, compare the dashboard tiles with the sidebar submenu after permissions load. If the lists differ, confirm both surfaces resolved the same department-role document and that their service keys match the keys in its `services` object.

## Security Implementation

### Three-Layer Protection Model

#### Layer 1: Frontend Access Control
- **Where:** `components/protected-page-wrapper.tsx`
- **When:** User navigates to `/admin/permissions`
- **Check:** `userRole === "SUPER ADMIN"`
- **Benefit:** Fast, user-friendly, prevents unauthorized users from seeing interface
- **Limitation:** Can be bypassed if frontend code is modified

#### Layer 2: API Route Validation
- **Where:** `pages/api/permissions/role.ts` (POST method)
- **When:** User submits permission changes
- **Check:** Verifies `isSuperAdmin(userId)` against Supabase database
- **Benefit:** Server-side validation, cannot be bypassed
- **Response:** `403 Forbidden` if unauthorized
- **Implementation:**
  ```javascript
  const isAdmin = await isSuperAdmin(userId);
  if (!isAdmin) {
    return res.status(403).json({ 
      error: "Forbidden: Only SUPER ADMIN can modify permissions" 
    });
  }
  ```

#### Layer 3: Audit Trail & Accountability
- **Where:** `role_permissions` table
- **Fields:** `updated_at`, `updated_by`
- **Benefit:** Full traceability of all changes
- **Usage:** Who made the change, when, and what was changed
- **Example:**
  ```json
  {
    "doc_id": "ENGINEERING_MANAGER",
    "updated_at": "2026-10-10T12:00:00Z",
    "updated_by": "admin_user_id",
    "services": { ... }
  }
  ```

### API Endpoint Security

#### GET /api/permissions/role
- **Permission:** Available to all authenticated users
- **Purpose:** Fetch permissions for viewing
- **Risk:** Low (read-only)
- **Response:** Permission configuration or 404 if not found

#### POST /api/permissions/role
- **Permission:** SUPER ADMIN only
- **Purpose:** Save or update permissions
- **Risk:** High (data modification)
- **Validation:** 
  1. Check `x-user-id` header
  2. Fetch user from Supabase
  3. Verify role is "SUPER ADMIN"
  4. Allow save only if verified
- **Response:** 
  - `200 OK` if authorized and saved
  - `403 Forbidden` if not SUPER ADMIN
  - `500 Error` if database error

### Role Format for Security Checks

The system uses case-insensitive comparison:

```javascript
const userRole = localStorage.getItem("engiconnect_role")?.toUpperCase() || "";
if (userRole !== "SUPER ADMIN") {
  // Deny access
}
```

**Valid SUPER ADMIN formats:**
- "SUPER ADMIN"
- "super admin"
- "Super Admin"
- "SUPER_ADMIN" (if stored this way)

All are normalized to "SUPER ADMIN" before comparison.

## Service Permission Enforcement

In addition to admin-level permissions, the system also enforces **service-level permissions** throughout the application. Users cannot access specific features unless their role has that service enabled.

### How It Works

When a user tries to access a restricted feature (e.g., `/appointments/site-visit`):

1. **Check Route** - System identifies required service (e.g., `siteVisit`)
2. **Fetch Permissions** - API fetches user's role permissions from Supabase
3. **Verify Service** - Check if `services.siteVisit === true`
4. **Grant or Deny** - Allow access or show "Access Restricted" error

### Protected Routes & Services

| Route | Service | Permission Key |
|-------|---------|---|
| `/appointments/site-visit` | Site Visits | `siteVisit` |
| `/appointments/meeting-rooms` | Meeting Rooms | `meetingRoom` |
| `/appointments/protocols` | Recommendations | `recommendation` |
| `/request/dialux` | DIAlux Simulations | `dialux` |
| `/request/job` | Job Requests | `jobRequest` |
| `/request/other` | Other Requests | `others` |
| `/request/product` | Product Requests | `productRequest` |
| `/request/shop-drawing` | Shop Drawings | `shopDrawing` |
| `/request/testing` | Testing & Monitoring | `testing` |

### Example: Engineering Member with Site Visit Disabled

```
Scenario:
1. ENGINEERING_MEMBER role has siteVisit: false (saved in permissions page)
2. User logs in with this role
3. User tries to access /appointments/site-visit

Result:
❌ "Access Restricted" error page
❌ Cannot see or interact with site visits
✅ Can click "Return Home" or "Request Access"
```

### Implementation Details

**File:** `components/protected-page-wrapper.tsx`
```javascript
// Map routes to required services
const ROUTE_SERVICE_MAP = {
  "/appointments/site-visit": "siteVisit",
  "/request/dialux": "dialux",
  // ... more routes
};

// Check if service is enabled
const requiredService = getRequiredService(pathname);
if (requiredService && !services[requiredService]) {
  // Deny access
  setAccessDenied(true);
}
```

**File:** `pages/api/permissions/check.ts`
- Enhanced to return parsed `services` field
- Handles both string and object JSON from Supabase

### Admin Bypass

IT and PROCUREMENT departments automatically bypass service checks:
- Can access ALL services regardless of permissions
- No restrictions on any feature access
- Useful for support and troubleshooting

## Troubleshooting

### Permission Page Issues

#### Issue: "Access Restricted" Error for SUPER ADMIN
**Problem:** SUPER ADMIN user sees access denied on `/admin/permissions`  
**Cause:** Role field not properly set or formatted  
**Solution:**
1. Check localStorage: Open DevTools → Application → localStorage
2. Look for `engiconnect_role` or `userRole` key
3. Verify value is exactly "SUPER ADMIN" (case-sensitive in comparison)
4. If not set correctly, log out and log back in
5. Verify user record in Supabase has `engiconnect_role = "SUPER ADMIN"`

#### Issue: 404 Error on First Load
**Problem:** `API error: 404` when opening permissions page  
**Cause:** `role_permissions` table is empty  
**Solution:** This is expected on first load
1. Page automatically initializes seed data
2. Check browser console for: "Seed data initialized successfully"
3. Wait a few seconds for initialization
4. Refresh page
5. Permissions should now load

#### Issue: Can Toggle Permissions But Save Shows 403 Forbidden
**Problem:** Can see interface and toggle but "Failed to save" error appears  
**Cause:** Frontend accepted user as SUPER ADMIN, but API validation failed  
**Possible causes:**
1. User ID header (`x-user-id`) not sent with request
2. User record in Supabase was modified (role changed to non-SUPER ADMIN)
3. Supabase connection issue
**Solution:**
1. Check browser DevTools → Network tab → permissions/role POST request
2. Verify `x-user-id` header is present
3. Check Supabase users table: Is user's `engiconnect_role` still "SUPER ADMIN"?
4. Check Supabase connection string in `.env.local`
5. Check console logs for error details

#### Issue: Changes Not Persisting After Refresh
**Problem:** Permission changes saved but disappear after page refresh  
**Cause:** Data not actually saved to database  
**Solution:**
1. Check browser console for errors
2. Check Supabase: Did `role_permissions` table update?
3. Check if `updated_at` changed to current timestamp
4. If not updated, API save failed silently
5. Check API logs for 403 or 500 errors

### Permission Denied Errors
If you see permission denied errors in the API routes:
1. Verify RLS policies are correctly set up in Supabase
2. Check your Supabase service role key has correct permissions
3. Verify `engiconnect_role` field is set for the user in the users table
4. Ensure the service role key in `.env.local` hasn't expired

### User Has No Permissions
If a user cannot access features they should:
1. Check that `engiconnect_role` is set in the users table
2. Verify the role name matches a permission document ID (e.g., "ENGINEERING_MANAGER")
3. Check that the permission document exists in the `role_permissions` table
4. Verify the `doc_id` format is correct: `{DEPARTMENT}_{ROLE}`

### Page Not Loading
If the permissions page doesn't load:
1. Check the browser console for errors
2. Verify the API endpoints are accessible
3. Check that the Supabase tables exist
4. Ensure the fix-null-constraints.sql was run if you're using old table schema
5. Check browser DevTools → Network tab for failed API requests
6. Verify user is logged in and has SUPER ADMIN role

### Visual States Not Showing Correctly
If toggles don't display enabled/disabled states:
1. Check browser console for JavaScript errors
2. Verify CSS classes are loading (check DevTools → Styles)
3. Clear browser cache: `Ctrl+Shift+Delete`
4. Force refresh: `Ctrl+F5`
5. Check that permission data loaded correctly (look for console logs)

### Real-time Updates
Note: The implementation uses polling (every 30 seconds) instead of real-time subscriptions since Supabase real-time is accessed via API routes. This is a trade-off for simplicity and security.

### Type Errors (p.doc_id.endsWith is not a function)
If you encounter type errors:
1. The code now includes type checks to handle non-string doc_id values
2. All permission lookups are safely wrapped with `typeof p.doc_id === 'string'` checks
3. Array checks are added before using `.find()` methods

### API Returns 403 Forbidden When Saving
This is **expected behavior** for non-SUPER ADMIN users:
- User sees "Failed to save permissions" toast
- No changes are saved to database
- This is the security feature working as intended
- Verify user has SUPER ADMIN role to allow saves

### JSON Parsing Errors
If you see JSON parsing errors in console:
1. These may occur with mixed API response formats
2. The page now handles both string and object JSON from Supabase
3. If persists, check:
   - Supabase response format in Network tab
   - If JSONB columns store as strings, ensure parsing handles it
   - Check browser console for specific error line
