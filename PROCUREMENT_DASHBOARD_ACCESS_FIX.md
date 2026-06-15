# Procurement Department Dashboard Access Fix

## Problem
Users with Department: "Procurement" were getting "Access Restricted" error when trying to access the Dashboard, even though they had valid Supabase credentials and were in an allowed department.

## Root Cause
The `protected-page-wrapper.tsx` component had overly restrictive bypass logic:

**Before**:
```typescript
// Only IT department users could bypass Firestore role checking
if (userDept !== "IT" && finalUserId) {
  // Check Firestore for role
  // If no Firestore doc or role=GUEST, deny access to /dashboard
}
```

This meant:
- ✅ IT users → bypass check
- ❌ Procurement users → required Firestore role validation
- ❌ Other departments → required Firestore role validation

Since the Supabase users table doesn't have Firestore documents, Procurement users had no Firestore record, defaulting to "GUEST" role, which got blocked.

## Solution
Added "PROCUREMENT" to the bypass list:

**After**:
```typescript
// IT and PROCUREMENT department users bypass Firestore role checking
if (userDept !== "IT" && userDept !== "PROCUREMENT" && finalUserId) {
  // Check Firestore for role (only for non-IT, non-PROCUREMENT users)
}
```

This means:
- ✅ IT users → bypass check (can access dashboard)
- ✅ Procurement users → bypass check (can access dashboard)
- ⚠️ Other departments → still require Firestore role validation

## Files Modified
- `components/protected-page-wrapper.tsx` - Updated bypass logic to include PROCUREMENT

## Department Access Levels

### **Full Dashboard Access (No Firestore required)**
- IT Department ✅
- Procurement Department ✅

### **Conditional Dashboard Access (Firestore role required)**
- Sales Department - Requires valid Firestore role (not GUEST)
- Engineering Department - Requires valid Firestore role (not GUEST)
- Warehouse Operations Department - Requires valid Firestore role (not GUEST)
- Admin Department - Requires valid Firestore role (not GUEST)

## User Verification
The user can now access the dashboard because:
1. ✅ Department = "Procurement" (from Supabase users table)
2. ✅ Status = "Active" (from Supabase users table)
3. ✅ Now bypasses Firestore role checking
4. ✅ Session is valid

User data verified:
```json
{
  "ReferenceID": "PE-NCR-152898",
  "Firstname": "procurement",
  "Email": "p.eng@disruptivesolutionsinc.com",
  "Position": "Purchasing Associate",
  "Department": "Procurement",
  "Status": "Active"
}
```

## Testing
- [ ] Login as Procurement user
- [ ] Dashboard should load successfully
- [ ] No "Access Restricted" error
- [ ] User details display correctly
- [ ] Can navigate dashboard features

## Related Access Control Points

### 1. Login API (`/api/login.ts`)
- ✅ Already allows Procurement department: `["IT", "Sales", "Engineering", "Procurement", "Warehouse Operations","Admin"]`

### 2. Dashboard Protection (`components/protected-page-wrapper.tsx`)
- ✅ NOW allows Procurement department (IT + PROCUREMENT bypass Firestore check)

### 3. Procurement Portal (`/app/request/product/page.tsx`)
- ✅ Full access for Procurement department (see ALL records)

## Security Implications

### Current Architecture
- Firestore: Optional role storage (primarily for Sales department roles like TSM, Manager)
- Supabase: Primary user database with Department info
- Logic: Department-based access rather than role-based

### Recommendations
1. **Migrate all Firestore data to Supabase** - Single source of truth
2. **Implement Supabase RLS** - Database-level security
3. **Standardize role definitions** - Department+Role mapping in Supabase
4. **Audit trail** - Log all dashboard access by department

## Notes
- This fix maintains security by keeping department-based access control
- IT and Procurement get full access (administrative departments)
- Other departments still have Firestore role validation as a secondary check
- No changes needed to login API or procurement portal logic
