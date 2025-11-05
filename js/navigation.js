// Navigation and Page Management
import { healthRecommendations } from './health-recommendations.js';
import { getMap } from './map.js';

class NavigationManager {
  constructor() {
    this.currentPage = 'map';
    this.init();
  }

  init() {
    // Set up nav tab click handlers (desktop)
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.dataset.page;
        this.switchPage(page);
      });
    });

    // Set up mobile nav click handlers
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        this.switchPage(page);
      });
    });

    // Load health advice when the page loads
    this.loadHealthAdvice();
  }

  switchPage(pageName) {
    // Update active tab (desktop)
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.page === pageName) {
        tab.classList.add('active');
      }
    });

    // Update active tab (mobile)
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === pageName) {
        item.classList.add('active');
      }
    });

    // Update active page content (in sidebar for map page)
    document.querySelectorAll('.sidebar .page-content').forEach(page => {
      page.classList.remove('active');
    });

    // Update active page content (in main content for about/health pages)
    document.querySelectorAll('.main-content .page-content').forEach(page => {
      page.classList.remove('active');
    });

    this.currentPage = pageName;

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: { page: pageName } }));

    // Show/hide appropriate containers
    const mapContainer = document.querySelector('.map-container');
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.sidebar');

    if (pageName === 'map') {
      // Show map and sidebar
      if (mapContainer) mapContainer.classList.remove('hidden');
      if (mainContent) mainContent.classList.remove('active');
      if (sidebar) sidebar.style.display = 'block';

      // Activate map page content in sidebar
      const mapPage = document.querySelector('.sidebar #page-map');
      if (mapPage) mapPage.classList.add('active');

      // Fix map rendering after showing it
      setTimeout(() => {
        const map = getMap();
        if (map) {
          map.invalidateSize();
        }
      }, 100);
    } else {
      // Show main content, hide map
      if (mapContainer) mapContainer.classList.add('hidden');
      if (mainContent) mainContent.classList.add('active');
      if (sidebar) sidebar.style.display = 'none';

      // Activate appropriate page in main content
      const targetPage = document.querySelector(`.main-content #page-${pageName}`);
      if (targetPage) targetPage.classList.add('active');
    }
  }

  async loadHealthAdvice() {
    try {
      // Wait for health recommendations to load
      await healthRecommendations.loadRecommendations();
      const recs = healthRecommendations.recommendations;

      if (!recs || recs.length === 0) {
        document.getElementById('health-advice-content').innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--gray-500);">
            ไม่พบข้อมูลคำแนะนำสุขภาพ
          </div>
        `;
        return;
      }

      // Group recommendations by type
      const groupedByType = {};
      recs.forEach(rec => {
        if (!groupedByType[rec.type]) {
          groupedByType[rec.type] = {};
        }
        if (!groupedByType[rec.type][rec.type_description]) {
          groupedByType[rec.type][rec.type_description] = [];
        }
        groupedByType[rec.type][rec.type_description].push(rec);
      });

      // Generate HTML for each type
      let html = '';

      Object.entries(groupedByType).forEach(([type, groups]) => {
        const typeTitle = healthRecommendations.getGroupTitle(type);
        const typeIcon = this.getTypeIcon(type);

        html += `
          <div class="advice-type-section">
            <h3 class="advice-type-title">
              <i class="material-icons">${typeIcon}</i>
              ${typeTitle}
            </h3>
        `;

        Object.entries(groups).forEach(([groupName, recommendations]) => {
          const groupIcon = healthRecommendations.getGroupIcon(type, groupName);

          html += `
            <div class="advice-group-card">
              <div class="advice-group-header">
                <i class="material-icons">${groupIcon}</i>
                <span>${groupName}</span>
              </div>
              <div class="advice-table">
          `;

          recommendations.forEach(rec => {
            const aqhiLevel = this.getAQHILevelInfo(rec.aqhi_level);

            html += `
              <div class="advice-row" style="border-left-color: ${aqhiLevel.color};">
                <div class="advice-level" style="background: ${aqhiLevel.color};">
                  ${aqhiLevel.label}
                </div>
                <div class="advice-text">
                  ${rec.health_recommendation}
                </div>
              </div>
            `;
          });

          html += `
              </div>
            </div>
          `;
        });

        html += `</div>`;
      });

      document.getElementById('health-advice-content').innerHTML = html;
    } catch (error) {
      document.getElementById('health-advice-content').innerHTML = `
        <div class="error">
          เกิดข้อผิดพลาดในการโหลดข้อมูล: ${error.message}
        </div>
      `;
    }
  }

  getTypeIcon(type) {
    const iconMap = {
      'age': 'groups',
      'diseases': 'medical_services',
      'job': 'work'
    };
    return iconMap[type] || 'info';
  }

  getAQHILevelInfo(levelText) {
    if (levelText.includes('1-3') || levelText.includes('Low')) {
      return { label: 'ต่ำ (1-3)', color: '#10b981' };
    } else if (levelText.includes('4-6') || levelText.includes('Moderate')) {
      return { label: 'ปานกลาง (4-6)', color: '#f59e0b' };
    } else if (levelText.includes('7-10') || levelText.includes('High')) {
      return { label: 'สูง (7-10)', color: '#ef4444' };
    } else if (levelText.includes('10+') || levelText.includes('Very high')) {
      return { label: 'สูงมาก (10+)', color: '#991b1b' };
    }
    return { label: levelText, color: '#6b7280' };
  }
}

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.navigationManager = new NavigationManager();
  });
} else {
  window.navigationManager = new NavigationManager();
}

export { NavigationManager };
