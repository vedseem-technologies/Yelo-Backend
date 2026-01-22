// Load environment variables from .env file
require("dotenv").config()

const app = require("./app")
const connectDB = require("./config/db")

const PORT = process.env.PORT || 5000

const startServer = async () => {
  try {
    // 1️⃣ Connect DB ONCE
    await connectDB()
    console.log("MongoDB connected")

    // 2️⃣ Ensure Product indexes are created (non-blocking)
    try {
      const { ensureProductIndexes } = require("./modules/product/ensure-indexes")
      await ensureProductIndexes()
    } catch (indexError) {
      console.warn("⚠️ Index creation warning (non-critical):", indexError.message)
      // Don't crash the server if index creation fails - they'll be created on first use
    }

    // 3️⃣ OPTIONAL: seed shops (only if SEED_SHOPS env var is set)
    if (process.env.SEED_SHOPS === "true") {
      try {
        const seedShops = require("./modules/shop/shop.seed")
        await seedShops()
        console.log("✅ Shops seeded successfully")
      } catch (seedError) {
        console.warn("⚠️ Shop seeding failed (non-critical):", seedError.message)
        // Don't crash the server if seeding fails
      }
    }

    // 4️⃣ Start server AFTER DB is ready
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (err) {
    console.error("Server startup failed:", err)
    process.exit(1)
  }
}

startServer()
