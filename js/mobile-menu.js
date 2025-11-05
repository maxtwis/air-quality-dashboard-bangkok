// Mobile menu functionality
document.addEventListener('DOMContentLoaded', () => {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileMenuClose = document.getElementById('mobile-menu-close');
  const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

  // Open mobile menu
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
    });
  }

  // Close mobile menu
  const closeMobileMenu = () => {
    mobileMenu.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  };

  if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', closeMobileMenu);
  }

  if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener('click', closeMobileMenu);
  }

  // Handle mobile nav item clicks
  mobileNavItems.forEach((item) => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;

      // Update active state for mobile nav items
      mobileNavItems.forEach((navItem) => {
        navItem.classList.remove('active');
      });
      item.classList.add('active');

      // Update active state for desktop nav items (for consistency)
      const desktopNavItems = document.querySelectorAll('.nav-tab');
      desktopNavItems.forEach((navItem) => {
        if (navItem.dataset.page === page) {
          navItem.classList.add('active');
        } else {
          navItem.classList.remove('active');
        }
      });

      // Close menu after selection
      closeMobileMenu();

      // Trigger the same navigation event that desktop tabs trigger
      // The navigation.js will handle the actual page switching
    });
  });

  // Sync mobile menu active state with desktop nav when page changes
  window.addEventListener('pageChanged', (event) => {
    const currentPage = event.detail?.page;
    if (currentPage) {
      mobileNavItems.forEach((item) => {
        if (item.dataset.page === currentPage) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
      closeMobileMenu();
    }
  });
});
