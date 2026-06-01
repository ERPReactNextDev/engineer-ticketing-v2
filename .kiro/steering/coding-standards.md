---
inclusion: auto
---

# DSI Connect — Coding Standards

Always follow these standards when writing or modifying code in this project.

## Component Rules

### Imports Order
```tsx
"use client"

// 1. React
import * as React from "react"
import { useEffect, useState } from "react"

// 2. Next.js
import { useRouter } from "next/navigation"
import Image from "next/image"

// 3. Third-party
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// 4. Firebase
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, where } from "firebase/firestore"

// 5. UI components (shadcn)
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// 6. Local components
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeader } from "@/components/page-header"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
```

### State Declaration Order
```tsx
// 1. User/session state first
const [userId, setUserId] = React.useState<string | null>(null)
const [userRole, setUserRole] = React.useState<string>("")
const [userDept, setUserDept] = React.useState<string>("")

// 2. Loading states
const [loading, setLoading] = React.useState(true)
const [saving, setSaving] = React.useState(false)

// 3. Data states
const [items, setItems] = React.useState<any[]>([])

// 4. UI states
const [searchTerm, setSearchTerm] = React.useState("")
const [selectedItem, setSelectedItem] = React.useState<any | null>(null)
```

### useEffect Order
```tsx
// 1. Session/userId init (always first)
React.useEffect(() => {
  setUserId(localStorage.getItem("userId"))
  setUserRole(localStorage.getItem("userRole") || "MEMBER")
  setUserDept(localStorage.getItem("userDepartment") || "")
}, [])

// 2. Data fetching (depends on userId)
React.useEffect(() => {
  if (!userId) return
  // fetch data...
}, [userId])

// 3. Firestore subscriptions (depends on userId)
React.useEffect(() => {
  if (!db || !userId) return
  const unsub = onSnapshot(...)
  return () => unsub()
}, [userId])
```

## Styling Rules

### Card Component Pattern
```tsx
// Standard card
<div className="bg-white rounded-2xl border border-zinc-200/60 p-6 shadow-sm hover:shadow-md transition-all">
  {/* content */}
</div>

// Larger card with more padding
<div className="bg-white rounded-[24px] border border-zinc-200/60 p-8 shadow-sm">
  {/* content */}
</div>

// Interactive/clickable card
<button className="bg-white rounded-2xl border border-zinc-200/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all text-left w-full">
  {/* content */}
</button>
```

### Section Header Pattern
```tsx
<div className="flex items-center gap-3 mb-6">
  <div className="p-2 bg-zinc-900 text-white rounded-[8px]">
    <IconName className="size-4" />
  </div>
  <h3 className="font-black text-[10px] uppercase tracking-widest">Section Title</h3>
</div>
```

### Label Pattern
```tsx
<Label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
  Field Label
</Label>
```

### Status Badge Pattern
```tsx
// Pending
<span className="px-2 py-1 bg-amber-50 text-amber-600 text-[9px] font-black rounded-lg uppercase tracking-wider border border-amber-100">
  PENDING
</span>

// Active/Success
<span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-lg uppercase tracking-wider border border-emerald-100">
  ACTIVE
</span>

// Error/Critical
<span className="px-2 py-1 bg-red-50 text-[#E33636] text-[9px] font-black rounded-lg uppercase tracking-wider border border-red-100">
  OVERDUE
</span>
```

### Loading Skeleton Pattern
```tsx
{loading ? (
  <div className="h-4 w-32 bg-gray-100 rounded-full animate-pulse" />
) : (
  <span className="text-sm font-bold">{value}</span>
)}
```

### Empty State Pattern
```tsx
<div className="py-20 flex flex-col items-center justify-center">
  <div className="size-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-zinc-100">
    <IconName size={32} className="text-zinc-200" />
  </div>
  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">
    No items found
  </p>
</div>
```

## Firestore Rules

### Always Clean Up Subscriptions
```typescript
// CORRECT
useEffect(() => {
  const unsub = onSnapshot(collection(db, "items"), snap => { ... })
  return () => unsub()  // ← REQUIRED
}, [])

// WRONG — memory leak
useEffect(() => {
  onSnapshot(collection(db, "items"), snap => { ... })  // no cleanup!
}, [])
```

### Multiple Subscriptions
```typescript
useEffect(() => {
  if (!db || !userId) return
  const unsubscribes = [
    onSnapshot(query1, handler1),
    onSnapshot(query2, handler2),
  ]
  return () => unsubscribes.forEach(unsub => unsub())
}, [userId])
```

### Optimistic Updates
```typescript
const handleUpdate = async (id: string, newValue: any) => {
  const previous = items  // save for rollback
  setItems(prev => prev.map(i => i.id === id ? { ...i, ...newValue } : i))  // optimistic
  try {
    await updateDoc(doc(db, "collection", id), newValue)
    toast.success("Updated successfully")
  } catch {
    setItems(previous)  // rollback
    toast.error("Update failed")
  }
}
```

## Error Handling

### API Calls
```typescript
try {
  const res = await fetch("/api/endpoint", { method: "POST", ... })
  if (!res.ok) {
    const err = await res.json()
    toast.error(err.error || "Something went wrong")
    return
  }
  const data = await res.json()
  // handle success
} catch (error) {
  toast.error("Connection error. Please try again.")
} finally {
  setLoading(false)
}
```

### Firestore Writes
```typescript
try {
  await setDoc(doc(db, "collection", id), data)
  toast.success("Saved successfully")
} catch (err) {
  console.error("Firestore write error:", err)
  toast.error("Failed to save. Check your connection.")
}
```

## TypeScript Rules

- Use `any` only when the Firestore document shape is truly unknown
- Prefer `interface` over `type` for object shapes
- Always type `useState` when the initial value is `null`: `useState<string | null>(null)`
- Use `React.useState` and `React.useEffect` (not destructured imports) in page components for consistency with the existing codebase

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Page files | `page.tsx` | `app/request/job/page.tsx` |
| Component files | `kebab-case.tsx` | `job-request-card.tsx` |
| Utility files | `kebab-case.ts` | `notification-service.ts` |
| Variables | `camelCase` | `userId`, `jobRequests` |
| Constants | `UPPER_SNAKE` | `ITEMS_PER_PAGE` |
| Types/Interfaces | `PascalCase` | `JobRequest`, `UserPermissions` |
| Firestore collection names | `snake_case` | `job_requests`, `pic_assignments` |

## Do Not

- ❌ Do NOT use `useContext` or Redux — no global state library
- ❌ Do NOT use `getServerSideProps` or `getStaticProps` — this is App Router
- ❌ Do NOT fetch data in `layout.tsx` — only in `page.tsx` or client components
- ❌ Do NOT store sensitive data in Firestore client-side without security rules
- ❌ Do NOT use `window.location.href` for navigation — use `useRouter().push()`
- ❌ Do NOT create new UI component libraries — use existing shadcn/ui components
- ❌ Do NOT add new npm packages without checking if the functionality already exists in the project
- ❌ Do NOT use `&&` for conditional rendering when the left side could be `0` — use ternary or explicit boolean check
