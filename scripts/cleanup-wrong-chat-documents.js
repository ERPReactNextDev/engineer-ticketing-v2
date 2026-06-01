/**
 * Cleanup Script: Remove Wrong Chat Document IDs
 * 
 * This script removes chat documents that were created with offer IDs (e.g., "399")
 * instead of SPF numbers (e.g., "SPF-DSI-26-HITEST2")
 * 
 * Run this script to clean up the Firebase database after the fix is deployed.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupWrongDocuments() {
  try {
    console.log('🔍 Scanning for documents with numeric IDs (offer IDs)...');
    
    const snapshot = await db.collection('spf_creations').get();
    
    let wrongDocs = [];
    
    snapshot.forEach(doc => {
      const docId = doc.id;
      
      // Check if document ID is purely numeric (offer ID) instead of SPF format
      if (/^\d+$/.test(docId)) {
        wrongDocs.push({
          id: docId,
          data: doc.data()
        });
      }
    });
    
    if (wrongDocs.length === 0) {
      console.log('✅ No wrong documents found!');
      return;
    }
    
    console.log(`⚠️  Found ${wrongDocs.length} document(s) with wrong IDs:`);
    wrongDocs.forEach(doc => {
      console.log(`   - Document ID: ${doc.id}`);
      console.log(`     Messages: ${doc.data.messages?.length || 0}`);
    });
    
    console.log('\n⚠️  WARNING: These documents will be DELETED!');
    console.log('Make sure you have backed up any important messages.');
    console.log('\nTo proceed with deletion, uncomment the deletion code below.\n');
    
    // UNCOMMENT THE CODE BELOW TO ACTUALLY DELETE THE DOCUMENTS
    /*
    for (const doc of wrongDocs) {
      console.log(`🗑️  Deleting document: ${doc.id}`);
      await db.collection('spf_creations').doc(doc.id).delete();
      console.log(`✅ Deleted: ${doc.id}`);
    }
    
    console.log('\n✅ Cleanup complete!');
    */
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

// Run the cleanup
cleanupWrongDocuments();
