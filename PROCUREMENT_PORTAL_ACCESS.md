# Procurement Portal Access Control

## Access Levels

### **Full Access** (Can see all records)
Users in these departments can access **all** procurement records:
- **IT Department**
- **PROCUREMENT Department**

### **Limited Access** (Can see filtered records only)
Users in **ALL OTHER departments** (Sales, Engineering, Warehouse Operations, Admin) can only see:
- Records with status: `"Pending For Procurement"`
- Records with status: `"Approved By Procurement"`

Users cannot see records in other statuses like:
- Draft
- Approved for Engineering
- Rejected
- Completed
- etc.

## Code Implementation

**File**: `/app/request/product/page.tsx`

```typescript
const deptUpper = (department || "").toUpperCase()
const isIT = deptUpper === "IT"
const isProcurement = deptUpper === "PROCUREMENT"
const hasFullAccess = isIT || isProcurement

// Query logic:
if (!hasFullAccess) {
  // Non-IT/Procurement users only see these statuses
  query = query.or("status.eq.Pending For Procurement,status.eq.Approved By Procurement")
}
```

## Access Matrix

| Department | Full Access | Can See | Cannot See |
|-----------|-----------|---------|-----------|
| **IT** | ✅ Yes | ALL records | N/A |
| **PROCUREMENT** | ✅ Yes | ALL records | N/A |
| Sales | ❌ No | Pending For Procurement<br>Approved By Procurement | Draft, Rejected, etc. |
| Engineering | ❌ No | Pending For Procurement<br>Approved By Procurement | Draft, Rejected, etc. |
| Warehouse Operations | ❌ No | Pending For Procurement<br>Approved By Procurement | Draft, Rejected, etc. |
| Admin | ❌ No | Pending For Procurement<br>Approved By Procurement | Draft, Rejected, etc. |

## Features by Access Level

### **IT & PROCUREMENT (Full Access)**
- ✅ View all SPF records regardless of status
- ✅ See draft records
- ✅ See rejected records
- ✅ See all workflow stages
- ✅ Full visibility for reporting/auditing

### **Other Departments (Limited Access)**
- ✅ View only pending for costing records (can add/edit costing)
- ✅ View approved records (for reference)
- ❌ Cannot see rejected records
- ❌ Cannot see draft records
- ❌ Cannot see records in other workflow stages

## Related Features

### **Costing Management**
- Only visible on `"Pending For Procurement"` status records
- Users can see if items are "NEEDS_COSTING" (incomplete)
- Can mark costing as filled

### **Pagination & Sorting**
- Works consistently regardless of access level
- Uses filtered dataset specific to user's department

### **Real-time Updates**
- Supabase channels listen to all changes in `spf_creation` table
- Updates reflect immediately for authorized records only

## Page Location
- **URL**: `/request/product`
- **Route**: `app/request/product/page.tsx`

## Related Endpoints

### `/api/user?id=<userId>`
- Returns user profile including Department
- Used to determine access level

### Supabase Table: `spf_creation`
- **Columns**: spf_number, status, date_created, final_selling_cost, etc.
- **RLS Policy**: No row-level security (filtering done in application)

## Security Note
The access control is enforced at the **application level** (client-side filtering). For production deployment, consider implementing:
1. **Supabase RLS (Row Level Security)** for database-level protection
2. **API endpoint protection** to prevent direct Supabase queries
3. **Audit logging** of who views sensitive records

## Testing Access

### Test as IT User
```
Department: IT
Expected: Can see all SPF records
```

### Test as Procurement User
```
Department: PROCUREMENT
Expected: Can see all SPF records
```

### Test as Sales User
```
Department: SALES
Expected: Can see only "Pending For Procurement" and "Approved By Procurement" records
```

### Test as Engineering User
```
Department: ENGINEERING
Expected: Can see only "Pending For Procurement" and "Approved By Procurement" records
```
