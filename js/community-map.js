// Community Map with GeoJSON boundaries
import { CONFIG } from './config.js';

let communityMap = null;
let communityLayer = null;
let selectedCommunity = null;

export async function initializeCommunityMap() {
  // Initialize Leaflet map for community view
  communityMap = L.map('community-map', {
    preferCanvas: false,
    zoomControl: true,
    attributionControl: true,
  }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);

  // Add tile layer
  const tileLayer = L.tileLayer(CONFIG.TILE_LAYER.url, {
    attribution: CONFIG.TILE_LAYER.attribution,
    maxZoom: 19,
    minZoom: 10,
  });

  tileLayer.addTo(communityMap);

  // Load and display community boundaries
  await loadCommunityBoundaries();

  // Fix map rendering
  setTimeout(() => {
    if (communityMap) {
      communityMap.invalidateSize();
    }
  }, 100);
}

async function loadCommunityBoundaries() {
  try {
    // Fetch GeoJSON data
    const response = await fetch('/data/Community_Stud_FeaturesToJSO.geojson');
    const geojsonData = await response.json();

    // Style function for community boundaries
    const communityStyle = {
      color: CONFIG.COLORS.primary,
      weight: 2,
      opacity: 0.8,
      fillColor: CONFIG.COLORS.primary,
      fillOpacity: 0.1,
    };

    // Add GeoJSON layer to map
    communityLayer = L.geoJSON(geojsonData, {
      style: communityStyle,
      onEachFeature: (feature, layer) => {
        const properties = feature.properties;
        const communityName = properties.COMMU_AD_1 || 'Unknown';
        const population = properties.POP || 0;
        const households = properties.HOUSEHOLD || 0;
        const male = properties.MALE || 0;
        const female = properties.FEMALE || 0;

        // Bind popup with community info
        const popupContent = `
          <div class="community-popup">
            <h4>${communityName}</h4>
            <p><strong>ประชากร:</strong> ${population.toLocaleString()} คน</p>
            <p><strong>ครัวเรือน:</strong> ${households.toLocaleString()}</p>
            <p><strong>เพศชาย:</strong> ${male.toLocaleString()} | <strong>เพศหญิง:</strong> ${female.toLocaleString()}</p>
          </div>
        `;
        layer.bindPopup(popupContent, {
          maxWidth: 300,
          minWidth: 200,
          maxHeight: 200,
          autoPan: true,
          autoPanPadding: [50, 50],
          keepInView: true,
          closeButton: true,
          className: 'community-leaflet-popup',
        });

        // Click handler
        layer.on('click', () => {
          selectCommunity(feature, layer);
        });

        // Hover effects
        layer.on('mouseover', function () {
          this.setStyle({
            weight: 3,
            fillOpacity: 0.25,
          });
        });

        layer.on('mouseout', function () {
          if (selectedCommunity !== this) {
            this.setStyle({
              weight: 2,
              fillOpacity: 0.1,
            });
          }
        });
      },
    }).addTo(communityMap);

    // Fit map to community boundaries
    communityMap.fitBounds(communityLayer.getBounds());

    // Calculate and update statistics
    updateCommunityStatistics(geojsonData);
  } catch (error) {
    console.error('Error loading community boundaries:', error);
  }
}

function selectCommunity(feature, layer) {
  // Reset previous selection
  if (selectedCommunity) {
    selectedCommunity.setStyle({
      weight: 2,
      fillOpacity: 0.1,
    });
  }

  // Highlight selected community
  layer.setStyle({
    weight: 3,
    fillOpacity: 0.3,
  });
  selectedCommunity = layer;

  // Update info panel
  displayCommunityInfo(feature);

  // Zoom to selected community
  communityMap.fitBounds(layer.getBounds(), { padding: [50, 50] });
}

function displayCommunityInfo(feature) {
  const panel = document.getElementById('community-info-panel');
  if (!panel) return;

  const props = feature.properties;
  const communityName = props.COMMU_AD_1 || 'ไม่มีข้อมูล';
  const population = props.POP || 0;
  const households = props.HOUSEHOLD || 0;
  const male = props.MALE || 0;
  const female = props.FEMALE || 0;
  const area = props.RAI || 0;
  const district = props.DNAME || 'ไม่มีข้อมูล';
  const subdistrict = props.SNAME || 'ไม่มีข้อมูล';
  const chairman = props.CHAIRMAN || 'ไม่มีข้อมูล';
  const address = props.ADDRESS || 'ไม่มีข้อมูล';

  panel.innerHTML = `
    <div class="community-detail">
      <h3>${communityName}</h3>
      <p style="color: var(--gray-500); font-size: 0.875rem;">เขต${district} แขวง${subdistrict}</p>

      <h4>ข้อมูลประชากร</h4>
      <div class="community-detail-grid">
        <div class="community-detail-item">
          <span class="community-detail-label">ประชากรรวม</span>
          <span class="community-detail-value">${population.toLocaleString()} คน</span>
        </div>
        <div class="community-detail-item">
          <span class="community-detail-label">จำนวนครัวเรือน</span>
          <span class="community-detail-value">${households.toLocaleString()}</span>
        </div>
        <div class="community-detail-item">
          <span class="community-detail-label">เพศชาย</span>
          <span class="community-detail-value">${male.toLocaleString()} คน</span>
        </div>
        <div class="community-detail-item">
          <span class="community-detail-label">เพศหญิง</span>
          <span class="community-detail-value">${female.toLocaleString()} คน</span>
        </div>
      </div>

      <h4>ข้อมูลพื้นที่</h4>
      <div class="community-detail-grid">
        <div class="community-detail-item">
          <span class="community-detail-label">พื้นที่</span>
          <span class="community-detail-value">${area} ไร่</span>
        </div>
        <div class="community-detail-item">
          <span class="community-detail-label">ประธานชุมชน</span>
          <span class="community-detail-value" style="font-size: 0.875rem;">${chairman}</span>
        </div>
      </div>

      <h4>ที่อยู่</h4>
      <p style="color: var(--gray-700); font-size: 0.875rem; line-height: 1.6;">${address}</p>
    </div>
  `;
}

function updateCommunityStatistics(geojsonData) {
  let totalPopulation = 0;
  let totalCommunities = geojsonData.features.length;

  geojsonData.features.forEach(feature => {
    totalPopulation += feature.properties.POP || 0;
  });

  // Update statistics in the UI
  const totalPopElement = document.getElementById('total-population');
  const totalCommElement = document.getElementById('total-communities');

  if (totalPopElement) {
    totalPopElement.textContent = totalPopulation.toLocaleString();
  }

  if (totalCommElement) {
    totalCommElement.textContent = totalCommunities;
  }
}

export function getCommunityMap() {
  return communityMap;
}
