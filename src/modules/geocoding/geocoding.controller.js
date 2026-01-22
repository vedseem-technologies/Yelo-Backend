const { reverseGeocode: reverseGeocodeService, geocodeAddress: geocodeAddressService } = require('./geocoding.service');

/**
 * Reverse geocode endpoint: Convert latitude/longitude to address
 * GET /api/geocoding/reverse?latitude=XX&longitude=YY
 */
async function reverseGeocode(req, res) {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required',
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude or longitude values',
      });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Latitude must be between -90 and 90, longitude must be between -180 and 180',
      });
    }

    const addressData = await reverseGeocodeService(lat, lng);

    res.json({
      success: true,
      data: addressData,
    });
  } catch (error) {
    console.error('Reverse geocoding controller error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reverse geocode location',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}

/**
 * Geocode endpoint: Convert address to latitude/longitude
 * GET /api/geocoding/geocode?address=XXX
 */
async function geocodeAddress(req, res) {
  try {
    const { address } = req.query;

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Address is required',
      });
    }

    const locationData = await geocodeAddressService(address.trim());

    res.json({
      success: true,
      data: locationData,
    });
  } catch (error) {
    console.error('Geocoding controller error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to geocode address',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}

module.exports = {
  reverseGeocode,
  geocodeAddress,
};

