# Supabase Login Migration

## Overview
Migrated the login authentication system from MongoDB to Supabase. The new implementation uses the Supabase `users` table with the same business logic.

## Changes Made

### 1. New Supabase Helper Module
**File**: `lib/ModuleGlobal/supabase.ts`

Created a new helper module that provides the following functions:
- `getSupabaseClient()` - Returns initialized Supabase client
- `validateUser()` - Validates user credentials (email + password)
- `registerUser()` - Registers a new user with hashed password
- `fetchUserById()` - Fetches user by ID
- `fetchUserByEmail()` - Fetches user by email
- `fetchUserByDeviceId()` - Fetches user by device ID
- `updateUser()` - Updates user fields

All functions use Supabase's JavaScript client library with proper error handling.

### 2. Updated Login API
**File**: `pages/api/login.ts`

Replaced MongoDB imports and operations with Supabase equivalents:
- Replaced `connectToDatabase()` with Supabase helper functions
- Removed MongoDB ObjectId usage - Supabase uses standard UUID/bigint IDs
- Updated all database queries to use Supabase RLS queries
- Changed date handling to use ISO strings for Supabase timestamp compatibility

#### Supported Login Modes
1. **Biometric Mode** - WebAuthn verified client-side, looks up user by userId
2. **PIN Mode** - Device-based PIN verification, looks up by DeviceId
3. **Password Mode** (default) - Email + password credentials

### 3. Environment Variables
**File**: `.env.local`

Added Supabase configuration:
```
NEXT_PUBLIC_SUPABASE_URL=https://uxzltmlilcxekresbitc.supabase.co
SUPABASE_SERVICE_ROLE_KEY_USERS=<your_service_role_key>
```

Use the service role key for server-side operations to bypass RLS policies when needed.

## Supabase Users Table Schema
The migration uses the existing Supabase `users` table with these key columns:
- `id` (bigint) - Primary key
- `Email` (text) - User email
- `Password` (text) - Hashed password
- `userName` (text) - Username
- `Firstname`, `Lastname` (text) - User name
- `Role` (text) - User role
- `Department` (text) - Department assignment
- `Status` (text) - User status (Active, Locked, Resigned, Terminated)
- `DeviceId` (text) - Device identifier for PIN login
- `LoginAttempts` (bigint) - Failed login attempts counter
- `LastLoginAt` (date) - Last login timestamp
- And other fields as per the table definition

## Key Implementation Details

### Password Hashing
- Still uses bcrypt for password hashing (10 rounds)
- Passwords are hashed before insertion/validation
- Dependency: `bcrypt` package

### Login Security
- Account locks after 5 failed login attempts
- Invalid departments are rejected (IT, Sales, Engineering, Procurement, Warehouse Operations, Admin)
- Resigned/Terminated accounts are denied access
- Locked accounts require IT Department intervention

### Session Management
- Uses HTTP-only cookies with 24-hour expiration
- Secure flag enabled in production
- Same-site cookie policy set to strict

### Database Transactions
All user updates (login attempts, last login, device ID) are performed via the `updateUser()` function to ensure consistency.

## Migration Checklist

- [ ] Ensure Supabase project is configured with the `users` table
- [ ] Verify table schema matches the columns referenced in the API
- [ ] Set up proper RLS (Row Level Security) policies if needed
- [ ] Test password login mode
- [ ] Test PIN login mode
- [ ] Test biometric login mode
- [ ] Test account locking after 5 failed attempts
- [ ] Test department authorization
- [ ] Verify session cookie is set correctly
- [ ] Monitor login errors in production

## Troubleshooting

### "Missing Supabase environment variables"
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY_USERS` are set in `.env.local`
- Restart the development server after adding env variables

### "Invalid email or password"
- Verify user exists in Supabase `users` table
- Check that password is properly hashed with bcrypt
- Ensure email matches exactly (case-sensitive)

### "Database error" during login
- Check Supabase service status
- Verify RLS policies allow the service role to read/update users
- Check network connectivity to Supabase

### Connection timeouts
- Verify Supabase project URL is correct
- Check that the service role key is valid
- Ensure firewall/network allows connections to Supabase

## Future Improvements

1. Add email verification workflow
2. Implement password reset functionality
3. Add 2FA/MFA support (Supabase OTP)
4. Audit logging for authentication events
5. Rate limiting on login attempts
6. Gradual migration path for existing MongoDB users
