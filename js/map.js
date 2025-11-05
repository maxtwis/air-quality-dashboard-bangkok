import { CONFIG } from "./config.js";

// Map initialization and management

let map = null;

export function initializeMap() {
  // Initialize Leaflet map
  map = L.map("map", {
    preferCanvas: false,
    zoomControl: true,
    attributionControl: true
  }).setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);

  // Add tile layer with error handling
  const tileLayer = L.tileLayer(CONFIG.TILE_LAYER.url, {
    attribution: CONFIG.TILE_LAYER.attribution,
    maxZoom: 19,
    minZoom: 10,
  });

  tileLayer.on('tileerror', (error) => {
    console.warn('Tile loading error:', error);
  });

  tileLayer.addTo(map);

  // Fix map rendering on window resize (especially important for mobile)
  window.addEventListener('resize', () => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  });

  // Fix for mobile - multiple invalidateSize calls to ensure rendering
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 100);

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 500);

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 1000);

  return map;
}

export function getMap() {
  return map;
}

export function clearMarkers() {
  if (!map) return;

  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
}

export function fitMapToBounds(bounds) {
  if (!map) return;

  const leafletBounds = L.latLngBounds(
    [bounds.southwest.lat, bounds.southwest.lng],
    [bounds.northeast.lat, bounds.northeast.lng],
  );

  map.fitBounds(leafletBounds);
}

export function addMapClickHandler(callback) {
  if (!map) return;

  map.on("click", callback);
}

export function removeMapClickHandler(callback) {
  if (!map) return;

  map.off("click", callback);
}
