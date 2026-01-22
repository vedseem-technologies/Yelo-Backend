/**
 * Google Maps Geocoding Service
 * Handles server-side geocoding requests
 */

let axios;
try {
  axios = require('axios');
} catch (error) {
  console.error('ERROR: axios module not found. Please run: npm install axios');
  throw new Error('axios module is required. Please install it with: npm install axios');
}

/**
 * Get Google Maps API key from environment
 */
function getGoogleMapsApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key is not configured in backend environment variables. Please add GOOGLE_MAPS_API_KEY to your environment variables.');
  }
  return apiKey;
}

/**
 * Reverse geocode: Convert latitude/longitude to address
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{address: string, city: string, state: string, pincode: string, fullAddress: string}>}
 */
async function reverseGeocode(latitude, longitude) {
  console.log('[Geocoding] Starting reverse geocode for:', { latitude, longitude });
  
  const apiKey = getGoogleMapsApiKey();
  console.log('[Geocoding] API key found:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
    console.log('[Geocoding] Making request to Google Maps API...');
    
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
    });
    
    console.log('[Geocoding] Response status:', response.status);

    const data = response.data;

    // Handle different API response statuses
    if (data.status === 'ZERO_RESULTS') {
      throw new Error('No address found for this location. Please try selecting a different location.');
    } else if (data.status === 'OVER_QUERY_LIMIT') {
      throw new Error('Geocoding API quota exceeded. Please try again later.');
    } else if (data.status === 'REQUEST_DENIED') {
      console.error('Geocoding API request denied. Status:', data.status, 'Error message:', data.error_message);
      throw new Error(`Geocoding API access denied: ${data.error_message || 'Please check API key configuration and ensure Geocoding API is enabled.'}`);
    } else if (data.status === 'INVALID_REQUEST') {
      console.error('Invalid geocoding request. Status:', data.status, 'Error message:', data.error_message);
      throw new Error(`Invalid location coordinates: ${data.error_message || 'Please try again.'}`);
    } else if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.error('Geocoding API error. Status:', data.status, 'Error message:', data.error_message);
      throw new Error(`Failed to reverse geocode location: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
    }

    // Use the first result (most specific) but also check other results for better data
    const primaryResult = data.results[0];
    let addressComponents = [...primaryResult.address_components]; // Clone array
    let address = primaryResult.formatted_address || '';
    
    // Collect all unique address components from multiple results
    // Sometimes different results have different component types
    if (data.results.length > 1) {
      const componentMap = new Map();
      
      // Store components from primary result
      addressComponents.forEach(comp => {
        const key = comp.types.sort().join('|');
        if (!componentMap.has(key)) {
          componentMap.set(key, comp);
        }
      });
      
      // Check other results for missing component types
      for (let i = 1; i < Math.min(data.results.length, 5); i++) {
        const altResult = data.results[i];
        if (altResult.address_components) {
          altResult.address_components.forEach(comp => {
            const key = comp.types.sort().join('|');
            if (!componentMap.has(key)) {
              componentMap.set(key, comp);
              addressComponents.push(comp);
            }
          });
        }
      }
    }
    let city = '';
    let state = '';
    let pincode = '';

    // Extract city - prefer locality, then administrative_area_level_2
    let cityFromLocality = '';
    let cityFromAdmin2 = '';
    
    addressComponents.forEach((component) => {
      const types = component.types;

      if (types.includes('postal_code')) {
        pincode = component.long_name;
      } else if (types.includes('locality')) {
        cityFromLocality = component.long_name;
      } else if (types.includes('administrative_area_level_2')) {
        cityFromAdmin2 = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        state = component.long_name;
      }
    });
    
    // Prefer locality over administrative_area_level_2 for city
    city = cityFromLocality || cityFromAdmin2;

    // Debug: Log all address components for troubleshooting
    if (process.env.NODE_ENV === 'development') {
      console.log('[Geocoding] Address components:', JSON.stringify(
        addressComponents.map(c => ({
          types: c.types,
          long_name: c.long_name,
          short_name: c.short_name
        })),
        null,
        2
      ));
    }

    // Extract street address (first line)
    const streetNumber = addressComponents.find(c => c.types.includes('street_number'))?.long_name || '';
    const route = addressComponents.find(c => c.types.includes('route'))?.long_name || '';
    const streetAddress = [streetNumber, route].filter(Boolean).join(' ');
    
    // For Indian addresses, route (street name) is better in Address Line 2
    // Address Line 1 should be: House/Flat No., Building/Premise
    const premise = addressComponents.find(c => c.types.includes('premise'))?.long_name || '';
    const subpremise = addressComponents.find(c => c.types.includes('subpremise'))?.long_name || '';
    const addressLine1Parts = [streetNumber, premise || subpremise].filter(Boolean);
    const extractedAddressLine1 = addressLine1Parts.length > 0 
      ? addressLine1Parts.join(', ') 
      : streetAddress || address.split(',')[0]?.trim() || '';

    // Extract additional address components - check multiple levels
    const sublocalityLevel1 = addressComponents.find(c => c.types.includes('sublocality_level_1'))?.long_name || '';
    const sublocalityLevel2 = addressComponents.find(c => c.types.includes('sublocality_level_2'))?.long_name || '';
    const sublocality = addressComponents.find(c => c.types.includes('sublocality'))?.long_name || '';
    const neighborhood = addressComponents.find(c => c.types.includes('neighborhood'))?.long_name || '';
    
    // Area: prefer sublocality_level_1, then sublocality, then neighborhood
    const area = sublocalityLevel1 || sublocalityLevel2 || sublocality || neighborhood || '';
    
    // Block: try to extract from sublocality_level_2 or other components
    // Sometimes block information is in sublocality_level_2
    let block = '';
    if (sublocalityLevel2 && sublocalityLevel2 !== area) {
      block = sublocalityLevel2;
    } else {
      // Try to find block in other component types
      const politicalBlock = addressComponents.find(c => 
        c.types.includes('political') && 
        (c.long_name.toLowerCase().includes('block') || 
         c.long_name.match(/\b(block|blk)\b/i))
      )?.long_name || '';
      if (politicalBlock) {
        block = politicalBlock.replace(/\b(block|blk)\b/gi, '').trim();
      }
    }
    
    // Address line 2: Should include street name (route) and locality details
    // This is important for delivery accuracy - route (street name) is crucial
    const addressLine2Parts = [];
    
    // Add route (street name) first - this is crucial for delivery
    if (route && route !== streetNumber) {
      addressLine2Parts.push(route);
    }
    
    // Then add sublocality, neighborhood details (but not if they're already in area)
    if (sublocality && sublocality !== area && sublocality !== block && sublocality !== route) {
      addressLine2Parts.push(sublocality);
    }
    if (neighborhood && neighborhood !== area && neighborhood !== block && neighborhood !== route) {
      addressLine2Parts.push(neighborhood);
    }
    
    let addressLine2 = addressLine2Parts.filter(Boolean).join(', ');
    let extractedArea = area;
    let extractedBlock = block;
    
    // Intelligent parsing from formatted_address for Indian addresses
    if (address) {
      const addressParts = address.split(',').map(part => part.trim());
      const cityLower = city.toLowerCase();
      const stateLower = state.toLowerCase();
      
      // Find indices of known components
      let cityIndex = -1;
      let stateIndex = -1;
      let pincodeIndex = -1;
      let indiaIndex = -1;
      
      addressParts.forEach((part, index) => {
        const partLower = part.toLowerCase();
        if (cityLower && partLower.includes(cityLower)) {
          cityIndex = index;
        } else if (stateLower && partLower.includes(stateLower)) {
          stateIndex = index;
        } else if (pincode && part.includes(pincode)) {
          pincodeIndex = index;
        } else if (partLower.includes('india')) {
          indiaIndex = index;
        }
      });
      
      // Extract intermediate parts (between street and city)
      // Typical format: "Street, Area, Block/Sublocality, City, State PIN, India"
      const intermediateParts = [];
      const startIndex = streetNumber ? 1 : (route ? 1 : 1); // Start after street number/route
      const endIndex = cityIndex > 0 ? cityIndex : (stateIndex > 0 ? stateIndex : addressParts.length - 2);
      
      for (let i = startIndex; i < endIndex; i++) {
        const part = addressParts[i];
        if (part && 
            !part.toLowerCase().includes('india') &&
            part.length > 0) {
          intermediateParts.push(part);
        }
      }
      
      // Distribute intermediate parts intelligently
      if (intermediateParts.length > 0) {
        const usedParts = new Set();
        
        // First pass: Identify block patterns (more aggressive extraction)
        intermediateParts.forEach((part, idx) => {
          const partLower = part.toLowerCase();
          // Check for block, blk, sector patterns
          if (!extractedBlock && (
            partLower.includes('block') || 
            partLower.includes('blk') || 
            partLower.includes('sector') ||
            partLower.match(/\b(block|blk|sector)\s*[a-z0-9]*\b/i)
          )) {
            // Extract block number/name
            const blockMatch = part.match(/\b(block|blk|sector)\s*([a-z0-9]+)\b/i);
            if (blockMatch && blockMatch[2]) {
              extractedBlock = blockMatch[2].trim();
            } else {
              // If no match, use the whole part or extract after block keyword
              extractedBlock = part.replace(/\b(block|blk|sector)\s*/gi, '').trim() || part.trim();
            }
            usedParts.add(idx);
          }
        });
        
        // If still no block, check for numeric/alphanumeric patterns that might be block numbers
        if (!extractedBlock && intermediateParts.length > 0) {
          intermediateParts.forEach((part, idx) => {
            if (!usedParts.has(idx)) {
              const partLower = part.toLowerCase();
              // Check for patterns like "A", "B", "1", "2", "Sector 5", etc.
              if (part.match(/^[A-Z]\d*$|^Block\s*[A-Z0-9]+$/i) || 
                  (part.length <= 5 && (part.match(/^[A-Z0-9]+$/i) || part.match(/^\d+$/)))) {
                extractedBlock = part.trim();
                usedParts.add(idx);
              }
            }
          });
        }
        
        // Second pass: Assign area (prefer longer, more descriptive parts)
        if (!extractedArea || extractedArea.length < 3) {
          const areaCandidates = intermediateParts
            .map((part, idx) => ({ part, idx }))
            .filter(({ idx }) => !usedParts.has(idx))
            .filter(({ part }) => {
              const partLower = part.toLowerCase();
              return part.length >= 3 && 
                     !partLower.match(/^\d+$/) && // Not just numbers
                     (!route || !partLower.includes(route.toLowerCase())) &&
                     !partLower.match(/\b(block|blk|sector)\b/i) &&
                     !partLower.includes(cityLower) &&
                     !partLower.includes(stateLower);
            })
            .sort((a, b) => {
              // Prefer longer parts, but also prefer parts that look like area names
              const aIsAreaLike = a.part.length > 5 && !a.part.match(/^[A-Z0-9]+$/);
              const bIsAreaLike = b.part.length > 5 && !b.part.match(/^[A-Z0-9]+$/);
              if (aIsAreaLike && !bIsAreaLike) return -1;
              if (!aIsAreaLike && bIsAreaLike) return 1;
              return b.part.length - a.part.length;
            });
          
          if (areaCandidates.length > 0) {
            extractedArea = areaCandidates[0].part.trim();
            usedParts.add(areaCandidates[0].idx);
          }
        }
        
        // If area is still empty, use the first unused intermediate part
        if (!extractedArea || extractedArea.length < 3) {
          const unusedFirst = intermediateParts.find((part, idx) => 
            !usedParts.has(idx) && 
            part.trim().length >= 3 &&
            !part.toLowerCase().includes(cityLower) &&
            !part.toLowerCase().includes(stateLower)
          );
          if (unusedFirst) {
            extractedArea = unusedFirst.trim();
          }
        }
        
        // Third pass: Remaining parts go to addressLine2
        const remainingParts = intermediateParts
          .map((part, idx) => ({ part, idx }))
          .filter(({ idx }) => !usedParts.has(idx))
          .map(({ part }) => part);
        
        if (remainingParts.length > 0) {
          if (addressLine2) {
            addressLine2 = [addressLine2, ...remainingParts].join(', ');
          } else {
            addressLine2 = remainingParts.join(', ');
          }
        }
        
        // If we still don't have area but have unused intermediate parts, use the first one
        if (!extractedArea && intermediateParts.length > 0) {
          const unusedFirst = intermediateParts.find((part, idx) => !usedParts.has(idx));
          if (unusedFirst) {
            extractedArea = unusedFirst;
          }
        }
      }
    }
    
    // Final values: use extracted if original is empty
    const finalArea = area || extractedArea;
    const finalBlock = block || extractedBlock;

    // Final Address Line 1: Use extracted one, or fallback
    const finalAddressLine1 = extractedAddressLine1 || streetNumber || address.split(',')[0]?.trim() || '';
    
    // If Address Line 2 is still empty, try to get route or other street info
    if (!addressLine2 && route) {
      addressLine2 = route;
    }
    
    // Enhanced parsing from formatted address if fields are still missing
    // Parse fullAddress to extract missing fields
    if (address && address.includes(',')) {
      const addressParts = address.split(',').map(p => p.trim());
      
      // For address like: "52, Railway Colony, Jhansi, Jhansi Rly. Settl, Uttar Pradesh 284003, India"
      // Parts: ["52", "Railway Colony", "Jhansi", "Jhansi Rly. Settl", "Uttar Pradesh 284003", "India"]
      
      if (addressParts.length > 2) {
        // Find indices of city, state, pincode, india
        let cityPartIndex = -1;
        let statePartIndex = -1;
        let pincodePartIndex = -1;
        let indiaIndex = -1;
        
        addressParts.forEach((part, idx) => {
          const partLower = part.toLowerCase();
          if (partLower.includes('india')) {
            indiaIndex = idx;
          } else if (pincode && part.includes(pincode)) {
            pincodePartIndex = idx;
          } else if (state && partLower.includes(state.toLowerCase().split(' ')[0])) {
            statePartIndex = idx;
          } else if (city && (partLower.includes(city.toLowerCase().split(' ')[0]) || 
                              city.toLowerCase().includes(partLower))) {
            cityPartIndex = idx;
          }
        });
        
        // Locality parts are between house number (index 0) and city/state
        const localityEndIdx = cityPartIndex > 0 ? cityPartIndex : 
                              (statePartIndex > 0 ? statePartIndex : 
                              (pincodePartIndex > 0 ? pincodePartIndex : addressParts.length - 1));
        
        // Extract locality parts (between index 1 and localityEndIdx)
        const localityParts = addressParts.slice(1, localityEndIdx)
          .filter(p => {
            const pLower = p.toLowerCase();
            return p && p.length > 0 &&
                   !pLower.includes('india') &&
                   (!pincode || !p.includes(pincode)) &&
                   (!state || !pLower.includes(state.toLowerCase().split(' ')[0])) &&
                   (!city || !pLower.includes(city.toLowerCase().split(' ')[0]));
          });
        
        // Assign to missing fields
        if (localityParts.length > 0) {
          // If addressLine2 is empty or too short, use first locality part
          if (!addressLine2 || addressLine2.length < 3) {
            addressLine2 = localityParts[0];
          }
          
          // If area is empty or too short, use first locality part (or better candidate)
          if (!finalArea || finalArea.length < 2) {
            // Prefer parts that look like area names (longer, descriptive)
            const areaCandidate = localityParts.find(p => p.length > 5) || localityParts[0];
            if (areaCandidate) {
              extractedArea = areaCandidate;
            }
          }
        }
      }
    }
    
    // Update final values after enhanced parsing
    const finalAreaUpdated = (finalArea && finalArea.length >= 2) ? finalArea : 
                            (extractedArea && extractedArea.length >= 2 ? extractedArea : '');
    const finalAddressLine2 = (addressLine2 && addressLine2.length >= 3) ? addressLine2 : '';

    // Ensure all fields have values, parsing from fullAddress if needed
    let finalAddressLine1Value = finalAddressLine1 || address.split(',')[0]?.trim() || '';
    let finalAddressLine2Value = finalAddressLine2 || addressLine2 || '';
    let finalAreaValue = finalAreaUpdated || finalArea || extractedArea || '';
    
    // Last resort: Parse directly from fullAddress if still missing
    if ((!finalAddressLine2Value || finalAddressLine2Value.length < 3) && address) {
      const parts = address.split(',').map(p => p.trim());
      if (parts.length > 1) {
        // Get the part after house number (index 0) but before city/state
        const localityParts = parts.slice(1, -2).filter(p => 
          p && 
          !p.toLowerCase().includes('india') &&
          (!city || !p.toLowerCase().includes(city.toLowerCase().split(' ')[0])) &&
          (!state || !p.toLowerCase().includes(state.toLowerCase().split(' ')[0]))
        );
        if (localityParts.length > 0) {
          finalAddressLine2Value = localityParts[0];
          if (!finalAreaValue || finalAreaValue.length < 2) {
            finalAreaValue = localityParts[0];
          }
        }
      }
    }

    // ALWAYS parse from fullAddress as the primary method - this is most reliable
    // Parse: "52, Railway Colony, Jhansi, Jhansi Rly. Settl, Uttar Pradesh 284003, India"
    if (address && address.includes(',')) {
      const parts = address.split(',').map(p => p.trim());
      
      // addressLine1: Always use first part (house number)
      finalAddressLine1Value = parts[0] || '';
      
      // Find where city/state/pincode/india start (from the end)
      let localityEnd = parts.length;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i].toLowerCase();
        if (p.includes('india')) {
          localityEnd = i;
          break;
        } else if (pincode && parts[i].includes(pincode)) {
          localityEnd = i;
          break;
        } else if (state && p.includes(state.toLowerCase().split(' ')[0])) {
          localityEnd = i;
          break;
        }
      }
      
      // Extract locality parts (between index 1 and localityEnd)
      // For "52, Railway Colony, Jhansi, Jhansi Rly. Settl, Uttar Pradesh 284003, India"
      // Parts: ["52", "Railway Colony", "Jhansi", "Jhansi Rly. Settl", "Uttar Pradesh 284003", "India"]
      // localityEnd should be index of "Uttar Pradesh 284003" (4)
      // So localityParts = parts[1:4] = ["Railway Colony", "Jhansi", "Jhansi Rly. Settl"]
      const localityParts = parts.slice(1, localityEnd)
        .filter(p => {
          const pLower = p.toLowerCase();
          return p && p.length > 0 &&
                 !pLower.includes('india') &&
                 (!pincode || !p.includes(pincode)) &&
                 (!state || !pLower.includes(state.toLowerCase().split(' ')[0])) &&
                 (!city || !pLower.includes(city.toLowerCase().split(' ')[0]));
        });
      
      // addressLine2: First locality part (e.g., "Railway Colony")
      if (localityParts.length > 0) {
        finalAddressLine2Value = localityParts[0];
      }
      
      // area: Use the longest/most descriptive locality part
      // Prefer "Jhansi Rly. Settl" over "Railway Colony" if both exist
      if (localityParts.length > 0) {
        const bestArea = localityParts.reduce((best, current) => 
          current.length > (best?.length || 0) ? current : best, 
          localityParts[0]
        );
        finalAreaValue = bestArea;
      }
    }

    const result = {
      address: streetAddress || address.split(',')[0]?.trim() || '',
      addressLine1: finalAddressLine1Value || address.split(',')[0]?.trim() || '',
      addressLine2: finalAddressLine2Value || '', 
      area: finalAreaValue || '', 
      block: finalBlock || '',
      city: city || '',
      state: state || '',
      pincode: pincode || '',
      fullAddress: address,
    };

    // Always log the complete result
    console.log('[Geocoding] Complete result:', JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    
    // Handle axios-specific errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const data = error.response.data;
      console.error('Google Maps API HTTP error:', status, data);
      throw new Error(`Google Maps API error: ${status} - ${data?.error_message || 'Unknown error'}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response from Google Maps API:', error.message);
      throw new Error('Failed to connect to Google Maps API. Please check your internet connection and try again.');
    } else if (error.code === 'ECONNABORTED') {
      // Request timeout
      throw new Error('Request to Google Maps API timed out. Please try again.');
    } else {
      // Something happened in setting up the request
      throw error;
    }
  }
}

/**
 * Geocode: Convert address to latitude/longitude
 * @param {string} address
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
async function geocodeAddress(address) {
  const apiKey = getGoogleMapsApiKey();

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
    });

    const data = response.data;

    // Handle different API response statuses
    if (data.status === 'ZERO_RESULTS') {
      throw new Error('No location found for this address. Please try a different address.');
    } else if (data.status === 'OVER_QUERY_LIMIT') {
      throw new Error('Geocoding API quota exceeded. Please try again later.');
    } else if (data.status === 'REQUEST_DENIED') {
      console.error('Geocoding API request denied. Status:', data.status, 'Error message:', data.error_message);
      throw new Error(`Geocoding API access denied: ${data.error_message || 'Please check API key configuration and ensure Geocoding API is enabled.'}`);
    } else if (data.status === 'INVALID_REQUEST') {
      console.error('Invalid geocoding request. Status:', data.status, 'Error message:', data.error_message);
      throw new Error(`Invalid address format: ${data.error_message || 'Please try again.'}`);
    } else if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.error('Geocoding API error. Status:', data.status, 'Error message:', data.error_message);
      throw new Error(`Failed to geocode address: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
    }

    const location = data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    
    // Handle axios-specific errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const data = error.response.data;
      console.error('Google Maps API HTTP error:', status, data);
      throw new Error(`Google Maps API error: ${status} - ${data?.error_message || 'Unknown error'}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response from Google Maps API:', error.message);
      throw new Error('Failed to connect to Google Maps API. Please check your internet connection and try again.');
    } else if (error.code === 'ECONNABORTED') {
      // Request timeout
      throw new Error('Request to Google Maps API timed out. Please try again.');
    } else {
      // Something happened in setting up the request
      throw error;
    }
  }
}

module.exports = {
  reverseGeocode,
  geocodeAddress,
};

