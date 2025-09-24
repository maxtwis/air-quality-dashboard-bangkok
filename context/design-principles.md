# Bangkok Health Dashboard Design Principles

## I. Core Mission & Philosophy

- [x] **Health Equity First:** Ensure all Bangkok residents have access to health information, regardless of technical literacy or language
- [x] **Data-Driven Decisions:** Transform complex health data into actionable insights for policymakers and communities
- [x] **Community-Centric:** Focus on vulnerable populations (elderly, informal workers, disabled)
- [x] **Scientific Rigor:** Maintain statistical validity with minimum sample sizes and transparent methodologies
- [x] **Responsive Design:** Work seamlessly across devices from mobile phones to desktop displays
- [x] **Bilingual Support:** Thai/English toggle for inclusive accessibility
- [x] **Performance Optimized:** Fast loading times even on limited bandwidth connections
- [x] **Progressive Disclosure:** Start with overview, allow drilling into details as needed

## II. Visual Design System

### Color Palette

- [x] **Health Status Colors:**
  - [x] **Good (Green):** #10B981 - Indicators meeting targets
  - [x] **Warning (Yellow):** #F59E0B - Indicators needing attention
  - [x] **Critical (Red):** #EF4444 - Indicators requiring urgent action
  - [x] **Neutral (Gray):** #6B7280 - Unavailable/insufficient data
- [x] **Domain Colors:**
  - [x] **Physical Health:** #3B82F6 (Blue)
  - [x] **Mental Health:** #8B5CF6 (Purple)
  - [x] **Social Health:** #10B981 (Green)
  - [x] **Environmental Health:** #F59E0B (Amber)
- [x] **Background & Neutrals:**
  - [x] White backgrounds for data clarity
  - [x] Gray scale (#F9FAFB to #111827) for hierarchy
  - [x] Sufficient contrast for WCAG AA compliance

### Typography

- [x] **Font Family:** System fonts for optimal performance
- [x] **Scale:**
  - [x] H1: 32px - Dashboard titles
  - [x] H2: 24px - Section headers
  - [x] H3: 20px - Subsection headers
  - [x] Body: 16px - Default text
  - [x] Small: 14px - Secondary information
  - [x] Caption: 12px - Data labels
- [x] **Thai Language Support:** Ensure proper rendering of Thai characters
- [x] **Numeric Display:** Monospace for data tables and statistics

### Spacing & Layout

- [x] **8px Base Unit:** All spacing multiples of 8px
- [x] **Responsive Grid:** 12-column system
- [x] **Generous Whitespace:** Improve readability and reduce cognitive load
- [x] **Consistent Margins:** 16px mobile, 24px tablet, 32px desktop

## III. Data Visualization Standards

### Maps

- [x] **Choropleth Maps:** Color-coded districts by indicator values
- [x] **Interactive Tooltips:** Show district details on hover/click
- [x] **Healthcare Facilities:** Pin markers for hospitals and clinics
- [x] **Legend:** Clear color scale with value ranges
- [x] **Zoom Controls:** Allow detailed district exploration

### Charts

- [x] **Bar Charts:** For district comparisons
- [x] **Spider/Radar Charts:** For multi-indicator profiles
- [x] **Time Series:** For trend analysis
- [x] **Consistent Colors:** Match domain color scheme
- [x] **Responsive Sizing:** Adapt to container width
- [x] **Data Labels:** Show values on hover/focus
- [x] **Axis Labels:** Clear units and descriptions

### Tables

- [x] **Sortable Columns:** Click headers to sort
- [x] **Color Indicators:** Traffic light status in cells
- [x] **Sticky Headers:** Keep headers visible when scrolling
- [x] **Row Highlights:** Hover states for better tracking
- [x] **Responsive Design:** Horizontal scroll on mobile
- [x] **Export Options:** Download as CSV/Excel

## IV. Navigation & Information Architecture

### Primary Navigation

- [x] **Tab-Based Navigation:** Main sections (Overview, Detail, Analysis)
- [x] **Breadcrumbs:** Show current location in hierarchy
- [x] **Quick Filters:** Domain and population group selectors
- [x] **Search:** Find specific indicators or districts

### Dashboard Hierarchy

```
Landing Page
├── Overview Dashboard
│   ├── Key Metrics Summary
│   ├── Bangkok Map View
│   └── Domain Overview Cards
├── Indicator Detail
│   ├── District Rankings
│   ├── Population Group Analysis
│   └── Time Trends
└── Comparative Analysis
    ├── Multi-District Comparison
    ├── Spider Chart Profiles
    └── Healthcare Supply Analysis
```

### User Flows

- [x] **Exploration Flow:** Overview → Select Indicator → View Details → Compare
- [x] **Analysis Flow:** Select Districts → Choose Indicators → Generate Report
- [x] **Quick Access:** Direct links to critical indicators

## V. Component Patterns

### Cards

- [x] **Metric Cards:** Large number, trend arrow, color status
- [x] **Domain Cards:** Icon, title, key indicators summary
- [x] **District Cards:** Name, population, top concerns
- [x] **Consistent Padding:** 16px internal spacing
- [x] **Subtle Shadows:** Elevation for hierarchy
- [x] **Hover States:** Slight elevation change

### Filters & Controls

- [x] **Select Dropdowns:** For domain/indicator selection
- [x] **Checkbox Groups:** For multiple district selection
- [x] **Radio Buttons:** For view mode selection
- [x] **Toggle Switches:** For Thai/English language
- [x] **Clear Labels:** Descriptive text for all controls
- [x] **Reset Options:** Clear all filters button

### Status Indicators

- [x] **Traffic Lights:** Red/Yellow/Green circles
- [x] **Progress Bars:** Show achievement levels
- [x] **Trend Arrows:** Up/down/stable indicators
- [x] **Badges:** Population group tags
- [x] **Tooltips:** Explanatory text on hover

## VI. Accessibility Standards

- [x] **WCAG AA Compliance:** Minimum contrast ratios
- [x] **Keyboard Navigation:** All interactive elements accessible
- [x] **Screen Reader Support:** Proper ARIA labels
- [x] **Focus Indicators:** Clear visual focus states
- [x] **Alt Text:** Descriptions for all charts and maps
- [x] **Color Independence:** Don't rely solely on color
- [x] **Text Scaling:** Support browser zoom to 200%
- [x] **Mobile Touch Targets:** Minimum 44x44px

## VII. Performance Optimization

- [x] **Code Splitting:** Separate bundles for charts, maps, utilities
- [x] **Lazy Loading:** Load visualizations on demand
- [x] **Data Caching:** Memoize expensive calculations
- [x] **Image Optimization:** SVG icons, optimized PNGs
- [x] **Minimal Dependencies:** Use native APIs where possible
- [x] **Progressive Enhancement:** Core functionality without JS
- [x] **CDN Delivery:** Static assets from edge locations

## VIII. Bangkok Health Context

### Key Stakeholder Needs

- [x] **Policymakers:** High-level dashboards, district comparisons
- [x] **Healthcare Providers:** Facility gaps, service coverage
- [x] **Community Leaders:** Local health profiles, priority issues
- [x] **Researchers:** Raw data access, statistical validity
- [x] **Citizens:** Simple summaries, actionable information

### Data Integrity

- [x] **Minimum Sample Size:** 5 respondents per district
- [x] **Missing Data Handling:** Clear "No Data" states
- [x] **Update Timestamps:** Show data collection dates
- [x] **Methodology Notes:** Link to survey methods
- [x] **Confidence Intervals:** Show statistical uncertainty

### Priority Indicators

- [x] **Healthcare Access:** Facility ratios, travel times
- [x] **Disease Burden:** Prevalence of key conditions
- [x] **Environmental Factors:** Air quality, sanitation
- [x] **Social Determinants:** Income, education, housing
- [x] **Mental Health:** Stress, depression, social support

## IX. Implementation Checklist

### Development Setup

- [x] React 19 with Vite for fast development
- [x] Tailwind CSS for utility-first styling
- [x] Recharts for data visualization
- [x] Leaflet for interactive maps
- [x] PapaCSV for data processing

### Quality Assurance

- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile device testing (iOS, Android)
- [ ] Performance profiling (Lighthouse scores)
- [ ] Accessibility audit (axe DevTools)
- [ ] Thai language QA
- [ ] Data accuracy validation

### Deployment

- [ ] Production build optimization
- [ ] Error monitoring setup
- [ ] Analytics implementation
- [ ] CDN configuration
- [ ] SSL certificate
- [ ] Backup procedures
