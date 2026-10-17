# JR Form Workflow Documentation

## Table of Contents

1. [Overview](#overview)
2. [Workflow Stages](#workflow-stages)
3. [File Structure](#file-structure)
4. [Key Components](#key-components)
5. [Firestore Collections](#firestore-collections)
6. [API Endpoints](#api-endpoints)
7. [User Roles & Permissions](#user-roles--permissions)
8. [Status Transitions](#status-transitions)
9. [PDF Upload Requirements](#pdf-upload-requirements)
10. [Technical Details](#technical-details)
11. [Troubleshooting](#troubleshooting)
12. [Recent Updates](#recent-updates)

---

## Overview

The JR (Job Request) Form is a critical component in the engineer ticketing system that allows Engineering and IT users to review job requests, upload necessary documents, and fill out formal documentation before forwarding to procurement.

### Key Features
- Real-time data synchronization via Firestore
- Draft management for Fill Up Forms
- Role-based access control
- Photo gallery with zoom/pan
- SLA countdown timer (24-hour limit)
- Collaboration hub for messaging
- Procurement columns with Excel paste support
- PDF document upload and viewing

---

## Workflow Stages

### 1. Job Request List View
**Location**: `app/request/job/page.tsx`

**Purpose**: Display all job requests in a searchable/filterable list

**Features**:
- Status badges (color-coded)
- Priority indicators
- Search functionality
- Date filters
- Click to navigate to detail page
- Role-based data filtering (Global access vs. filtered by user ID)
- Real-time data synchronization via Firestore listeners
- Support for multiple user identifier formats (id, refId, ReferenceID, referenceId)

**Data Access Logic**:
- **Global Access**: IT, Engineering, Procurement, Super Admin, and Leader roles see all job requests
- **Filtered Access**: Other users see only their own requests and subordinate requests
- **Procurement**: View-only access to all job requests, can see Engineer's Console notes but cannot edit or perform actions
- **User Identification**: Uses multiple identifier fields to match users (id, refId, ReferenceID, referenceId)
- **Subordinate Handling**: Managers/TSMs can view requests from their subordinates

**Enhanced Data Synchronization**:
- **Global Access Users**: Single Firestore query with `orderBy("createdAt", "desc")` for all job requests
- **Filtered Access Users**: Multiple Firestore queries chunked by user IDs (max 30 per query) to avoid composite index requirements
  - Queries both `createdBy` and `submittedBy` fields for comprehensive coverage
  - Merges results client-side and sorts by `createdAt` descending
  - Real-time updates via `onSnapshot` listeners for each query chunk
- **User ID Normalization**: Collects all possible user identifiers (id, refId, ReferenceID, referenceId) and converts to strings for consistent matching
- **Pending Jobs Filter**: Enhanced to match on multiple user identifier fields (submittedBy, createdBy) using refId and id

**Performance Optimizations**:
- Chunked queries to avoid Firestore "in" clause limit (10 items) and composite index requirements
- Client-side sorting for filtered access users instead of server-side orderBy
- Deduplication via Map-based merging to handle overlapping query results
- Efficient date handling supporting both Firestore Timestamp and string/Date formats

---

### 2. Job Request Creation
**Location**: `app/request/job/add/page.tsx`

**Purpose**: Create new job requests

**Form Fields**:
- Project name and title
- Client information
- Location with coordinates
- Contact details
- Work schedule (dates and hours)
- Service types (installation/modification)
- Scope of work description
- Safety requirements
- Permit documents
- Photo attachments

**Features**:
- Multi-step form wizard
- Photo upload with preview
- Location picker with coordinates
- Dynamic service type selection
- Real-time validation

**Data Storage**:
- Collection: `job_requests`
- Initial status: `JR FORM FORWARD TO ENGINEERING`
- Auto-generated document ID

---

### 3. Job Request Review (Detail Page)
**Location**: `app/request/job/[id]/page.tsx`

**Purpose**: Engineers review job request details and take action

**Features**:
- Project information display
- Photo gallery with zoom/pan
- SLA countdown timer (24-hour limit)
- Progress tracker visualization (signatures are hidden from the UI)
- Collaboration hub for messaging (based on job request ID, title shows JR number)
- Engineer's Console (Admin/Engineering/IT/Procurement - Procurement has view-only access)
- Real-time updates via Firestore `onSnapshot` listener

**Actions Available**:

1. **Mark as Finished** (Admin/Engineering/IT only)
   - Location: Engineer's Console section
   - **Prerequisites**: Both PDFs must be uploaded:
     - Signed JR Form PDF
     - Scope of Work PDF
   - Action: Uploads PDFs to cloud storage, copies the Fill Up Form draft into the job request document, updates status to `JR FORM FORWARD TO PROCUREMENT`, and marks the draft as completed
   - Button state: Disabled until both PDFs are uploaded
   - Atomic operation: Uses Firestore batch write to update both job request and draft document simultaneously

2. **Fill Up Form** (Engineering/IT only)
   - Location: Below "Mark as Finished" button
   - **Visibility**: Only shown when no draft exists for this job request
   - Action: Opens the Fill Up Form dialog in edit mode (empty form)
   - Data: Auto-populates from job request document

3. **Load Draft** (Engineering/IT only)
   - Location: Below "Mark as Finished" button (next to it)
   - **Visibility**: Only shown when a draft exists in `job_fill_ups` collection
   - Action: Opens the Fill Up Form dialog in view mode (read-only)
   - From view mode, user can edit the draft (re-opens in edit mode)

**Status Progression**:
- `JR FORM FORWARD TO ENGINEERING` → Initial state
- `JR FORM FORWARD TO PROCUREMENT` → After engineer marks as finished
- `COMPLETED` → Final state

**User Access Control**:
```typescript
const isAdmin = userContext.role === "admin" || userContext.role === "it";
const isEngineering = userContext.role === "engineering" || userContext.role === "it" || userContext.role === "admin";
```

---

### 4. Fill Up Form Dialog
**Location**: `components/job-fill-up-form-dialog.tsx`

**Purpose**: Fill out formal documentation for job requests

**Features**:
- 3-column grid layout for desktop (responsive)
- Auto-population from Firestore job request document
- Field locking for auto-populated values
- Form validation for required fields
- **Draft Management**: Saves form data to `job_fill_ups` collection via `onSubmit` callback
- **View Mode**: Shows saved draft with all fields disabled (read-only)
- **Edit Mode**: Allows editing of existing drafts or creating new ones
- Submit functionality: Calls `onSubmit` callback with form values, BOQ sections, and summary

**Draft Management Workflow**:
- New form: Click "Fill Up Form" → Fill in data → Submit → Saves as draft in `job_fill_ups/{requestId}`
- Load draft: Click "Load Draft" → View saved draft (read-only) or edit → Submit → Updates existing draft
- View mode: Shows saved draft with all fields disabled (no submit/clear buttons)
- **Final Step**: When "Mark as Finished" is clicked, the draft is copied into the job request document (field: `fillUpForm`) and marked as completed

**Props Interface**:
```typescript
interface JobFillUpFormDialogProps {
  open: boolean;                      // Dialog open state
  onOpenChange: (open: boolean) => void;
  requestId?: string;                 // Firestore doc id in "job_requests"
  readOnly?: boolean;                 // View mode (read-only draft)
  draft?: FillUpDraft | null;         // Saved draft data to load
  onSubmit?: (                        // Called on form submit
    values: JobFillUpFormValues,
    boqSections: BoqSection[],
    summary: BoqSummary
  ) => void | Promise<void>;
}
```

**Draft Data Structure**:
```typescript
type FillUpDraft = {
  values: JobFillUpFormValues;         // Form field values
  boqSections: BoqSection[];           // Bill of quantities sections
  summary: BoqSummary;                // Project summary with totals
  status?: "draft" | "completed";     // Draft status
  requestId?: string;                 // Link to job request
  createdBy?: string;                // User ID who created draft
  createdByName?: string;             // User name who created draft
  createdAt?: Timestamp;              // Creation timestamp
  updatedAt?: Timestamp;              // Last update timestamp
};
```

**Form Fields**:

| Field | Label | Required | Auto-Populated | Span |
|-------|-------|----------|----------------|------|
| jrNumber | JR Number | Yes | Yes | 1 |
| dateRequested | Date Requested | No | Yes | 1 |
| agentName | Agent Name | No | Yes | 1 |
| projectTitle | Project Title | Yes | Yes | 2 |
| clientName | Client Name | No | Yes | 1 |
| address | Address | Yes | Yes | 3 |
| projectDuration | Project Duration | No | Yes | 1 |
| workHours | Work Hours | No | Yes | 2 |
| scopeOfWork | Detailed Scope of Work | Yes | Yes | 3 |

**BOQ (Bill of Quantities) Section**:
- Contains multiple sections, each with rows of items
- Each row includes: Item No, Procurement columns (for Procurement/IT/Admin only), Description, Quantity, Unit, and 7 money columns
- **Procurement Columns** (visible only to Procurement, IT, and Admin):
  - Position: Between Item No and Description columns
  - Sticky positioning: The Item No and 4 procurement columns stick to the left when scrolling horizontally
  - Total sticky width: 621px (60px Item No + 100px Qty + 130px Cost + 135px Total + 140px Variance + gaps + padding)
  - Procurement Qty: Input field for procurement quantity (supports Excel paste - multi-row paste starts at clicked row)
  - Procurement Acquired Cost: Input field for actual cost (supports Excel paste - multi-row paste starts at clicked row)
  - Procurement Total Amount: Auto-computed (Qty × Cost)
  - Variance: Auto-computed (Engineering Total - Procurement Total), color-coded (red for negative, green for positive)
  - **Excel Paste Feature**: Procurement users can paste Excel data directly into Qty and Cost columns
    - Paste into Qty column: First pasted column goes to Qty, second to Cost
    - Paste into Cost column: First pasted column goes to Cost only
    - Supports multi-row paste - fills down from the clicked row
    - Automatically cleans currency symbols and formats as decimal (e.g., "₱7,800.00" → "7800.00")
    - Shows success toast with number of items pasted
    - Warns if extra rows are pasted beyond available items in the section
- **Money Columns**:
  - Material Cost: Input field
  - Total Material Cost: Auto-computed (Qty × Material Cost)
  - Labor Cost: Input field
  - Total Labor Cost: Auto-computed (Qty × Labor Cost)
  - Consumable Cost: Input field
  - Total Consumable: Auto-computed (Qty × Consumable Cost)
  - Total Amount: Auto-computed (Sum of all totals)
- Row totals are computed automatically and displayed in read-only fields
- Section subtotals are calculated and displayed at the bottom of each section
- Project summary includes material, labor, consumables, direct cost, contingency, and total project cost

**Data Mapping**:
The form auto-populates from the `job_requests` Firestore document:
- `jrNumber` ← `jobRequestNo`
- `dateRequested` ← `createdAt` (formatted)
- `agentName` ← `agentName` (resolved via `/api/user-by-reference`)
- `projectTitle` ← `projectTitle`
- `clientName` ← `clientName` (or "GENERAL")
- `address` ← `location`
- `projectDuration` ← `workingTimeFrom` to `workingTimeTo`
- `workHours` ← `workingTimeFrom` to `workingTimeTo` (with time)
- `scopeOfWork` ← `scopeOfWork`

**State Management**:
```typescript
const [values, setValues] = useState<JobFillUpFormValues>(EMPTY_DATA);
const [lockedKeys, setLockedKeys] = useState<string[]>([]); // Auto-populated fields
const [isSubmitting, setIsSubmitting] = useState(false);
const [isLoadingJob, setIsLoadingJob] = useState(false);
```

**Usage in Detail Page**:
```typescript
// New form (empty)
<JobFillUpFormDialog
  open={fillUpFormOpen}
  onOpenChange={setFillUpFormOpen}
  requestId={params.id}
  draft={null}
  onSubmit={handleSaveFillUpDraft}
/>

// View draft (read-only)
<JobFillUpFormDialog
  open={fillUpFormOpen}
  onOpenChange={setFillUpFormOpen}
  requestId={params.id}
  draft={fillUpDraft}
  readOnly={true}
/>

// Edit draft
<JobFillUpFormDialog
  open={fillUpFormOpen}
  onOpenChange={setFillUpFormOpen}
  requestId={params.id}
  draft={fillUpDraft}
  readOnly={false}
  onSubmit={handleSaveFillUpDraft}
/>
```

**State Management in Detail Page**:
```typescript
const [fillUpFormOpen, setFillUpFormOpen] = useState(false);
const [fillUpDraft, setFillUpDraft] = useState<FillUpDraft | null>(null);
const [draftToLoad, setDraftToLoad] = useState<FillUpDraft | null>(null);

// Listen to saved draft in real-time
useEffect(() => {
  const draftRef = doc(db, "job_fill_ups", params.id);
  const unsubscribe = onSnapshot(draftRef, (snap) => {
    setFillUpDraft(snap.exists() ? (snap.data() as FillUpDraft) : null);
  });
  return () => unsubscribe();
}, [params.id]);

// Save draft to Firestore
const handleSaveFillUpDraft = async (
  values: JobFillUpFormValues,
  boqSections: BoqSection[],
  summary: BoqSummary
) => {
  const payload = JSON.parse(JSON.stringify({ values, boqSections, summary }));
  const draftRef = doc(db, "job_fill_ups", params.id);

  if (fillUpDraft) {
    // Update existing draft
    await updateDoc(draftRef, {
      ...payload,
      updatedBy: userContext.name,
      updatedAt: serverTimestamp(),
    });
  } else {
    // Create new draft
    await setDoc(draftRef, {
      ...payload,
      requestId: params.id,
      status: "draft",
      createdBy: userContext.id,
      createdByName: userContext.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
};
```

---

## File Structure

```
engineer-ticketing-v2/
├── app/
│   ├── api/
│   │   ├── user-by-reference/
│   │   │   └── route.ts                 # API: Resolve agent name from ReferenceID
│   │   ├── upload-job-pdf/
│   │   │   └── route.ts                 # API: Upload PDF documents to cloud storage
│   │   └── get-subordinates/
│   │       └── route.ts                 # API: Fetch subordinate users for Managers/TSMs
│   └── request/
│       └── job/
│           ├── [id]/
│           │   └── page.tsx              # Job detail page with actions
│           ├── add/
│           │   └── page.tsx              # Job request creation
│           └── page.tsx                 # Job request list page
├── components/
│   ├── job-fill-up-form-dialog.tsx      # Fill up form dialog component
│   ├── page-header.tsx                   # Page header component
│   ├── collaboration-hub.tsx            # Real-time collaboration/messaging
│   ├── protected-page-wrapper.tsx       # Authentication wrapper
│   └── ui/                              # UI components (shadcn/ui)
│       ├── button.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── label.tsx
│       ├── dialog.tsx
│       ├── badge.tsx
│       ├── tabs.tsx
│       ├── tooltip.tsx
│       ├── separator.tsx
│       ├── sidebar.tsx
│       └── card.tsx
├── lib/
│   ├── firebase.ts                      # Firebase configuration
│   └── utils.ts                         # Utility functions (cn helper)
├── docs/
│   ├── JR_FORM_WORKFLOW.md              # This documentation
│   └── DATA_MODELS.md                  # Data models documentation
└── .env.local                           # Environment variables
```

---

## Key Components

### Job List Page
**Location**: `app/request/job/page.tsx`

**Navigation**: `/request/job` → list, `/request/job/[id]` → detail

### Job Creation Page
**Location**: `app/request/job/add/page.tsx`

**Navigation**: `/request/job/add`

**Submit**: Creates document in `job_requests` collection with auto-generated ID

### Job Detail Page
**Location**: `app/request/job/[id]/page.tsx`

**Features**:
- Displays complete job request information
- Real-time status updates via Firestore listeners
- SLA countdown timer (24-hour limit)
- Progress tracker visualization (signatures are hidden from the UI)
- Photo gallery for attachments
- Engineer's Console (Admin/Engineering/IT only)

### Fill Up Form Dialog
**Location**: `components/job-fill-up-form-dialog.tsx`

**Import Path in Detail Page**:
```typescript
// Relative path used (from app/request/job/[id]/page.tsx)
import { JobFillUpFormDialog } from "../../../../components/job-fill-up-form-dialog";
```

---

## Firestore Collections

### `job_requests`
**Purpose**: Stores all job request documents

**Document Structure**:
```typescript
{
  id: string;                           // Auto-generated document ID
  jobRequestNo: string;                // JR number
  projectName: string;                 // Project name
  projectTitle: string;                // Project title
  clientName: string;                  // Client name
  location: string;                    // Site address
  scopeOfWork: string;                 // Detailed scope
  agentName: string;                   // Agent ReferenceID
  submittedByName: string;             // Requestor name
  submittedBy: string;                 // Requestor user ID (may vary by format)
  createdBy: string;                   // User ID who created the request (may vary by format)
  status: string;                      // Current status
  priority: string;                    // Priority level
  workingTimeFrom: Date;               // Work start time
  workingTimeTo: Date;                 // Work end time
  createdAt: Timestamp | string;      // Creation timestamp (supports both formats)
  updatedAt: Timestamp;                // Last update timestamp
  completedAt: Timestamp;              // Completion timestamp
  signedJRFormUrl: string;             // Uploaded PDF URL
  signedJRFormViewerUrl: string;      // Google Docs viewer URL
  scopeOfWorkUrl: string;              // Uploaded PDF URL
  scopeOfWorkViewerUrl: string;       // Google Docs viewer URL
  attachments: string[];               // Photo URLs
  fillUpForm?: {                       // Fill Up Form data (copied from draft on completion)
    values: JobFillUpFormValues;       // Form field values
    boqSections: BoqSection[];          // Bill of quantities sections
    summary: BoqSummary;               // Project summary with totals
    savedBy: string;                   // User who saved the draft
    savedAt: Timestamp;               // When the draft was saved
  };
  // ... other fields
}
```

**User Identifier Notes**:
- `submittedBy` and `createdBy` fields may contain user IDs in various formats (id, refId, ReferenceID, referenceId)
- The application normalizes these fields during filtering to ensure comprehensive matching
- Date fields support both Firestore Timestamp objects and string/Date formats for flexibility

---

### `job_fill_ups`
**Purpose**: Stores Fill Up Form drafts before they are copied into the job request document

**Document ID**: Matches the job request ID (`requestId`)

**Document Structure**:
```typescript
{
  requestId: string;                   // Job request document ID
  status: "draft" | "completed";      // Draft status
  values: JobFillUpFormValues;        // Form field values
  boqSections: BoqSection[];          // Bill of quantities sections
  summary: BoqSummary;                // Project summary with totals
  createdBy: string;                  // User ID who created the draft
  createdByName: string;              // User name who created the draft
  createdAt: Timestamp;               // Creation timestamp
  updatedAt: Timestamp;               // Last update timestamp
  completedAt?: Timestamp;            // When marked as completed (optional)
  completedBy?: string;               // User who marked as completed (optional)
}
```

**Workflow**:
1. Engineering/IT clicks "Fill Up Form" → Creates new draft in `job_fill_ups/{requestId}` with `status: "draft"`
2. Engineering/IT can click "Load Draft" to view/edit the draft
3. When "Mark as Finished" is clicked:
   - Draft data is copied into `job_requests/{id}.fillUpForm`
   - Draft status is updated to `"completed"`
   - `completedAt` and `completedBy` are set
   - All done in a single Firestore batch write

---

## API Endpoints

### `/api/user-by-reference`
**Location**: `app/api/user-by-reference/route.ts`

**Purpose**: Resolve agent name from ReferenceID

**Method**: GET

**Query Param**: `referenceid` (the ReferenceID from the job request)

**Returns**: `{ name: string }` - Full name of the user

**Used by**: Fill Up Form dialog to get agent full name

**Flow**:
1. Dialog receives `agentName` (ReferenceID) from job request
2. Calls `/api/user-by-reference?referenceid=AE-NCR-749180`
3. API queries the `users` collection by ReferenceID
4. Returns formatted name: "Firstname Lastname"

---

### `/api/upload-job-pdf`
**Location**: `app/api/upload-job-pdf/route.ts`

**Purpose**: Upload PDF documents to cloud storage (Cloudinary)

**Method**: POST

**Body**: FormData with:
- `file`: The PDF file to upload
- `folder`: Destination folder name

**Returns**: `{ secure_url: string }` - Public URL of uploaded file

**Used by**: "Mark as Finished" action for uploading:
- Signed JR Form (folder: `job-signed-jr-forms`)
- Scope of Work (folder: `job-scope-of-work`)

**Flow**:
1. User selects PDF file
2. File is uploaded to Cloudinary via API
3. API returns secure URL
4. URL is stored in Firestore document
5. Google Docs viewer URL is generated for embedded viewing

---

### `/api/get-subordinates`
**Location**: `app/api/get-subordinates/route.ts`

**Purpose**: Fetch subordinate users for Managers and TSMs

**Method**: GET

**Returns**: Array of user objects with all identifier fields

**Used by**: Job list page to build comprehensive subordinate ID lists

---

## User Roles & Permissions

### Role-Based Access Control

| Role | Department | Access Level | Can View Job Details | Can Mark as Finished | Can Fill Up Form | Can Edit Console Notes |
|------|------------|--------------|---------------------|---------------------|------------------|----------------------|
| Super Admin | Any | Global | All job requests | Yes | Yes | Yes (all) |
| Leader | Any | Global | All job requests | Yes | Yes | Yes (all) |
| IT | IT | Global | All job requests | Yes | Yes | Yes (all) |
| Engineering | Engineering | Global | All job requests | Yes | Yes | Yes (role-specific) |
| Procurement | Procurement | Global | All job requests | No | No | No (view-only) |
| Manager | Any | Subordinate | Own + subordinate requests | No | No | No |
| TSM | Sales | Subordinate | Own + subordinate requests | No | No | No |
| Other | Any | Personal | Own requests only | No | No | No |

**Global Access Criteria**:
```typescript
const hasGlobalAccess =
  userDept === "IT" ||
  userDept === "ENGINEERING" ||
  ["SUPER ADMIN", "LEADER"].includes(userRole)
```

---

### User Identification & Access Control

#### Multiple User Identifier Support
The system supports multiple user identifier formats to ensure comprehensive user matching across different data sources:

- **id**: Primary user ID (MongoDB ObjectId or equivalent)
- **refId**: Reference ID (alternative identifier)
- **ReferenceID**: Pascal-case reference ID (from certain legacy systems)
- **referenceId**: camel-case reference ID (from other systems)

**Normalization Logic**:
```typescript
// Convert all identifiers to strings for consistent matching
const ids = Array.from(new Set(
  [user.refId, user.id, ...subordinateIds].filter(Boolean).map(String)
))
```

#### Subordinate Management
**For Managers and TSM Roles**:
- Subordinate data is fetched from the users collection via `/api/get-subordinates` endpoint
- Each subordinate's multiple identifier fields are collected for comprehensive matching
- Subordinate IDs are normalized into a flat array for Firestore queries

**Subordinate ID Extraction**:
```typescript
setSubordinateIds(
  subs.flatMap(u => [u._id, u.id, u.ReferenceID, u.referenceId].filter(Boolean).map(String))
)
```

#### Pending Jobs Filter
The "My Pending" jobs filter has been enhanced to match on multiple user identifier fields:

```typescript
const myPending = requests.filter((r: any) =>
  (r.status === "JR FORM FORWARD TO ENGINEERING" ||
   r.status === "JR FORM FORWARD TO ENGINEERING LEADER" ||
   r.status === "JR FORM FORWARD TO ENGINEERING MANAGER") &&
  (r.submittedBy === user.id || r.submittedBy === user.refId || r.createdBy === user.refId)
)
```

This ensures users see their pending jobs regardless of which identifier format was used when the request was created.

---

## Status Transitions

```
┌─────────────────────────────────────┐
│ JR FORM FORWARD TO ENGINEERING        │
│ (Initial state after creation)        │
└──────────────┬──────────────────────┘
               │
               │ Mark as Finished
               │ (with PDF uploads)
               ▼
┌─────────────────────────────────────┐
│ JR FORM FORWARD TO PROCUREMENT       │
│ (Documents uploaded & forwarded)     │
└──────────────┬──────────────────────┘
               │
               │ (Final completion)
               ▼
┌─────────────────────────────────────┐
│ COMPLETED                           │
│ (Final state)                       │
└─────────────────────────────────────┘
```

---

## PDF Upload Requirements

### Before "Mark as Finished" can be clicked:

1. **Signed JR Form PDF**
   - Upload folder: `job-signed-jr-forms`
   - Field name: `signedJRForm`
   - Storage fields: `signedJRFormUrl`, `signedJRFormViewerUrl`

2. **Scope of Work PDF**
   - Upload folder: `job-scope-of-work`
   - Field name: `scopeOfWork`
   - Storage fields: `scopeOfWorkUrl`, `scopeOfWorkViewerUrl`

Both PDFs are required. The "Mark as Finished" button is disabled until both are uploaded.

---

## Technical Details

### Dependencies
- React (useState, useEffect)
- Next.js (App Router, useParams, useRouter)
- Firebase Firestore (doc, getDoc, onSnapshot, updateDoc, setDoc, writeBatch, serverTimestamp)
- Lucide React (icons)
- Sonner (toast notifications)
- react-zoom-pan-pinch (image preview)

### Configuration Files

#### Firebase Configuration
**Location**: `lib/firebase.ts`

**Purpose**: Initialize Firebase app and Firestore

**Usage**: Imported in components that need database access
```typescript
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
```

#### Utility Functions
**Location**: `lib/utils.ts`

**Purpose**: Helper functions (cn for className merging)

**Usage**: Merging Tailwind classes conditionally
```typescript
import { cn } from "@/lib/utils";
```

### Styling
- Tailwind CSS utility classes
- Custom UI components from `@/components/ui/` (shadcn/ui)
- Responsive design (mobile vs desktop layouts)
- Custom color schemes for status indicators

### Navigation Routes

| Route | Path | Component | Purpose |
|-------|------|----------|---------|
| Job List | `/request/job` | `app/request/job/page.tsx` | View all job requests |
| Job Detail | `/request/job/[id]` | `app/request/job/[id]/page.tsx` | View specific job request |
| Create Job | `/request/job/add` | `app/request/job/add/page.tsx` | Create new job request |

### Error Handling
- Job request not found (404 handling)
- PDF upload failures (toast notifications)
- Agent name resolution errors (fallback to ReferenceID)
- Form validation errors (required field checks)
- Network errors (retry logic)
- Firestore sync errors (logged to console with error context)
- User identification mismatches (multiple identifier formats supported)

### Authentication & Authorization
- **Wrapper Component**: `components/protected-page-wrapper.tsx`
- **Session Check**: `/api/check-session` endpoint
- **Role-Based Access**:
  - `admin` - Full access
  - `it` - Full access
  - `engineering` - Can view, mark finished, fill form
  - Other roles - View only

---

## Troubleshooting

### Issue: "Mark as Finished" button is disabled
**Solution**: Ensure both Signed JR Form and Scope of Work PDFs are uploaded.

### Issue: Fill Up Form dialog doesn't auto-populate
**Solution**: Check that `requestId` is correctly passed and the job request exists in Firestore.

### Issue: Agent name shows ReferenceID instead of name
**Solution**: Check `/api/user-by-reference` endpoint and ensure the user exists in the users table.

### Issue: Module not found errors
**Solution**: Use relative paths or verify `@/` alias in `tsconfig.json`. Current implementation uses relative path: `../../../../components/job-fill-up-form-dialog`

---

## Recent Updates

### User Identification Enhancement (October 2026)
**Problem**: User IDs were stored in various formats across the system (id, refId, ReferenceID, referenceId), causing filtering issues when users tried to view their jobs.

**Solution**:
- Implemented multi-format user identifier support across the job list page
- Enhanced the pending jobs filter to check multiple identifier fields (submittedBy, createdBy)
- Normalized subordinate IDs by extracting all identifier variants from user records
- Ensured comprehensive matching regardless of which identifier format was used during job creation

### Firestore Data Sync Optimization (October 2026)
**Problem**: Original implementation used a single Firestore query with composite indexes, which required index creation and had limitations on the "in" clause (max 10 items).

**Solution**:
- Implemented chunked query strategy for filtered access users
- Split user ID lists into chunks of 30 to stay within Firestore limits
- Query both `createdBy` and `submittedBy` fields to ensure comprehensive coverage
- Merge results client-side with deduplication via Map-based approach
- Sort results by `createdAt` descending after merging
- Removed server-side `orderBy` for filtered users to avoid composite index requirements

**Benefits**:
- No composite index setup required for most queries
- Better performance for users with large subordinate lists
- More robust error handling with individual query failure isolation
- Improved date handling supporting both Timestamp and string formats

### Date Field Compatibility (October 2026)
**Problem**: Date fields in Firestore were stored in inconsistent formats (Timestamp objects vs. strings), causing display issues.

**Solution**:
- Added helper function to normalize date handling:
  ```typescript
  const toMillis = (v: any) =>
    v?.toDate ? v.toDate().getTime() : v ? new Date(v).getTime() || 0 : 0
  ```
- Updated date display logic to handle both formats:
  ```typescript
  format(r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt), "yyyy-MM-dd")
  ```

### API Endpoint Addition (October 2026)
**New Endpoint**: `/api/get-subordinates`
- **Purpose**: Fetch subordinate users for Managers and TSMs
- **Method**: GET
- **Returns**: Array of user objects with all identifier fields
- **Used by**: Job list page to build comprehensive subordinate ID lists

### Performance Improvements (October 2026)
- Reduced Firestore query complexity for non-admin users
- Eliminated need for composite index creation for filtered queries
- Improved error resilience with individual query chunk handling
- Better memory efficiency through Map-based result merging

### Procurement Columns Enhancement (October 2026)
**Feature**: Added procurement-specific columns to the BOQ section with sticky positioning and Excel paste support

**Procurement Columns** (visible only to Procurement, IT, and Admin):
- Position: Between Item No and Description columns
- Sticky positioning: The Item No and 4 procurement columns stick to the left when scrolling horizontally
- Total sticky width: 621px (60px Item No + 100px Qty + 130px Cost + 135px Total + 140px Variance + gaps + padding)
- Procurement Qty: Input field for procurement quantity (supports Excel paste)
- Procurement Acquired Cost: Input field for actual cost (supports Excel paste)
- Procurement Total Amount: Auto-computed (Qty × Cost)
- Variance: Auto-computed (Engineering Total - Procurement Total), color-coded (red for negative, green for positive)

**Excel Paste Feature**:
- Procurement users can paste Excel data directly into Qty and Cost columns
- Paste into Qty column: First pasted column goes to Qty, second to Cost
- Paste into Cost column: First pasted column goes to Cost only
- Supports multi-row paste - fills down from the clicked row
- Automatically cleans currency symbols and formats as decimal (e.g., "₱7,800.00" → "7800.00")
- Shows success toast with number of items pasted
- Warns if extra rows are pasted beyond available items in the section

**Technical Implementation**:
- Added `PROC_STICKY` constant for the sticky wrapper styling (includes `pr-3` for right padding)
- Updated `BOQ_GRID_PROC` to use a single sticky track (621px width - increased from 583px to accommodate larger Variance column)
- Wrapped Item No and procurement columns in a sticky container with border and shadow
- Applied solid backgrounds (white for rows, slate-50 for header/subtotal) to prevent scroll-through visibility
- Added `handleProcPaste` function to handle Excel paste events in procurement columns
- Added `data-proc-input` attribute to prevent BOQ import paste from triggering when pasting in procurement fields
- Updated subtotal row to use inline grid cells instead of sticky wrapper (simplified layout)
- Added `whitespace-nowrap` to Variance column to prevent text wrapping

---

## Fill Up Form Workflow

### Flow Diagram
```
┌─────────────────────────────────────┐
│ Job Request Detail Page             │
│ (Status: JR FORM FORWARD TO ENG)    │
└──────────────┬──────────────────────┘
               │
               │ Engineering/IT clicks "Fill Up Form"
               ▼
┌─────────────────────────────────────┐
│ Fill Up Form Dialog (Edit Mode)     │
│ - Auto-populates from job request   │
│ - User fills in form data           │
│ - User submits                      │
└──────────────┬──────────────────────┘
               │
               │ onSubmit → handleSaveFillUpDraft
               ▼
┌─────────────────────────────────────┐
│ Draft Saved to Firestore            │
│ Collection: job_fill_ups            │
│ Doc ID: {requestId}                 │
│ Status: "draft"                     │
└──────────────┬──────────────────────┘
               │
               │ Real-time listener updates UI
               ▼
┌─────────────────────────────────────┐
│ Job Request Detail Page (Updated)   │
│ - "Fill Up Form" button hidden      │
│ - "Load Draft" button shown         │
└──────────────┬──────────────────────┘
               │
               │ Engineering/IT clicks "Load Draft"
               ▼
┌─────────────────────────────────────┐
│ Fill Up Form Dialog (View Mode)     │
│ - Shows saved draft (read-only)     │
│ - All fields disabled               │
│ - No submit/clear buttons           │
└──────────────┬──────────────────────┘
               │
               │ User can edit draft
               ▼
┌─────────────────────────────────────┐
│ Fill Up Form Dialog (Edit Mode)     │
│ - Pre-filled with draft data        │
│ - Job request fields still locked   │
│ - User can edit and submit          │
└──────────────┬──────────────────────┘
               │
               │ User submits → Updates draft
               ▼
┌─────────────────────────────────────┐
│ Draft Updated in Firestore          │
│ Collection: job_fill_ups            │
│ Status: "draft"                     │
│ updatedAt updated                   │
└──────────────┬──────────────────────┘
               │
               │ Engineering/IT uploads PDFs and clicks
               │ "Mark as Finished"
               ▼
┌─────────────────────────────────────┐
│ Atomic Batch Write                  │
│ 1. Update job_requests document    │
│    - Set status to procurement      │
│    - Upload PDF URLs                │
│    - Copy draft to fillUpForm field │
│ 2. Update job_fill_ups document     │
│    - Set status to "completed"      │
│    - Set completedAt timestamp      │
│    - Set completedBy user           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Job Request Complete               │
│ Status: JR FORM FORWARD TO PROC     │
│ Fill Up Form data preserved in job  │
└─────────────────────────────────────┘
```

### Key Features

1. **Real-time Draft Synchronization**
   - Uses Firestore `onSnapshot` to listen for draft changes
   - UI updates immediately when draft is saved/updated
   - No manual refresh needed

2. **Atomic Operations**
   - "Mark as Finished" uses Firestore batch write
   - Ensures job request and draft update together
   - Prevents partial updates or data inconsistency

3. **Data Preservation**
   - Draft is preserved in `job_fill_ups` collection with metadata
   - On completion, draft data is copied into job request
   - Draft status changes to "completed" for audit trail

4. **Field Locking**
   - Fields auto-populated from job request remain locked
   - When editing a draft, job request fields always take precedence
   - Ensures data consistency with source job request

---

## Component Import Summary

### Job Detail Page Imports
```typescript
// From app/request/job/[id]/page.tsx
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, setDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { CollaborationHub } from "@/components/collaboration-hub";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import {
  JobFillUpFormDialog,
  type FillUpDraft,
  type JobFillUpFormValues,
  type BoqSection,
  type BoqSummary,
} from "../../../../components/job-fill-up-form-dialog";
```

### Fill Up Form Dialog Imports
```typescript
// From components/job-fill-up-form-dialog.tsx
import React, { useEffect, useState } from "react";
import { FileText, Send, RotateCcw, Loader2, Lock, Eye } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
```

---

## Related Documentation
- **Data Models**: `docs/DATA_MODELS.md` - Detailed Firestore collection schemas
- **Environment Setup**: `.env.local` - Firebase and API configuration

---

## Future Enhancements

1. **PDF Generation**
   - Generate PDF from filled form data
   - Auto-generate JR number if not provided

2. **Email Notifications**
   - Notify procurement when status changes
   - Notify requestor when completed

3. **Version History for Drafts**
   - Track all edits to a draft (currently only tracks created/updated timestamps)
   - Allow reverting to previous versions

4. **Draft Deletion**
   - Allow users to delete a draft and start fresh
   - Currently, once a draft is created, it can only be edited or completed
