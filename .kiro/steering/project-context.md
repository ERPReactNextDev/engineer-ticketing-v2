---
inclusion: auto
---

# DSI Connect — Project Context

This is the **DSI Connect** internal enterprise platform for **Disruptive Solutions Inc.**
Always refer to this context before making any code changes, adding features, or fixing bugs.

## What This App Is

A full-stack Next.js 16 web app (also a PWA) that manages workflows between Sales, Engineering, and Management teams. It handles service requests, appointments, real-time collaboration, staff management, and push notifications.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui + Radix UI |
| Icons | Lucide React |
| Animations | Framer Motion |
| Real-time DB | Firebase Firestore (client SDK + Admin SDK) |
| User/HR DB | MongoDB Atlas |
| Auth | Custom (bcrypt + localStorage sessions — NO NextAuth) |
| File Storage | Cloudinary (unsigned upload preset: `"Xchire"`, cloud: `dhczsyzcz`) |
| Push Notifications | Firebase FCM + web-push library |
| Toast Notifications | Sonner |
| PDF Export | jsPDF + jspdf-autotable |
| Maps | Leaflet + react-leaflet |
| PWA | next-pwa (Workbox) |
| Deployment | Netlify (netlify.toml present) or Vercel |

## Critical Architecture Rules

1. **Dual database** — MongoDB stores HR/user data; Firestore stores ALL operational/real-time data (requests, messages, assignments, permissions). Never mix these up.
2. **No server-side sessions** — Auth is stored in `localStorage`. Keys: `userId`, `userName`, `userDepartment`, `userRole`, `userEmail`.
3. **Two API router systems** — `/pages/api/` (Pages Router, legacy) handles auth and user CRUD. `/app/api/` (App Router) handles admin counters, push, and system config.
4. **Real-time via onSnapshot** — Never use polling. Always use Firestore `onSnapshot` for live data and always clean up with the returned unsubscribe function.
5. **Permissions from Firestore** — Role permissions are stored in `role_permissions/{DEPT}_{ROLE}` collection. Always check this before showing/hiding features.

## Project Structure (Key Paths)

```
app/                    # Next.js App Router pages
pages/api/              # Legacy API routes (auth, user CRUD)
app/api/                # App Router API routes
components/             # Shared React components
components/ui/          # shadcn/ui base components
lib/                    # Firebase, MongoDB, utilities
lib/firebase.ts         # Firebase CLIENT SDK init
lib/firebase-admin.ts   # Firebase ADMIN SDK (server only)
lib/MongoDB.ts          # MongoDB connection singleton
lib/utils.ts            # cn() utility
hooks/                  # Custom React hooks
providers/              # React context providers
utils/supabase.ts       # Supabase client
public/                 # Static assets, PWA manifest, sounds
docs/                   # Full project documentation
```

## Page Layout Pattern

Every authenticated page MUST follow this exact structure:

```tsx
"use client"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"

export default function MyPage() {
  const [userId, setUserId] = React.useState<string | null>(null)
  React.useEffect(() => { setUserId(localStorage.getItem("userId")) }, [])

  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F4F7F7] min-h-screen font-sans">
          <PageHeader title="PAGE TITLE" version="V1.0" showBackButton={true}
            trigger={<SidebarTrigger className="mr-2" />}
          />
          <main className="p-4 md:p-8 max-w-5xl mx-auto w-full">
            {/* content */}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}
```

## Styling Conventions

- **Page background:** `bg-[#F4F7F7]` or `bg-[#F8FAFC]`
- **Brand/accent color:** `#E33636` (DSI red)
- **Card radius:** `rounded-2xl` (16px) or `rounded-[24px]` (24px)
- **Section labels:** ALL CAPS + `font-black` + `tracking-widest` + `text-[10px]`
- **Headings:** `font-black uppercase tracking-tight`
- **Conditional classes:** Always use `cn()` from `@/lib/utils`
- **Shadows:** `shadow-sm` default, `hover:shadow-md` on interactive cards
- **Borders:** `border border-zinc-200/60` or `border border-gray-100`

## Firestore Collections Reference

| Collection | Purpose | Key Fields |
|-----------|---------|-----------|
| `users` | Security/access per user | `isActive`, `Role`, `email` |
| `appointments` | Site visits | `status`, `submittedBy`, `scheduledDate`, `messages[]` |
| `job_requests` | Job orders | `status`, `submittedBy`, `assignedTo`, `messages[]` |
| `shop_drawing_requests` | Shop drawings | `status`, `department: "ENGINEERING"`, `messages[]` |
| `dialux_requests` | DIAlux simulations | `status`, `submittedBy`, `messages[]` |
| `testing_tracker` | Testing items | `targetDate`, `releaseDate`, `assignedTo` |
| `other_requests` | Misc requests | `status`, `submittedBy`, `messages[]` |
| `spf_creations` | SPF products | `status`, `submittedBy`, `messages[]` |
| `role_permissions` | Permission config | Doc ID = `{DEPT}_{ROLE}` |
| `pic_assignments` | Manager→Engineer map | Doc ID = manager's MongoDB `_id` |
| `push_subscriptions` | FCM tokens | `userId`, `token` |

## MongoDB `users` Collection Key Fields

```
_id, Firstname, Lastname, Email, Password (bcrypt),
Department, Position, Role, Company, Status,
ReferenceID, profilePicture, signatureImage,
TSM, TSMName, Manager, ManagerName, ContactNumber, Address
```

## Role Hierarchy

```
SUPER ADMIN > MANAGER/SALES HEAD > TSM > LEADER > MEMBER/TSA
```

IT and Engineering departments have **global access** to all data regardless of role.

## Data Visibility Rules (CRITICAL)

```
IT dept / Engineering dept / SUPER ADMIN / MANAGER / LEADER
  → Can see ALL requests from ALL users

TSM (Territory Sales Manager)
  → Own requests + subordinates' requests
  → Subordinates matched via TSM/TSMName fields in MongoDB

MEMBER / TSA
  → ONLY their own submitted requests
```

## Common Firestore Patterns

```typescript
// Real-time listener (always clean up)
useEffect(() => {
  if (!db || !userId) return
  const unsub = onSnapshot(
    query(collection(db, "job_requests"), where("submittedBy", "==", userId)),
    snap => setData(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
  return () => unsub()
}, [userId])

// Load permissions
const docId = `${dept.toUpperCase()}_${role.toUpperCase()}`
const unsub = onSnapshot(collection(db, "role_permissions"), snap => {
  const perms = snap.docs.find(d => d.id === docId)?.data()
  if (perms) setPermissions(perms)
})
```

## API Routes Summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/login` | POST | Authenticate user |
| `/api/user?id=` | GET | Get single user |
| `/api/user` | GET | Get all users |
| `/api/profile-update` | POST | Update profile |
| `/api/request-reset-password` | POST | Send reset email |
| `/api/check-session` | GET | Validate session |
| `/api/UserManagement/Fetch` | GET | All staff for admin |
| `/api/staff` | GET | Staff list (App Router) |
| `/api/system-config` | GET | System config / CSP |
| `/api/send-push` | POST | Send push notification |
| `/api/admin/job-counter` | GET | Pending job count |
| `/api/admin/site-visit-counter` | GET | Pending visit count |

## File Upload Pattern

```typescript
// Direct browser → Cloudinary (no server needed)
const formData = new FormData()
formData.append("file", file)
formData.append("upload_preset", "Xchire")
const res = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload", {
  method: "POST", body: formData
})
const { secure_url } = await res.json()
```

## Full Documentation

Detailed docs are in the `/docs/` folder:
- `docs/DEVELOPER_GUIDE.md` — Architecture, setup, patterns, troubleshooting
- `docs/USER_GUIDE.md` — End-user feature guide
- `docs/ADMIN_GUIDE.md` — Admin operations guide
- `docs/API_REFERENCE.md` — All API endpoints
- `docs/DATA_MODELS.md` — All TypeScript interfaces and schemas
- `docs/ROLES_AND_PERMISSIONS.md` — Role hierarchy and permission matrix
- `docs/DEPLOYMENT.md` — Build and deployment instructions
