# DSI Connect — API Reference

> All API endpoints, request/response formats, and usage examples.

---

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** `https://your-domain.com`

## Authentication

All API routes are internal (called from the Next.js frontend). There is no token-based API authentication — routes rely on the same session stored in `localStorage`. For server-to-server calls, Firebase Admin SDK is used directly.

---

## Pages Router APIs (`/pages/api/`)

---

### POST `/api/login`

Authenticates a user with email and password.

**Request Body:**
```json
{
  "email": "john.doe@disruptivesolutions.com",
  "password": "plaintext_password"
}
```

**Success Response (200):**
```json
{
  "_id": "64a1b2c3d4e5f6789012345",
  "Firstname": "John",
  "Lastname": "Doe",
  "Email": "john.doe@disruptivesolutions.com",
  "Department": "SALES",
  "Position": "Territory Sales Associate",
  "Role": "MEMBER",
  "Status": "ACTIVE",
  "Company": "Disruptive Solutions Inc.",
  "profilePicture": "https://res.cloudinary.com/..."
}
```

**Error Responses:**
```json
// 401 - Invalid credentials
{ "error": "Invalid credentials" }

// 403 - Account inactive
{ "error": "Account is inactive" }

// 500 - Server error
{ "error": "Internal server error" }
```

---

### GET `/api/user?id={userId}`

Fetches a single user's full profile by MongoDB `_id`.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB `_id` of the user |

**Success Response (200):**
```json
{
  "_id": "64a1b2c3d4e5f6789012345",
  "Firstname": "John",
  "Lastname": "Doe",
  "Email": "john.doe@disruptivesolutions.com",
  "ContactNumber": "09123456789",
  "Address": "123 Main Street, Manila",
  "Department": "SALES",
  "Position": "Territory Sales Associate",
  "Role": "MEMBER",
  "Company": "Disruptive Solutions Inc.",
  "Status": "ACTIVE",
  "Birthday": "1990-01-15",
  "Gender": "Male",
  "ReferenceID": "DSI-001",
  "profilePicture": "https://res.cloudinary.com/...",
  "signatureImage": "https://res.cloudinary.com/...",
  "TSM": "Jane Smith",
  "Manager": "Bob Johnson"
}
```

**Error Response (404):**
```json
{ "error": "User not found" }
```

---

### GET `/api/user`

Fetches all users. Used for subordinate lookups and assignment matrix.

**Success Response (200):**
```json
[
  { "_id": "...", "Firstname": "John", "Lastname": "Doe", ... },
  { "_id": "...", "Firstname": "Jane", "Lastname": "Smith", ... }
]
```

---

### POST `/api/profile-update`

Updates a user's profile information.

**Request Body:**
```json
{
  "id": "64a1b2c3d4e5f6789012345",
  "Firstname": "John",
  "Lastname": "Doe",
  "ContactNumber": "09123456789",
  "Address": "456 New Street, Quezon City",
  "profilePicture": "https://res.cloudinary.com/...",
  "signatureImage": "https://res.cloudinary.com/...",
  "Password": "newSecurePassword123!"
}
```

> ℹ️ `Password` is optional. Only include it if the user is changing their password. It will be bcrypt-hashed before saving.

**Success Response (200):**
```json
{ "message": "Profile updated successfully" }
```

**Error Responses:**
```json
// 400 - Missing required fields
{ "error": "User ID is required" }

// 500 - Database error
{ "error": "Failed to update profile" }
```

---

### POST `/api/request-reset-password`

Sends a password reset email to the user.

**Request Body:**
```json
{ "email": "john.doe@disruptivesolutions.com" }
```

**Success Response (200):**
```json
{ "message": "Reset email sent" }
```

**Error Response (404):**
```json
{ "error": "Email not found" }
```

---

### GET `/api/check-session`

Validates if a user session is still active.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | The user's MongoDB `_id` |

**Success Response (200):**
```json
{ "valid": true, "user": { "_id": "...", "Status": "ACTIVE" } }
```

**Error Response (401):**
```json
{ "valid": false, "error": "Session invalid or user inactive" }
```

---

### GET `/api/UserManagement/Fetch`

Fetches all staff records for the Staff Directory admin page.

**Success Response (200):**
```json
[
  {
    "_id": "64a1b2c3d4e5f6789012345",
    "Firstname": "John",
    "Lastname": "Doe",
    "Email": "john.doe@disruptivesolutions.com",
    "Department": "SALES",
    "Position": "Territory Sales Associate",
    "Status": "ACTIVE",
    "Role": "MEMBER"
  }
]
```

---

## App Router APIs (`/app/api/`)

---

### GET `/api/staff`

Returns staff list (App Router version, used by some components).

**Success Response (200):** Same format as `/api/UserManagement/Fetch`

---

### GET `/api/system-config`

Returns system-wide configuration. Used by middleware for CSP headers.

**Success Response (200):**
```json
{
  "allowedIframeOrigins": [
    "https://taskflow.devtech-erp-solutions.cloud/",
    "https://taskflow-crm.vercel.app/"
  ],
  "maintenanceMode": false,
  "systemVersion": "4.5"
}
```

---

### POST `/api/send-push`

Sends a web push notification to one or more users.

**Request Body:**
```json
{
  "title": "New Job Request",
  "body": "A new job request has been submitted by John Doe",
  "url": "/request/job/64a1b2c3d4e5f6789012345",
  "icon": "/icons/disruptive.png",
  "userIds": ["userId1", "userId2"],
  "sendToAll": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Notification title |
| `body` | string | Yes | Notification body text |
| `url` | string | No | URL to open when notification is clicked |
| `icon` | string | No | Icon URL (defaults to app icon) |
| `userIds` | string[] | No | Specific users to notify |
| `sendToAll` | boolean | No | If true, sends to all subscribed users |

**Success Response (200):**
```json
{
  "sent": 5,
  "failed": 0,
  "message": "Notifications sent successfully"
}
```

---

### GET `/api/admin/job-counter`

Returns the count of pending job requests. Used by dashboard counters.

**Success Response (200):**
```json
{ "count": 12 }
```

---

### GET `/api/admin/site-visit-counter`

Returns the count of pending site visit appointments.

**Success Response (200):**
```json
{ "count": 5 }
```

---

### GET `/api/com-fetch-cluster-account`

Fetches cluster account data for the collaboration hub. Returns accounts associated with active request clusters.

**Success Response (200):**
```json
[
  {
    "id": "cluster_id",
    "name": "Project Alpha",
    "members": ["userId1", "userId2"],
    "type": "job_requests"
  }
]
```

---

### POST `/api/testing/google-sheet-sync`

Syncs testing tracker data to a configured Google Sheets spreadsheet.

**Request Body:**
```json
{
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
  "range": "Sheet1!A1",
  "data": [
    ["Project Name", "Client", "Target Date", "Status"],
    ["Project Alpha", "Client Corp", "2026-06-01", "IN PROGRESS"]
  ]
}
```

**Success Response (200):**
```json
{ "updated": 5, "message": "Sync successful" }
```

**Error Response (500):**
```json
{ "error": "Google Sheets sync failed", "details": "..." }
```

---

## Error Codes Reference

| HTTP Code | Meaning | Common Causes |
|-----------|---------|---------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Missing required fields, invalid data format |
| 401 | Unauthorized | Invalid credentials, session expired |
| 403 | Forbidden | Account inactive, insufficient permissions |
| 404 | Not Found | User/resource doesn't exist |
| 500 | Server Error | Database connection failed, unhandled exception |

---

## Firebase Firestore Direct Access

Most real-time data is accessed directly from the client using the Firebase SDK, not through API routes. This is intentional for performance and real-time capabilities.

### Common Firestore Queries Used in the App

```typescript
// Get all pending job requests
query(collection(db, "job_requests"), where("status", "==", "PENDING"))

// Get requests submitted by a specific user
query(collection(db, "job_requests"), where("submittedBy", "==", userId))

// Get user's role permissions
doc(db, "role_permissions", `${dept}_${role}`)

// Get assignment matrix for a manager
doc(db, "pic_assignments", managerId)

// Real-time listener for all appointments
onSnapshot(collection(db, "appointments"), callback)
```

---

*For API issues or new endpoint requests, contact the development team.*
*Last updated: May 2026*
