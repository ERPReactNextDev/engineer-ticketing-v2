import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/firebase-admin";

// Google Sheets API configuration
const SPREADSHEET_ID = "1bR_3xvyc_S5QrZX941wu-Avy5KTxDWlq83ze28voWpw";
const SHEET_NAME = "Packing List Testing"; // Adjust based on actual sheet name

// Initialize Google Sheets API with service account
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

/**
 * GET - Import data from Google Sheet to Firebase
 */
export async function GET(req: NextRequest) {
  try {
    // Fetch data from Google Sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`, // Adjust range as needed
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, message: "No data found in sheet" }, { status: 404 });
    }

    // Assume first row is headers
    const headers = rows[0].map((h: string) => h.toString().toLowerCase().replace(/\s+/g, ""));
    const dataRows = rows.slice(1);

    // Map column indices
    const getIndex = (name: string) => headers.findIndex((h: string) => h.includes(name.toLowerCase()));
    
    const colIndices = {
      refNo: getIndex("ref"),
      productName: getIndex("product"),
      shipmentCode: getIndex("shipment") !== -1 ? getIndex("shipment") : getIndex("packing"),
      quantity: getIndex("qty") !== -1 ? getIndex("qty") : getIndex("quantity"),
      arrivalDate: getIndex("arrival"),
      targetDate: getIndex("target") !== -1 ? getIndex("target") : getIndex("released"),
      releaseDate: getIndex("release"),
      status: getIndex("status"),
      remarks: getIndex("remarks") !== -1 ? getIndex("remarks") : getIndex("notes"),
      requestedBy: getIndex("requested") !== -1 ? getIndex("requested") : getIndex("by"),
    };

    // Process and import to Firebase
    const batch = db.batch();
    const testingCollection = db.collection("testing_tracker");
    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const row of dataRows as (string | undefined)[][]) {
      try {
        // Skip empty rows
        if (!row?.[colIndices.productName] && !row?.[colIndices.shipmentCode]) {
          results.skipped++;
          continue;
        }

        // Parse dates
        const parseDate = (val: string) => {
          if (!val) return null;
          const date = new Date(val);
          return isNaN(date.getTime()) ? null : date;
        };

        const arrivalDate = parseDate(row[colIndices.arrivalDate] ?? "");
        const targetDate = parseDate(row[colIndices.targetDate] ?? "");
        const releaseDate = parseDate(row[colIndices.releaseDate] ?? "");

        // Determine status
        let autoStatus: string;
        const today = new Date();
        if (releaseDate) {
          autoStatus = "RELEASED";
        } else if (targetDate && targetDate < today) {
          autoStatus = "OVERDUE";
        } else if (arrivalDate) {
          autoStatus = "TESTING";
        } else {
          autoStatus = "AWAITING";
        }

        // Create document data
        const docData = {
          productName: row[colIndices.productName] || "Untitled",
          shipmentCode: row[colIndices.shipmentCode] || "",
          quantity: parseInt(row[colIndices.quantity] ?? "0") || 0,
          arrivalDate: arrivalDate ? new Date(arrivalDate) : null,
          targetDate: targetDate ? new Date(targetDate) : null,
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          autoStatus,
          remarks: row[colIndices.remarks] || "",
          requestedBy: row[colIndices.requestedBy] || "PQ Team",
          source: "google_sheet",
          sheetRef: row[colIndices.refNo] || "",
          createdAt: new Date(),
          updatedAt: new Date(),
          syncedAt: new Date(),
        };

        // Check if already exists by shipment code or ref
        const existingQuery = await testingCollection
          .where("shipmentCode", "==", docData.shipmentCode)
          .where("productName", "==", docData.productName)
          .limit(1)
          .get();

        if (existingQuery.empty) {
          const newDoc = testingCollection.doc();
          batch.set(newDoc, docData);
          results.imported++;
        } else {
          // Update existing
          const existingDoc = existingQuery.docs[0];
          batch.update(existingDoc.ref, {
            ...docData,
            createdAt: existingDoc.data().createdAt, // Preserve original creation date
          });
          results.imported++;
        }
      } catch (rowError) {
        results.errors.push(`Row error: ${(rowError as Error).message}`);
      }
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Imported ${results.imported} items, skipped ${results.skipped}`,
      details: results,
    });
  } catch (error) {
    console.error("Google Sheet Import Error:", error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST - Export data from Firebase to Google Sheet
 */
export async function POST(req: NextRequest) {
  try {
    const { entryIds } = await req.json();
    
    // Fetch entries from Firebase
    let entries: any[] = [];
    if (entryIds && entryIds.length > 0) {
      const snapshots = await Promise.all(
        entryIds.map((id: string) => db.collection("testing_tracker").doc(id).get())
      );
      entries = snapshots.filter(snap => snap.exists).map(snap => ({ id: snap.id, ...snap.data() }));
    } else {
      // Export all entries updated in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const snapshot = await db
        .collection("testing_tracker")
        .where("updatedAt", ">=", thirtyDaysAgo)
        .orderBy("updatedAt", "desc")
        .get();
      
      entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // SAFETY: Check if sheet has existing data we shouldn't overwrite
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:K`, // Skip header row
    });

    const hasExistingData = existingData.data.values && existingData.data.values.length > 0;
    const forceOverwrite = req.headers.get("x-force-overwrite") === "true";

    // SAFETY: Prevent accidental overwrite of live data
    if (hasExistingData && !forceOverwrite) {
      return NextResponse.json({
        success: false,
        message: "Sheet contains existing data. Use 'Force Export' to overwrite, or export will append new rows only.",
        existingRows: existingData.data.values?.length || 0,
        requiresForce: true,
      }, { status: 409 });
    }

    // Format data for sheet
    const formatDate = (timestamp: any) => {
      if (!timestamp) return "";
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toISOString().split("T")[0]; // YYYY-MM-DD format
    };

    const rows = entries.map(entry => [
      entry.id.slice(-6).toUpperCase(), // Ref ID
      entry.productName || "",
      entry.shipmentCode || "",
      entry.quantity || 0,
      formatDate(entry.arrivalDate),
      formatDate(entry.targetDate),
      formatDate(entry.releaseDate),
      entry.autoStatus || "AWAITING",
      entry.remarks || "",
      entry.requestedBy || "",
      formatDate(entry.updatedAt),
    ]);

    const headers = ["Ref ID", "Product Name", "Shipment Code", "Qty", "Arrival Date", "Target Date", "Release Date", "Status", "Remarks", "Requested By", "Last Updated"];
    
    if (forceOverwrite && hasExistingData) {
      // DANGER: Clear and rewrite - only if explicitly forced
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:K`,
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [headers, ...rows],
        },
      });
    } else {
      // SAFE: Append to existing sheet without clearing
      // First ensure headers exist
      const headerCheck = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:K1`,
      });

      if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
        // Add headers if missing
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [headers] },
        });
      }

      // Append rows at the bottom
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:K`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });
    }

    // Format the sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          // Header formatting
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          // Auto-resize columns
          {
            autoResizeDimensions: {
              dimensions: { sheetId: 0, dimension: "COLUMNS" },
            },
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      message: `Exported ${entries.length} items to Google Sheet`,
      count: entries.length,
    });
  } catch (error) {
    console.error("Google Sheet Export Error:", error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Sync specific entry to Google Sheet (for real-time updates)
 */
export async function PUT(req: NextRequest) {
  try {
    const { entry } = await req.json();
    
    const formatDate = (timestamp: any) => {
      if (!timestamp) return "";
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toISOString().split("T")[0];
    };

    // Find existing row by Ref ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = response.data.values || [];
    const refId = entry.id.slice(-6).toUpperCase();
    const rowIndex = rows.findIndex(row => row[0] === refId);

    const rowData = [
      refId,
      entry.productName || "",
      entry.shipmentCode || "",
      entry.quantity || 0,
      formatDate(entry.arrivalDate),
      formatDate(entry.targetDate),
      formatDate(entry.releaseDate),
      entry.autoStatus || "AWAITING",
      entry.remarks || "",
      entry.requestedBy || "",
      formatDate(new Date()),
    ];

    if (rowIndex > 0) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${rowIndex + 1}:K${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [rowData] },
      });
    } else {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:K`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [rowData] },
      });
    }

    return NextResponse.json({ success: true, message: "Entry synced to Google Sheet" });
  } catch (error) {
    console.error("Google Sheet Sync Error:", error);
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
