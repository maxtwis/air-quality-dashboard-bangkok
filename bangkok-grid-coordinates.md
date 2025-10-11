# Bangkok-Focused Grid Coordinates (Updated)

## New Grid Boundaries - Bangkok Proper Only ✅
- **Latitude**: 13.65°N to 13.95°N (30km range)
- **Longitude**: 100.45°E to 100.80°E (35km range)
- **Grid Size**: 4×4 (16 points)
- **Spacing**: ~0.1° latitude × ~0.117° longitude (~11km × 13km per cell)

## All 16 Bangkok Grid Points

| Row | Latitude | Col 1 (100.45°E) | Col 2 (100.567°E) | Col 3 (100.683°E) | Col 4 (100.80°E) |
|-----|----------|------------------|-------------------|-------------------|------------------|
| 1   | 13.65°N  | South-West       | South-Central     | South-East        | Far East         |
| 2   | 13.75°N  | Central-West     | **City Center**   | Central-East      | East             |
| 3   | 13.85°N  | North-West       | North-Central     | North-East        | Far North-East   |
| 4   | 13.95°N  | Far North-West   | Far North         | Far North-East    | North Border     |

## Example Grid Points with Landmarks

### Row 2 (Central Bangkok - 13.75°N)
1. **(13.75, 100.45)** - https://www.google.com/maps?q=13.75,100.45
   - Near: Taling Chan, Bangkok Noi

2. **(13.75, 100.567)** - https://www.google.com/maps?q=13.75,100.567
   - **City Center**: Siam, Chitlom, Ratchaprasong

3. **(13.75, 100.683)** - https://www.google.com/maps?q=13.75,100.683
   - Near: Lat Phrao, Bang Kapi

4. **(13.75, 100.80)** - https://www.google.com/maps?q=13.75,100.80
   - Near: Min Buri (east boundary)

### Row 3 (North Bangkok - 13.85°N)
1. **(13.85, 100.45)** - https://www.google.com/maps?q=13.85,100.45
   - Near: Nonthaburi border

2. **(13.85, 100.567)** - https://www.google.com/maps?q=13.85,100.567
   - Near: Chatuchak, Don Mueang

3. **(13.85, 100.683)** - https://www.google.com/maps?q=13.85,100.683
   - Near: Khan Na Yao, Bueng Kum

### Row 1 (South Bangkok - 13.65°N)
1. **(13.65, 100.567)** - https://www.google.com/maps?q=13.65,100.567
   - Near: Samut Prakan border, Bang Na

## Coverage Area
- **Width**: ~35km (west to east)
- **Height**: ~30km (south to north)
- **Each grid cell**: ~11km × 13km
- **Maximum distance from any station to nearest grid**: ~8-9km

## What Changed?
**Old Grid** (Too Wide):
- 13.5-14.0°N, 100.3-100.9°E
- Covered Nakhon Pathom, Pathum Thani, Samut Prakan

**New Grid** (Bangkok Only):
- 13.65-13.95°N, 100.45-100.80°E
- Focuses on Bangkok proper
- Better accuracy in high-density areas
- Same cost (~11 API calls/hour)

## View All Points on Google Maps
Open this link to see the grid center:
https://www.google.com/maps/@13.8,100.625,12z

This grid is now properly focused on Bangkok Metropolitan Area! 🎯
