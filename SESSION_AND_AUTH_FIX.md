# Session and Authentication API Migration to Supabase

## Problem
After successful login and biometric/notification sync dialog, users were redirected back to the login page. This was caused by API endpoints still using MongoDB while the authentication system migrated to Supabase.

## Root Cause
The login flow was:
1. ✅ User authenticates via `/api/login` (Supabase) → SUCCESS
2. ✅ Session cookie set with user ID
3. ❌ Dashboard tries to load user data via `/api/user?id=...` (MongoDB) → FAILS
4. ❌ Dashboard redirects back to login due to data fetch failure

The broken endpoints:
- `/api/user.ts` - Used MongoDB `connectToDatabase()` 
- `/api/check-session.ts` - Used MongoDB to validate session

## Solution
Updated both API endpoints to use Supabase instead of MongoDB:

### 1. `/api/user.ts` Migration
**Before**: Used MongoDB `connectToDatabase()` and `ObjectId`
**After**: Uses Supabase helper functions `fetchUserById()` and `getSupabaseClient()`

Changes:
- Single user fetch: `fetchUserById(userId)`
- All users fetch: Supabase query with role filter
- Removed MongoDB ObjectId validation
- Password field is excluded from response

### 2. `/api/check-session.ts` Migration  
**Before**: Used MongoDB `connectToDatabase()` to validate session user
**After**: Uses Supabase `fetchUserById()` to validate session

Changes:
- Session validation now queries Supabase directly
- Maintains device mismatch checking logic
- Maintains delegated session support for iframe scenarios

## Files Modified
1. `pages/api/user.ts` - Updated to use Supabase
2. `pages/api/check-session.ts` - Updated to use Supabase

## Supabase Helper Functions Used
- `getSupabaseClient()` - Returns initialized Supabase client
- `fetchUserById(userId)` - Fetches user by ID from users table

## Login Flow (Now Fixed)
1. ✅ User authenticates via `/api/login` (Supabase) → Sets session cookie
2. ✅ Location dialog shown and dismissed
3. ✅ Dashboard loads and calls `/api/user?id=...` (Supabase) → Gets user data
4. ✅ User details and role loaded from Supabase
5. ✅ Dashboard renders with user context
6. ✅ User redirected to dashboard with greeting

## Testing Checklist
- [ ] Login with email/password
- [ ] Wait for location sync dialog
- [ ] Dashboard loads successfully
- [ ] User details appear correctly
- [ ] Can navigate dashboard without redirect
- [ ] Session persists on page refresh
- [ ] Logout works correctly
- [ ] Test with different user roles

## Environment Requirements
Ensure `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=https://uxzltmlilcxekresbitc.supabase.co
SUPABASE_SERVICE_ROLE_KEY_USERS=<your_service_role_key>
```

## Notes
- Both endpoints now consistently use Supabase for user data
- Session cookies work the same way (no changes needed)
- Device ID tracking still functions as before
- Delegated session support for multi-app scenarios preserved

---

## Access Denied "Return Home" Button Fix

### Problem
When users were denied access to certain features (e.g., dashboard, appointments, requests) and clicked the "Return Home" button:
- Logged-in users with session cookies were redirected to `/` → `/login` → `/dashboard?id={userId}` (circular redirect)
- This caused confusion as users expected to be taken to their dashboard when logged in

### Solution
Updated `components/protected-page-wrapper.tsx` to intelligently handle the "Return Home" button behavior:

**Changes made:**
1. Check if user has valid `userId` in localStorage when access is denied
2. If logged in (userId exists), redirect directly to `/dashboard?id={userId}`
3. If not logged in, redirect to `/` (which goes to login page)
4. Button text remains "Return Home" for simplicity

### Updated Behavior
- **Logged-in users**: Clicking "Return Home" → `/dashboard?id={userId}` (their dashboard)
- **Not logged-in users**: Clicking "Return Home" → `/` → login page
- Session is preserved (no logout occurs)
- Uses userId from localStorage which matches session cookie value

### Files Modified
1. `components/protected-page-wrapper.tsx` - Added intelligent routing logic for "Return Home" button

### Code Changes
```typescript
// Check if user is logged in (has userId in localStorage)
const userId = localStorage.getItem("userId")
const isLoggedIn = userId && userId !== "null"

// If logged in, go to dashboard with their ID; otherwise go to home
const handleReturnHome = () => {
  if (isLoggedIn) {
    router.push(`/dashboard?id=${userId}`)
  } else {
    router.push("/")
  }
}
```

### Testing Checklist
- [ ] Test access denied scenario for logged-in user
- [ ] Verify "Return Home" button goes to dashboard with user ID
- [ ] Test access denied scenario for non-logged-in user
- [ ] Verify "Return Home" button goes to login page
- [ ] Confirm session cookie is preserved
- [ ] Test with different access denied scenarios (dashboard, appointments, requests, admin pages)
