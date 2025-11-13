// Set up map
// Alabama bounds
const minLat = 30.18;
const maxLat = 35.00;
const minLon = -88.47; // West Longitude is negative
const maxLon = -84.88;

const map = L.map('map');
map.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [10, 10] });
map.setMaxBounds([[minLat, minLon], [maxLat, maxLon]]);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap contributors'
}).addTo(map);

let heatLayer;

// tolerant accessor for latitude & longitude (handles many column name styles)
function getLatLonFromRow(row, mappings) {
  if (mappings && mappings.lat && mappings.lon) {
    const lat = row[mappings.lat];
    const lon = row[mappings.lon];
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [lat, lon];
    }
  }
  // Fallback to common keys if mappings are not provided or invalid
  const latKeys = ['Lat','LAT','lat','Latitude','LATITUDE','latitude'];
  const lonKeys = ['Lng','LNG','lng','Lon','LON','lon','Longitude','LONGITUDE','longitude'];
  let lat = null, lon = null;
  for (const k of latKeys) { if (k in row && row[k] != null) { lat = parseFloat(row[k]); break; } }
  for (const k of lonKeys) { if (k in row && row[k] != null) { lon = parseFloat(row[k]); break; } }
  if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
  return null;
}

function renderHeat(records, mappings) {
  console.log("renderHeat called; records length:", records?.length ?? 0);
  const points = [];
  // Alabama bounds
  const minLat = 30.18;
  const maxLat = 35.00;
  const minLon = -88.47; // West Longitude is negative
  const maxLon = -84.88;

  if (!records || !records.length) {
    console.log("No records to render.");
    // Optionally display a message to the user
    // showProblem("No data found to render heatmap.");
  } else {
    console.log("First 5 records preview:", records.slice(0,5));
    for (const r of records) {
      const pair = getLatLonFromRow(r, mappings);
      if (pair) {
        const lat = pair[0];
        const lon = pair[1];
        // Filter for Alabama
        if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
          points.push([lat, lon, 1]); // weight=1 for each row
        }
      }
    }
    console.log("Parsed points count (filtered for Alabama):", points.length);
  }

  if (heatLayer) { try { map.removeLayer(heatLayer); } catch(e){} }
  if (!points.length) {
    console.log("No valid points to render heatmap (after Alabama filter).");
    return;
  }

  heatLayer = L.heatLayer(points, {
    radius: 50, // Increased radius
    blur: 30,   // Increased blur
    maxZoom: 17,
    // More contrasting gradient
    gradient: {
      0.0: 'blue',
      0.2: 'cyan',
      0.4: 'lime',
      0.6: 'yellow',
      0.8: 'orange',
      1.0: 'red'
    },
    maxOpacity: 0.8 // Increase maxOpacity for better visibility
  }).addTo(map);

  // fit bounds safely (if only one point, expand a small box)
  try {
    if (points.length === 1) {
      const p = points[0];
      const pad = 0.1;
      map.fitBounds([[p[0]-pad, p[1]-pad],[p[0]+pad, p[1]+pad]], { padding: [30,30] });
    } else {
      map.fitBounds(points.map(p => [p[0], p[1]]), { padding: [30,30] });
    }
  } catch (err) {
    console.warn("fitBounds failed:", err);
  }
}

// Connect to Grist — request read access and request the likely column names.
grist.ready({
  requiredAccess: 'read table',
  columns: [
    { name: "lat", type: 'Numeric', title: 'Latitude', optional: true },
    { name: "lon", type: 'Numeric', title: 'Longitude', optional: true }
  ]
});

try {
  grist.onReady((info) => {
    console.log("Grist widget ready. Info:", info);
  });
} catch (e) {
  console.error("grist.onReady is not a function. It is safe to ignore this error.");
  console.error(e);
}

// Main listener: whenever records change, render heat
grist.onRecords((records, mappings) => {
  const mappedRecords = grist.mapColumnNames(records, mappings);
  console.log("onRecords invoked. mappings:", mappings);
  console.log("Raw records received:", JSON.stringify(records, null, 2));
  console.log("Mapped records:", JSON.stringify(mappedRecords, null, 2));
  renderHeat(mappedRecords || [], mappings);
});