// Language switching functionality
import { initLanguage, setLanguage, getLanguage, t } from './translations.js';

// Initialize language on page load
initLanguage();

// Setup language switcher buttons
document.addEventListener('DOMContentLoaded', () => {
  const langButtons = document.querySelectorAll('.lang-btn');
  const currentLang = getLanguage();

  // Set active state on initial load
  langButtons.forEach((btn) => {
    if (btn.dataset.lang === currentLang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Add click handlers
  langButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      setLanguage(lang);

      // Update button states
      langButtons.forEach((b) => {
        if (b.dataset.lang === lang) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    });
  });

  // Initial translation update
  updatePageTranslations();
});

// Update all translations on the page
function updatePageTranslations() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });
}

// Export for use in other modules
export { t, setLanguage, getLanguage };
