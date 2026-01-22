const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true
    },

    email: {
      type: String
    },

    avatar: {
      type: String // image URL
    },

    isProfileComplete: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true
    },

    // Address fields (keeping old fields for backward compatibility)
    address: {
      type: String
    },
    city: {
      type: String
    },
    state: {
      type: String
    },
    pincode: {
      type: String
    },
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    },
    // Detailed address fields
    fullName: {
      type: String
    },
    addressLine1: {
      type: String // House/Flat No., Building Name
    },
    addressLine2: {
      type: String // Street, Area, Locality
    },
    area: {
      type: String
    },
    block: {
      type: String
    },
    landmark: {
      type: String
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("User", userSchema)
