import puppeteer from 'puppeteer';
import fs from 'fs';

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    console.log('Navigating and logging in...');
    await page.goto('https://beta.schedex.co/dashboard', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('input[name="email"]');
    await page.click('input[name="email"]');
    await page.type('input[name="email"]', 'freddykhoury@gmail.com', { delay: 50 });
    await page.click('input[name="password"]');
    await page.type('input[name="password"]', '5EflxJ0vlM', { delay: 50 });
    
    // Dispatch input events
    await page.evaluate(() => {
      document.querySelector('input[name="email"]').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('input[name="password"]').dispatchEvent(new Event('input', { bubbles: true }));
    });
    
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {})
    ]);

    console.log('LoggedIn. URL:', page.url());
    // Wait for the dashboard to settle
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Capture the dashboard screenshot
    await page.screenshot({ path: 'schedex_dashboard.png', fullPage: true });
    console.log('Dashboard screenshot saved as schedex_dashboard.png');

    // Extract page metadata
    const pageData = await page.evaluate(() => {
      // Get all links
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href,
        class: a.className
      }));

      // Get all buttons
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.innerText.trim(),
        class: b.className
      }));

      // Get page headers
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
        tag: h.tagName,
        text: h.innerText.trim()
      }));

      return { links, buttons, headings };
    });

    console.log('\n--- HEADINGS ---');
    console.log(pageData.headings);

    console.log('\n--- NAV LINKS ---');
    const navLinks = pageData.links.filter(l => l.text && !l.href.includes('javascript') && !l.href.includes('#'));
    console.log(navLinks);

    console.log('\n--- BUTTONS ---');
    const actionBtns = pageData.buttons.filter(b => b.text);
    console.log(actionBtns);

    // Let's try to click on the sidebar/nav links one by one to take screenshots
    // We search for elements with specific text, e.g. "Scheduler", "Timesheets", "Employees", "Settings"
    const pagesToVisit = ['Schedule', 'Timesheet', 'Employee', 'Request', 'Setting', 'Shift', 'Clock', 'Attendance'];
    
    for (const item of pagesToVisit) {
      try {
        console.log(`\nAttempting to find and click link containing: "${item}"`);
        const linkSelector = `a`;
        const clicked = await page.evaluate((searchText) => {
          const anchors = Array.from(document.querySelectorAll('a'));
          const target = anchors.find(a => a.innerText && a.innerText.toLowerCase().includes(searchText.toLowerCase()));
          if (target) {
            target.click();
            return { found: true, text: target.innerText, href: target.href };
          }
          return { found: false };
        }, item);

        if (clicked.found) {
          console.log(`Found and clicked: "${clicked.text}" (href: ${clicked.href})`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          const filename = `schedex_${item.toLowerCase().replace(/ /g, '_')}.png`;
          await page.screenshot({ path: filename, fullPage: true });
          console.log(`Saved screenshot: ${filename}`);
          
          // Navigate back to dashboard if we went elsewhere
          if (!page.url().includes('dashboard')) {
            await page.goto('https://beta.schedex.co/dashboard', { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } else {
          console.log(`No link containing "${item}" found.`);
        }
      } catch (e) {
        console.error(`Error navigating to "${item}":`, e.message);
      }
    }

  } catch (error) {
    console.error('Error during execution:', error);
    await page.screenshot({ path: 'explore_error.png' });
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

run();
