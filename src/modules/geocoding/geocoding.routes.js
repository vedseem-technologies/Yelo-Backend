const router = require('express').Router();
const { reverseGeocode, geocodeAddress } = require('./geocoding.controller');

// Reverse geocode: lat/lng -> address
router.get('/reverse', reverseGeocode);

// Geocode: address -> lat/lng
router.get('/geocode', geocodeAddress);

module.exports = router;

