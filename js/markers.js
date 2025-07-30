import { getMap } from './map.js';
import { getAQIColor, getAQICategory, formatDateTime, isValidStation } from './utils.js';

// Marker creation and management

export function createMarkerIcon(aqi, color) {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${color};
            width: 25px;
            height: 25px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 10px;
            color: white;
            text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
        ">${aqi}</div>`,
        iconSize: [25, 25],
        iconAnchor: [12.5, 12.5]
    });
}

export function createPopupContent(station, aqi, color, category) {
    return `
        <div style="text-align: center; min-width: 200px;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">${station.station?.name || 'Unknown Station'}</h4>
            <div style="background: ${color}; color: white; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                <div style="font-size: 24px; font-weight: bold;">${aqi}</div>
                <div style="font-size: 12px; opacity: 0.9;">AQI</div>
            </div>
            <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
                <strong>Category:</strong> ${category}
            </div>
            ${station.station?.time ? `
            <div style="font-size: 11px; color: #666;">
                Last updated: ${formatDateTime(station.station.time)}
            </div>
            ` : ''}
        </div>
    `;
}

export function addMarkersToMap(stations) {
    const map = getMap();
    if (!map) {
        console.error('Map not initialized');
        return;
    }

    const markers = [];

    stations.forEach(station => {
        if (!isValidStation(station)) return;
        
        const aqi = parseInt(station.aqi);
        const color = getAQIColor(aqi);
        const category = getAQICategory(aqi);
        
        // Create custom icon
        const icon = createMarkerIcon(aqi, color);
        
        // Create marker
        const marker = L.marker([station.lat, station.lon], { icon }).addTo(map);
        
        // Create popup content
        const popupContent = createPopupContent(station, aqi, color, category);
        marker.bindPopup(popupContent);
        
        // Store reference for potential future use
        marker.stationData = station;
        markers.push(marker);
    });

    console.log(`Added ${markers.length} markers to map`);
    return markers;
}

export function addSingleMarker(station) {
    if (!isValidStation(station)) return null;
    
    const map = getMap();
    if (!map) return null;
    
    const aqi = parseInt(station.aqi);
    const color = getAQIColor(aqi);
    const category = getAQICategory(aqi);
    
    const icon = createMarkerIcon(aqi, color);
    const marker = L.marker([station.lat, station.lon], { icon }).addTo(map);
    
    const popupContent = createPopupContent(station, aqi, color, category);
    marker.bindPopup(popupContent);
    
    marker.stationData = station;
    return marker;
}