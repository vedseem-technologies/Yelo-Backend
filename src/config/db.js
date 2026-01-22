const mongoose = require("mongoose")

const connectDB = async (retries = 3, delay = 2000) => {
  // Get MongoDB URI from environment variables
  let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI
  
  if (!mongoUri) {
    throw new Error(
      "MongoDB connection string is missing. Please set MONGODB_URI or MONGO_URI environment variable."
    )
  }
  
  // Trim whitespace
  mongoUri = mongoUri.trim()
  
  // Validate connection string format
  if (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) {
    // Log first 20 chars for debugging (without exposing full connection string)
    const preview = mongoUri.substring(0, 20) + (mongoUri.length > 20 ? "..." : "")
    throw new Error(
      `Invalid MongoDB connection string format. Expected to start with "mongodb://" or "mongodb+srv://". ` +
      `Received: "${preview}" (length: ${mongoUri.length}). ` +
      `Please check your MONGODB_URI environment variable.`
    )
  }
  
  // Connection options with better timeout and retry settings
  const options = {
    serverSelectionTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 120000, // 120 seconds (2 minutes) - increased for slow queries
    connectTimeoutMS: 30000, // 30 seconds
    maxPoolSize: 20, // Increased pool size
    minPoolSize: 5, // Maintain minimum connections
    retryWrites: true,
    retryReads: true,
    // Heartbeat settings to keep connections alive
    heartbeatFrequencyMS: 10000,
  }
  
  // Set Mongoose-specific buffer settings (not part of connection options)
  mongoose.set('bufferCommands', false) // Disable mongoose buffering
  
  // Retry logic for connection
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Attempting MongoDB connection (${attempt}/${retries})...`)
      
      await mongoose.connect(mongoUri, options)
      console.log("✅ MongoDB connected successfully")
      return
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed:`, error.message)
      
      // Check for specific error types
      if (error.message.includes("querySrv EREFUSED") || error.message.includes("ENOTFOUND")) {
        console.error("   💡 DNS resolution error - possible causes:")
        console.error("      - MongoDB Atlas IP whitelist: Add your current IP to MongoDB Atlas Network Access")
        console.error("      - Network connectivity issue: Check your internet connection")
        console.error("      - Firewall blocking: Check if port 27017 or MongoDB Atlas ports are blocked")
      } else if (error.message.includes("authentication failed")) {
        console.error("   💡 Authentication error - check your MongoDB username and password")
      } else if (error.message.includes("timeout")) {
        console.error("   💡 Connection timeout - MongoDB server may be unreachable")
      }
      
      // If this was the last attempt, throw the error
      if (attempt === retries) {
        throw new Error(
          `MongoDB connection failed after ${retries} attempts. Last error: ${error.message}. ` +
          `Please check your MONGODB_URI and ensure MongoDB is accessible.`
        )
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = delay * attempt
      console.log(`   ⏳ Retrying in ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
}

module.exports = connectDB
