const User = require("../user/user.model");
const sendEmail = require("../../utils/sendEmail");
const jwt = require("jsonwebtoken");

// In-memory OTP store (Use Redis for production)
const otpStore = new Map();

// Helper to generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const otp = generateOTP();
    // Store OTP with expiry (5 minutes)
    otpStore.set(email, { 
      otp, 
      expires: Date.now() + 5 * 60 * 1000 
    });

    const message = `Your OTP for Yelo Fashion login is ${otp}. Valid for 5 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #F59E0B;">Yelo Fashion Login</h2>
        <p>Your One-Time Password (OTP) is:</p>
        <h1 style="letter-spacing: 5px; background: #f3f4f6; padding: 10px; display: inline-block; border-radius: 8px;">${otp}</h1>
        <p>This OTP is valid for 5 minutes. Do not share it with anyone.</p>
      </div>
    `;

    await sendEmail({
      email,
      subject: "Your Login OTP - Yelo Fashion",
      message,
      html,
    });

    res.status(200).json({ success: true, message: "OTP sent successfully" });

  } catch (error) {
    console.error("Request OTP Error:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const storedData = otpStore.get(email);

    if (!storedData) {
      return res.status(400).json({ success: false, message: "OTP expired or not requested" });
    }

    if (Date.now() > storedData.expires) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // OTP Valid - Clear it
    otpStore.delete(email);

    // Find or Create User
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user (Phone will be missing/null initially)
      user = await User.create({
        email,
        name: email.split("@")[0], // Default name from email
        isProfileComplete: false
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      success: true,
      token,
      user,
      isProfileComplete: user.isProfileComplete && !!user.phone // Check if phone exists
    });

  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ success: false, message: "Login failed" });
  }
};
