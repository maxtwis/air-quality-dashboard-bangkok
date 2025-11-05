import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome' // Try to use system Chrome instead
  });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000');

  // Wait for the map to load
  await page.waitForTimeout(3000);

  console.log('Taking screenshot of main map page...');
  await page.screenshot({ path: 'mobile-screenshot-1-map.png', fullPage: true });

  // Click on "เกี่ยวกับ AQHI" tab
  console.log('Clicking on "เกี่ยวกับ AQHI" tab...');
  await page.click('text=เกี่ยวกับ AQHI');
  await page.waitForTimeout(1000);

  console.log('Taking screenshot of About page...');
  await page.screenshot({ path: 'mobile-screenshot-2-about.png', fullPage: true });

  // Click on "คำแนะนำสุขภาพ" tab
  console.log('Clicking on "คำแนะนำสุขภาพ" tab...');
  await page.click('text=คำแนะนำสุขภาพ');
  await page.waitForTimeout(1000);

  console.log('Taking screenshot of Health page...');
  await page.screenshot({ path: 'mobile-screenshot-3-health.png', fullPage: true });

  console.log('All screenshots captured successfully!');

  await browser.close();
})();
