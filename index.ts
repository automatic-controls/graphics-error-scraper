
import type * as puppeteerType from 'puppeteer';
import type * as fsType from 'fs';
const { createRequire } = require('module');
const requireFromDisk = createRequire(__filename);
process.env['PUPPETEER_CACHE_DIR'] = require('path').resolve(__dirname, '.cache/puppeteer');
const puppeteer: typeof puppeteerType = requireFromDisk('puppeteer');
const fs: typeof fsType = require('fs');

(async () => {
  // Simple argument parser for named flags
  const args = process.argv.slice(2);
  // Aliases for flags
  const flagAliases = Object.entries({
    '-u': 'url', '--url': 'url',
    '-U': 'username', '--username': 'username',
    '-p': 'password', '--password': 'password',
    '-o': 'output', '--output': 'output',
    '-h': 'headless', '--headless': 'headless',
    '-v': 'verbose', '--verbose': 'verbose',
    '-f': 'force', '--force': 'force',
    '-i': 'ignoressl', '--ignoressl': 'ignoressl',
    '-t': 'timeout', '--timeout': 'timeout'
  });

  // Helper to get argument value by flag or alias
  const getArg = (name: string) => {
    const flags = flagAliases.filter(([_k, v]) => v === name).map(([k]) => k);
    for (const flag of flags) {
      const idx = args.findIndex(a => a === flag);
      if (idx !== -1 && idx + 1 < args.length) {
        const val = args[idx + 1];
        if (val === '-' || !val.startsWith('-')) {
          return val;
        }
      }
    }
    return undefined;
  };
  // Helper to check if a flag or alias is present
  const hasFlag = (name: string) => {
    const flags = flagAliases.filter(([_k, v]) => v === name).map(([k]) => k);
    return flags.some(flag => args.includes(flag));
  };

  // Special case: -v or --version with no other parameters
  const onlyVersion = (args.length === 1 && (args[0] === '-v' || args[0] === '--version'));
  if (hasFlag('version') || onlyVersion) {
    console.log('v0.1.2');
    return;
  }

  const url = getArg('url');
  const username = getArg('username');
  const password = getArg('password');
  const outputFile = getArg('output') || 'errors.json';
  const force = hasFlag('force');
  const headlessArg = getArg('headless');
  const verbose = hasFlag('verbose') || getArg('verbose') === 'true';

  if (!url || !username || !password) {
    console.error(
      'Usage: graphics-error-scraper [options]\n' +
      '  -u, --url <url>             Target URL (required)\n' +
      '  -U, --username <username>   Username (required)\n' +
      '  -p, --password <password>   Password (required)\n' +
      '  -o, --output <file>         Output file (default: errors.json, use - for stdout)\n' +
      '  -f, --force                 Overwrite output file if it exists\n' +
      '  -i, --ignoressl             Ignore SSL certificate errors\n' +
      '  -t, --timeout <ms>          Timeout for page actions in milliseconds (default: 180000)\n' +
      '  -h, --headless <bool>       Headless mode (true/false, default: true)\n' +
      '  -v, --verbose               Verbose logging (flag or "true")\n' +
      '      --version, -v           Print version and exit'
    );
    process.exit(1);
  }
  // headless: optional, defaults to true, accepts 'true' or 'false'
  const headless = headlessArg === undefined ? true : headlessArg.toLowerCase() === 'true';
  const ignoreSSL = hasFlag('ignoressl');
  const timeoutArg = getArg('timeout');
  const timeout = timeoutArg !== undefined && !isNaN(Number(timeoutArg)) ? Number(timeoutArg) : 180000;

  // Helper for conditional logging
  const log = (...args: any[]) => { if (verbose) console.log(...args); };

  // Browser setup
  const startTime = Date.now();
  log("Started: " + new Date().toLocaleString());
  if (!force && outputFile !== '-' && fs.existsSync(outputFile)) {
    console.error(`Output file '${outputFile}' already exists. Use --force or -f to overwrite.`);
    process.exit(2);
  }
  log(`Navigating to ${url}`);
  const launchOpts: puppeteerType.LaunchOptions & Record<string, any> = headless
    ? { headless: true }
    : { headless: false, defaultViewport: null, args: ['--start-maximized'] };
  if (ignoreSSL) {
    launchOpts.acceptInsecureCerts = true;
    if (launchOpts.args) {
      launchOpts.args.push('--disable-features=HttpsFirstBalancedModeAutoEnable');
    } else {
      launchOpts.args = ['--disable-features=HttpsFirstBalancedModeAutoEnable'];
    }
  }
  launchOpts.timeout = timeout;
  launchOpts.protocolTimeout = timeout;
  const browser = await puppeteer.launch(launchOpts);
  const [page] = await browser.pages();
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);

  // Promise-based wait function
  async function wait() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.waitForNetworkIdle();
  }

  async function logout() {
    await page.locator('img[title="System Menu"]').click();
    await wait();
    await page.evaluate(() => {
      const x = (document.getElementById('rightMenuiframe') as HTMLIFrameElement)?.contentWindow?.document.getElementById('main_logout');
      if (x?.onmouseup) {
        x.onmouseup(new MouseEvent('mouseup', { bubbles: false }));
      }
    });
    await wait();
    await browser.close();
    process.exit(0);
  }

  // Login
  await page.goto(url);
  log('Logging in...');
  await page.locator('#nameInput').fill(username);
  await page.locator('#pass').fill(password);
  await page.locator('#submit').click();
  await page.waitForNavigation();
  await wait();
  const navFrame = await (await (await (await page.mainFrame().$('#navTableFrame'))?.contentFrame())?.$('#navContent'))?.contentFrame();
  if (!navFrame) {
    console.error('Navigation frame not found. Possibly invalid credentials.');
    process.exit(3);
  }

  // Expand all areas
  log("Expanding geographic tree nodes...");
  while (await page.evaluate(() => {
    let change = false;
    const doc = (document.getElementById('navTableFrame') as HTMLIFrameElement)?.contentWindow?.document.getElementById('navContent');
    const doc2 = (doc as HTMLIFrameElement)?.contentWindow?.document;
    if (!doc2) {
      return false;
    }
    for (const x of doc2.querySelectorAll('.TreeCtrl-twisty')) {
      if ((x as HTMLElement).getAttribute('src')?.includes('/clean_collapsed.png')) {
        const icon = x.parentElement?.querySelector('.TreeCtrl-content > img.TreeCtrl-icon');
        if (icon && (icon as HTMLElement).getAttribute('src')?.endsWith('/area.gif')) {
          (x as HTMLElement).click();
          change = true;
        }
      }
    }
    return change;
  })) {
    await wait();
  }

  // Check for errors
  log("Checking for errors...");
  async function getDisplayPath(g: any) {
    return await g.evaluate((g: any) => {
      let p;
      let s = '';
      let q;
      while (p = g?.querySelector('.TreeCtrl-text')?.innerText) {
        s = p + (s ? ' / ' : '') + s;
        q = g?.parentElement?.parentElement?.parentElement?.parentElement?.querySelector('.TreeCtrl-content') ?? undefined;
        if (g === q) {
          break;
        }
        g = q;
      }
      return s;
    });
  }

  const errors = [];
  for (const g of await navFrame.$$('.TreeCtrl-outer[id^=geoTree] .TreeCtrl-content')) {
    try {
      await g.click();
    } catch (ex) {
      continue;
    }
    await wait();
    if (await page.$('#actButtonSpan > span[title="View graphics"]') && await page.$('#errorIndication:not([style*="display: none"])')) {
      const e = await page.evaluate(() => {
        return {
          //@ts-ignore
          mainErrors: DisplayError.getMainErrors(),
          //@ts-ignore
          actionErrors: DisplayError.getActionErrors(),
          //@ts-ignore
          infoMessages: DisplayError.getInfoMessages()
        };
      });
      // Set url property to undefined if present in any error object
      const cleanList = (arr: any[]) => arr.map(obj => {
        if (obj && typeof obj === 'object' && 'url' in obj) {
          return { ...obj, url: undefined };
        }
        return obj;
      });
      const errorObj: any = { path: await getDisplayPath(g) };
      if (e.mainErrors && e.mainErrors.length > 0) errorObj.mainErrors = cleanList(e.mainErrors);
      if (e.actionErrors && e.actionErrors.length > 0) errorObj.actionErrors = cleanList(e.actionErrors);
      if (e.infoMessages && e.infoMessages.length > 0) errorObj.infoMessages = cleanList(e.infoMessages);
      errors.push(errorObj);
    }
  }
  if (outputFile === '-') {
    console.log(JSON.stringify(errors, null, 2));
  } else {
    if (!force && fs.existsSync(outputFile)) {
      console.error(`Output file '${outputFile}' already exists. Use --force or -f to overwrite.`);
      process.exit(2);
    }
    fs.writeFileSync(outputFile, JSON.stringify(errors, null, 2));
    log(`Results written to ${outputFile}`);
  }

  // Logout
  log("Logging out...");
  await logout();
  log("Ended: " + new Date().toLocaleString());
  log(`Completed in ${((Date.now() - startTime) / 60000).toFixed(2)} minutes.`);
})();