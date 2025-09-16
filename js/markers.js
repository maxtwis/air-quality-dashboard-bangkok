import { getMap } from './map.js';
import { getAQIColor, isValidStation } from './utils.js';
import { uiManager } from './ui.js';
import { formatAQHI } from './aqhi-realistic.js';

// Modern marker creation and management

export function createModernMarkerIcon(value, color) {
    // Determine size and font based on text length
    const textLength = value.toString().length;
    const isLongText = textLength > 3;
    const width = isLongText ? Math.max(38, textLength * 9) : 32;
    const fontSize = isLongText ? '9px' : '11px';

    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="
                background-color: ${color};
                width: ${width}px;
                height: 32px;
                border-radius: ${isLongText ? '16px' : '50%'};
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: ${fontSize};
                color: white;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: 'Inter', sans-serif;
                padding: 0 2px;
                white-space: nowrap;
            "
            onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.2)'"
            onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
            >${value}</div>
        `,
        iconSize: [width, 32],
        iconAnchor: [width / 2, 16]
    });
}

export function addMarkersToMap(stations) {
    const map = getMap();
    if (!map) {
        console.error('Map not initialized');
        return [];
    }

    const markers = [];
    const isAQHI = uiManager.currentIndicator === 'AQHI' || uiManager.currentIndicator === 'PM25_AQHI';

    stations.forEach(station => {
        if (!isValidStation(station)) return;

        let value, color;

        if (isAQHI && station.aqhi) {
            // Use AQHI if available (includes both full AQHI and PM2.5-only AQHI)
            value = formatAQHI(station.aqhi.value);
            color = station.aqhi.level.color;
        } else {
            // Fall back to AQI
            const aqi = parseInt(station.aqi);
            value = aqi;
            color = getAQIColor(aqi);
        }
        
        // Create modern marker icon
        const icon = createModernMarkerIcon(value, color);
        
        // Create marker
        const marker = L.marker([station.lat, station.lon], { icon }).addTo(map);
        
        // Add click handler to show station info
        marker.on('click', () => {
            uiManager.showStationInfo(station);
        });

        // Add hover effects
        marker.on('mouseover', function() {
            // Optional: Add hover popup or tooltip
        });

        marker.on('mouseout', function() {
            // Optional: Remove hover effects
        });
        
        // Store reference for potential future use
        marker.stationData = station;
        markers.push(marker);
    });

    console.log(`Added ${markers.length} modern markers to map`);
    return markers;
}

export function addSingleMarker(station) {
    if (!isValidStation(station)) return null;
    
    const map = getMap();
    if (!map) return null;
    
    const isAQHI = uiManager.currentIndicator === 'AQHI' || uiManager.currentIndicator === 'PM25_AQHI';
    let value, color;

    if (isAQHI && station.aqhi) {
        value = formatAQHI(station.aqhi.value);
        color = station.aqhi.level.color;
    } else {
        const aqi = parseInt(station.aqi);
        value = aqi;
        color = getAQIColor(aqi);
    }
    
    const icon = createModernMarkerIcon(value, color);
    const marker = L.marker([station.lat, station.lon], { icon }).addTo(map);
    
    // Add click handler
    marker.on('click', () => {
        uiManager.showStationInfo(station);
    });
    
    marker.stationData = station;
    return marker;
}

// Create a cluster of markers for better performance with many points
export function createMarkerCluster(stations) {
    // This would require additional clustering library
    // For now, we'll use the standard approach
    return addMarkersToMap(stations);
}

// Animate marker changes
export function animateMarkerUpdate(marker, newValue, newColor) {
    if (!marker || !marker.stationData) return;
    
    // If only AQI value provided (backward compatibility)
    if (typeof newValue === 'number' && !newColor) {
        newColor = getAQIColor(newValue);
    }
    
    const icon = createModernMarkerIcon(newValue, newColor);
    
    // Add animation class temporarily
    const markerElement = marker.getElement();
    if (markerElement) {
        markerElement.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            marker.setIcon(icon);
        }, 150);
    } else {
        marker.setIcon(icon);
    }
    
    // Update stored data
    if (typeof newValue === 'number') {
        marker.stationData.aqi = newValue.toString();
    }
}

// Highlight a specific marker
export function highlightMarker(marker) {
    const markerElement = marker.getElement();
    if (markerElement) {
        const markerDiv = markerElement.querySelector('div');
        if (markerDiv) {
            markerDiv.style.transform = 'scale(1.2)';
            markerDiv.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
            markerDiv.style.zIndex = '1000';
        }
    }
}

// Remove highlight from marker
export function unhighlightMarker(marker) {
    const markerElement = marker.getElement();
    if (markerElement) {
        const markerDiv = markerElement.querySelector('div');
        if (markerDiv) {
            markerDiv.style.transform = 'scale(1)';
            markerDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            markerDiv.style.zIndex = 'auto';
        }
    }
}