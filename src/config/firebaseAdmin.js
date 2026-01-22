const admin = require("firebase-admin")

// Helper function to properly format Firebase private key
function formatPrivateKey(key) {
  if (!key) return null
  
  // Handle various formats:
  // 1. Replace escaped newlines (\\n) with actual newlines
  // 2. Remove surrounding quotes if present
  // 3. Ensure proper PEM format with BEGIN/END markers
  
  let formattedKey = key
    .replace(/\\n/g, "\n")  // Replace \\n with actual newlines
    .replace(/^["']|["']$/g, "") // Remove surrounding quotes
    .trim()
  
  // Ensure the key has proper PEM format markers
  if (!formattedKey.includes("BEGIN PRIVATE KEY") && !formattedKey.includes("BEGIN RSA PRIVATE KEY")) {
    // If key doesn't have markers, try to add them
    if (formattedKey.startsWith("-----")) {
      // Already has markers, keep as is
      return formattedKey
    }
    // Key might be missing markers - log warning but return as is
    console.warn("⚠️ Firebase private key may be missing PEM markers")
  }
  
  return formattedKey
}

// Build service account object from environment variables
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
}

// Initialize Firebase Admin only if credentials are available
if (!admin.apps.length) {
  // Check if all required Firebase env vars are present
  const hasFirebaseConfig = 
    serviceAccount.project_id &&
    serviceAccount.private_key_id &&
    serviceAccount.private_key &&
    serviceAccount.client_email

  if (hasFirebaseConfig) {
    try {
      // Validate private key format before initializing
      if (!serviceAccount.private_key.includes("PRIVATE KEY")) {
        throw new Error("Private key appears to be invalid (missing PRIVATE KEY markers)")
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      })
      console.log("✅ Firebase Admin initialized")
    } catch (error) {
      console.warn("⚠️ Firebase Admin initialization failed:", error.message)
      console.warn("   This is non-critical - some endpoints may not work without Firebase")
      // Don't crash - Firebase might not be needed for all endpoints
    }
  } else {
    const missingVars = []
    if (!serviceAccount.project_id) missingVars.push("FIREBASE_PROJECT_ID")
    if (!serviceAccount.private_key_id) missingVars.push("FIREBASE_PRIVATE_KEY_ID")
    if (!serviceAccount.private_key) missingVars.push("FIREBASE_PRIVATE_KEY")
    if (!serviceAccount.client_email) missingVars.push("FIREBASE_CLIENT_EMAIL")
    
    console.warn(`⚠️ Firebase Admin not initialized - missing environment variables: ${missingVars.join(", ")}`)
  }
}

module.exports = admin
