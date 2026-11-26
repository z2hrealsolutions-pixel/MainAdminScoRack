import assert from 'node:assert/strict';
import { checkImageFile, fitWithin, outputFor, brandFilePath, brandSaveErrorText, LIMITS, IMAGE_ERRORS } from './brandKit.js';

assert.deepEqual(checkImageFile({ type: 'image/png', size: 1000 }), { ok: true });
assert.deepEqual(checkImageFile({ type: 'image/webp', size: 1000 }), { ok: true });
assert.equal(checkImageFile({ type: 'image/svg+xml', size: 10 }).error, 'bad_type');
assert.equal(checkImageFile({ type: 'image/gif', size: 10 }).error, 'bad_type');
assert.equal(checkImageFile({ type: 'application/pdf', size: 10 }).error, 'bad_type');
assert.equal(checkImageFile({ type: 'image/png', size: 13 * 1024 * 1024 }).error, 'too_big');
assert.equal(checkImageFile(null).error, 'no_file');
for (const code of ['no_file', 'bad_type', 'too_big', 'unreadable', 'still_big']) assert.ok(IMAGE_ERRORS[code]);

// shrunk to fit, same shape, never stretched
assert.deepEqual(fitWithin(4000, 2000, LIMITS.logo), { width: 800, height: 400 });
assert.deepEqual(fitWithin(1600, 400, LIMITS.logo), { width: 800, height: 200 });
assert.deepEqual(fitWithin(300, 100, LIMITS.logo), { width: 300, height: 100 });
assert.deepEqual(fitWithin(6000, 2000, LIMITS.banner), { width: 1800, height: 600 });
assert.deepEqual(fitWithin(1000, 4000, LIMITS.banner), { width: 150, height: 600 });
assert.ok(fitWithin(1, 5000, LIMITS.banner).width >= 1);

assert.equal(outputFor('logo').ext, 'png');
assert.equal(outputFor('banner').ext, 'jpg');

// the path the database accepts: <tenant>/<kind>-<digits>.<png|jpg|webp>
const t = '11111111-1111-1111-1111-111111111111';
const re = (kind) => new RegExp('^' + t + '/' + kind + '-[0-9]+\\.(png|jpg|webp)$');
assert.match(brandFilePath(t, 'logo', 'png', 1700000000000), re('logo'));
assert.match(brandFilePath(t, 'banner', 'jpg', 5), re('banner'));

assert.match(brandSaveErrorText('brand_not_allowed'), /switched on/);
assert.match(brandSaveErrorText('something_new'), /could not be saved/);
console.log('brandKit tests passed');
