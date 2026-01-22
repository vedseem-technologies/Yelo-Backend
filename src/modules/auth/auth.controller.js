const { firebaseLogin } = require("./auth.service")

async function firebaseLoginHandler(req, res) {
  try {
    const { idToken } = req.body

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "ID token is required"
      })
    }

    const data = await firebaseLogin(idToken)

    res.json({
      success: true,
      ...data
    })
  } catch (err) {
    // Return more specific error codes
    const statusCode = err.message.includes("verification failed") || err.message.includes("token") ? 401 : 500
    
    res.status(statusCode).json({
      success: false,
      message: err.message
    })
  }
}

module.exports = { firebaseLoginHandler }
