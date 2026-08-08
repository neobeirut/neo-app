/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Skip automatic Chrome download during npm install / npm ci in Docker / CI
  skipDownload: true,
};
