// The admin side of a tenant's brand kit: checking and shrinking the pictures, naming the files, and the
// plain-words messages. Pure where it can be, so it can be tested.

export const BUCKET = 'tenant-brand';
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // the storage limit; a picture is shrunk to fit
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // what a person may pick, before it is shrunk
export const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// the largest size each picture is kept at (width, height); a bigger one is shrunk, never stretched
export const LIMITS = {
  logo: { w: 800, h: 400 },
  banner: { w: 1800, h: 600 },
};

export function checkImageFile(file) {
  if (!file) return { ok: false, error: 'no_file' };
  if (!TYPES.includes(file.type)) return { ok: false, error: 'bad_type' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'too_big' };
  return { ok: true };
}

// the size to draw a picture at: the same shape, inside the limit, never bigger than it came
export function fitWithin(width, height, limit) {
  const scale = Math.min(1, limit.w / width, limit.h / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// a logo keeps see-through parts, so it is a png; a banner is a photo, so a jpeg
export function outputFor(kind) {
  return kind === 'logo' ? { type: 'image/png', ext: 'png', quality: undefined } : { type: 'image/jpeg', ext: 'jpg', quality: 0.86 };
}

export function brandFilePath(tenantId, kind, ext, now = Date.now()) {
  return `${tenantId}/${kind}-${now}.${ext}`;
}

export const IMAGE_ERRORS = {
  no_file: 'Choose a picture first.',
  bad_type: 'Use a PNG, JPG or WebP picture. Other kinds (SVG, GIF, PDF) are not accepted.',
  too_big: 'That picture is too large. Choose one under 12 MB.',
  unreadable: 'That picture could not be read. Try saving it again as a PNG or JPG.',
  still_big: 'Even shrunk, that picture is over 2 MB. Try a simpler picture.',
};

const SAVE_ERRORS = {
  brand_not_allowed: 'Brand Customisation is not switched on for this tenant. Ask the ScoreIt team to switch it on.',
  bad_logo_path: 'The logo could not be saved. Try uploading it again.',
  bad_banner_path: 'The banner could not be saved. Try uploading it again.',
  bad_primary_color: 'The main colour is not a valid colour.',
  bad_accent_color: 'The second colour is not a valid colour.',
  nothing_to_save: 'There was nothing to save.',
};

export function brandSaveErrorText(code) {
  return SAVE_ERRORS[code] || 'The brand kit could not be saved. Try again.';
}

// Draw a picked file onto a canvas at a safe size and give back a blob. Browser only.
export async function prepareImage(file, kind) {
  const check = checkImageFile(file);
  if (!check.ok) throw new Error(check.error);
  const out = outputFor(kind);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('unreadable');
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, LIMITS[kind]);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (kind === 'banner') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, out.type, out.quality));
  if (!blob) throw new Error('unreadable');
  if (blob.size > MAX_FILE_BYTES) throw new Error('still_big');
  return { blob, ext: out.ext, type: out.type, width, height };
}
