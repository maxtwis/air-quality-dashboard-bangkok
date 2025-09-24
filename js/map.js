import { CONFIG } from './config.js';

// Map initialization and management

let map = null;

export function initializeMap() {
  // Initialize Leaflet map
  map = L.map('map').setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);

  // Add tile layer
  L.tileLayer(CONFIG.TILE_LAYER.url, {
    attribution: CONFIG.TILE_LAYER.attribution,
  }).addTo(map);

  console.log('Map initialized');
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

  map.on('click', callback);
}

export function removeMapClickHandler(callback) {
  if (!map) return;

  map.off('click', callback);
}
