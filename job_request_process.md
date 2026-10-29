# Job Request Process - Sales Department Guide

## Overview

This guide explains the job request workflow from the **Sales Department's perspective**, including how to create new job requests and view/manage them in the system.

---

## Creating a New Job Request

### Access
- **Who can create:** Sales Department users and IT users
- **Location:** Navigate to `/request/job/add` or click the "+ New Job" button on the Job Requests page

### Step-by-Step Process

#### Step 1: Project Information
Fill in the following required fields:
- **Project Title** - Name of the project
- **Location** - Physical address where work will be done
  - Can use map picker to select coordinates (see Map Picker Feature below)
- **Agent Name** - Auto-populated from your ReferenceID
- **Project Name** - Customer's project name
- **Contact Person** - Primary contact at client site
- **Email** - Contact email address
- **Contact Number** - Phone number for coordination

### Map Picker Feature

The Location field includes an interactive map picker powered by OpenStreetMap to help you select accurate coordinates for the job site.

#### Access
- **Location:** Step 1 of the job request form
- **Trigger:** Click on the Location field to open the map picker interface

#### Features

**1. Address Search**
- **Search Bar:** Type any address to search for locations
- **Real-time Results:** Shows up to 5 matching addresses as you type
- **Debounced Search:** 500ms delay to optimize performance
- **Auto-Zoom:** Map automatically zooms in when you select a search result
- **Fly Animation:** Smooth animated transition to selected location

**2. Interactive Map**
- **Click to Pin:** Click anywhere on the map to place a location pin
- **Reverse Geocoding:** Automatically retrieves the full address from coordinates
- **Draggable Map:** Pan around to explore the area
- **Zoom Controls:** Zoom in/out to find precise location
- **Default Position:** Starts at Philippines center (14.5995, 120.9842)

**3. Manual Address Input**
For locations that can't be found through search:
- **Toggle Button:** "Can't find exact address? Manual input here"
- **Field Breakdown:**
  - **Rm./Flr./Unit No. & Bldg. Name** (optional)
  - **House/Lot & Blk. No.** (optional)
  - **Street Name** (optional, but helps precision)
  - **Subdivision** (optional)
  - **Barangay / District / Locality** (required)
  - **City / Municipality** (required)
  - **Province** (required)
  - **Zip Code** (optional, numeric only, max 4 digits)

**4. Auto-Pin Feature**
- **Automatic Location:** As you type City, Barangay, and Province, the map automatically attempts to locate the address
- **Smart Search Tries Multiple Levels:**
  1. **Street-level** (zoom 17) - if street is provided
  2. **Barangay-level** (zoom 15) - if barangay is provided
  3. **City-level** (zoom 13) - fallback to city match
- **Status Indicators:**
  - 🟢 **Green Pin:** Address successfully located
  - 🔴 **Red Pin:** Address not found
  - ⏳ **Spinner:** Currently searching
  - 📍 **Gray Pin:** Waiting for input
- **Manual Fine-Tuning:** Click anywhere on the map to adjust the pin after auto-locating
- **Locate Button:** Manually trigger location search if needed

**5. Location Confirmation**
- **Selected Location Display:** Shows the full address that will be submitted
- **Coordinates Display:** Shows latitude and longitude (6 decimal places)
- **Manual Mode Indicator:** Shows "(Manual)" badge when using manual input
- **Confirm Button:** Submits the selected location to the form
- **Validation:** Requires at least City, Barangay, and Province in manual mode

**6. Search Results Dropdown**
- **Real-time filtering:** Updates as you type
- **Full Address Display:** Shows complete address for each result
- **Click to Select:** Instantly moves map to selected location
- **Clear Button:** X icon to clear search input

**7. Technical Details**
- **Map Provider:** OpenStreetMap (free, open-source)
- **Geocoding Service:** Nominatim (OpenStreetMap's geocoding API)
- **Rate Limiting:** Respects Nominatim's 1 request/second limit
- **Debounce Timing:** 500ms for search, 1000ms for manual address auto-pin
- **Country:** Automatically filters to Philippines addresses (`.ph` country code)

**8. Best Practices**
- **Use Search First:** Try the address search before manual input
- **Minimum Required Fields:** In manual mode, at least Barangay, City, and Province are required
- **Optional Fields:** Unit, House/Lot, Subdivision, and Zip are optional and don't affect map pinning
- **Fine-Tune Pin:** After auto-locating, click on the map to adjust the precise location
- **Zip Code Format:** Only accepts numeric input, maximum 4 digits
- **Auto-Format:** All manual inputs are automatically converted to uppercase

**9. Error Handling**
- **Geocoding Failures:** If reverse geocoding fails, shows coordinates as fallback
- **Search Errors:** Shows "Searching..." status during queries
- **Not Found:** Displays "Couldn't locate that address" if manual geocoding fails
- **Manual Pin:** Always allows manual pin placement even if geocoding fails

#### Step 2: Work Details
- **Scope of Work** - Detailed description of work to be performed
- **Mounting Height** - Height requirements for installation
- **Working Time From/To** - Scheduled work hours
- **Working Days** - Select applicable days (Monday-Sunday)
- **Site Installation** - Select required installation equipment
- **In House** - Select in-house resources needed
- **Permits** - Select required permits
- **Other Assistance** - Additional assistance needed
- **Other Documents** - Reference to other documents

#### Step 3: Safety & Priority
- **Priority Level** - Choose: HIGH, MEDIUM, LOW, or URGENT
- **Temporary Facility** - Yes/No
- **Safety Induction** - Yes/No
- **Safety Notes** - Additional safety requirements
- **Photo Attachments** - Upload relevant images (only image files allowed)

#### Step 4: Customer Selection

**How It Works:**

The customer selection feature connects to your cluster account database to help you quickly select or search for clients.

**Interface Components:**

1. **Customer Dropdown Field**
   - Shows currently selected customer account
   - Format: Typically displays account name or reference
   - Click to open the customer search dropdown

2. **Search Bar**
   - Label: "Search customer..."
   - Type to filter customer list in real-time
   - Case-insensitive search
   - Searches by customer name, account name, or reference ID

3. **Customer List**
   - Displays all available accounts from the database
   - Shows customer/account names in alphabetical order
   - Highlights current selection on hover
   - Scrollable list for large databases

4. **Database Counter**
   - Top-right display: "DATABASE: X"
   - Shows total number of accounts available
   - Updates dynamically as you load more accounts

5. **Project/Site Information**
   - Displayed above the dropdown: "PROJECT / SITE"
   - Shows project/site name (or "NA" if not selected)
   - Helps verify the correct customer is selected

**Features:**

- **Real-time Search:** Filter customers as you type (500ms debounce for performance)
- **Pagination:** Loads 50 accounts at a time to prevent system overload
- **Load More:** Scroll to bottom or click to load additional accounts
- **Auto-population:** Based on your ReferenceID and department access
- **Role-based Access:** IT users can see all accounts; Sales users see their assigned cluster

**Usage Steps:**

1. Click the customer dropdown field to open the search dropdown
2. Type customer name or account reference in the search bar
3. Browse the filtered list or scroll through all accounts
4. Click on the desired customer to select it
5. Verify the selection appears in the dropdown field
6. The "PROJECT / SITE" info will update to reflect your selection
7. Press `Ctrl + Enter` or click "PROCEED" to continue to the next step

**Important Notes:**

- Customer selection is **required** before proceeding
- The dropdown will show "No results found" if search matches no accounts
- You can click "BACK" to return to previous steps if needed
- Only accounts in your cluster/assigned territory are visible (role-based)
- IT department users have access to the full customer database

#### Step 5: Submission
- Review all information
- Enable **Test Mode** (optional) - Prefixes job number with "TEST-" for testing
  - Toggle via button or keyboard shortcut `Ctrl+Shift+M`
- Click **Submit** to create the job request
- System generates unique job request number (e.g., `JR2026-0042`)
- Initial status: **JR FORM FORWARD TO ENGINEERING**
- Push notification sent to hierarchy (TSM/Manager + admins)

### Test Mode
- **Purpose:** Create test job requests without affecting production
- **How to enable:** Click "Test Mode" button or press `Ctrl+Shift+M`
- **Effect:** Job number prefixed with "TEST-" (e.g., `TEST-JR2026-0042`)
- **Status indicator:** Amber button when active

---

## Viewing Job Requests

### Access
- **Location:** `/request/job`
- **Who can view:** All users with role-based filtering

### Job Detail View

When you click on a job request from the list, you'll be taken to the detailed view page at `/request/job/[id]`. This page provides a comprehensive overview of the job with real-time collaboration features.

#### Page Layout

**Header Section:**
- **Status Badge:** Shows current approval status with color coding
- **Timer:** Countdown timer showing SLA (24-hour limit) and elapsed time
- **Reference ID:** Unique job identifier (e.g., `TEST-JR-2026-0010`)
- **Priority Badge:** Shows HIGH/MEDIUM/LOW/URGENT with visual indicator
- **Back Button:** Returns to job list

**Project Information Panel:**
- **Project Name:** Customer's project name
- **Agent Name:** ReferenceID of the sales agent who created the request
- **Project Title:** Descriptive title of the job
- **Location:** Full address with map coordinates
- **Client Name:** Customer/client name
- **Urgency:** Priority level
- **Work Hours:** Scheduled work timeline
- **Installation Type:** NEW INSTALLATION, MODIFICATION, etc.
- **Modification Type:** ASSEMBLY, DISASSEMBLY, etc.
- **Detailed Scope of Work:** Full description of work requirements

**Progress Tracker:**
Visual workflow showing approval stages with color-coded indicators:

| Stage | Color | Description |
|-------|-------|-------------|
| JR FORM FORWARD TO ENGINEERING | Amber | Initial submission, awaiting engineering review |
| JR FORM FORWARD TO ENGINEERING LEADER | Violet | Approved by engineering, awaiting leader review |
| JR FORM FORWARD TO ENGINEERING MANAGER | Blue | Approved by leader, awaiting manager review |
| JR FORM FORWARD TO PROCUREMENT | Emerald | Approved by engineering, forwarded to procurement |
| JR FORM APPROVED BY PROCUREMENT | Teal | Final approval by procurement (completed) |

**Photo Gallery:**
- Displays uploaded images from the job request
- Click to view full-size images
- Zoom and pan functionality for detailed inspection
- Supports multiple photos

**Engineering Console:**
- **Member Notes:** Engineering member's remarks (visible to all engineering roles)
- **Leader Notes:** Engineering leader's remarks (visible to all engineering roles)
- **Manager Notes:** Engineering manager's remarks (visible to all engineering roles)
- **Procurement Notes:** Procurement's remarks (visible to procurement and IT)

**Sales View Permissions:**
- Sales users can **view** all notes
- Sales users **cannot edit** any notes
- Notes are read-only for Sales department
- Full visibility into engineering and procurement feedback

---

## Collaboration Hub

The Collaboration Hub is a real-time chat system integrated into the job detail view, enabling communication between Sales, Engineering, and Procurement teams.

### Access
- **Location:** Bottom-right floating button on job detail page
- **Icon:** Blue message bubble with unread count badge
- **Click to open:** Expands into a chat panel

### Features

#### 1. Real-Time Messaging
- **Send messages:** Type in the input field and press Enter or click Send
- **Instant delivery:** Messages appear immediately for all participants
- **Sound notifications:** Audio alert for new messages
- **Timestamps:** Each message shows when it was sent

#### 2. System Messages
Automatic messages generated when the job status changes:
- Example: "PROJECT STATUS UPDATED TO: JR FORM FORWARD TO ENGINEERING MANAGER"
- Gray pill-style messages in the chat
- Helps everyone track approval progress
- No sender avatar (system-generated)

#### 3. Typing Indicators
- Shows "Someone is typing..." when another user is composing a message
- Disappears after 3 seconds of inactivity
- Helps avoid duplicate messages

#### 4. Message Reactions
React to messages with emojis:
- **👍** (Thumbs Up) - Agreement/Approval
- **❤️** (Heart) - Appreciation/Like
- **😊** (Smile) - Positive feedback
- Reaction count displayed on messages
- Toggle reactions on/off by clicking again

#### 5. Reply Functionality
- **Public Reply:** Reply to a message visible to all participants
- **Private Reply:** Send a private message visible only to the recipient (and IT)
- **Reply Preview:** Shows the original message being replied to
- **Click to Navigate:** Click on reply preview to jump to original message

**How to Reply:**
1. Click the Reply icon on any message
2. Type your response in the chat input
3. Press Enter or click Send to open the reply dialog
4. Choose between two options:
   - **Reply Publicly (Blue Button):** Message visible to all participants
   - **Reply Privately (Purple Button with Lock Icon):** Message visible only to the original sender (and IT department)
5. The reply dialog shows:
   - Original sender's name
   - Quoted text of the message being replied to
   - Both reply options clearly distinguished by color and icon

**Reply Dialog Features:**
- Blue "Reply Publicly" button for public responses
- Purple "Reply Privately" button with lock icon for private messages
- Shows preview of the message you're replying to
- X button to cancel the reply
- Requires a message to be typed before enabling buttons

#### 6. Message Resolution
- Mark messages as "Resolved" to indicate they've been addressed
- Resolved messages appear with reduced opacity and grayscale
- Green "Resolved" badge on resolved messages
- Toggle resolution status with the checkmark icon

#### 7. Seen By Feature
- Shows who has read each message
- Click the eye icon to view the list of people who have seen the message
- Includes user names and profile pictures
- Real-time updates as people read messages

**Seen By Dialog:**
- **Eye Icon:** Located in the timestamp area of each message
- **Click to Open:** Displays a dialog showing all users who have seen the message
- **User Information:** Shows:
  - User's full name (first name and last name)
  - Profile picture/avatar
  - Department information (if available)
- **Real-Time Updates:** Automatically updates when new users read the message
- **Current User:** Your own name appears with visual indication
- **Message Sender:** Can see who has read their messages
- **Auto-Mark as Seen:** Messages are automatically marked as seen when you open the chat (except for private messages you cannot see)

**Seen By Status Logic:**
- Your own messages are always marked as seen by you
- Private messages are only marked as seen if you are the recipient or sender
- IT department can see all private messages and mark them as seen
- The seen count updates in real-time as users view the message

#### 8. Image Attachments
- Upload images directly in the chat
- Click the image icon to select files
- Images appear inline in the conversation
- View full-size by clicking on images

#### 9. Message Search
- Click the search icon to open search bar
- Type keywords to filter message history
- Case-insensitive search
- Quickly find specific information in long conversations

#### 10. Private Messages
- Send messages visible only to specific recipients
- Purple "Private to [Name]" badge on private messages
- Recipient: Always sees their private messages
- Sender: Always sees their own private messages
- IT Department: Can see all private messages (admin access)
- Other users: Cannot see private messages not addressed to them

**How to Send Private Message:**
1. Reply to a message
2. Choose "Reply Privately" option
3. Message is sent only to the original sender

#### 11. Mention Support
- Tag users in messages using `@username`
- Mentioned users get highlighted in yellow background
- Other mentions appear in blue background
- Useful for directing attention to specific people

#### 12. Scroll to Bottom
- Button appears when scrolled up in chat
- Shows unread message count
- Click to jump to latest messages
- Smooth scrolling animation

#### 13. Chat Permissions by Status
- **Active Jobs:** Chat is fully functional
- **Approved/Finalized Jobs:** Chat becomes read-only
- "Project Archive Read Only" message displayed
- No new messages can be sent

### Sales Department Chat Permissions

| Feature | Sales Department |
|---------|------------------|
| Send Messages | ✅ Yes |
| View All Messages | ✅ Yes |
| Send Private Messages | ✅ Yes |
| View Private Messages | ✅ Only if recipient or sender |
| Add Reactions | ✅ Yes |
| Reply to Messages | ✅ Yes |
| Mark as Resolved | ✅ Yes |
| Upload Images | ✅ Yes |
| Search Messages | ✅ Yes |
| Mention Users | ✅ Yes |
| See Typing Indicators | ✅ Yes |
| See "Seen By" Status | ✅ Yes |

### Chat Best Practices for Sales

1. **Use for Clarifications:** Ask engineering or procurement teams for clarification on requirements
2. **Provide Updates:** Inform teams about client changes or new information
3. **Coordinate Schedules:** Discuss timing and availability with engineering
4. **Share Information:** Provide additional context not captured in the form
5. **Resolve Issues:** Use the "Resolved" feature to close completed discussions
6. **Private Conversations:** Use private messages for sensitive client information
7. **Mention Relevant People:** Use `@username` to ensure the right people see your message
8. **Keep Professional:** All chat messages are recorded and visible to the team

### Chat Interface Components

**Header:**
- EngiConnect logo with pulse animation
- Job reference number (e.g., `TEST-JR-2026-0010`)
- Online status indicator (green dot)
- Search button
- Minimize/close button

**Message Area:**
- Scrollable conversation history
- "New Messages Below" divider for unread messages
- User avatars with initials
- Timestamps on each message
- Reaction bar on hover (emoji reactions, reply, resolve)
- Private message badges
- System messages (status changes)

**Input Area:**
- Image upload button
- Text input field
- Send button with loading state
- Reply preview (when replying to a message)
- Typing indicator display
- Read-only notice for archived projects

---

## Viewing Job Requests (List View)

### Filter Tabs
Quickly filter jobs by status:
- **ALL JOBS** - View all visible jobs
- **ENGINEERING** - Jobs awaiting engineering review
- **ENG LEADER** - Jobs with engineering leader
- **ENG MANAGER** - Jobs with engineering manager
- **PROCUREMENT** - Jobs forwarded to procurement
- **PROC. APPROVED** - Completed and approved jobs

### Table Columns Explained

#### 1. REF_ID
- **Format:** `JR2026-0042` (or `TEST-JR2026-0042` for test jobs)
- **Description:** Unique sequential job request number
- **Purpose:** Quick reference for tracking and communication
- **Legacy:** Older jobs may show truncated full ID if no jobRequestNo exists

#### 2. PROJECT / CLIENT
- **Project Name:** Bold, uppercase project title
- **Client Name:** Displayed with user icon (default: "GENERAL CLIENT")
- **Location:** Displayed with map pin icon (default: "BRANCH LOCATION")
- **Color:** Turns blue on hover for easy identification

#### 3. TIMELINE
- **Format:** `YYYY-MM-DD` (e.g., `2026-10-17`)
- **Description:** Date when job request was created
- **Icon:** Calendar icon for visual reference
- **Purpose:** Track when requests were submitted

#### 4. PRIORITY
- **Options:** NORMAL, URGENT, HIGH, MEDIUM, LOW
- **Visual Indicator:**
  - **URGENT:** Red pill with pulsing dot (requires immediate attention)
  - **NORMAL:** Gray pill with static dot
- **Interaction:** Click to toggle between NORMAL and URGENT
- **Purpose:** Help departments prioritize urgent requests

#### 5. STATUS
Workflow statuses indicating current approval stage:

| Status | Color | Description |
|--------|-------|-------------|
| JR FORM FORWARD TO ENGINEERING | Amber | Initial submission, awaiting engineering review |
| JR FORM FORWARD TO ENGINEERING LEADER | Violet | Approved by engineering, awaiting leader review |
| JR FORM FORWARD TO ENGINEERING MANAGER | Blue | Approved by leader, awaiting manager review |
| JR FORM FORWARD TO PROCUREMENT | Emerald | Approved by engineering, forwarded to procurement |
| JR FORM APPROVED BY PROCUREMENT | Teal | Final approval by procurement (completed) |

**Visual Indicators:**
- Colored dot matching status color
- Full status label in uppercase
- Color-coded for quick scanning

---

## Sales Department Exclusive Features

### Role-Based Visibility
Sales users see **only their own job requests** and those of their subordinates:

- **Regular Sales (TSA):** Only jobs they personally created
- **Territory Sales Manager (TSM):** Their jobs + jobs of their assigned TSAs
- **Sales Head/Manager:** Their jobs + jobs of all TSMs and TSAs under them

**Filtering Logic:**
- Searches by `createdBy` and `submittedBy` fields
- Matches against user's ReferenceID, user ID, and subordinate IDs
- Uses MongoDB Position field for hierarchy detection (TSM/TSA/Manager)

### Sales-Specific Dashboard Widgets

#### My Pipeline Widget
- **Icon:** Trending Up chart
- **Display:** Count of pending job requests
- **Context:** Shows your active job requests that are in the approval workflow
- **Calculation:** Jobs where you are the creator/submitter and status is not final

#### Help Widget
- **Icon:** Help circle
- **Purpose:** Quick access to system guide
- **Content:** Tips on creating jobs, searching, filtering, and priority toggling

### Permission Summary for Sales

| Action | Sales Department |
|--------|------------------|
| Create Job Requests | ✅ Yes |
| View Own Jobs | ✅ Yes |
| View Subordinate Jobs (TSM/Manager) | ✅ Yes |
| View All Jobs | ❌ No |
| Edit Job Details | ❌ No (view only after submission) |
| Toggle Priority | ✅ Yes (click priority badge) |
| Delete Jobs | ❌ No |
| Change Status | ❌ No (engineering/procurement only) |
| View Job Details | ✅ Yes |
| View Engineering Notes | ✅ Yes (read-only) |
| View Procurement Notes | ✅ Yes (read-only) |
| Edit Notes | ❌ No (engineering/procurement only) |
| Use Collaboration Hub | ✅ Yes |
| Send Chat Messages | ✅ Yes |
| View All Chat Messages | ✅ Yes |
| Send Private Messages | ✅ Yes |
| Upload Chat Images | ✅ Yes |
| Mark Messages as Resolved | ✅ Yes |
| Add Reactions | ✅ Yes |
| Reply to Messages | ✅ Yes |

---

## Job Request Workflow (From Sales Perspective)

```
SALES CREATES JOB
    ↓
Status: JR FORM FORWARD TO ENGINEERING
    ↓
[Engineering Review]
    ↓
Status: JR FORM FORWARD TO ENGINEERING LEADER
    ↓
[Leader Approval]
    ↓
Status: JR FORM FORWARD TO ENGINEERING MANAGER
    ↓
[Manager Approval]
    ↓
Status: JR FORM FORWARD TO PROCUREMENT
    ↓
[Procurement Review]
    ↓
Status: JR FORM APPROVED BY PROCUREMENT
    ↓
✅ COMPLETED
```

**Sales Role in Workflow:**
- **Initial creation only**
- **No approval authority** after submission
- **Can monitor progress** through status updates
- **Can adjust priority** if urgency changes
- **Cannot modify** job details after submission

---

## Navigation & Search

### Quick Search
- **Searches:** Project name, Job ID, Client name
- **Case-insensitive:** Matches regardless of capitalization
- **Real-time:** Updates as you type
- **Auto-resets page:** Returns to page 1 on search

### Pagination
- **Items per page:** 10
- **Navigation:** Previous/Next buttons with page indicator
- **Total count:** Shows total number of filtered jobs
- **Format:** "PAGE X / Y" with "Z JOBS TOTAL"

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Enter` | Move to next step (in wizard) |
| `Ctrl + Shift + M` | Toggle Test Mode (create page) |

---

## Important Notes for Sales

1. **Draft Auto-Save:** Form data automatically saved to localStorage every 1 second
2. **Draft Recovery:** Automatically loads saved draft on page return
3. **Draft Clear:** Draft cleared after successful submission
4. **Customer Database:** Access to cluster accounts for easy client selection
5. **Photo Uploads:** Only image files accepted (JPG, PNG, etc.)
6. **Unique Job Numbers:** System guarantees unique sequential numbers with concurrency protection
7. **Notifications:** Push notifications sent to TSM/Manager when you create a job
8. **Priority Changes:** Click priority badge to mark urgent jobs (red indicator)
9. **View-Only After Submission:** Cannot edit job details once submitted
10. **Hierarchy Support:** TSMs and Managers can view their team's job requests
11. **Collaboration Hub:** Real-time chat with engineering and procurement teams
12. **System Messages:** Automatic status updates posted in chat when job progresses
13. **Read-Only Notes:** Can view engineering and procurement notes but cannot edit them
14. **Photo Gallery:** View all uploaded job images with zoom functionality
15. **Progress Tracker:** Visual timeline showing approval stages
16. **SLA Timer:** 24-hour countdown timer on job detail page
17. **Private Messages:** Send sensitive information only to specific recipients
18. **Message Reactions:** Use emojis to respond to messages without typing
19. **Message Resolution:** Mark completed discussions as resolved
20. **Seen By Feature:** See who has read your messages in the chat

---

## Troubleshooting

### Common Issues

**Issue:** Can't see all job requests
- **Cause:** Sales users only see their own jobs (or team's if TSM/Manager)
- **Solution:** Contact IT or Manager if you need broader access

**Issue:** Job number has "TEST-" prefix
- **Cause:** Test mode was enabled when creating the job
- **Solution:** Disable test mode (click button or `Ctrl+Shift+M`) before creating production jobs

**Issue:** Can't upload photos
- **Cause:** Non-image file selected
- **Solution:** Only upload image files (JPG, PNG, etc.)

**Issue:** Form data lost
- **Cause:** Browser localStorage cleared
- **Solution:** Draft feature is convenience, not guaranteed backup

**Issue:** Can't change job status
- **Cause:** Sales users cannot approve jobs
- **Solution:** Contact Engineering or Procurement for status updates

**Issue:** Chat is read-only
- **Cause:** Job has been approved or finalized
- **Solution:** Chat becomes archive for completed projects

**Issue:** Can't see private messages
- **Cause:** You are not the sender or recipient of the private message
- **Solution:** Only senders, recipients, and IT can see private messages

**Issue:** Chat messages not sending
- **Cause:** Network connectivity issue or chat is disabled for this job
- **Solution:** Check internet connection or contact IT if issue persists

**Issue:** Unread count not updating
- **Cause:** Messages not marked as seen
- **Solution:** Scroll to bottom of chat or click scroll button to mark as read

---

## System Architecture & Database

The EngiConnect Job Request System uses a **hybrid database architecture** combining Supabase and Firebase for optimal performance and functionality.

### Database Overview

#### Supabase (PostgreSQL)
**Purpose:** User management, authentication, and role-based access control (RBAC)

**Collections/Tables:**
- **`users`** - User account information
  - Fields: `id`, `Email`, `Password` (hashed), `userName`, `Firstname`, `Lastname`, `ReferenceID`, `Department`, `Position`, `Role`, `TSM`, `Manager`, `profilePicture`, `signatureImage`
  - Used for: Authentication, user lookups, agent name resolution

- **`role_permissions`** - Role-based access control
  - Fields: `doc_id`, `department`, `role`, `services`, `nav`, `security`, `account`, `dashboard`, `is_dashboard_allowed`
  - Used for: Controlling what each department/role can access

- **`department_configs`** - Department configuration
  - Fields: `name`, `roles`, `color`, `deleted`
  - Used for: Department-specific settings and UI customization

**Supabase Usage in Job Request System:**
- **Agent Name Resolution:** When a job request shows an agent's ReferenceID, the system queries Supabase to fetch the full name (Firstname + Lastname)
- **"Seen By" User Resolution:** When displaying who has seen chat messages, the system queries Supabase to get user names/profiles for the user IDs stored in Firebase
- **User Authentication:** Login validation and session management
- **Role Detection:** Determining user department (SALES, ENGINEERING, PROCUREMENT, IT) and role (TSM, TSA, MANAGER, MEMBER)
- **Hierarchy Management:** Identifying TSM/Manager relationships for visibility rules
- **Signature Retrieval:** Fetching digital signatures for approval workflow

#### Firebase (Firestore)
**Purpose:** Real-time data storage, job requests, and collaboration

**Three Firebase Projects:**

1. **Main Project (db)**
   - **`job_requests`** - Job request documents
     - Fields: `jobRequestNo`, `projectTitle`, `location`, `agentName`, `projectName`, `scopeOfWork`, `priority`, `status`, `createdAt`, `updatedAt`, `attachments`, `memberNotes`, `leaderNotes`, `managerNotes`, `procurementNotes`, `approvedByEngineeringMember`, `approvedByEngineeringLeader`, `approvedByEngineeringManager`, `approvedByProcurement`, etc.
     - Used for: Storing all job request data and approval workflow

   - **`users`** - Firebase user collection (for push notifications)
     - Used for: Managing push notification tokens and messaging

   - **`job_fill_ups`** - Fill Up Form drafts
     - Fields: `values`, `boqSections`, `summary`, `procurement`, `createdBy`, `createdByName`, `createdAt`, `updatedAt`
     - Used for: Engineering's detailed form data before procurement

2. **Logs Project (logsDb)**
   - Used for: System logs and audit trails
   - Purpose: Separate logging to avoid cluttering main database

3. **Collab Project (dbCollab)**
   - **`job_requests_collab`** - Collaboration Hub chat messages
     - Document ID: Job request number (e.g., `TEST-JR-2026-0010`)
     - Fields: `messages`, `createdAt`, `updatedAt`
     - **All chat data stored here:** messages, reactions, replies, private messages, seenBy IDs, etc.
     - **Note:** User names for "Seen By" feature are fetched from Supabase using the user IDs stored in Firebase
     - Message structure:
       ```json
       {
         "id": "unique-id",
         "text": "message content",
         "senderId": "user-id",
         "senderName": "John Doe",
         "senderImage": "profile-picture-url",
         "role": "SALES",
         "time": "2026-10-19T10:30:00Z",
         "isResolved": false,
         "isSystem": false,
         "seenBy": ["user-id-1", "user-id-2"],
         "reactions": {"👍": ["user-id-1"], "❤️": ["user-id-2"]},
         "replyTo": {
           "text": "original message",
           "senderName": "Jane Smith",
           "originalMsgId": "msg-id"
         },
         "isPrivate": false,
         "privateRecipientId": "user-id",
         "privateRecipientName": "Jane Smith"
       }
       ```
   - **`typing_indicators`** - Real-time typing status
     - Document ID: `{jobRequestId}_{userId}`
     - Fields: `userName`, `updatedAt`
     - Used for: Showing "Someone is typing..." in chat

**Firebase Usage in Job Request System:**
- **Job Request Storage:** All job request data stored in real-time Firestore
- **Real-time Sync:** Live updates when job status changes
- **Collaboration Hub:** Chat messages stored in separate Firestore instance
- **Typing Indicators:** Real-time typing status updates
- **Push Notifications:** FCM for notifying users of status changes
- **Fill Up Forms:** Engineering's detailed form data drafts

### Data Flow Examples

#### Creating a Job Request (Sales User)
1. User fills form → Data prepared locally
2. User clicks Submit → Data saved to Firebase `job_requests` collection
3. Agent name from form → Stored as ReferenceID
4. Job number generated → Sequential number from Firebase counter
5. Initial status set → "JR FORM FORWARD TO ENGINEERING"
6. Push notification sent → FCM notifies TSM/Manager

#### Viewing Job Details
1. User clicks job → Firebase fetches job request document
2. Agent ReferenceID displayed → System queries Supabase for full name
3. Chat loads → Firebase Collab fetches messages for this job
4. Status changes → Firebase real-time listener updates UI
5. Notes displayed → Read from Firebase job request document

#### Sending Chat Message
1. User types message → Firebase Collab shows typing indicator
2. User clicks Send → Message saved to Firebase `job_requests_collab`
3. Real-time sync → All users see message instantly
4. Sound notification → Audio plays for recipients
5. Seen status → Firebase updates `seenBy` array

#### Resolving Agent Name
1. Job request shows `agentName: "AARON-UCHIHA-001"`
2. System calls `/api/user-by-reference?referenceid=AARON-UCHIHA-001`
3. API queries Supabase `users` table by `ReferenceID`
4. Supabase returns `{ Firstname: "Aaron", Lastname: "Uchiha", signatureImage: "..." }`
5. UI displays "Aaron Uchiha" instead of ReferenceID

#### Resolving "Seen By" User Names (Collaboration Hub)
1. Chat message has `seenBy: ["user-id-1", "user-id-2", "user-id-3"]` stored in Firebase
2. Collaboration Hub calls `/api/get-users-by-ids` with the user IDs
3. API queries Supabase `users` table by `id` field (using `.in()` for batch query)
4. Supabase returns user data for all IDs: `{ firstName, lastName, userName, profilePicture, department }`
5. Results cached in `userNamesMap` to avoid repeated API calls (memoization)
6. UI displays names/avatars when clicking the eye icon on messages

**Important Note:** The Collaboration Hub itself stores all chat data (messages, typing indicators, reactions, etc.) in **Firebase**, but when it needs to display WHO has seen a message, it queries **Supabase** to get the user names/profiles for those user IDs.

### Why This Hybrid Architecture?

**Supabase Advantages:**
- **PostgreSQL:** Robust relational database for user management
- **Built-in Auth:** Easy authentication and user management
- **RBAC:** Easy role-based access control implementation
- **Queries:** Complex queries for hierarchy and filtering
- **Foreign Keys:** Relational integrity for user-manager relationships

**Firebase Advantages:**
- **Real-time:** Instant updates without page refresh
- **Offline Support:** Works without internet connection
- **Scalability:** Handles high-volume real-time data
- **Chat:** Optimized for real-time messaging
- **Push Notifications:** Built-in FCM for notifications
- **Client SDK:** Easy integration with React/Next.js

**Combined Benefits:**
- **Best of Both Worlds:** Relational data (Supabase) + Real-time data (Firebase)
- **Performance:** Optimized queries for user lookups + instant sync for chat
- **Scalability:** Separate databases for different workloads
- **Security:** Supabase for auth + Firebase rules for data access
- **Flexibility:** Easy to add features from either platform

### Collections Summary

| Data Type | Database | Collection/Table | Purpose |
|-----------|----------|------------------|---------|
| User Accounts | Supabase | `users` | Authentication, profile, hierarchy, agent name resolution |
| Role Permissions | Supabase | `role_permissions` | RBAC configuration |
| Department Configs | Supabase | `department_configs` | Department settings |
| Job Requests | Firebase | `job_requests` | Main job data and workflow |
| Fill Up Forms | Firebase | `job_fill_ups` | Engineering form drafts |
| Chat Messages | Firebase | `job_requests_collab` | Collaboration Hub messages (all chat data) |
| Typing Indicators | Firebase | `typing_indicators` | Real-time typing status |
| Chat User Names | Supabase | `users` | Resolving user IDs in "Seen By" feature |
| System Logs | Firebase | `logsDb` | Audit trails and logs |
| Push Tokens | Firebase | `users` | FCM notification tokens |

### Collaboration Hub Architecture Summary

**Important Clarification:**

The Collaboration Hub is **100% Firebase-based** for all chat functionality. Supabase is only used for user name lookups.

**What's Stored in Firebase (dbCollab):**
- ✅ All chat messages
- ✅ Message reactions (👍 ❤️ 😊)
- ✅ Message replies (public and private)
- ✅ Message resolution status
- ✅ Typing indicators
- ✅ User IDs in `seenBy` arrays (e.g., `["user-id-1", "user-id-2"]`)

**What's Queried from Supabase:**
- ✅ User names for "Seen By" feature (only when displaying who has seen a message)
- ✅ User profile pictures for "Seen By" dialog
- ✅ User departments for "Seen By" dialog

**Why This Split?**
- **Firebase** is optimized for real-time chat with instant updates
- **Supabase** has the complete user database with profile information
- When the "Seen By" eye icon is clicked, the system takes the user IDs from Firebase and queries Supabase once to get the names/profiles
- Results are cached in `userNamesMap` to avoid repeated Supabase queries

**Data Flow for "Seen By":**
```
Firebase Chat Message
    ↓
seenBy: ["user-id-1", "user-id-2", "user-id-3"]
    ↓
User clicks eye icon
    ↓
Call /api/get-users-by-ids with IDs
    ↓
Supabase query: SELECT * FROM users WHERE id IN (...)
    ↓
Return: { firstName, lastName, userName, profilePicture, department }
    ↓
Cache in userNamesMap
    ↓
Display names/avatars in dialog
```

**Key Point:** The Collaboration Hub itself does NOT store or manage chat data in Supabase. It only uses Supabase as a user directory for looking up names when needed.

---

## Contact & Support

For technical issues or questions:
- **Department:** IT Department
- **System:** EngiConnect Job Request System
- **Version:** V3.0 (Productivity Enhanced)

---

*Last Updated: 2026-10-19*
*Document Version: 1.0*
