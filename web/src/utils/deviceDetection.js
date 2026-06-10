/**
 * Device detection and app opening utility for Neo Beirut
 */

// App Store Links
const APP_STORE_URL = "https://apps.apple.com/us/app/neo-beirut/id6758227724";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.neobeirut.app&hl=en";
const FALLBACK_PAGE = "/download-app";

// Deep link scheme (optional - for installed app detection)
const APP_SCHEME = "neobeirut://";

/**
 * Detect user's device type
 * @returns {'ios' | 'android' | 'desktop'}
 */
export function detectDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "desktop";
  }

  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // iOS detection
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return "ios";
  }

  // Android detection
  if (/android/i.test(userAgent)) {
    return "android";
  }

  // Everything else is desktop
  return "desktop";
}

/**
 * Attempt to open the installed app via deep link
 * Falls back to store if app is not installed
 * @param {string} storeUrl - URL to fallback to if app not installed
 */
function tryDeepLink(storeUrl) {
  const startTime = Date.now();

  // Try to open the app
  window.location.href = APP_SCHEME;

  // If still here after 2 seconds, app probably isn't installed
  setTimeout(() => {
    const elapsedTime = Date.now() - startTime;
    // If less than 2 seconds passed, user is still here (app not installed)
    if (elapsedTime < 2100) {
      window.open(storeUrl, "_blank");
    }
  }, 2000);
}

/**
 * Main function to handle "Order Now" button clicks
 * Redirects to appropriate store or fallback page based on device
 * @param {Event} event - Optional click event to prevent default
 * @param {boolean} useDeepLink - Whether to attempt deep linking (default: true)
 */
export function openOrderApp(event = null, useDeepLink = true) {
  // Prevent default link behavior if event provided
  if (event) {
    event.preventDefault();
  }

  const device = detectDevice();

  switch (device) {
    case "ios":
      if (useDeepLink) {
        tryDeepLink(APP_STORE_URL);
      } else {
        window.open(APP_STORE_URL, "_blank");
      }
      break;

    case "android":
      if (useDeepLink) {
        tryDeepLink(PLAY_STORE_URL);
      } else {
        window.open(PLAY_STORE_URL, "_blank");
      }
      break;

    case "desktop":
    default:
      // Redirect to fallback informational page
      window.location.href = FALLBACK_PAGE;
      break;
  }
}

/**
 * Get the appropriate store URL for the current device
 * @returns {string} - Store URL or fallback page
 */
export function getStoreUrl() {
  const device = detectDevice();

  switch (device) {
    case "ios":
      return APP_STORE_URL;
    case "android":
      return PLAY_STORE_URL;
    default:
      return FALLBACK_PAGE;
  }
}

/**
 * Check if user is on a mobile device
 * @returns {boolean}
 */
export function isMobileDevice() {
  const device = detectDevice();
  return device === "ios" || device === "android";
}
