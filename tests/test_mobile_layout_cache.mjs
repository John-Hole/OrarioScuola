import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Test Mobile Layout & Cache Invalidation Verification ---');

// 1. Check index.html cache busters
const indexHtml = fs.readFileSync(path.resolve('public/index.html'), 'utf-8');
const cssMatch = indexHtml.match(/<link\s+rel="stylesheet"\s+href="css\/style\.css\?v=(\d+)">/);
assert(cssMatch, 'index.html must load css/style.css with a version query param');
const jsMatch = indexHtml.match(/<script\s+type="module"\s+src="js\/app\.js\?v=(\d+)"><\/script>/);
assert(jsMatch, 'index.html must load js/app.js with a version query param');

console.log(`✓ index.html has css/style.css?v=${cssMatch[1]} and js/app.js?v=${jsMatch[1]}`);
assert.strictEqual(cssMatch[1], jsMatch[1], `CSS version (${cssMatch[1]}) must match JS version (${jsMatch[1]}) to prevent stale cache desync!`);

// 2. Check sw.js cache name
const swJs = fs.readFileSync(path.resolve('public/sw.js'), 'utf-8');
const swCacheMatch = swJs.match(/const\s+CACHE_NAME\s*=\s*'smart-timetable-v(\d+)';/);
assert(swCacheMatch, 'sw.js must define CACHE_NAME as smart-timetable-vXX');
console.log(`✓ sw.js has CACHE_NAME smart-timetable-v${swCacheMatch[1]}`);
assert.strictEqual(swCacheMatch[1], jsMatch[1], `sw.js CACHE_NAME version (${swCacheMatch[1]}) must match index.html app.js version (${jsMatch[1]})!`);

// 3. Check sw.js network-first for both /js/ and /css/ and robust async offline fallbacks
assert(
  swJs.includes("url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/')") ||
  (swJs.includes("url.pathname.startsWith('/js/')") && swJs.includes("url.pathname.startsWith('/css/')")),
  'sw.js must apply Network-First caching strategy to both /js/ and /css/ to avoid serving stale assets'
);
assert(!swJs.includes('(caches.match(') && !swJs.includes('caches.match(\'/index.html\') || caches.match(\'/\')'),
  'sw.js must NOT evaluate caches.match() synchronously with logical OR (causes Promise truthiness bug breaking offline fallback)');
assert(swJs.includes('await caches.match'),
  'sw.js must properly await caches.match in catch handlers for offline fallback');
console.log('✓ sw.js applies Network-First caching and robust async offline fallbacks');

// 4. Check app.js cache references
const appJs = fs.readFileSync(path.resolve('public/js/app.js'), 'utf-8');
const appCacheRefs = appJs.match(/caches\.open\('smart-timetable-v(\d+)'\)/g);
assert(appCacheRefs && appCacheRefs.length >= 2, 'app.js must contain caches.open calls for the current cache');
for (const ref of appCacheRefs) {
  assert(ref.includes(`smart-timetable-v${swCacheMatch[1]}`), `app.js cache call ${ref} must match sw.js cache version`);
}
console.log(`✓ app.js has matching cache storage references for smart-timetable-v${swCacheMatch[1]}`);

// 5. Check CSS mobile clearance & proportional slot height
const styleCss = fs.readFileSync(path.resolve('public/css/style.css'), 'utf-8');
const mobileQuery = styleCss.slice(styleCss.indexOf('@media (max-width: 650px)'));

// Clearance check: .timeline-viewport padding-top >= 20px and .days-nav padding-bottom >= 8px
assert(mobileQuery.includes('padding: 22px 12px 14px 12px;') || mobileQuery.includes('padding-top: 22px'),
  '.timeline-viewport must have >=22px padding-top on mobile to prevent "08:00" from overlapping day chips');
assert(mobileQuery.includes('padding: 0 12px 8px 12px;') || mobileQuery.includes('padding-bottom: 8px'),
  '.days-nav must have sufficient padding-bottom on mobile');

// Slot height check: slot-height max clamp >= 90px to prevent 350px black canyon
assert(mobileQuery.includes('clamp(66px, 10.4dvh, 92px)'),
  '--timeline-slot-height must have proportional dvh scaling up to 92px on mobile');
assert(mobileQuery.includes('clamp(18px, 2.6dvh, 24px)'),
  '--timeline-break-height must have proportional dvh scaling on mobile');

console.log('✓ Mobile layout rules verified: 08:00 overlap eliminated and slot height scales proportionally.');
console.log('Tutti i test di Mobile Layout e Cache Invalidation sono passati con successo!');
