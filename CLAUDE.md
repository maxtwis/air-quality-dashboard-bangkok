# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MCP Integration

### Context7
This project uses Context7 MCP server for enhanced context awareness and capabilities.
- **MCP Server**: Context7 (https://mcp.context7.com/mcp)
- **Configuration**: Configured via `claude mcp add` command
- **Purpose**: Provides additional context and capabilities for better code understanding and assistance

### Playwright
MCP Playwright integration for browser automation and testing.
- **MCP Server**: Playwright MCP
- **Purpose**: Enables browser automation, web scraping, and end-to-end testing capabilities
- **Features**: Browser control, page navigation, element interaction, screenshot capture

## Project Overview
This is a real-time air quality dashboard for Bangkok that displays AQI (Air Quality Index) data on an interactive map using the WAQI API and Leaflet.js.

## Development Commands

### Run Development Server
```bash
npm run dev
```
Starts a live development server on port 3000 with hot reload.

### Format Code
```bash
npm run format
```
Runs Prettier to format all files in the project.

### Lint JavaScript
```bash
npm run lint
```
Runs ESLint on all JavaScript files in the `js/` directory.

## Architecture

### Frontend-Only Application
This is a client-side application with no backend server. It consists of:
- HTML/CSS/JavaScript modules
- Direct API calls to WAQI (World Air Quality Index) API from the browser
- Leaflet.js for interactive mapping

### Key Modules

**Configuration** (`js/config.js`):
- Contains API token for WAQI API
- Map boundaries for Bangkok area
- AQI level thresholds and color schemes
- Pollutant definitions and metadata

**Main Application** (`js/app.js`):
- `ModernAirQualityDashboard` class manages the entire application lifecycle
- Handles data fetching, display updates, and auto-refresh
- Provides analytics methods for station categorization

**API Layer** (`js/api.js`):
- Fetches air quality data from WAQI API
- Handles station details and current location data

**Map Management** (`js/map.js`, `js/markers.js`):
- Initializes Leaflet map centered on Bangkok
- Creates and manages station markers with AQI color coding
- Handles marker interactions and popups

**UI Components** (`js/ui.js`):
- Updates sidebar displays with current AQI values
- Manages loading states and error displays
- Handles station info panel

**Statistics** (`js/statistics.js`):
- Calculates and displays AQI statistics
- Shows category breakdowns and averages

### Data Flow
1. App initializes and fetches Bangkok area stations from WAQI API
2. Stations are displayed as color-coded markers on the map
3. Sidebar shows main location data and statistics
4. Auto-refresh updates data every 10 minutes
5. User can interact with markers to see station details

### API Integration
The app uses WAQI API v2 endpoints:
- `/v2/map/bounds/` - Fetch stations within Bangkok boundaries
- `/feed/@{uid}/` - Get detailed station data including pollutants
- Token-based authentication required for all API calls

## Visual Development & Testing

### Design System

The project follows S-Tier SaaS design standards inspired by Stripe, Airbnb, and Linear. All UI development must adhere to:

- **Design Principles**: `/context/design-principles.md` - Comprehensive checklist for world-class UI
- **Component Library**: NextUI with custom Tailwind configuration

### Quick Visual Check

**IMMEDIATELY after implementing any front-end change:**

1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against `/context/design-principles.md`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages` ⚠️

This verification ensures changes meet design standards and user requirements.

### Comprehensive Design Review

For significant UI changes or before merging PRs, use the design review agent:

```bash
# Option 1: Use the slash command
/design-review

# Option 2: Invoke the agent directly
@agent-design-review
```

The design review agent will:

- Test all interactive states and user flows
- Verify responsiveness (desktop/tablet/mobile)
- Check accessibility (WCAG 2.1 AA compliance)
- Validate visual polish and consistency
- Test edge cases and error states
- Provide categorized feedback (Blockers/High/Medium/Nitpicks)

### Playwright MCP Integration

#### Essential Commands for UI Testing

```javascript
// Navigation & Screenshots
mcp__playwright__browser_navigate(url); // Navigate to page
mcp__playwright__browser_take_screenshot(); // Capture visual evidence
mcp__playwright__browser_resize(
  width,
  height
); // Test responsiveness

// Interaction Testing
mcp__playwright__browser_click(element); // Test clicks
mcp__playwright__browser_type(
  element,
  text
); // Test input
mcp__playwright__browser_hover(element); // Test hover states

// Validation
mcp__playwright__browser_console_messages(); // Check for errors
mcp__playwright__browser_snapshot(); // Accessibility check
mcp__playwright__browser_wait_for(
  text / element
); // Ensure loading
```

### Design Compliance Checklist

When implementing UI features, verify:

- [ ] **Visual Hierarchy**: Clear focus flow, appropriate spacing
- [ ] **Consistency**: Uses design tokens, follows patterns
- [ ] **Responsiveness**: Works on mobile (375px), tablet (768px), desktop (1440px)
- [ ] **Accessibility**: Keyboard navigable, proper contrast, semantic HTML
- [ ] **Performance**: Fast load times, smooth animations (150-300ms)
- [ ] **Error Handling**: Clear error states, helpful messages
- [ ] **Polish**: Micro-interactions, loading states, empty states, No Emojis

## When to Use Automated Visual Testing

### Use Quick Visual Check for:

- Every front-end change, no matter how small
- After implementing new components or features
- When modifying existing UI elements
- After fixing visual bugs
- Before committing UI changes

### Use Comprehensive Design Review for:

- Major feature implementations
- Before creating pull requests with UI changes
- When refactoring component architecture
- After significant design system updates
- When accessibility compliance is critical

### Skip Visual Testing for:

- Backend-only changes (API, database)
- Configuration file updates
- Documentation changes
- Test file modifications
- Non-visual utility functions

## Additional Context

- Design review agent configuration: `/.claude/agents/design-review-agent.md`
- Design principles checklist: `/context/design-principles.md`
- Custom slash commands: `/context/design-review-slash-command.md`