# DSI Connect — Data Models Reference

> Complete schema reference for all databases used in DSI Connect.

---

## Overview

| Database | Collections/Tables | Purpose |
|----------|-------------------|---------|
| Firebase Firestore | 12+ collections | Real-time operational data |
| MongoDB Atlas | `users` | HR/staff records, authentication |
| Supabase | Various | Supplementary ticket data |

---

## Firebase Firestore Models

### Collection: `users`
**Purpose:** Security and access control data per user.
**Document ID:** MongoDB `_id` of the user (string)

```typescript
interface FirestoreUser {
  isActive: boolean;           // Can this user log in?
  Role: string;                // "MEMBER" | "LEADER" | "MANAGER" | "SUPER ADMIN" | "TSM" | "SALES HEAD" | "TERRITORY SALES MANAGER" | "TERRITORY SALES ASSOCIATE"
  email: string;               // Denormalized from MongoDB
  lastSecurityUpdate: string;  // ISO 8601 date string
  updatedBy: string;           // userId of admin who made last change
  sessionRevoked: boolean;     // Force-logout flag
}
```

---

### Collection: `appointments`
**Purpose:** Site visit appointments.

```typescript
interface Appointment {
  // Identity
  id: string;                  // Firestore auto-generated ID

  // Client Info
  company_name: string;
  client: string;              // Contact person name
  phone: string;
  email: string;

  // Location
  address: string;
  city: string;
  coordinates?: {              // Optional map coordinates
    lat: number;
    lng: number;
  };

  // Schedule
  scheduledDate: Timestamp;
  timeSlot: string;            // e.g., "09:00 AM - 10:00 AM"

  // Status & Assignment
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
  submittedBy: string;         // userId
  assignedTo?: string;         // userId of assigned engineer

  // Communication
  messages: Message[];         // Embedded message thread
  notes?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Collection: `job_requests`
**Purpose:** Engineering job orders.

```typescript
interface JobRequest {
  id: string;

  // Project Info
  projectName: string;
  client: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";

  // Status & Assignment
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  submittedBy: string;         // userId
  assignedTo?: string;         // userId of assigned engineer
  pic?: string;                // Person In Charge name

  // Files
  attachments: string[];       // Cloudinary URLs

  // Communication
  messages: Message[];

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Collection: `shop_drawing_requests`
**Purpose:** Technical drawing requests for engineering.

```typescript
interface ShopDrawingRequest {
  id: string;

  projectName: string;
  client: string;
  description: string;
  department: "ENGINEERING";   // Always ENGINEERING

  status: "PENDING_REVIEW" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  submittedBy: string;
  assignedTo?: string;

  drawingFiles: string[];      // Cloudinary URLs for uploaded drawings
  referenceFiles: string[];    // Reference documents

  messages: Message[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Collection: `dialux_requests`
**Purpose:** DIAlux lighting simulation requests.

```typescript
interface DialuxRequest {
  id: string;

  projectName: string;
  client: string;

  // Room/Area specifications
  roomDetails: {
    length: number;            // meters
    width: number;             // meters
    height: number;            // meters
    requiredLux: number;       // target illuminance
    roomType: string;          // "Office" | "Warehouse" | "Retail" | etc.
  };

  luminairePreferences?: string;
  referenceFiles: string[];    // Floor plans, etc.

  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  submittedBy: string;
  assignedTo?: string;

  resultFiles: string[];       // Simulation output files

  messages: Message[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Collection: `testing_tracker`
**Purpose:** Equipment testing and monitoring records.

```typescript
interface TestingItem {
  id: string;

  projectName: string;
  client: string;
  equipmentType: string;
  serialNumber?: string;

  targetDate: Timestamp;       // Expected completion date
  releaseDate?: Timestamp;     // Actual completion date (null = not yet done)

  assignedTo: string;          // userId of responsible engineer
  status: string;

  testResults?: string;        // Summary of test results
  certificationFile?: string;  // Cloudinary URL

  messages: Message[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

> **Overdue Logic:** An item is overdue if `releaseDate` is null AND `targetDate` is in the past.

---

### Collection: `other_requests`
**Purpose:** Miscellaneous requests that don't fit other categories.

```typescript
interface OtherRequest {
  id: string;

  requestType: string;         // User-defined type
  description: string;
  client?: string;
  projectName?: string;

  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  submittedBy: string;
  assignedTo?: string;

  attachments: string[];
  messages: Message[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Collection: `spf_creations`
**Purpose:** SPF (Special Product Fabrication) creation requests.

```typescript
interface SpfCreation {
  id: string;

  projectName: string;
  client: string;
  specifications: string;

  status: string;
  submittedBy: string;
  assignedTo?: string;

  productFiles: string[];      // Cloudinary URLs
  messages: Message[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Collection: `role_permissions`
**Purpose:** Permission configuration per department+role combination.
**Document ID:** `{DEPARTMENT}_{ROLE}` (e.g., `SALES_MEMBER`, `IT_SUPER ADMIN`)

```typescript
interface RolePermissions {
  services: {
    siteVisit: boolean;
    jobRequest: boolean;
    dialux: boolean;
    recommendation: boolean;
    shopDrawing: boolean;
    testing: boolean;
    productRequest: boolean;
    others: boolean;
  };
  nav: {
    team: boolean;
    admin: boolean;
    analytics: boolean;
    systemSettings: boolean;
    helpCenter: boolean;
  };
  security: {
    changePassword: boolean;
    managePin: boolean;
    manageBiometrics: boolean;
    manage2FA: boolean;
    viewActivityLog: boolean;
  };
  account: {
    viewProfile: boolean;
    editProfile: boolean;
    preferences: boolean;
  };
  dashboard: {
    showStats: boolean;
    showRecentActivity: boolean;
    showOverviewTabs: boolean;
    showSchedule: boolean;
    showAlertBanner: boolean;
    showMyTasks: boolean;
  };
}
```

---

### Collection: `pic_assignments`
**Purpose:** Maps Sales Managers to Engineering PICs.
**Document ID:** Sales Manager's MongoDB `_id`

```typescript
interface PicAssignment {
  assignedPics: string[];      // Array of engineer full names ("Firstname Lastname")
  managerName: string;         // Denormalized manager name
  managerRole: string;         // "Sales Manager"
  updatedAt: Timestamp;
}
```

---

### Collection: `push_subscriptions`
**Purpose:** Web push notification subscriptions.
**Document ID:** userId

```typescript
interface PushSubscription {
  userId: string;
  token: string;               // FCM registration token
  device: string;              // User agent string
  createdAt: Timestamp;
  lastSeen: Timestamp;
}
```

---

### Collection: `departments_config`
**Purpose:** Dynamic department and role configuration for the Permissions Manager.

```typescript
interface DepartmentsConfig {
  departments: Array<{
    name: string;              // Department name
    roles: string[];           // Available roles for this department
    color?: string;            // UI color hint
  }>;
  updatedAt: Timestamp;
  updatedBy: string;
}
```

---

### Shared: `Message` Object

Used as an embedded array in all request collections.

```typescript
interface Message {
  id: string;                  // UUID
  senderId: string;            // userId
  senderName: string;          // "Firstname Lastname"
  senderRole: string;          // Job position/title
  content: string;             // Message text
  timestamp: Timestamp;
  seenBy: string[];            // Array of userIds who have read this message
  attachments?: string[];      // Cloudinary URLs
  type?: "text" | "file" | "status_change";
  metadata?: {                 // For status_change type
    oldStatus: string;
    newStatus: string;
  };
}
```

---

## MongoDB Models

### Collection: `users`
**Purpose:** HR and authentication data for all staff.

```typescript
interface MongoUser {
  _id: ObjectId;               // Used as Firestore document ID

  // Personal Info
  Firstname: string;
  Lastname: string;
  Email: string;               // Unique, used for login
  Password: string;            // bcrypt hash (cost factor 10)
  ContactNumber?: string;
  Address?: string;
  Birthday?: string;           // "YYYY-MM-DD"
  Gender?: string;

  // Employment
  Department: string;          // "SALES" | "IT" | "ENGINEERING" | "PROCUREMENT" | "WAREHOUSE OPERATIONS"
  Position: string;            // Job title
  Role?: string;               // Mirrored from Firestore (may be stale — use Firestore as source of truth)
  Company: string;
  Status: string;              // "ACTIVE" | "INACTIVE" | "RESIGNED" | "TERMINATED"
  ReferenceID?: string;        // Employee ID code

  // Hierarchy (Sales department)
  TSM?: string;                // Territory Sales Manager name
  TSMName?: string;            // Alternative TSM name field
  tsm?: string;                // Lowercase variant
  tsmName?: string;            // Lowercase variant
  Manager?: string;            // Manager name
  ManagerName?: string;        // Alternative manager name field
  manager?: string;            // Lowercase variant
  managerName?: string;        // Lowercase variant

  // Media
  profilePicture?: string;     // Cloudinary URL
  signatureImage?: string;     // Cloudinary URL (e-signature)

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}
```

---

## Supabase Models

Supabase is used for supplementary ticket data. The exact schema depends on the Supabase project configuration. Access is via `utils/supabase.ts` and `utils/supabase-ticket.js`.

Common tables:
- `tickets` — supplementary ticket records
- `ticket_history` — audit trail for ticket changes

---

## Data Relationships

```
MongoDB users._id
    │
    ├──► Firestore users/{_id}          (security/access data)
    │
    ├──► Firestore appointments.submittedBy
    ├──► Firestore job_requests.submittedBy
    ├──► Firestore shop_drawing_requests.submittedBy
    ├──► Firestore dialux_requests.submittedBy
    ├──► Firestore testing_tracker.assignedTo
    ├──► Firestore other_requests.submittedBy
    ├──► Firestore spf_creations.submittedBy
    │
    ├──► Firestore pic_assignments/{_id} (as manager)
    │         └── assignedPics[] → engineer names
    │
    └──► Firestore role_permissions/{dept}_{role}
              └── Controls what this user can see/do
```

---

## Indexing Recommendations

### Firestore Composite Indexes

For optimal query performance, create these composite indexes in Firebase Console:

| Collection | Fields | Query Type |
|-----------|--------|-----------|
| `appointments` | `submittedBy` ASC, `createdAt` DESC | User's appointments |
| `appointments` | `status` ASC, `scheduledDate` ASC | Pending by date |
| `job_requests` | `submittedBy` ASC, `createdAt` DESC | User's requests |
| `job_requests` | `status` ASC, `createdAt` DESC | Pending requests |
| `testing_tracker` | `assignedTo` ASC, `targetDate` ASC | Engineer's items |

### MongoDB Indexes

```javascript
// Recommended indexes for the users collection
db.users.createIndex({ "Email": 1 }, { unique: true })
db.users.createIndex({ "Department": 1 })
db.users.createIndex({ "Status": 1 })
db.users.createIndex({ "TSM": 1 })
db.users.createIndex({ "Manager": 1 })
```

---

*Last updated: May 2026*
