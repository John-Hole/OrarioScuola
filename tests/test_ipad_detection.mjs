import assert from 'assert';

function createDeviceDetector(mockEnv) {
  function isIPadDevice() {
    const ua = mockEnv.userAgent || '';
    const platform = mockEnv.platform || '';
    const maxTouch = mockEnv.maxTouchPoints || 0;
    return /iPad/i.test(ua) || (platform === 'MacIntel' && maxTouch > 1) || (/Macintosh/i.test(ua) && maxTouch > 1);
  }

  function isTabletOrMobileDevice() {
    if (isIPadDevice()) return true;
    const ua = mockEnv.userAgent || '';
    if (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Silk/i.test(ua)) return true;
    const maxTouch = mockEnv.maxTouchPoints || 0;
    return ('ontouchstart' in mockEnv) && maxTouch > 1;
  }

  function isDesktopDevice() {
    if (isIPadDevice() || isTabletOrMobileDevice()) {
      return false; // iPad (sia orizzontale che verticale) e smartphone: SEMPRE GIORNO
    }
    const ua = mockEnv.userAgent || '';
    const maxTouch = mockEnv.maxTouchPoints || 0;
    const isRealDesktopOS = /Windows NT/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch === 0) || (/Linux/i.test(ua) && !/Android/i.test(ua));
    return isRealDesktopOS && mockEnv.innerWidth >= 900;
  }

  function getInitialView() {
    if (isIPadDevice() || isTabletOrMobileDevice()) {
      return 'daily';
    }
    if (isDesktopDevice()) {
      return 'weekly';
    }
    return 'daily';
  }

  return { isIPadDevice, isTabletOrMobileDevice, isDesktopDevice, getInitialView };
}

console.log('--- Test Rilevamento iPad e Dispositivi ---');

// 1. iPad con Safari moderno in verticale (Portrait 810px)
const ipadSafariPortrait = createDeviceDetector({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
  innerWidth: 810
});
assert.strictEqual(ipadSafariPortrait.isIPadDevice(), true);
assert.strictEqual(ipadSafariPortrait.isDesktopDevice(), false);
assert.strictEqual(ipadSafariPortrait.getInitialView(), 'daily', 'iPad Safari verticale deve aprirsi in Giorno');
console.log('✓ iPad Safari verticale -> Vista GIORNO garantita');

// 2. iPad con Safari moderno in orizzontale (Landscape 1080px)
const ipadSafariLandscape = createDeviceDetector({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
  innerWidth: 1080
});
assert.strictEqual(ipadSafariLandscape.isIPadDevice(), true);
assert.strictEqual(ipadSafariLandscape.isDesktopDevice(), false, 'iPad orizzontale non deve MAI essere considerato PC');
assert.strictEqual(ipadSafariLandscape.getInitialView(), 'daily', 'iPad Safari orizzontale deve aprirsi sempre in Giorno');
console.log('✓ iPad Safari orizzontale (Landscape) -> Vista GIORNO garantita');

// 3. iPad Pro 12.9" in orizzontale (Landscape 1366px)
const ipadProLandscape = createDeviceDetector({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
  innerWidth: 1366
});
assert.strictEqual(ipadProLandscape.isIPadDevice(), true);
assert.strictEqual(ipadProLandscape.isDesktopDevice(), false);
assert.strictEqual(ipadProLandscape.getInitialView(), 'daily', 'iPad Pro 12.9 orizzontale deve aprirsi sempre in Giorno');
console.log('✓ iPad Pro 12.9" orizzontale -> Vista GIORNO garantita');

// 4. iPad con User Agent esplicito iPad
const ipadLegacy = createDeviceDetector({
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15',
  platform: 'iPad',
  maxTouchPoints: 5,
  innerWidth: 768
});
assert.strictEqual(ipadLegacy.isIPadDevice(), true);
assert.strictEqual(ipadLegacy.isDesktopDevice(), false);
assert.strictEqual(ipadLegacy.getInitialView(), 'daily');
console.log('✓ iPad con UA iPad esplicito -> Vista GIORNO garantita');

// 5. iPhone
const iphone = createDeviceDetector({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  platform: 'iPhone',
  maxTouchPoints: 5,
  innerWidth: 390
});
assert.strictEqual(iphone.getInitialView(), 'daily');
console.log('✓ iPhone -> Vista GIORNO garantita');

// 6. Android Smartphone
const android = createDeviceDetector({
  userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
  innerWidth: 412
});
assert.strictEqual(android.getInitialView(), 'daily');
console.log('✓ Android Smartphone -> Vista GIORNO garantita');

// 7. PC Desktop Widescreen (Windows, mouse, no touch, 1920x1080)
const desktopPC = createDeviceDetector({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  platform: 'Win32',
  maxTouchPoints: 0,
  innerWidth: 1440
});
assert.strictEqual(desktopPC.isDesktopDevice(), true, 'PC Widescreen deve essere desktop');
assert.strictEqual(desktopPC.getInitialView(), 'weekly', 'PC Widescreen deve aprirsi di default in vista Settimanale');
console.log('✓ PC Desktop Widescreen -> Vista SETTIMANA garantita');

// 8. Mac Desktop (macOS, no touch, 1440px)
const macDesktop = createDeviceDetector({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  platform: 'MacIntel',
  maxTouchPoints: 0, // Mac desktop ha 0 touch points!
  innerWidth: 1440
});
assert.strictEqual(macDesktop.isDesktopDevice(), true, 'Mac Desktop (senza touch) deve essere desktop');
assert.strictEqual(macDesktop.getInitialView(), 'weekly', 'Mac Desktop deve aprirsi in vista Settimanale');
console.log('✓ Mac Desktop (senza touch) -> Vista SETTIMANA garantita');

console.log('\n✓ Tutti i test per iPad (incluso orizzontale) e PC sono passati con successo!');
