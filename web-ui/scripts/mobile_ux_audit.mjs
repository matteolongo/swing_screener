import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:8000';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir =
  process.env.AUDIT_OUTPUT_DIR || path.resolve(process.cwd(), '.audit', `mobile-ux-audit-${timestamp}`);

const routeSpecs = [
  { route: '/workspace', slug: 'workspace' },
  { route: '/daily-review', slug: 'daily-review' },
  { route: '/strategy', slug: 'strategy' },
  { route: '/intelligence', slug: 'intelligence' },
];

const devicesToAudit = ['iPhone 13', 'iPhone SE'];

function sanitizeText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return text || fallback;
}

async function collectTapTargetMetrics(page) {
  return page.evaluate(() => {
    const selectors = [
      'button',
      'a[href]',
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
      'select',
      'textarea',
      '[role="button"]',
      '[role="tab"]',
      '[role="menuitem"]',
    ];
    const minSize = 44;
    const elements = Array.from(document.querySelectorAll(selectors.join(',')));
    const visible = elements.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const intersectsViewport =
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight;
      const hiddenByAncestor = Boolean(el.closest('[aria-hidden="true"]'));
      return (
        intersectsViewport &&
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.pointerEvents !== 'none' &&
        !hiddenByAncestor
      );
    });

    const underSized = visible
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label =
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.textContent?.trim() ||
          el.getAttribute('name') ||
          el.id ||
          el.tagName.toLowerCase();
        return {
          tag: el.tagName.toLowerCase(),
          label: (label || '').slice(0, 120),
          width: Number(rect.width.toFixed(1)),
          height: Number(rect.height.toFixed(1)),
        };
      })
      .filter((item) => item.width < minSize || item.height < minSize);

    return {
      minSize,
      totalVisibleInteractive: visible.length,
      undersizedCount: underSized.length,
      undersizedSamples: underSized.slice(0, 12),
    };
  });
}

async function collectPageSummary(page, routeSlug, screenshotPath) {
  const heading = await page
    .locator('main h1')
    .first()
    .textContent()
    .catch(async () => page.locator('h1').first().textContent().catch(() => null));
  const topNotice = await page.locator('[role="alert"], .bg-red-50, .bg-yellow-50, .bg-blue-50').first().textContent().catch(() => null);
  const overflow = await page.evaluate(() => ({
    hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyOverflowStyle: getComputedStyle(document.body).overflow,
  }));
  const tapTargets = await collectTapTargetMetrics(page);
  const axeResults = await new AxeBuilder({ page }).analyze();

  return {
    heading: sanitizeText(heading),
    notice: sanitizeText(topNotice),
    screenshotPath,
    overflow,
    tapTargets,
    axe: {
      violationCount: axeResults.violations.length,
      violations: axeResults.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        affectedNodes: violation.nodes.length,
      })),
    },
  };
}

async function runWorkspaceFlowChecks(page, deviceOutputDir) {
  const checks = {
    runScreenerClicked: false,
    symbolModalOpened: false,
    symbolModalFullscreenMobile: false,
    backgroundScrollLocked: false,
    placeBuyActionVisible: false,
    orderTabSelected: false,
    createOrderButtonVisible: false,
    modalClosedViaBack: false,
    modalScreenshotPath: null,
    notes: [],
  };

  const runButton = page.getByRole('button', { name: /Run Screener/i }).first();
  if (!(await runButton.isVisible().catch(() => false))) {
    checks.notes.push('Run Screener button not visible');
    return checks;
  }

  await runButton.click();
  checks.runScreenerClicked = true;
  await page.waitForTimeout(2500);

  const symbolButtonCandidates = [
    page.locator('button[title^="Open details for"]').first(),
    page.locator('table button').filter({ hasText: /^[A-Z]{1,6}(\.[A-Z]+)?$/ }).first(),
    page.getByRole('button', { name: /^[A-Z]{1,6}(\.[A-Z]+)?$/ }).first(),
  ];

  let symbolButton = null;
  for (const candidate of symbolButtonCandidates) {
    if (await candidate.isVisible().catch(() => false)) {
      symbolButton = candidate;
      break;
    }
  }

  if (!symbolButton) {
    checks.notes.push('No symbol button found in screener results (table or card layout)');
    return checks;
  }

  await symbolButton.click();
  const dialog = page.getByRole('dialog');
  if (!(await dialog.isVisible().catch(() => false))) {
    checks.notes.push('Symbol detail dialog did not open');
    return checks;
  }

  checks.symbolModalOpened = true;
  const dialogClass = (await dialog.getAttribute('class')) || '';
  checks.symbolModalFullscreenMobile =
    dialogClass.includes('h-dvh') && dialogClass.includes('rounded-none');
  checks.backgroundScrollLocked = await page.evaluate(
    () =>
      getComputedStyle(document.body).overflow === 'hidden' &&
      getComputedStyle(document.documentElement).overflow === 'hidden'
  );

  if (deviceOutputDir) {
    const modalScreenshotPath = path.join(deviceOutputDir, 'workspace-symbol-modal.png');
    await page.screenshot({ path: modalScreenshotPath, fullPage: false });
    checks.modalScreenshotPath = modalScreenshotPath;
  }

  const placeBuyButton = dialog.getByRole('button', { name: /Place Buy Order/i }).first();
  checks.placeBuyActionVisible = await placeBuyButton.isVisible().catch(() => false);
  if (checks.placeBuyActionVisible) {
    await placeBuyButton.click();
    await page.waitForTimeout(200);
  }

  const orderTab = dialog.getByRole('tab', { name: /Order/i }).first();
  checks.orderTabSelected = (await orderTab.getAttribute('aria-selected')) === 'true';

  checks.createOrderButtonVisible = await dialog
    .getByRole('button', { name: /Create Order/i })
    .first()
    .isVisible()
    .catch(() => false);

  const backButton = dialog.getByRole('button', { name: /Back/i }).first();
  if (await backButton.isVisible().catch(() => false)) {
    await backButton.click();
    await page.waitForTimeout(250);
    checks.modalClosedViaBack = !(await dialog.isVisible().catch(() => false));
  } else {
    checks.notes.push('Back button not visible in symbol modal');
  }

  return checks;
}

async function runDeviceAudit(browser, deviceName) {
  const device = devices[deviceName];
  if (!device) {
    throw new Error(`Unknown Playwright device: ${deviceName}`);
  }

  const context = await browser.newContext({
    ...device,
    locale: 'en-US',
    colorScheme: 'light',
  });

  await context.addInitScript(() => {
    window.localStorage.setItem(
      'swing-screener-last-result',
      JSON.stringify({
        state: {
          lastResult: {
            candidates: [
              {
                ticker: 'AAPL',
                currency: 'USD',
                name: 'Apple Inc.',
                sector: 'Technology',
                lastBar: '2026-02-26',
                close: 175.5,
                sma20: 170.0,
                sma50: 165.0,
                sma200: 160.0,
                atr: 3.2,
                momentum6m: 24.0,
                momentum12m: 42.0,
                relStrength: 78.0,
                score: 0.92,
                confidence: 0.79,
                rank: 1,
                entry: 175.5,
                stop: 170.0,
                target: 186.0,
                rr: 1.9,
                shares: 12,
                recommendation: {
                  verdict: 'RECOMMENDED',
                  reasonsShort: ['Strong trend alignment'],
                  reasonsDetailed: [],
                  risk: {
                    entry: 175.5,
                    stop: 170.0,
                    target: 186.0,
                    rr: 1.9,
                    riskAmount: 66,
                    riskPct: 0.01,
                    positionSize: 2106,
                    shares: 12,
                    invalidationLevel: 170.0,
                  },
                  costs: {
                    commissionEstimate: 1.0,
                    fxEstimate: 0,
                    slippageEstimate: 0.5,
                    totalCost: 1.5,
                    feeToRiskPct: 0.02,
                  },
                  checklist: [],
                  education: {
                    commonBiasWarning: 'Avoid chasing breakouts late.',
                    whatToLearn: 'Wait for confirmation before entry.',
                    whatWouldMakeValid: ['Sustained close above resistance'],
                  },
                },
              },
            ],
            asofDate: '2026-02-26',
            totalScreened: 1,
            dataFreshness: 'final_close',
            warnings: [],
          },
        },
        version: 0,
      })
    );
    window.localStorage.setItem(
      'swing-screener-onboarding',
      JSON.stringify({
        state: { status: 'completed', currentStep: 0 },
        version: 0,
      })
    );
    window.localStorage.setItem(
      'swing-screener-beginner-mode',
      JSON.stringify({
        state: { isBeginnerMode: true },
        version: 0,
      })
    );
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });

  const deviceOutputDir = path.join(outputDir, deviceName.replace(/\s+/g, '-').toLowerCase());
  await fs.mkdir(deviceOutputDir, { recursive: true });

  const pages = {};
  for (const spec of routeSpecs) {
    const url = `${baseUrl}${spec.route}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (spec.slug === 'daily-review') {
      const loadingLabel = page.getByText('Loading daily review...');
      if (await loadingLabel.isVisible().catch(() => false)) {
        await loadingLabel.waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {});
      }
    }
    await page.waitForTimeout(1400);
    const screenshotPath = path.join(deviceOutputDir, `${spec.slug}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    pages[spec.slug] = await collectPageSummary(page, spec.slug, screenshotPath);
  }

  await page.goto(`${baseUrl}/workspace`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);
  const workspaceFlow = await runWorkspaceFlowChecks(page, deviceOutputDir);

  const navCheck = {
    menuToggleVisible: false,
    menuOpened: false,
    navLinkCountInDrawer: 0,
  };
  const menuToggle = page.getByRole('button', { name: /Show navigation|Hide navigation/i }).first();
  navCheck.menuToggleVisible = await menuToggle.isVisible().catch(() => false);
  if (navCheck.menuToggleVisible) {
    await menuToggle.click();
    await page.waitForTimeout(250);
    const drawer = page.locator('aside').first();
    navCheck.menuOpened = await drawer.isVisible().catch(() => false);
    if (navCheck.menuOpened) {
      navCheck.navLinkCountInDrawer = await drawer.getByRole('link').count();
    }
  }

  await context.close();
  return {
    deviceName,
    viewport: { width: device.viewport.width, height: device.viewport.height },
    pages,
    workspaceFlow,
    navCheck,
    consoleErrors: Array.from(new Set(consoleErrors)).slice(0, 30),
    pageErrors: Array.from(new Set(pageErrors)).slice(0, 30),
  };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      outputDir,
      devices: [],
    };

    for (const deviceName of devicesToAudit) {
      const deviceReport = await runDeviceAudit(browser, deviceName);
      report.devices.push(deviceReport);
    }

    const reportPath = path.join(outputDir, 'report.json');
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    process.stdout.write(`${JSON.stringify({ ok: true, reportPath, outputDir }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`mobile_ux_audit failed: ${error?.stack || String(error)}\n`);
  process.exit(1);
});
