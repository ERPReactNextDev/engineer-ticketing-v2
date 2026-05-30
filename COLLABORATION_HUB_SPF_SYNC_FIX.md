# Collaboration Hub SPF Number Sync Fix

## Problem
Ang collaboration chat ay hindi nag-sync across Espiron (disruptive-product-database) at Taskflow kasi:
- Ang URL ay gumagamit ng **offer ID** (e.g., `/request/product/3785`)
- Pero ang chat document ID ay dapat **SPF number** (e.g., `SPF-DSI-26-WAITTES12`)

## Solution

### 1. Updated Firebase Import
Changed from `db` to `dbCollab` to use the shared collaboration database:

```typescript
import { dbCollab } from "@/lib/firebase";
```

### 2. Updated Chat Sync Logic
Modified the `useEffect` hook to use the **SPF number** instead of the offer ID for chat syncing:

**Before:**
```typescript
const docRef = doc(db, "spf_creations", id); // Using offer ID ❌
```

**After:**
```typescript
const docRef = doc(dbCollab, "spf_creations", spfData.spf_number); // Using SPF number ✅
```

### 3. Key Changes
- **URL routing**: Still uses offer ID (`/request/product/3785`) for navigation
- **Chat syncing**: Uses SPF number (`SPF-DSI-26-WAITTES12`) as Firebase document ID
- **Database**: Uses `dbCollab` (shared collaboration database)

## How It Works

1. **User clicks row** → Navigates to `/request/product/[offer_id]`
2. **Page loads** → Fetches offer data using offer ID
3. **Chat initializes** → Uses `spfData.spf_number` as document ID
4. **Messages sync** → All three apps (engineer-ticketing, Taskflow, Espiron) use the same SPF number

## Benefits

✅ **URL stays clean**: Uses numeric offer ID for routing  
✅ **Chat syncs properly**: Uses SPF number for Firebase document  
✅ **Cross-app sync**: Works across all three applications  
✅ **No breaking changes**: Existing URLs still work  

## Testing

To verify the fix:
1. Open the same SPF in all three applications
2. Send a message from engineer-ticketing
3. Message should appear in Taskflow and Espiron in real-time
4. All reactions, replies, and seen status should sync

## Example

**SPF**: `SPF-DSI-26-WAITTES12`  
**Offer ID**: `3785`

- **URL**: `http://localhost:3000/request/product/3785`
- **Firebase Document**: `spf_creations/SPF-DSI-26-WAITTES12`
- **Syncs with**:
  - Taskflow: `spf_creations/SPF-DSI-26-WAITTES12`
  - Espiron: `spf_creations/SPF-DSI-26-WAITTES12`

## Date Fixed
May 30, 2026
