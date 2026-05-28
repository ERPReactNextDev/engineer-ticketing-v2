# Private/Public Reply Mode Feature

## Overview
Successfully implemented the private/public reply mode feature in EngiConnect, allowing users to choose whether to reply to messages publicly (visible to everyone) or privately (visible only to sender, recipient, and IT department).

## What Was Added

### 1. **Reply Mode Dialog**
When replying to a message, users are presented with two options:
- **Reply Publicly** - Message visible to all participants
- **Reply Privately** - Message visible only to sender, recipient, and IT department

### 2. **Private Message Data Structure**
Messages now support private mode with additional fields:
```typescript
interface Message {
  // ... existing fields
  isPrivate?: boolean;
  privateRecipientId?: string;
  privateRecipientName?: string;
}
```

### 3. **Privacy Controls**
- **Visibility Logic**: Private messages are filtered based on user permissions
- **IT Department Override**: IT department can see all private messages
- **Sender/Recipient Access**: Only sender and recipient can see their private messages

### 4. **Visual Indicators**
- **Purple Badge**: Private messages display a purple "Private to [Name]" badge
- **Lock Icon**: Lock icon appears on private message indicator

## How It Works

### User Flow:

1. **User types a reply** to an existing message
2. **User clicks Send** or presses Enter
3. **Dialog appears** with two options:
   - Reply Publicly (Blue button)
   - Reply Privately (Purple button with lock icon)
4. **User selects mode** and message is sent accordingly

### Without Reply Context:
- If user is not replying to a message, send button works normally (public message)
- Dialog only appears when replying to an existing message

## Privacy Rules

### Who Can See Private Messages:

✅ **Message Sender** - Can always see their own private messages
✅ **Message Recipient** - Can see private messages sent to them
✅ **IT Department** - Can see all private messages (for moderation/support)
❌ **Other Users** - Cannot see private messages not intended for them

### Example Scenarios:

**Scenario 1: Engineer to Procurement**
- Engineer sends private reply to Procurement
- Only Engineer, Procurement, and IT can see it
- Other engineers cannot see the message

**Scenario 2: IT Department**
- IT can see all messages (public and private)
- Useful for support and moderation

**Scenario 3: Public Reply**
- All participants can see the message
- Standard behavior for team communication

## Visual Design

### Reply Dialog (Inside Chat Interface):
The dialog now appears INSIDE the collaboration hub popover, not as a separate overlay:

```
┌─────────────────────────────────────┐
│ EngiConnect          [Search] [-]   │
├─────────────────────────────────────┤
│                                     │
│  [Messages displayed here]          │
│                                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Reply to Message            [X] │ │
│ ├─────────────────────────────────┤ │
│ │ ┃ Ron Ron                       │ │
│ │ ┃ "hoy"                         │ │
│ ├─────────────────────────────────┤ │
│ │ ┌───────────────────────────┐   │ │
│ │ │   Reply Publicly          │   │ │ (Blue)
│ │ └───────────────────────────┘   │ │
│ │ ┌───────────────────────────┐   │ │
│ │ │ 🔒 Reply Privately        │   │ │ (Purple)
│ │ └───────────────────────────┘   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Image] [Type message...] [Send]    │
└─────────────────────────────────────┘
```

The dialog slides up from the bottom within the chat interface, maintaining context and keeping the user focused on the conversation.

### Private Message Badge:
```
┌──────────────────────────────┐
│ 🔒 Private to John Doe       │ (Purple badge)
│ Your private message here... │
│ 10:30 AM 👁 2                │
└──────────────────────────────┘
```

## Technical Implementation

### Key Features:

**1. Integrated Dialog**
- Dialog appears INSIDE the collaboration hub popover
- Uses `animate-in slide-in-from-bottom-2` for smooth animation
- Positioned above the input area, below messages
- No separate overlay - maintains chat context

**2. sendChat(isPrivate, recipientId, recipientName)**
- Accepts optional parameters for private messages
- Adds private fields to message object when isPrivate=true

**2. canSeePrivateMessage(msg)**
- Filters messages based on privacy rules
- Checks sender, recipient, and department permissions

**3. filteredMessages**
- Applies privacy filter before displaying messages
- Ensures users only see messages they're authorized to view

### State Management:
```typescript
const [showReplyDialog, setShowReplyDialog] = useState(false);
const [replyingTo, setReplyingTo] = useState<Message | null>(null);
```

### Send Button Logic:
```typescript
onClick={() => {
  if (replyingTo && chatMessage.trim()) {
    setShowReplyDialog(true);  // Show dialog
  } else {
    sendChat();  // Send normally
  }
}}
```

## Benefits

✅ **Privacy** - Sensitive information can be shared privately
✅ **Flexibility** - Users choose communication mode per message
✅ **Transparency** - Clear visual indicators for private messages
✅ **Control** - IT department maintains oversight
✅ **User-Friendly** - Simple, intuitive interface

## Use Cases

### 1. **Sensitive Information**
- Sharing passwords or credentials
- Discussing personnel matters
- Financial information

### 2. **Direct Communication**
- Quick question to specific person
- Follow-up on previous discussion
- Clarification requests

### 3. **Department-Specific**
- IT support conversations
- Procurement negotiations
- Management decisions

## Keyboard Shortcuts

- **Enter** (when replying): Opens reply mode dialog
- **Shift + Enter**: New line in message (doesn't trigger send)
- **Esc** (in dialog): Close dialog and cancel

## Future Enhancements (Optional)

- [ ] Private message encryption
- [ ] Read receipts for private messages
- [ ] Private message expiration
- [ ] Audit log for private messages
- [ ] Configurable department permissions
- [ ] Private message notifications
- [ ] Reply to private messages (maintain privacy)
- [ ] Swipe gestures for mobile reply mode selection

## Design Notes

- Dialog is embedded within the chat interface (not a separate modal)
- Uses Tailwind's `animate-in slide-in-from-bottom-2` for smooth entry
- Border and shadow styling matches the chat aesthetic
- Compact design to fit within the chat popover
- Dialog z-index managed within the popover context
- Maintains all chat functionality while dialog is open

## Notes

- Private messages are stored in the same Firestore collection
- Filtering happens client-side for performance
- IT department check uses `userDepartment` prop
- Dialog z-index is 200 to appear above chat popover (z-index 100)
- Private messages maintain all other features (reactions, resolve, seen by)
