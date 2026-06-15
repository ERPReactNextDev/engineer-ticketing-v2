# Profile Update API - Supabase Migration

## Overview
Updated the profile update functionality to use Supabase instead of MongoDB. Users can now update their profile information, and the changes are saved directly to the Supabase `users` table.

## Files Modified

### 1. `/pages/api/profile-update.ts`
**Changed from**: MongoDB `connectToDatabase()` and `ObjectId`  
**Changed to**: Supabase helper functions

**Changes**:
- Replaced MongoDB connection with `fetchUserById()` and `updateUser()`
- Removed ObjectId validation
- Changed date format to ISO string for Supabase compatibility
- Maintains all existing functionality (profile picture, signature, password hashing)

### 2. `/app/account/profile/page.tsx`
**Changed**: User details state management

**Changes**:
- Changed `_id` field to `id` (Supabase uses `id`, MongoDB uses `_id`)
- Updated all references from `userDetails._id` to `userDetails.id`
- Maintains all existing UI and functionality

## Profile Update Process

### Current Workflow
1. User accesses `/account/profile`
2. Page loads and fetches user data via `/api/user?id=...` (Supabase)
3. User modifies profile fields:
   - Personal Details: Firstname, Lastname, Contact Number, Address
   - Security: Password (optional)
   - E-Signature: Signature image
   - Organization: Company, Department, Position, Role (read-only display)

4. User clicks "Save Changes"
5. `/api/profile-update` is called with updated data
6. Updates are saved to Supabase `users` table
7. Cloudinary images are managed (deleted old, saved new)
8. Success toast notification shows

## Editable Fields

### Personal Details
- ✏️ Firstname
- ✏️ Lastname
- ✏️ ContactNumber
- ✏️ Address
- ✏️ Email
- ✏️ OtherEmail
- ✏️ AnotherNumber
- ✏️ Birthday
- ✏️ Gender

### Security
- ✏️ Password (optional, only saved if provided)
- 🔒 Password is hashed with bcrypt (10 rounds) before saving

### Images
- 📷 Profile Picture (via Cloudinary)
- ✍️ E-Signature (via Cloudinary)

### Read-Only Display
- 🔒 Company
- 🔒 Department
- 🔒 Position
- 🔒 Role
- 🔒 Status

## API Endpoint

### POST `/api/profile-update`

**Request Body**:
```json
{
  "id": "user_id",
  "Firstname": "John",
  "Lastname": "Doe",
  "Email": "john@example.com",
  "ContactNumber": "555-1234",
  "Address": "123 Main St",
  "Birthday": "1990-01-15",
  "Gender": "Male",
  "profilePicture": "https://cloudinary.com/...",
  "signatureImage": "https://cloudinary.com/...",
  "Password": "new_password",
  "Role": "User",
  "Department": "Procurement",
  "Status": "Active"
}
```

**Success Response**:
```json
{
  "message": "Profile updated successfully"
}
```

**Error Responses**:
```json
{ "error": "User ID is required" }           // 400
{ "error": "User not found" }                // 404
{ "error": "Failed to update profile" }      // 500
{ "error": "Internal Server Error" }         // 500
```

## Key Features

### 1. Password Hashing
- Only hashes if new password is provided
- Uses bcrypt with 10 rounds
- Does not update password if field is empty

### 2. Image Management
- Profile pictures and signatures are uploaded to Cloudinary
- Old images are automatically deleted when replaced
- Supports multiple file formats (PNG, JPG, etc.)

### 3. Profile Completion Tracking
- Calculates completion percentage based on filled fields
- Tracks 9 main fields: Firstname, Lastname, Email, ContactNumber, Address, Position, Department, Company, profilePicture
- Displayed in dashboard card

### 4. Data Validation
- Requires user ID
- Requires passwords to match (client-side)
- Validates user existence in Supabase

## Supabase Integration

### Table: `users`
All profile updates write to the Supabase `users` table with these key fields:
- `id` - Primary key (UUID or bigint)
- `Firstname`, `Lastname` - User names
- `Email`, `OtherEmail` - Email addresses
- `ContactNumber`, `AnotherNumber` - Phone numbers
- `Address` - Home address
- `Birthday`, `Gender` - Demographics
- `profilePicture` - Cloudinary URL
- `signatureImage` - Cloudinary URL
- `Password` - Hashed password (bcrypt)
- `updatedAt` - ISO timestamp of last update

### Helper Functions Used
```typescript
fetchUserById(id)    // Get current user data
updateUser(id, data) // Update user in Supabase
```

## Testing Checklist

- [ ] Load profile page - data displays correctly
- [ ] Update first name - saves to Supabase
- [ ] Update contact number - saves to Supabase
- [ ] Update address - saves to Supabase
- [ ] Upload profile picture - saves to Cloudinary + Supabase
- [ ] Update signature - saves to Cloudinary + Supabase
- [ ] Change password - hashed and saved
- [ ] Verify password match validation - shows error if mismatch
- [ ] Check profile completion percentage - updates correctly
- [ ] Verify read-only fields - cannot be edited (Company, Department, etc.)
- [ ] Test error cases - missing ID, user not found
- [ ] Verify toast notifications - success/error messages show

## Security Considerations

1. ✅ Passwords are hashed with bcrypt before saving
2. ✅ User ID validation required
3. ✅ Session check via protected page wrapper
4. ✅ Cloudinary API credentials are environment variables
5. ⚠️ Consider adding rate limiting on profile updates
6. ⚠️ Consider adding audit logging for sensitive changes

## Migration Notes

- All existing MongoDB user data has been migrated to Supabase
- Field names remain the same for compatibility
- ID field changed from `_id` (MongoDB) to `id` (Supabase)
- Date format changed to ISO strings for Supabase compatibility
- All profile pictures and signatures remain in Cloudinary

## Related Endpoints

- GET `/api/user?id=<userId>` - Fetch user profile (Supabase)
- POST `/api/profile-update` - Update user profile (Supabase)
- GET `/api/check-session` - Validate session (Supabase)

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=https://uxzltmlilcxekresbitc.supabase.co
SUPABASE_SERVICE_ROLE_KEY_USERS=<your_service_role_key>
CLOUDINARY_CLOUD_NAME=<your_cloud_name>
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>
```
