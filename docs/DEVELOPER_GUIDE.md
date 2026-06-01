# DSI Connect — Developer Guide

> Version: 4.5 | Last Updated: May 2026
> Stack: Next.js 16 · TypeScript 5 · Firebase · MongoDB · Tailwind CSS v4

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Prerequisites](#2-prerequisites)
3. [Project Setup](#3-project-setup)
4. [Project Structure](#4-project-structure)
5. [Architecture Overview](#5-architecture-overview)
6. [Authentication System](#6-authentication-system)
7. [Database Architecture](#7-database-architecture)
8. [Firebase Firestore Collections](#8-firebase-firestore-collections)
9. [MongoDB Collections](#9-mongodb-collections)
10. [API Routes](#10-api-routes)
11. [Component Library](#11-component-library)
12. [State Management](#12-state-management)
13. [Role & Permission System](#13-role--permission-system)
14. [Notification System](#14-notification-system)
15. [File Upload System](#15-file-upload-system)
16. [PWA Configuration](#16-pwa-configuration)
17. [Environment Variables](#17-environment-variables)
18. [Scripts & Commands](#18-scripts--commands)
19. [Code Conventions](#19-code-conventions)
20. [Common Patterns](#20-common-patterns)
21. [Troubleshooting](#21-troubleshooting)

---

## 1. Project Overview

DSI Connect is a full-stack internal enterprise platform for Disruptive Solutions Inc. It connects the Sales, Engineering, Procurement, and Management teams through a unified workflow system.

**Core responsibilities of the system:**
- Manage service requests (Job Requests, Site Visits, Shop Drawings, DIAlux, Testing, Products)
- Real-time collaboration and messaging per project
- Role-based access control across all features
- Staff directory and security management
- Push notifications and activity alerts
- PWA support for mobile installation

**Key design decisions:**
- **Dual database**: MongoDB stores user/staff records (HR data); Firebase Firestore handles all real-time operational data (requests, messages, assignments)
- **Client-side auth**: Sessions are stored in `localStorage` — no server-side session cookies. This is intentional for PWA offline support
- **Role permissions in Firestore**: The `role_permissions` collection drives what each department+role combination can see and do, making it configurable without code changes

---

## 2. Prerequisites

Before setting up the project, ensure you have:

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x or higher | Runtime |
| npm | 10.x or higher | Package manager |
| Git | Any | Version control |
| Firebase account | — | Firestore + FCM |
| MongoDB Atlas account | — | User database |
| Cloudinary account | — | Image/file storage |

---

## 3. Project Setup

### 3.1 Clone and Install

```bash
git clone <repository-url>
cd engineer-ticketing
npm install
```

### 3.2 Environment Variables

Create a `.env.local` file in the project root. See [Section 17](#17-environment-variables) for all required variables.

### 3.3 Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database** (production mode)
3. Enable **Firebase Cloud Messaging**
4. Generate a **Web App** config and add to `.env.local`
5. Generate a **Service Account** key for Firebase Admin SDK
6. Add the service worker file at `public/firebase-messaging-sw.js` (already present)

### 3.4 MongoDB Setup

1. Create a MongoDB Atlas cluster
2. Create a database named `dsi_connect` (or your preferred name)
3. Add the connection string to `.env.local` as `MONGODB_URI`

### 3.5 Run Development Server

```bash
npm run dev
# Runs at http://localhost:3000
# App redirects / → /login automatically
```

---

## 4. Project Structure

```
engineer-ticketing/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (fonts, PWA meta, NotificationProvider, Toaster)
│   ├── page.tsx                  # Root redirect → /login
│   ├── globals.css               # Global styles
│   ├── not-found.tsx             # 404 page
│   │
│   ├── login/                    # Login page
│   ├── reset-password/           # Password reset page
│   │
│   ├── dashboard/                # Main dashboard
│   │   ├── page.tsx              # Primary dashboard (V4)
│   │   ├── page1.tsx             # Dashboard variant 1
│   │   └── page2.tsx             # Dashboard variant 2
│   │
│   ├── request/                  # All service request types
│   │   ├── job/                  # Job requests
│   │   ├── dialux/               # DIAlux simulation requests
│   │   ├── shop-drawing/         # Shop drawing requests
│   │   ├── testing/              # Testing & monitoring
│   │   ├── product/              # SPF product requests
│   │   ├── product1/             # Product variant
│   │   └── other/                # Miscellaneous requests
│   │
│   ├── appointments/             # Appointment management
│   │   ├── site-visit/           # Site visit scheduling
│   │   │   ├── page.tsx          # List view
│   │   │   ├── add/              # Create new visit
│   │   │   │   ├── page.tsx      # Add form
│   │   │   │   ├── layout.tsx    # Add layout
│   │   │   │   └── schedule/     # Schedule step
│   │   │   └── [id]/             # Individual visit detail
│   │   ├── protocols/            # Protocol management
│   │   └── slots/                # Booking slots
│   │
│   ├── messages/                 # Collaboration hub / messaging
│   ├── notifications/            # Activity center
│   ├── tracking/                 # Tracking page (placeholder)
│   │
│   ├── account/                  # User account pages
│   │   ├── profile/              # Profile editor
│   │   └── security/             # Security settings
│   │
│   ├── admin/                    # Admin-only pages
│   │   ├── staff/                # Staff directory + security management
│   │   ├── permissions/          # Role permission editor
│   │   ├── assignment-matrix/    # Sales Manager ↔ Engineer mapping
│   │   ├── booking_rules/        # Booking rules config
│   │   ├── logs/                 # System logs
│   │   ├── notifications/        # Push notification subscriptions
│   │   │   └── subscriptions/
│   │   ├── protocols/            # Protocol management
│   │   ├── sounds/               # Notification sounds
│   │   └── system-settings/      # System-wide settings
│   │
│   ├── settings/                 # User settings
│   │   └── notifications/        # Notification preferences
│   │
│   └── api/                      # Next.js API routes (see Section 10)
│
├── components/                   # Shared React components
│   ├── ui/                       # shadcn/ui base components
│   ├── modals/                   # Modal components
│   ├── shop-drawing/             # Shop drawing specific components
│   ├── app-sidebar.tsx           # Main navigation sidebar
│   ├── chat-conversation.tsx     # Chat message thread
│   ├── chat-message-list-item.tsx
│   ├── login-form.tsx            # Login form with PIN/biometric
│   ├── notification-bell.tsx     # Header notification bell
│   ├── page-header.tsx           # Reusable page header
│   ├── protected-page-wrapper.tsx # Auth guard HOC
│   └── ...                       # Other shared components
│
├── pages/                        # Next.js Pages Router (legacy API routes)
│   └── api/
│       ├── login.ts              # Login endpoint
│       ├── user.ts               # User CRUD
│       ├── profile-update.ts     # Profile update
│       ├── check-session.ts      # Session validation
│       ├── request-reset-password.ts
│       └── UserManagement/       # Staff management APIs
│
├── lib/                          # Utility libraries and configs
│   ├── firebase.ts               # Firebase client SDK init
│   ├── firebase-admin.ts         # Firebase Admin SDK init
│   ├── firebase_old.ts           # Legacy Firebase config
│   ├── MongoDB.ts                # MongoDB connection (global module)
│   ├── ModuleCSR/mongodb.ts      # CSR-specific MongoDB module
│   ├── ModuleGlobal/mongodb.ts   # Global MongoDB module
│   ├── Session.ts                # Session utilities
│   ├── cloudinary.js             # Cloudinary config
│   ├── notification-service.ts   # Push notification service
│   ├── notification-sounds.ts    # Sound playback utilities
│   ├── push-subscription.ts      # Web push subscription manager
│   ├── job-request-counter.ts    # Job counter utilities
│   ├── site-visit-counter.ts     # Site visit counter utilities
│   ├── time.ts                   # Time/date utilities
│   ├── upload.ts                 # File upload utilities
│   └── utils.ts                  # General utilities (cn, etc.)
│
├── hooks/                        # Custom React hooks
│   ├── use-debounce.ts           # Debounce hook
│   ├── use-mobile.ts             # Mobile detection hook
│   └── useDrawingStats.ts        # Drawing statistics hook
│
├── providers/                    # React context providers
│   └── notification-provider.tsx # Global notification context
│
├── utils/                        # Utility functions
│   ├── supabase.ts               # Supabase client
│   └── supabase-ticket.js        # Supabase ticket utilities
│
├── public/                       # Static assets
│   ├── manifest.json             # PWA manifest
│   ├── firebase-messaging-sw.js  # FCM service worker
│   ├── sounds/                   # Notification audio files
│   └── icons/                    # App icons
│
├── middleware.ts                 # Next.js middleware (CSP headers)
├── next.config.ts                # Next.js configuration
├── tailwind.config (inline)      # Tailwind v4 (CSS-based config)
├── tsconfig.json                 # TypeScript configuration
└── .env.local                    # Environment variables (not committed)
```

---

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / PWA                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Next.js App │  │  Firestore   │  │  localStorage    │  │
│  │  (App Router)│  │  Real-time   │  │  (session/PIN/   │  │
│  │              │◄─┤  onSnapshot  │  │   biometric)     │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │ HTTP / API Routes
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Layer                          │
│                                                             │
│  /pages/api/*          /app/api/*                           │
│  (Pages Router)        (App Router)                         │
│  - login               - admin/job-counter                  │
│  - user CRUD           - admin/site-visit-counter           │
│  - profile-update      - staff                              │
│  - UserManagement      - system-config                      │
│  - check-session       - send-push                          │
│  - reset-password      - com-fetch-cluster-account          │
└──────────┬──────────────────────┬───────────────────────────┘
           │                      │
     ┌─────▼──────┐        ┌──────▼──────┐
     │  MongoDB   │        │  Firebase   │
     │  Atlas     │        │  Admin SDK  │
     │            │        │  (Firestore)│
     │  Users     │        │             │
     │  Staff     │        │  Requests   │
     │  HR Data   │        │  Messages   │
     └────────────┘        │  Assignments│
                           │  Permissions│
                           └─────────────┘
                                  │
                           ┌──────▼──────┐
                           │  Firebase   │
                           │  FCM        │
                           │  (Push      │
                           │  Notifications)│
                           └─────────────┘
```

### Data Flow for a Typical Request

1. User fills out a form (e.g., Job Request)
2. Form submits to Firestore `job_requests` collection
3. All users with access get real-time update via `onSnapshot`
4. A push notification is sent via `/api/send-push`
5. The notification bell updates its count
6. Engineers/managers can open the request and add messages
7. Messages are stored in the same Firestore document under a `messages` array

---

## 6. Authentication System

### 6.1 Login Flow

```
User enters email + password
        │
        ▼
POST /api/login
        │
        ▼
MongoDB lookup by email
        │
        ▼
bcrypt.compare(password, hash)
        │
   ┌────┴────┐
  Pass      Fail
   │          │
   ▼          ▼
Store in    Return 401
localStorage
- userId
- userName
- userDepartment
- userRole
- userEmail
        │
        ▼
Redirect to /dashboard
```

### 6.2 Session Storage Keys

All session data is stored in `localStorage`:

| Key | Value | Description |
|-----|-------|-------------|
| `userId` | MongoDB `_id` string | Primary user identifier |
| `userName` | `"Firstname Lastname"` | Display name |
| `userDepartment` | `"SALES"`, `"IT"`, etc. | Department |
| `userRole` | `"MEMBER"`, `"MANAGER"`, etc. | Role |
| `userEmail` | Email string | User email |

### 6.3 PIN Authentication

PIN is stored locally per user, scoped by userId:

```typescript
// Key format (from lib/security)
const scopedPinKey = (uid: string) => `engiconnect_user_pin_${uid}`

// Setting a PIN
localStorage.setItem(scopedPinKey(userId), pinValue) // 6-digit string

// Verifying a PIN
const stored = localStorage.getItem(scopedPinKey(userId))
const isValid = stored === enteredPin
```

### 6.4 Biometric Authentication (WebAuthn)

```typescript
// Registration
navigator.credentials.create({ publicKey: { ... } })
// Stores credential ID in localStorage:
// engiconnect_webauthn_credId_{userId}
// engiconnect_bio_enabled_{userId} = "true"

// Authentication
navigator.credentials.get({ publicKey: { ... } })
// Looks up userId from credential ID
```

### 6.5 Protected Routes

All authenticated pages are wrapped with `ProtectedPageWrapper`:

```tsx
// components/protected-page-wrapper.tsx
// Checks localStorage for userId
// If not found → redirects to /login
// If found → renders children

export default function ProtectedPageWrapper({ children }) {
  const router = useRouter()
  useEffect(() => {
    const userId = localStorage.getItem("userId")
    if (!userId) router.push("/login")
  }, [])
  return <>{children}</>
}
```

---

## 7. Database Architecture

The system uses **two primary databases** with distinct responsibilities:

| Database | Purpose | Access Method |
|----------|---------|---------------|
| **Firebase Firestore** | All operational/real-time data | Firebase SDK (client + admin) |
| **MongoDB Atlas** | User accounts, HR/staff records | MongoDB Node.js driver |
| **Supabase** | Supplementary data (tickets, etc.) | Supabase JS client |

### Why Two Databases?

- **MongoDB** was the original database for user management. It stores HR-sensitive data (names, emails, departments, positions, salaries if any).
- **Firestore** was added for real-time features. It stores all request data, messages, assignments, and permissions — data that needs live sync across multiple clients.
- This split means user identity lives in MongoDB, while all workflow data lives in Firestore.

### Merging Data

Many pages merge data from both sources. Example from Staff Directory:

```typescript
// 1. Fetch HR data from MongoDB via API
const mongoUsers = await fetch("/api/UserManagement/Fetch").then(r => r.json())

// 2. Fetch security/role data from Firestore
const firestoreSnap = await getDocs(collection(db, "users"))
const securityMap = {}
firestoreSnap.forEach(doc => { securityMap[doc.id] = doc.data() })

// 3. Merge: MongoDB _id matches Firestore document ID
const merged = mongoUsers.map(u => ({
  ...u,                              // HR data from MongoDB
  isActive: securityMap[u._id]?.isActive ?? false,  // Auth from Firestore
  Role: securityMap[u._id]?.Role,    // Role from Firestore
}))
```

---

## 8. Firebase Firestore Collections

### 8.1 `users`
Stores security/auth data for each user. Document ID = MongoDB `_id`.

```typescript
{
  isActive: boolean,          // Whether user can log in
  Role: string,               // "MEMBER" | "LEADER" | "MANAGER" | "SUPER ADMIN" | "TSM" | etc.
  email: string,              // User email (denormalized)
  lastSecurityUpdate: string, // ISO date string
  updatedBy: string,          // userId who made the last change
  sessionRevoked: boolean,    // Force logout flag
}
```

### 8.2 `appointments`
Site visit appointments.

```typescript
{
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED",
  company_name: string,
  client: string,
  address: string,
  city: string,
  scheduledDate: Timestamp,
  submittedBy: string,        // userId
  assignedTo: string,         // userId of engineer
  messages: Message[],        // Embedded message thread
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### 8.3 `job_requests`
Engineering job orders.

```typescript
{
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
  projectName: string,
  client: string,
  description: string,
  submittedBy: string,
  assignedTo: string,
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  messages: Message[],
  attachments: string[],      // Cloudinary URLs
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### 8.4 `shop_drawing_requests`
Technical drawing requests.

```typescript
{
  status: "PENDING_REVIEW" | "IN_PROGRESS" | "COMPLETED",
  department: "ENGINEERING",
  projectName: string,
  client: string,
  submittedBy: string,
  messages: Message[],
  drawingFiles: string[],     // Cloudinary URLs
  createdAt: Timestamp,
}
```

### 8.5 `dialux_requests`
DIAlux lighting simulation requests.

```typescript
{
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED",
  projectName: string,
  client: string,
  submittedBy: string,
  messages: Message[],
  createdAt: Timestamp,
}
```

### 8.6 `testing_tracker`
Equipment testing and monitoring records.

```typescript
{
  projectName: string,
  client: string,
  targetDate: Timestamp,      // Expected completion date
  releaseDate: Timestamp,     // Actual completion date (null if pending)
  assignedTo: string,
  status: string,
  messages: Message[],
}
```

### 8.7 `other_requests`
Miscellaneous requests.

```typescript
{
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED",
  requestType: string,
  description: string,
  submittedBy: string,
  messages: Message[],
  createdAt: Timestamp,
}
```

### 8.8 `spf_creations`
SPF product creation requests.

```typescript
{
  status: string,
  projectName: string,
  client: string,
  submittedBy: string,
  messages: Message[],
  createdAt: Timestamp,
}
```

### 8.9 `role_permissions`
Permission configuration per department+role. Document ID = `{DEPT}_{ROLE}`.

```typescript
// Example ID: "SALES_MEMBER" or "IT_SUPER ADMIN"
{
  services: {
    siteVisit: boolean,
    jobRequest: boolean,
    dialux: boolean,
    recommendation: boolean,
    shopDrawing: boolean,
    testing: boolean,
    productRequest: boolean,
    others: boolean,
  },
  nav: {
    team: boolean,
    admin: boolean,
    analytics: boolean,
    systemSettings: boolean,
    helpCenter: boolean,
  },
  security: {
    changePassword: boolean,
    managePin: boolean,
    manageBiometrics: boolean,
    manage2FA: boolean,
    viewActivityLog: boolean,
  },
  account: {
    viewProfile: boolean,
    editProfile: boolean,
    preferences: boolean,
  },
  dashboard: {
    showStats: boolean,
    showRecentActivity: boolean,
    showOverviewTabs: boolean,
    showSchedule: boolean,
    showAlertBanner: boolean,
    showMyTasks: boolean,
  },
}
```

### 8.10 `pic_assignments`
Sales Manager → Engineer assignment matrix. Document ID = Sales Manager's MongoDB `_id`.

```typescript
{
  assignedPics: string[],     // Array of engineer full names
  managerName: string,
  managerRole: string,
  updatedAt: Timestamp,
}
```

### 8.11 `departments_config`
Dynamic department and role configuration.

```typescript
{
  departments: [
    { name: string, roles: string[] }
  ]
}
```

### 8.12 Message Object (Embedded in Requests)

```typescript
interface Message {
  id: string,
  senderId: string,           // userId
  senderName: string,
  senderRole: string,
  content: string,
  timestamp: Timestamp,
  seenBy: string[],           // Array of userIds who have read it
  attachments?: string[],     // Cloudinary URLs
}
```

---

## 9. MongoDB Collections

### 9.1 `users` (Staff/HR Records)

```typescript
{
  _id: ObjectId,              // Used as Firestore document ID too
  Firstname: string,
  Lastname: string,
  Email: string,
  Password: string,           // bcrypt hashed
  ContactNumber: string,
  Address: string,
  Department: string,         // "SALES" | "IT" | "ENGINEERING" | etc.
  Position: string,           // Job title
  Role: string,               // Mirrored from Firestore (may be stale)
  Company: string,
  Status: string,             // "ACTIVE" | "INACTIVE" | "RESIGNED"
  Birthday: string,
  Gender: string,
  ReferenceID: string,        // Employee reference code
  profilePicture: string,     // Cloudinary URL
  signatureImage: string,     // Cloudinary URL
  TSM: string,                // Territory Sales Manager name (for Sales dept)
  TSMName: string,
  Manager: string,            // Manager name
  ManagerName: string,
  createdAt: Date,
  updatedAt: Date,
}
```

### 9.2 Connecting to MongoDB

```typescript
// lib/MongoDB.ts
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI!
let client: MongoClient
let clientPromise: Promise<MongoClient>

// Singleton pattern for connection reuse
if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  client = new MongoClient(uri)
  clientPromise = client.connect()
}

export default clientPromise
```

---

## 10. API Routes

The project uses **both** the Pages Router (`/pages/api/`) and App Router (`/app/api/`) for API routes.

### Pages Router APIs (`/pages/api/`)

#### `POST /api/login`
Authenticates a user.

**Request body:**
```json
{ "email": "user@example.com", "password": "plaintext" }
```

**Response (200):**
```json
{
  "_id": "mongo_object_id",
  "Firstname": "John",
  "Lastname": "Doe",
  "Email": "user@example.com",
  "Department": "SALES",
  "Position": "Territory Sales Associate",
  "Role": "MEMBER",
  "Status": "ACTIVE"
}
```

**Response (401):** `{ "error": "Invalid credentials" }`

---

#### `GET /api/user?id={userId}`
Fetches a single user by MongoDB `_id`.

**Response (200):** Full user object (see MongoDB schema above)

#### `GET /api/user`
Fetches all users (used for subordinate lookups, assignment matrix).

**Response (200):** Array of user objects

---

#### `POST /api/profile-update`
Updates user profile data.

**Request body:**
```json
{
  "id": "mongo_object_id",
  "Firstname": "John",
  "Lastname": "Doe",
  "ContactNumber": "09123456789",
  "Address": "123 Main St",
  "profilePicture": "https://cloudinary.com/...",
  "signatureImage": "https://cloudinary.com/...",
  "Password": "newpassword"  // Optional — only if changing password
}
```

---

#### `POST /api/request-reset-password`
Sends a password reset email via nodemailer.

**Request body:** `{ "email": "user@example.com" }`

---

#### `GET /api/check-session`
Validates if a session is still active.

---

#### `GET /api/UserManagement/Fetch`
Fetches all staff records from MongoDB for the Staff Directory.

**Response (200):** Array of all user objects

---

### App Router APIs (`/app/api/`)

#### `GET /api/staff`
Returns staff list (App Router version).

#### `GET /api/system-config`
Returns system configuration including allowed iframe origins for CSP.

**Response:**
```json
{
  "allowedIframeOrigins": ["https://taskflow.example.com"],
  "maintenanceMode": false
}
```

#### `POST /api/send-push`
Sends a web push notification to subscribed users.

**Request body:**
```json
{
  "title": "New Job Request",
  "body": "A new job request has been submitted",
  "url": "/request/job/abc123",
  "userIds": ["userId1", "userId2"]
}
```

#### `GET /api/admin/job-counter`
Returns count of pending job requests.

#### `GET /api/admin/site-visit-counter`
Returns count of pending site visits.

#### `GET /api/com-fetch-cluster-account`
Fetches cluster account data for the collaboration hub.

#### `POST /api/testing/google-sheet-sync`
Syncs testing tracker data to Google Sheets.

---

## 11. Component Library

The project uses **shadcn/ui** components (in `components/ui/`) built on top of Radix UI primitives. All components are fully customized with Tailwind CSS.

### Key Custom Components

#### `AppSidebar` (`components/app-sidebar.tsx`)
The main navigation sidebar. Accepts `userId` prop and renders navigation items based on the user's role permissions fetched from Firestore.

```tsx
<AppSidebar userId={userId} />
```

#### `PageHeader` (`components/page-header.tsx`)
Reusable page header with title, version badge, back button, and action slot.

```tsx
<PageHeader
  title="MY PAGE"
  version="V2.0"
  showBackButton={true}
  trigger={<SidebarTrigger className="mr-2" />}
  actions={<Button>Save</Button>}
/>
```

#### `ProtectedPageWrapper` (`components/protected-page-wrapper.tsx`)
Auth guard — wraps any page that requires authentication.

```tsx
<ProtectedPageWrapper>
  <YourPageContent />
</ProtectedPageWrapper>
```

#### `ChatConversation` (`components/chat-conversation.tsx`)
Full message thread component for request collaboration.

```tsx
<ChatConversation
  requestId="abc123"
  collectionName="job_requests"
  messages={messages}
  currentUserId={userId}
  userName="John Doe"
  userRole="Engineer"
  status="PENDING"
  profilePicture="https://..."
  title="Project Name"
  searchQuery=""
/>
```

#### `NotificationBell` (`components/notification-bell.tsx`)
Header bell icon with unread count badge. Subscribes to Firestore in real-time.

#### `FloatingActionButton` (`components/floating-action-button.tsx`)
Mobile-friendly FAB for quick request creation. Shows different options based on user role.

#### `EnhancedNotifications` (`components/enhanced-notifications.tsx`)
Full notification panel component used in the dashboard.

---

## 12. State Management

The project does **not** use a global state library (no Redux, Zustand, etc.). State is managed through:

1. **React `useState` / `useEffect`** — local component state
2. **Firebase `onSnapshot`** — real-time data subscriptions (replaces polling)
3. **`localStorage`** — session data, user preferences, PIN, biometric credentials
4. **URL search params** — for navigation state (e.g., `?id=abc123` in messages)

### Pattern: Real-time Data Subscription

```typescript
useEffect(() => {
  if (!db) return

  const unsubscribe = onSnapshot(
    query(collection(db, "job_requests"), where("status", "==", "PENDING")),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setRequests(data)
    }
  )

  return () => unsubscribe() // Always clean up!
}, [])
```

### Pattern: Merging Firestore + MongoDB Data

```typescript
useEffect(() => {
  const fetchData = async () => {
    // 1. Get HR data from MongoDB API
    const mongoData = await fetch(`/api/user?id=${userId}`).then(r => r.json())

    // 2. Get role from Firestore
    const userDoc = await getDoc(doc(db, "users", userId))
    const firestoreRole = userDoc.data()?.Role || "MEMBER"

    // 3. Merge
    setUserDetails({ ...mongoData, Role: firestoreRole })
  }
  fetchData()
}, [userId])
```

---

## 13. Role & Permission System

### 13.1 Role Hierarchy

```
SUPER ADMIN
    │
    ├── MANAGER / SALES HEAD
    │       │
    │       ├── TSM (Territory Sales Manager)
    │       │       │
    │       │       └── TSA (Territory Sales Associate) / MEMBER
    │       │
    │       └── LEADER
    │               │
    │               └── MEMBER
    │
    └── IT / ENGINEERING (cross-cutting access)
```

### 13.2 How Permissions Are Loaded

```typescript
// In any component that needs permissions:
useEffect(() => {
  const dept = localStorage.getItem("userDepartment") || ""
  const role = localStorage.getItem("userRole") || "MEMBER"
  const docId = `${dept.toUpperCase()}_${role.toUpperCase()}`

  const unsub = onSnapshot(collection(db, "role_permissions"), snap => {
    const perms = snap.docs.find(d => d.id === docId)?.data()
    if (perms) setPermissions(perms)
  })

  return () => unsub()
}, [])
```

### 13.3 Checking Permissions in Components

```typescript
// Example: Show/hide a nav item
{permissions?.nav?.admin && (
  <NavItem href="/admin/staff" label="Staff Directory" />
)}

// Example: Show/hide a service tile
{permissions?.services?.jobRequest && (
  <ServiceTile href="/request/job" label="Job Request" />
)}
```

### 13.4 Data-Level Access Control (Messages Page)

```typescript
// Determines what requests a user can see
const hasGlobalAccess = 
  userDept === "IT" || 
  userDept === "ENGINEERING" || 
  userRole === "MANAGER" || 
  userRole === "SUPER ADMIN"

if (!hasGlobalAccess) {
  // Filter to only show own requests + subordinates' (for TSM)
  current = current.filter(r => {
    const isOwner = [r.submittedBy, r.createdBy, r.userId].includes(userId)
    if (isOwner) return true
    if (isTSM) return subordinateIds.includes(r.submittedBy)
    return false
  })
}
```

---

## 14. Notification System

### 14.1 Push Notifications (FCM)

The app uses Firebase Cloud Messaging for push notifications.

**Service Worker** (`public/firebase-messaging-sw.js`):
- Handles background push messages
- Shows browser notifications when app is not in focus

**Subscription Flow:**
```typescript
// lib/push-subscription.ts
// 1. Request notification permission
const permission = await Notification.requestPermission()

// 2. Get FCM token
const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY })

// 3. Save token to Firestore
await setDoc(doc(db, "push_subscriptions", userId), { token, userId })
```

**Sending a Push:**
```typescript
// POST /api/send-push
// Uses web-push library with VAPID keys
webpush.sendNotification(subscription, JSON.stringify({
  title: "New Request",
  body: "A new job request has been submitted",
  url: "/request/job/abc123"
}))
```

### 14.2 In-App Notifications

The `NotificationProvider` (`providers/notification-provider.tsx`) wraps the entire app and provides:
- Real-time unread counts
- Toast notifications via `sonner`
- Notification sound playback

### 14.3 Notification Sounds

```typescript
// lib/notification-sounds.ts
// Sounds stored in /public/sounds/
// - reminder-notification.mp3
// - ticket-endorsed.mp3

export function playNotificationSound(type: "reminder" | "endorsed") {
  const audio = new Audio(`/sounds/${type}-notification.mp3`)
  audio.play().catch(() => {}) // Ignore autoplay policy errors
}
```

---

## 15. File Upload System

All file uploads go through **Cloudinary**.

### Upload Flow

```typescript
// Direct browser-to-Cloudinary upload (no server needed)
const uploadToCloudinary = async (file: File | string) => {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", "Xchire") // Unsigned upload preset

  const response = await fetch(
    "https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload",
    { method: "POST", body: formData }
  )
  const data = await response.json()
  return data.secure_url // HTTPS URL to the uploaded file
}
```

### Upload Presets

The project uses an **unsigned upload preset** named `"Xchire"` on the `dhczsyzcz` Cloudinary cloud. This allows direct browser uploads without exposing API secrets.

> ⚠️ **Security Note**: Unsigned presets allow anyone to upload to your Cloudinary account. Consider adding upload restrictions (file type, size, folder) in the Cloudinary dashboard.

---

## 16. PWA Configuration

The app is configured as a Progressive Web App using `next-pwa`.

### Manifest (`public/manifest.json`)
```json
{
  "name": "DSI Connect",
  "short_name": "DSI Connect",
  "theme_color": "#E33636",
  "background_color": "#ffffff",
  "display": "standalone",
  "start_url": "/dashboard",
  "icons": [{ "src": "/icons/disruptive.png", "sizes": "192x192" }]
}
```

### Service Worker
- Managed by `next-pwa` (Workbox-based)
- Caches static assets for offline support
- FCM service worker at `public/firebase-messaging-sw.js` handles push messages

### iOS Support
```tsx
// app/layout.tsx
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="DSI Connect" />
<link rel="apple-touch-icon" href="/icons/disruptive.png" />
```

---

## 17. Environment Variables

Create `.env.local` in the project root with these variables:

```bash
# ─── MongoDB ───────────────────────────────────────────────
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# ─── Firebase Client SDK (Public — safe to expose) ─────────
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BNj...  # For push notifications

# ─── Firebase Admin SDK (Server-side only — NEVER expose) ──
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ─── Cloudinary ────────────────────────────────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dhczsyzcz
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ─── Web Push (VAPID Keys) ─────────────────────────────────
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNj...
VAPID_PRIVATE_KEY=your_private_key
VAPID_EMAIL=mailto:admin@disruptivesolutions.com

# ─── Email (Nodemailer) ────────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# ─── Google Sheets (Optional) ──────────────────────────────
GOOGLE_SHEETS_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id

# ─── Supabase (Optional) ───────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

> ⚠️ **Never commit `.env.local` to version control.** It's already in `.gitignore`.

---

## 18. Scripts & Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Linting
npm run lint         # Run ESLint
```

### Build Notes

- The build uses Next.js Turbopack (enabled by default in Next.js 16)
- PWA service worker is only generated in production builds
- Firebase Admin SDK requires the private key to be properly formatted with `\n` newlines

---

## 19. Code Conventions

### File Naming
- Pages: `page.tsx` (Next.js App Router convention)
- Components: `kebab-case.tsx` (e.g., `app-sidebar.tsx`)
- Utilities: `camelCase.ts` (e.g., `notification-service.ts`)

### Component Structure
All page components follow this pattern:

```tsx
"use client"  // Always client components for pages with interactivity

import * as React from "react"
// ... imports

export default function PageName() {
  // 1. State declarations
  const [userId, setUserId] = React.useState<string | null>(null)

  // 2. Effects (data fetching, subscriptions)
  React.useEffect(() => {
    setUserId(localStorage.getItem("userId"))
  }, [])

  // 3. Event handlers

  // 4. Render
  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F4F7F7] min-h-screen font-sans">
          <PageHeader title="PAGE TITLE" version="V1.0" showBackButton={true}
            trigger={<SidebarTrigger className="mr-2" />}
          />
          <main className="p-4 md:p-8 max-w-5xl mx-auto w-full">
            {/* Page content */}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}
```

### Styling Conventions
- Background color: `bg-[#F4F7F7]` or `bg-[#F8FAFC]` for page backgrounds
- Brand color: `#E33636` (DSI red)
- Card radius: `rounded-2xl` (16px) or `rounded-[24px]` (24px)
- Typography: All-caps labels with `tracking-widest` for section headers
- Font weight: `font-black` for headings, `font-bold` for body
- Utility: Always use `cn()` from `lib/utils` for conditional classes

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### TypeScript
- Use `any` sparingly — prefer proper interfaces
- All API responses should be typed
- Firestore data should be typed with interfaces

---

## 20. Common Patterns

### Pattern: Loading State with Skeleton

```tsx
{loading ? (
  <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
) : (
  <span>{value}</span>
)}
```

### Pattern: Role-Based Rendering

```tsx
const isSales = userDept === "SALES"
const isAdmin = userRole === "SUPER ADMIN" || userDept === "IT"
const isManager = userRole === "MANAGER" || userRole === "SALES HEAD"

{isAdmin && <AdminOnlyComponent />}
{(isManager || isAdmin) && <ManagerComponent />}
{isSales && <SalesComponent />}
```

### Pattern: Firestore Real-time with Cleanup

```typescript
useEffect(() => {
  if (!db || !userId) return

  const unsubscribes = [
    onSnapshot(query(collection(db, "job_requests"), where("submittedBy", "==", userId)),
      snap => setJobRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ),
    onSnapshot(query(collection(db, "appointments"), where("submittedBy", "==", userId)),
      snap => setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ),
  ]

  return () => unsubscribes.forEach(unsub => unsub())
}, [userId])
```

### Pattern: Optimistic UI Update

```typescript
const handleToggle = async (id: string) => {
  // 1. Update UI immediately
  setItems(prev => prev.map(item =>
    item.id === id ? { ...item, active: !item.active } : item
  ))

  try {
    // 2. Persist to Firestore
    await updateDoc(doc(db, "collection", id), { active: !currentValue })
  } catch (err) {
    // 3. Rollback on failure
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, active: currentValue } : item
    ))
    toast.error("Update failed")
  }
}
```

---

## 21. Troubleshooting

### Firebase "Missing or insufficient permissions"
- Check Firestore security rules in Firebase Console
- Ensure the user document exists in the `users` collection
- Verify `isActive: true` is set for the user

### MongoDB connection timeout
- Check `MONGODB_URI` in `.env.local`
- Ensure your IP is whitelisted in MongoDB Atlas Network Access
- Check if the cluster is paused (free tier auto-pauses after inactivity)

### Push notifications not working
- Ensure VAPID keys are correctly set in `.env.local`
- Check that `firebase-messaging-sw.js` is accessible at the root URL
- Verify notification permission is granted in the browser
- Push notifications require HTTPS (use ngrok for local testing)

### PWA not installing
- PWA only works in production builds (`npm run build && npm run start`)
- Ensure `manifest.json` is valid and accessible
- Check that the service worker is registered

### Biometric login not working
- WebAuthn requires HTTPS or localhost
- Not supported in all browsers (check [caniuse.com](https://caniuse.com/webauthn))
- Each device registers separately — credentials are device-specific

### "userId is null" errors
- User is not logged in or session was cleared
- `ProtectedPageWrapper` should redirect to `/login` automatically
- Check if `localStorage` is accessible (some browsers block it in private mode)

### Cloudinary upload fails
- Verify the upload preset `"Xchire"` exists and is set to "Unsigned"
- Check the cloud name `dhczsyzcz` is correct
- File size limit: 10MB for free tier

---

*End of Developer Guide — For API details see [API_REFERENCE.md](./API_REFERENCE.md)*
*For data schemas see [DATA_MODELS.md](./DATA_MODELS.md)*
