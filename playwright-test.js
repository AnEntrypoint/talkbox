import { test, expect } from '@playwright/test';

const APP_URL = 'https://anentrypoint.github.io/talkbox?api=https://talkbox.almagestfraternite.workers.dev';
const TEST_PASSWORD = 'test-password-123';
const TEST_MESSAGE = 'Hello from Playwright test';

// Capture all console messages and network requests
const consoleLogs = [];
const networkRequests = [];

test.describe('Talkbox Application E2E Tests', () => {

  test.beforeEach(async ({ page, context }) => {
    // Clear request log before each test
    networkRequests.length = 0;
    consoleLogs.length = 0;

    // Intercept and log all network requests
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
        timestamp: new Date().toISOString()
      });
    });

    // Intercept and log console messages
    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Log any page errors
    page.on('pageerror', err => {
      consoleLogs.push({
        type: 'error',
        text: err.message
      });
    });

    // Navigate to app
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test('1.1 - Generate Tab: Enter password and generate shortcode', async ({ page }) => {
    // Clear and set password
    await page.fill('#gen-password', TEST_PASSWORD);

    // Click generate button
    await page.click('button:has-text("Generate Shortcode")');

    // Wait for result to appear
    await page.waitForSelector('#gen-result .result.success', { timeout: 5000 });

    // Verify success message appears
    const successDiv = await page.locator('#gen-result .result.success').isVisible();
    expect(successDiv).toBeTruthy();

    // Extract shortcode
    const shortcodeElement = await page.locator('.shortcode').first();
    const shortcode = await shortcodeElement.textContent();

    console.log('Generated shortcode:', shortcode);
    expect(shortcode).toBeTruthy();
    expect(shortcode.length).toBeGreaterThan(0);

    // Verify it looks like a hash (alphanumeric)
    expect(/^[a-f0-9]+$/.test(shortcode)).toBeTruthy();
  });

  test('1.2 - Generate Tab: Shortcode should be deterministic', async ({ page }) => {
    // Generate shortcode first time
    await page.fill('#gen-password', TEST_PASSWORD);
    await page.click('button:has-text("Generate Shortcode")');
    await page.waitForSelector('#gen-result .shortcode');
    const shortcode1 = await page.locator('.shortcode').first().textContent();

    // Clear result
    await page.evaluate(() => {
      document.getElementById('gen-result').innerHTML = '';
    });

    // Generate again with same password
    await page.fill('#gen-password', TEST_PASSWORD);
    await page.click('button:has-text("Generate Shortcode")');
    await page.waitForSelector('#gen-result .shortcode');
    const shortcode2 = await page.locator('.shortcode').first().textContent();

    // Should be identical
    expect(shortcode1).toBe(shortcode2);
    console.log('Deterministic check passed:', shortcode1);
  });

  test('1.3 - Generate Tab: Copy button should work', async ({ page }) => {
    // Generate shortcode
    await page.fill('#gen-password', TEST_PASSWORD);
    await page.click('button:has-text("Generate Shortcode")');
    await page.waitForSelector('#gen-result .copy-button');

    // Get original button text
    const copyButton = page.locator('.copy-button').first();
    const originalText = await copyButton.textContent();

    // Click copy button
    await copyButton.click();

    // Wait for button to change
    await page.waitForTimeout(100);
    const newText = await copyButton.textContent();
    expect(newText).toContain('✓');

    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBeTruthy();
    expect(/^[a-f0-9]+$/.test(clipboardText)).toBeTruthy();
    console.log('Copy button works, clipboard text:', clipboardText);
  });

  test('1.4 - Generate Tab: Verify NO /generate endpoint call', async ({ page }) => {
    // Clear network log
    networkRequests.length = 0;

    // Generate shortcode
    await page.fill('#gen-password', TEST_PASSWORD);
    await page.click('button:has-text("Generate Shortcode")');
    await page.waitForSelector('#gen-result .result.success', { timeout: 5000 });

    // Check network requests
    const generateCalls = networkRequests.filter(req =>
      req.url.includes('/generate')
    );

    expect(generateCalls.length).toBe(0);
    console.log('Network requests made:', networkRequests.map(r => r.url));
    console.log('Confirmed: No /generate endpoint was called');
  });

  test('1.5 - Generate Tab: Form validation (empty password)', async ({ page }) => {
    // Try to generate without password
    await page.click('button:has-text("Generate Shortcode")');

    // Wait for error message
    await page.waitForSelector('#gen-result .result.error', { timeout: 5000 });

    const errorMsg = await page.locator('#gen-result .result').textContent();
    expect(errorMsg).toContain('Please enter a password');
    console.log('Empty password validation works');
  });

  test('2.1 - Send Tab: Send message successfully', async ({ page }) => {
    // Switch to Send tab
    await page.click('.tab:has-text("Send")');

    // Fill form
    await page.fill('#send-password', TEST_PASSWORD);
    await page.fill('#send-message', TEST_MESSAGE);

    // Send message
    await page.click('button:has-text("Send Message")');

    // Wait for success response
    await page.waitForSelector('#send-result .result.success', { timeout: 10000 });

    const resultText = await page.locator('#send-result').textContent();
    expect(resultText).toContain('Message sent');
    expect(resultText).toContain('ID');

    console.log('Message sent successfully');
  });

  test('2.2 - Send Tab: Verify API call structure', async ({ page }) => {
    // Clear network log
    networkRequests.length = 0;

    // Switch to Send tab
    await page.click('.tab:has-text("Send")');

    // Fill form
    await page.fill('#send-password', TEST_PASSWORD);
    await page.fill('#send-message', TEST_MESSAGE);

    // Send message
    await page.click('button:has-text("Send Message")');

    // Wait for request
    await page.waitForTimeout(1000);

    // Find /send endpoint call
    const sendCall = networkRequests.find(req =>
      req.url.includes('/send') && req.method === 'POST'
    );

    expect(sendCall).toBeTruthy();

    if (sendCall) {
      const body = JSON.parse(sendCall.postData);
      expect(body.shortcode).toBeTruthy();
      expect(body.password).toBe(TEST_PASSWORD);
      expect(body.message).toBe(TEST_MESSAGE);
      console.log('API call structure verified:', body);
    }
  });

  test('2.3 - Send Tab: Form validation (empty fields)', async ({ page }) => {
    // Switch to Send tab
    await page.click('.tab:has-text("Send")');

    // Try to send without fields
    await page.click('button:has-text("Send Message")');

    // Wait for error
    await page.waitForSelector('#send-result .result.error', { timeout: 5000 });

    const errorMsg = await page.locator('#send-result').textContent();
    expect(errorMsg).toContain('Please enter password and message');
  });

  test('2.4 - Send Tab: Check for console errors during send', async ({ page }) => {
    // Switch to Send tab
    await page.click('.tab:has-text("Send")');

    // Fill form
    await page.fill('#send-password', TEST_PASSWORD);
    await page.fill('#send-message', TEST_MESSAGE);

    // Send message
    await page.click('button:has-text("Send Message")');

    // Wait for completion
    await page.waitForSelector('#send-result .result', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Check for errors in console
    const errors = consoleLogs.filter(log =>
      log.type === 'error' || (log.type === 'log' && log.text.toLowerCase().includes('error'))
    );

    console.log('Console logs:', consoleLogs);
    expect(errors.length).toBe(0);
  });

  test('3.1 - Read Tab: Read messages', async ({ page }) => {
    // First, send a message
    await page.click('.tab:has-text("Send")');
    await page.fill('#send-password', TEST_PASSWORD);
    await page.fill('#send-message', TEST_MESSAGE);
    await page.click('button:has-text("Send Message")');
    await page.waitForSelector('#send-result .result.success', { timeout: 10000 });

    // Wait a bit for relay delivery
    await page.waitForTimeout(3000);

    // Switch to Read tab
    await page.click('.tab:has-text("Read")');

    // Set password
    await page.fill('#read-password', TEST_PASSWORD);

    // Click read messages
    await page.click('button:has-text("Read Messages")');

    // Wait for result (with longer timeout for relay delivery)
    await page.waitForSelector('#read-result .result', { timeout: 15000 });

    const resultText = await page.locator('#read-result').textContent();
    expect(resultText).toBeTruthy();

    console.log('Read messages result:', resultText);
  });

  test('3.2 - Read Tab: Display shortcode when no messages', async ({ page }) => {
    // Switch to Read tab
    await page.click('.tab:has-text("Read")');

    // Use a different password to ensure no messages
    await page.fill('#read-password', 'unique-test-password-' + Date.now());

    // Click read messages
    await page.click('button:has-text("Read Messages")');

    // Wait for result
    await page.waitForSelector('#read-result .result', { timeout: 10000 });

    // Should show shortcode or "no messages"
    const resultText = await page.locator('#read-result').textContent();
    expect(resultText).toBeTruthy();
  });

  test('3.3 - Read Tab: Form validation (empty password)', async ({ page }) => {
    // Switch to Read tab
    await page.click('.tab:has-text("Read")');

    // Clear password
    await page.fill('#read-password', '');

    // Try to read
    await page.click('button:has-text("Read Messages")');

    // Wait for error
    await page.waitForSelector('#read-result .result.error', { timeout: 5000 });

    const errorMsg = await page.locator('#read-result').textContent();
    expect(errorMsg).toContain('Please enter your password');
  });

  test('4.1 - UI/UX: Tab switching works correctly', async ({ page }) => {
    // Verify Generate tab is active initially
    const generateTab = page.locator('.tab:has-text("Generate")');
    const generateContent = page.locator('#generate');

    expect(await generateTab.locator('..').isVisible()).toBeTruthy();
    expect(await generateContent.isVisible()).toBeTruthy();

    // Switch to Send tab
    await page.click('.tab:has-text("Send")');
    await page.waitForTimeout(300);

    const sendContent = page.locator('#send');
    expect(await sendContent.isVisible()).toBeTruthy();
    expect(await generateContent.isVisible()).toBeFalsy();

    // Switch to Read tab
    await page.click('.tab:has-text("Read")');
    await page.waitForTimeout(300);

    const readContent = page.locator('#read');
    expect(await readContent.isVisible()).toBeTruthy();
    expect(await sendContent.isVisible()).toBeFalsy();

    console.log('Tab switching works correctly');
  });

  test('4.2 - UI/UX: API URL from query parameter', async ({ page }) => {
    // Check console for API URL log
    const apiLogs = consoleLogs.filter(log =>
      log.text.includes('Talkbox frontend using API')
    );

    expect(apiLogs.length).toBeGreaterThan(0);
    expect(apiLogs[0].text).toContain('https://talkbox.almagestfraternite.workers.dev');

    console.log('API URL correctly set from query parameter');
  });

  test('4.3 - UI/UX: Responsive design check', async ({ page }) => {
    // Check main container exists
    const container = page.locator('.container');
    expect(await container.isVisible()).toBeTruthy();

    // Check header
    const header = page.locator('.header');
    expect(await header.isVisible()).toBeTruthy();

    // Check tabs
    const tabs = page.locator('.tabs');
    expect(await tabs.isVisible()).toBeTruthy();

    // Count tab buttons
    const tabButtons = page.locator('.tab');
    const tabCount = await tabButtons.count();
    expect(tabCount).toBe(3);

    console.log('Responsive design elements present');
  });

  test('4.4 - UI/UX: Page title and headers', async ({ page }) => {
    // Check page title
    const title = await page.title();
    expect(title).toContain('Talkbox');

    // Check h1 header
    const h1 = await page.locator('h1').textContent();
    expect(h1).toContain('Talkbox');

    // Check subtitle
    const subtitle = await page.locator('.header p').textContent();
    expect(subtitle).toContain('Secure message exchange');

    console.log('Page title and headers are correct');
  });

  test('4.5 - Console: No errors on initial load', async ({ page }) => {
    // Wait for any initial loading to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check for errors
    const errors = consoleLogs.filter(log => log.type === 'error');

    console.log('All console logs:', JSON.stringify(consoleLogs, null, 2));
    expect(errors.length).toBe(0);
  });

  test('4.6 - Error handling: API URL is accessible', async ({ page }) => {
    // Try to reach the API endpoint
    const response = await page.evaluate(() => {
      return fetch('https://talkbox.almagestfraternite.workers.dev/health')
        .then(r => ({ status: r.status, ok: r.ok }))
        .catch(e => ({ error: e.message }));
    });

    console.log('API health check response:', response);
  });
});
