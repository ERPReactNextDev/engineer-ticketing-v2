# Google Sheets Sync Setup for Testing Tracker

## Overview
This integration allows the Testing Tracker to sync with Google Sheets, enabling the **Product Quality (PQ)** team to manage testing data collaboratively.

## Features
- **Import from Google Sheet**: Pull existing data from the shared Google Sheet into Firebase
- **Export to Google Sheet**: Push app data back to Google Sheets
- **Two-way Sync**: Keep both systems in sync
- **PQ Team Access**: Special permissions for Product Quality (PQ) team members

---

## Setup Instructions

### 1. Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Enable the **Google Sheets API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. Create a Service Account:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Name: `testing-tracker-sync`
   - Role: `Editor` (or create custom role with Sheets API access)
   - Click "Done"

5. Generate Credentials:
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Select JSON format
   - Download the JSON file (keep it secure!)

### 2. Share Google Sheet

1. Open the Google Sheet: `Packing List Testing_Shared`
2. Click "Share" button
3. Add the service account email (from the JSON file) as **Editor**
   - Email looks like: `testing-tracker-sync@your-project.iam.gserviceaccount.com`
4. Click "Share"

### 3. Configure Environment Variables

Add these to your `.env.local` file:

```env
# Firebase Admin (for server-side operations)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Key Here\n-----END PRIVATE KEY-----\n"

# Google Sheets API (can use same service account or separate)
GOOGLE_PROJECT_ID=your-google-project-id
GOOGLE_CLIENT_EMAIL=testing-tracker-sync@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Key Here\n-----END PRIVATE KEY-----\n"
```

**Note**: The private key must have `\n` characters escaped as `\\n` in the .env file, or the actual newlines preserved within quotes.

### 4. Install Dependencies

```bash
npm install googleapis firebase-admin
```

### 5. Update Sheet Structure

Ensure the Google Sheet has these columns (adjust in `route.ts` if different):

| Column | Header | Description |
|--------|--------|-------------|
| A | Ref ID | Auto-generated reference |
| B | Product Name | Product/item name |
| C | Shipment Code | Packing/shipment code |
| D | Qty | Quantity |
| E | Arrival Date | Date received for testing |
| F | Target Date | Target release date |
| G | Release Date | Actual release date |
| H | Status | AWAITING/TESTING/OVERDUE/RELEASED |
| I | Remarks | Notes/comments |
| J | Requested By | Person who requested |
| K | Last Updated | Sync timestamp |

---

## Product Quality (PQ) Team Access

### Who can access:
- Users with `Department: PQ` or `Department: QUALITY` (PQ = Product Quality)
- Users with `Role: PQ` (Product Quality role)
- Procurement, IT, Engineering departments
- Managers, Leaders, Super Admins

### Permissions for PQ Team:
- ✅ Add new testing entries
- ✅ Edit existing entries
- ✅ Sync with Google Sheets
- ✅ View all testing items (for quality control oversight)
- ✅ Export data for quality reports
- ✅ Track product testing status and release dates

### How to assign Product Quality (PQ) access:
1. In Firebase `users` collection, set:
   - `Department: "PQ"` (Product Quality department) or 
   - `Role: "PQ"` (Product Quality role)
2. Or in your user management system, assign the Product Quality (PQ) department

---

## Using the Sync Feature

### In the App:
1. Navigate to **Testing Tracker** page
2. Click the **"Google Sheets"** button in the header
3. Choose:
   - **Import from Sheet**: Pulls data from Google Sheet into the app
   - **Export to Google Sheet**: Pushes selected (or all) items to the sheet

### For Product Quality (PQ) Team:
1. Add items directly in the Google Sheet with proper format
2. Click "Import from Sheet" in the app to sync
3. App updates will automatically sync back (if configured)
4. Use the Testing Tracker to monitor product quality testing status and ensure timely releases

---

## Troubleshooting

### "Permission denied" error
- Ensure the service account email has Editor access to the Google Sheet
- Check that the Google Sheets API is enabled in Cloud Console

### "Invalid credentials" error
- Verify environment variables are set correctly
- Ensure private key is properly formatted (newlines as `\n` or actual newlines)

### Data not syncing
- Check the sheet name matches: `Packing List Testing`
- Verify column headers match expected format
- Check browser console for detailed error messages

### Items not appearing after import
- Refresh the Testing Tracker page
- Check if items are filtered out by status/priority filters
- Verify the user has appropriate role/department permissions

---

## Security Notes

- Keep service account credentials secure
- Never commit `.env.local` to version control
- Regularly rotate service account keys
- Limit sheet access to necessary users only

---

## API Endpoints

### GET `/api/testing/google-sheet-sync`
Imports data from Google Sheet to Firebase

### POST `/api/testing/google-sheet-sync`
Exports data from Firebase to Google Sheet
- Body: `{ "entryIds": ["id1", "id2"] }` (optional - exports all if empty)

### PUT `/api/testing/google-sheet-sync`
Syncs a single entry to Google Sheet
- Body: `{ "entry": { ...entryData } }`
