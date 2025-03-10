// same file but differnt name.....
// made by cool-dev-guy

const puppeteer = require('puppeteer-extra');
const chrome = require('@sparticuz/chromium');

// Stealth plugin issue - There is a good fix but currently this works.
require('puppeteer-extra-plugin-user-data-dir')
require('puppeteer-extra-plugin-user-preferences')
require('puppeteer-extra-plugin-stealth/evasions/chrome.app')
require('puppeteer-extra-plugin-stealth/evasions/chrome.csi')
require('puppeteer-extra-plugin-stealth/evasions/chrome.loadTimes')
require('puppeteer-extra-plugin-stealth/evasions/chrome.runtime')
require('puppeteer-extra-plugin-stealth/evasions/defaultArgs') // pkg warned me this one was missing
require('puppeteer-extra-plugin-stealth/evasions/iframe.contentWindow')
require('puppeteer-extra-plugin-stealth/evasions/media.codecs')
require('puppeteer-extra-plugin-stealth/evasions/navigator.hardwareConcurrency')
require('puppeteer-extra-plugin-stealth/evasions/navigator.languages')
require('puppeteer-extra-plugin-stealth/evasions/navigator.permissions')
require('puppeteer-extra-plugin-stealth/evasions/navigator.plugins')
require('puppeteer-extra-plugin-stealth/evasions/navigator.vendor')
require('puppeteer-extra-plugin-stealth/evasions/navigator.webdriver')
require('puppeteer-extra-plugin-stealth/evasions/sourceurl')
require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')
require('puppeteer-extra-plugin-stealth/evasions/webgl.vendor')
require('puppeteer-extra-plugin-stealth/evasions/window.outerdimensions')

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

export default async (req, res) => {
  const { body, method } = req;

  // Handle preflight requests
  if (method !== 'POST') {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    return res.status(200).end();
  }

  // Validate the request body
  if (!body) return res.status(400).end(`No body provided`);
  if (typeof body === 'object' && !body.id) return res.status(400).end(`No ID provided`);

  const id = body.id;
  const isProd = process.env.NODE_ENV === 'production';

  // Launch Puppeteer browser
  let browser;
  if (isProd) {
    browser = await puppeteer.launch({
      args: chrome.args,
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath(),
      headless: true,
      ignoreHTTPSErrors: true,
    });
  } else {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    });
  }

  const page = await browser.newPage();
  await page.setRequestInterception(true);

  // Set extra HTTP headers
  await page.setExtraHTTPHeaders({ Referer: 'https://flixhq.to/' });

  // Prepare response data
  const finalResponse = { source: '', subtitle: [] };

  // Intercept network requests
  page.on('request', async (interceptedRequest) => {
    const url = interceptedRequest.url();

    if (url.includes('.m3u8') && !finalResponse.source) {
      finalResponse.source = url;
      console.log('M3U8 link found:', finalResponse.source);
    }

    if (url.includes('.vtt') && !finalResponse.subtitle.includes(url)) {
      finalResponse.subtitle.push(url);
      console.log('VTT link added:', url);
    }

    if (finalResponse.source && finalResponse.subtitle.length > 0) {
      console.log('M3U8 and at least one VTT found. Closing browser.');
      await browser.close();

      // Set response headers and send finalResponse
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Credentials', true);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      );

      return res.json(finalResponse);
    }

    interceptedRequest.continue();
  });

  try {
    // Start navigation and listen for requests
    await page.goto(`https://kerolaunochan.online/v2/embed-4/${id}?z=&_debug=1`, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    console.error('Error during navigation:', error);
    await browser.close();
    return res.status(500).end(`Server Error, check the params.`);
  }
};
