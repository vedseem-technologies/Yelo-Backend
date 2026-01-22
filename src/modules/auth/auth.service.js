const admin = require("../../config/firebaseAdmin")
const User = require("../user/user.model")
const jwt = require("jsonwebtoken")

async function firebaseLogin(idToken) {
  if (!idToken) {
    throw new Error("ID token is required")
  }

  // 1️⃣ Verify Firebase token
  let decoded
  try {
    decoded = await admin.auth().verifyIdToken(idToken)
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`)
  }

  const phone = decoded.phone_number

  if (!phone) {
    throw new Error("Phone number missing in token")
  }

  // 2️⃣ Find or create user
  let user = await User.findOne({ phone })

  if (!user) {
    user = await User.create({ phone })
  }

  // 3️⃣ Issue backend JWT
  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  )

  return {
    token,
    user,
    isProfileComplete: user.isProfileComplete
  }
}

module.exports = { firebaseLogin }
