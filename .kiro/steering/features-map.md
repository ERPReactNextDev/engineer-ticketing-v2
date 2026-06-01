---
inclusion: auto
---

# DSI Connect — Features Map

Quick reference of what already exists so AI never duplicates or contradicts existing features.

## Existing Pages (Routes)

| Route | File | Status |
|-------|------|--------|
| `/` | `app/page.tsx` | Redirects to `/login` |
| `/login` | `app/login/page.tsx` | Login form with PIN + biometric |
| `/reset-password` | `app/reset-password/page.tsx` | Password reset |
| `/dashboard` | `app/dashboard/page.tsx` | Main dashboard (V4) |
| `/request/job` | `app/request/job/` | Job requests list + detail |
| `/request/dialux` | `app/request/dialux/` | DIAlux requests |
| `/request/shop-drawing` | `app/request/shop-drawing/` | Shop drawing requests |
| `/request/testing` | `app/request/testing/` | Testing tracker |
| `/request/product` | `app/request/product/` | SPF product requests |
| `/request/other` | `app/request/other/` | Misc requests |
| `/appointments/site-visit` | `app/appointments/site-visit/` | Site visit list |
| `/appointments/site-visit/add` | `app/appointments/site-visit/add/` | Add new visit |
| `/appointments/site-visit/add/schedule` | `app/appointments/site-visit/add/schedule/` | Schedule step |
| `/appointments/site-visit/[id]` | `app/appointments/site-visit/[id]/` | Visit detail |
| `/appointments/protocols` | `app/appointments/protocols/` | Protocols |
| `/appointments/slots` | `app/appointments/slots/` | Booking slots |
| `/messages` | `app/messages/page.tsx` | Collaboration hub |
| `/notifications` | `app/notifications/page.tsx` | Activity center |
| `/tracking` | `app/tracking/page.tsx` | Placeholder (empty) |
| `/account/profile` | `app/account/profile/page.tsx` | Profile editor |
| `/account/security` | `app/account/security/page.tsx` | Security settings |
| `/admin/staff` | `app/admin/staff/page.tsx` | Staff directory |
| `/admin/permissions` | `app/admin/permissions/page.tsx` | Role permissions |
| `/admin/assignment-matrix` | `app/admin/assignment-matrix/page.tsx` | PIC assignment |
| `/admin/booking_rules` | `app/admin/booking_rules/page.tsx` | Booking rules |
| `/admin/logs` | `app/admin/logs/page.tsx` | System logs |
| `/admin/notifications/subscriptions` | `app/admin/notifications/subscriptions/` | Push subscriptions |
| `/admin/protocols` | `app/admin/protocols/page.tsx` | Protocol management |
| `/admin/sounds` | `app/admin/sounds/page.tsx` | Notification sounds |
| `/admin/system-settings` | `app/admin/system-settings/page.tsx` | System config |
| `/settings/notifications` | `app/settings/notifications/` | User notification prefs |

## Existing Components

| Component | File | Purpose |
|-----------|------|---------|
| `AppSidebar` | `components/app-sidebar.tsx` | Main nav sidebar |
| `PageHeader` | `components/page-header.tsx` | Reusable page header |
| `ProtectedPageWrapper` | `components/protected-page-wrapper.tsx` | Auth guard |
| `ChatConversation` | `components/chat-conversation.tsx` | Message thread |
| `ChatMessageListItem` | `components/chat-message-list-item.tsx` | Message list item |
| `LoginForm` | `components/login-form.tsx` | Login with PIN/biometric |
| `NotificationBell` | `components/notification-bell.tsx` | Header bell |
| `NotificationPopup` | `components/notification-popup.tsx` | Notification popup |
| `NotificationSettings` | `components/notification-settings.tsx` | Notification prefs |
| `EnhancedNotifications` | `components/enhanced-notifications.tsx` | Full notification panel |
| `FloatingActionButton` | `components/floating-action-button.tsx` | FAB for quick actions |
| `DashboardGuide` | `components/dashboard-guide.tsx` | Dashboard help guide |
| `CollaborationHub` | `components/collaboration-hub.tsx` | Collab hub component |
| `GoogleSheetsSync` | `components/google-sheets-sync.tsx` | Sheets sync UI |
| `JobCounterAdmin` | `components/job-counter-admin.tsx` | Job counter admin |
| `SiteVisitCounterAdmin` | `components/site-visit-counter-admin.tsx` | Visit counter admin |
| `SlaTracker` | `components/sla-tracker.tsx` | SLA tracking |
| `SystemClock` | `components/system-clock.tsx` | Live clock |
| `TaskFilters` | `components/task-filters.tsx` | Task filter controls |
| `TeamAvailability` | `components/team-availability.tsx` | Team availability |
| `TeamPerformance` | `components/team-performance.tsx` | Performance metrics |
| `WorkflowPipeline` | `components/workflow-pipeline.tsx` | Workflow visualization |
| `WorkloadBalancer` | `components/workload-balancer.tsx` | Workload distribution |
| `QuickActions` | `components/quick-actions.tsx` | Quick action buttons |
| `KeyboardShortcuts` | `components/keyboard-shortcuts.tsx` | Keyboard shortcut help |
| `DepartmentWidgets` | `components/department-widgets.tsx` | Dept-specific widgets |
| `AppUserAccountsDeleteDialog` | `components/app-user-accounts-delete-dialog.tsx` | Delete account dialog |
| `ServiceModal` | `components/modals/service-modal.tsx` | Service request modal |
| `DrawingVisualizer` | `components/shop-drawing/DrawingVisualizer.tsx` | Drawing viewer |
| `WizardSteps` | `components/shop-drawing/WizardSteps.tsx` | Multi-step wizard |

## Existing Lib Utilities

| File | Exports | Use For |
|------|---------|---------|
| `lib/firebase.ts` | `db`, `messaging`, `app` | Firestore client access |
| `lib/firebase-admin.ts` | `adminDb`, `adminApp` | Server-side Firestore |
| `lib/MongoDB.ts` | `clientPromise` | MongoDB connection |
| `lib/utils.ts` | `cn()` | Tailwind class merging |
| `lib/time.ts` | Time utilities | Date/time formatting |
| `lib/notification-service.ts` | Notification helpers | Send notifications |
| `lib/notification-sounds.ts` | `playSound()` | Play audio alerts |
| `lib/push-subscription.ts` | Subscription manager | FCM token management |
| `lib/cloudinary.js` | Cloudinary config | File upload config |
| `lib/upload.ts` | `uploadFile()` | File upload helper |
| `lib/Session.ts` | Session utilities | Session management |
| `lib/job-request-counter.ts` | Counter utilities | Job count helpers |
| `lib/site-visit-counter.ts` | Counter utilities | Visit count helpers |

## Existing Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useDebounce` | `hooks/use-debounce.ts` | Debounce input values |
| `useMobile` | `hooks/use-mobile.ts` | Detect mobile viewport |
| `useDrawingStats` | `hooks/useDrawingStats.ts` | Shop drawing statistics |

## Existing Providers

| Provider | File | Provides |
|----------|------|---------|
| `NotificationProvider` | `providers/notification-provider.tsx` | Global notification context |

## Request Types & Their Firestore Collections

| Request Type | Collection | Status Values |
|-------------|-----------|--------------|
| Site Visit | `appointments` | PENDING, CONFIRMED, COMPLETED, CANCELLED, RESCHEDULED |
| Job Request | `job_requests` | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| Shop Drawing | `shop_drawing_requests` | PENDING_REVIEW, IN_PROGRESS, COMPLETED, CANCELLED |
| DIAlux | `dialux_requests` | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| Testing | `testing_tracker` | (custom, overdue = no releaseDate + past targetDate) |
| Product (SPF) | `spf_creations` | (custom) |
| Other | `other_requests` | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |

## Messages Page Collection IDs

The messages page (`/messages`) uses these exact collection IDs:
```typescript
const COLLECTIONS = [
  { id: "dialux_requests",       label: "DIALux" },
  { id: "job_requests",          label: "Job Requests" },
  { id: "shop_drawing_requests", label: "Shop Drawings" },
  { id: "appointments",          label: "Site Visits" },
  { id: "spf_creations",         label: "SPF Products" },
  { id: "other_requests",        label: "Others" },
]
```

## Environment Variables (Keys Only — Never Log Values)

```
MONGODB_URI
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_EMAIL
EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS
GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY / GOOGLE_SHEETS_SPREADSHEET_ID
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Known Placeholders / Incomplete Features

- `/tracking` — page exists but has no content (placeholder)
- `app/dashboard/page1.tsx` and `page2.tsx` — dashboard variants, not the main page
- `app/admin/filtering-config/page.tsx.backup` — backup file, not active
- `app/docs/` — empty folder inside app (docs are in `/docs/` at root instead)
- Profile page "Last Login" and "Total Requests" stats are hardcoded placeholders
- 2FA toggle exists in Security page but is UI-only (no backend implementation)
