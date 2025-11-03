# Recommended Grid Boundary Fix

## Current Problem

Current grid: **13.5-14.0°N, 100.3-100.9°E**

- Covers areas outside Bangkok (Nakhon Pathom, Pathum Thani, Samut Prakan)
- Too wide, wasting some grid points on low-density areas

## Actual WAQI Station Distribution

Based on actual data:

- **Latitude**: 13.57°N to 13.99°N
- **Longitude**: 100.30°E to 100.84°E
- **Core Bangkok**: 13.65-13.95°N, 100.45-100.80°E

## Recommended Grid Options

### Option 1: Tight Bangkok Focus (Recommended)

```
Latitude:  13.65 to 13.95°N  (0.3° range, Bangkok proper)
Longitude: 100.45 to 100.80°E (0.35° range, core city)
Grid: 4×4
Spacing: ~0.1° × ~0.12° (~11km × 13km per cell)
```

**Example Points:**

- (13.65, 100.45) - South Bangkok
- (13.75, 100.55) - Siam/Silom area
- (13.85, 100.65) - Chatuchak area
- (13.95, 100.75) - North Bangkok

### Option 2: Greater Bangkok Area

```
Latitude:  13.60 to 13.95°N  (0.35° range)
Longitude: 100.35 to 100.80°E (0.45° range)
Grid: 4×4
Spacing: ~0.12° × ~0.15° (~13km × 17km per cell)
```

Includes surrounding provinces (Nonthaburi, Pathum Thani, Samut Prakan)

## Implementation

Update `api/collect-google-supplements.js`:

```javascript
function findNearestGridPoint(stationLat, stationLon) {
  const gridPoints = [];

  // Option 1: Tight Bangkok Focus
  const latMin = 13.65;
  const latMax = 13.95;
  const lngMin = 100.45;
  const lngMax = 100.8;

  const latStep = (latMax - latMin) / 3; // 4x4 = divide by 3
  const lngStep = (lngMax - lngMin) / 3;

  // ... rest of code
}
```

## Trade-offs

**Tighter Grid (13.65-13.95, 100.45-100.80):**

- ✅ Better accuracy in central Bangkok
- ✅ All grid points in high-density areas
- ✅ More efficient API usage
- ❌ Outer stations might be farther from grid points

**Current Wide Grid (13.5-14.0, 100.3-100.9):**

- ✅ Covers all stations
- ✅ Includes surrounding provinces
- ❌ Some grid points in low-density areas
- ❌ Less accurate for central Bangkok

## Recommendation

**Use Option 1** (13.65-13.95, 100.45-100.80) because:

1. Most WAQI stations are in this area
2. Better geographic accuracy where it matters most
3. Outer stations are still within ~15km of nearest grid point
4. Same 11 API calls/hour (same cost)
