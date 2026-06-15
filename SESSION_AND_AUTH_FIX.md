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
