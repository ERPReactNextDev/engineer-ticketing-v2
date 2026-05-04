# Site Visit Workflow Process

## Overview
This document outlines the complete lifecycle of a Site Visit request within the Engineer Ticketing system.

---

## Status Lifecycle

```
[PENDING] → [CONFIRMED] → [COMPLETED]
     ↓
[CANCELLED] (alternative terminal state)
```

---

## Step-by-Step Process Flow

### 1. Request Creation

| Aspect | Details |
|--------|---------|
| **Trigger** | User submits new site visit request |
| **Status** | `PENDING` |
| **Database Fields** | `createdAt` (timestamp), `siteVisitNo` (reference ID) |
| **Reference ID Format** | `PS-YYYY-NNN` (e.g., PS-2026-044) |

**UI Behavior:**
- Request appears in site visit list
- Status badge shows "Pending Engagement"
- Timeline shows: "Created" step marked as "done"

---

### 2. PIC Assignment

| Aspect | Details |
|--------|---------|
| **Status** | `PENDING` |
| **Who Can Assign** | Users with `canAssignPersonnel` permission (Engineering dept, Sales Management) |
| **Prerequisite** | No PIC assigned yet (`pic` is empty or "UNASSIGNED") |

**Actions:**
1. Select one or more engineers from available PICs list
2. Click "Confirm Assignment" (or "Confirm Multiple Assignment")

**Database Fields Updated:**
- `pic` - Assigned engineer name(s)
- `assignedAt` - Timestamp of assignment
- `assignedBy` - Name of user who made assignment
- `assignedById` - ID of user who made assignment
- `updatedAt` - General update timestamp

---

### 3. Visit Confirmation (Engineer Action)

| Aspect | Details |
|--------|---------|
| **Status** | `PENDING` (awaiting confirmation) |
| **Who** | Assigned PIC (engineer) |
| **UI Section** | "Visit Confirmation" (dark-themed action card) |

**Prerequisites:**
- PIC must be assigned (`pic` field populated)
- Status must be `PENDING`

**UI Elements:**
- **PIC Assignment Info:** Shows who assigned and when (e.g., "Assigned: John Doe • Apr 20, 04:57 PM")
- **Contact Actions:**
  - Viber chat button (opens `viber://chat?number=...`)
  - Copy phone number button
- **Confirmation Notes:** Textarea for engineer to enter visit findings
- **Submit Button:** "Confirm Visit Complete"

**Database Fields Updated on Submit:**
- `status` → `CONFIRMED`
- `confirmedAt` - Timestamp
- `confirmedBy` - Engineer name
- `confirmationNotes` - Text entered by engineer

---

### 4. Manager Review & Finalization

| Aspect | Details |
|--------|---------|
| **Status** | `CONFIRMED` (awaiting approval) |
| **Who** | Sales/Manager (`isSales` role) |
| **UI Section** | "Manager Review" |

**UI Elements:**
- Engineer's confirmation notes displayed in read-only format
- "Approve & Finalize" button

**Database Fields Updated on Approval:**
- `status` → `COMPLETED`
- `completedAt` - Timestamp
- `completedBy` - Manager name

**Result:** Request is archived and available for reporting.

---

### 5. Cancellation (Alternative Flow)

| Aspect | Details |
|--------|---------|
| **Available When** | Status is `PENDING` only |
| **Who Can Cancel** | Original requestor, Sales team, or Staff |
| **UI Section** | "Cancel / Decline Request" |

**Process:**
1. Click "Cancel / Decline Request" button
2. Enter cancellation reason (required)
3. Click "Confirm Cancel"

**Database Fields Updated:**
- `status` → `CANCELLED`
- `cancelledAt` - Timestamp
- `cancelledBy` - User who cancelled
- `cancellationReason` - Reason text

---

## Timeline Display (Activity Panel)

The activity timeline shows the progression through the workflow:

| Step | Label | Description | Department Responsibility |
|------|-------|-------------|---------------------------|
| 1 | **Created** | "Pending Request submitted" | - |
| 2 | **In Progress** | When PENDING: "Engineer to submit report"<br>When CONFIRMED: "Request Completed - awaiting approval" | PENDING: ENGINEERING<br>CONFIRMED: SALES MGMT |
| 3 | **Acknowledged** | "Request Acknowledge - completed" | - |

---

## Status Colors & Labels

| Status | Color | Display Label |
|--------|-------|---------------|
| `PENDING` | Amber/Yellow | "Pending Engagement" |
| `CONFIRMED` | Blue | "Confirmed Visit" |
| `COMPLETED` | Emerald/Green | "Visit Completed" |
| `CANCELLED` | Red | "Cancelled" |

---

## Permission Matrix

| Action | Engineering | Sales/Mgmt | Requestor | Staff |
|--------|-------------|------------|-----------|-------|
| Create Request | ✓ | ✓ | ✓ | ✓ |
| Assign PIC | ✓ | ✓ | ✗ | ✗ |
| Submit Confirmation | ✓ | ✗ | ✗ | ✗ |
| Approve & Finalize | ✗ | ✓ | ✗ | ✗ |
| Cancel Request | ✗ | ✓ | ✓ | ✓ |

---

## SLA Tracking

| Status | SLA Timer | Description |
|--------|-----------|-------------|
| `PENDING` | "Visit" timer | Time until engineer must complete visit |
| `CONFIRMED` | "Appr" (Approval) timer | Time until manager must approve |

**Overdue Indicators:**
- Red color coding when SLA is exceeded
- Countdown timer in HH:MM:SS format

---

## Implementation Notes

- All timestamps use `serverTimestamp()` for consistency
- Status transitions are logged with actor information for audit trail
- The workflow prevents skipping steps (e.g., cannot approve before confirmation)
- UI components conditionally render based on status and user permissions
