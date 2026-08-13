import puppeteer from 'puppeteer';
import fs from 'fs';

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log('Navigating to dashboard...');
    await page.goto('https://beta.schedex.co/dashboard', { waitUntil: 'networkidle2' });
    console.log('Current URL:', page.url());

    // Wait for the login form to load
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });

    console.log('Typing email...');
    // Focus, click, and type slowly
    await page.click('input[name="email"]');
    await page.type('input[name="email"]', 'freddykhoury@gmail.com', { delay: 100 });

    console.log('Typing password...');
    await page.click('input[name="password"]');
    await page.type('input[name="password"]', '5EflxJ0vlM', { delay: 100 });

    // Let's check if they have values and if the button is still disabled
    const state = await page.evaluate(() => {
      const emailInput = document.querySelector('input[name="email"]');
      const passwordInput = document.querySelector('input[name="password"]');
      const submitBtn = document.querySelector('button[type="submit"]');
      
      // If disabled, let's try to trigger react change handlers manually by dispatching events
      if (submitBtn && submitBtn.disabled) {
        // Dispatch input events
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      return {
        emailValue: emailInput ? emailInput.value : null,
        passwordValue: passwordInput ? passwordInput.value : null,
        btnDisabled: submitBtn ? submitBtn.disabled : null,
        btnClasses: submitBtn ? submitBtn.className : null
      };
    });

    console.log('Input state before click:', state);
    await page.screenshot({ path: 'step2_filled_v2.png' });

    console.log('Clicking submit button...');
    await page.click('button[type="submit"]');

    // Wait for navigation or response
    console.log('Waiting for response...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('URL after wait:', page.url());
    await page.screenshot({ path: 'step3_after_login_v2.png' });

    const finalHtml = await page.content();
    fs.writeFileSync('final_page.html', finalHtml);
    
    // Check if there are error messages displayed on screen
    const errorMsg = await page.evaluate(() => {
      const el = document.querySelector('.error-message');
      return el ? el.textContent : null;
    });
    console.log('Error message on page:', errorMsg);

  } catch (error) {
    console.error('Error during execution:', error);
    await page.screenshot({ path: 'error_screenshot_v2.png' });
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

run();
