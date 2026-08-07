const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const BG = [2, 6, 23, 255];
const CARD = [8, 18, 39, 255];
const LINE = [31, 41, 55, 255];
const GREEN = [74, 222, 128, 255];
const GREEN_DARK = [34, 197, 94, 255];
const GREEN_LINE = [134, 239, 172, 255];
const BLUE = [56, 189, 248, 255];
const TRANSPARENT = [0, 0, 0, 0];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const src = y * width * 4;
    const dst = y * (width * 4 + 1);
    raw[dst] = 0;
    rgba.copy(raw, dst + 1, src, src + width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function canvas(width, height, bg = TRANSPARENT) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = bg[3];
  }
  return { width, height, data };
}

function blendPixel(c, x, y, color) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (Math.floor(y) * c.width + Math.floor(x)) * 4;
  const a = color[3] / 255;
  const ia = 1 - a;
  c.data[i] = Math.round(color[0] * a + c.data[i] * ia);
  c.data[i + 1] = Math.round(color[1] * a + c.data[i + 1] * ia);
  c.data[i + 2] = Math.round(color[2] * a + c.data[i + 2] * ia);
  c.data[i + 3] = Math.min(255, Math.round(color[3] + c.data[i + 3] * ia));
}

function fillRect(c, x0, y0, x1, y1, color) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) blendPixel(c, x, y, color);
  }
}

function fillCircle(c, cx, cy, r, color) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) blendPixel(c, x, y, color);
    }
  }
}

function fillRoundedRect(c, x0, y0, x1, y1, r, color) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
      const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) blendPixel(c, x, y, color);
    }
  }
}

function strokeCircle(c, cx, cy, r, width, color) {
  const inner = (r - width) * (r - width);
  const outer = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = dx * dx + dy * dy;
      if (d <= outer && d >= inner) blendPixel(c, x, y, color);
    }
  }
}

function robot(c, cx, cy, s) {
  const headW = 180 * s;
  const headH = 138 * s;
  const x0 = cx - headW / 2;
  const y0 = cy - headH / 2;
  const x1 = cx + headW / 2;
  const y1 = cy + headH / 2;

  fillRoundedRect(c, x0 - 26 * s, cy - 35 * s, x0 + 4 * s, cy + 35 * s, 12 * s, GREEN_DARK);
  fillRoundedRect(c, x1 - 4 * s, cy - 35 * s, x1 + 26 * s, cy + 35 * s, 12 * s, GREEN_DARK);
  fillRect(c, cx - 4 * s, y0 - 36 * s, cx + 4 * s, y0 + 2 * s, GREEN);
  fillCircle(c, cx, y0 - 56 * s, 14 * s, GREEN);

  fillRoundedRect(c, x0 - 5 * s, y0 - 5 * s, x1 + 5 * s, y1 + 5 * s, 42 * s, GREEN_LINE);
  fillRoundedRect(c, x0, y0, x1, y1, 36 * s, GREEN);

  fillRoundedRect(c, cx - 58 * s, cy - 30 * s, cx - 35 * s, cy - 7 * s, 8 * s, BG);
  fillRoundedRect(c, cx + 35 * s, cy - 30 * s, cx + 58 * s, cy - 7 * s, 8 * s, BG);
  fillRoundedRect(c, cx - 45 * s, cy + 33 * s, cx + 45 * s, cy + 47 * s, 7 * s, BG);
}

function drawIcon(size, transparentBackground = false) {
  const c = canvas(size, size, transparentBackground ? TRANSPARENT : BG);
  const scale = size / 512;

  if (!transparentBackground) {
    strokeCircle(c, size / 2, size / 2, 210 * scale, 5 * scale, [34, 197, 94, 35]);
    strokeCircle(c, size / 2, size / 2, 170 * scale, 5 * scale, [34, 197, 94, 45]);
    strokeCircle(c, size / 2, size / 2, 128 * scale, 5 * scale, [34, 197, 94, 70]);
  }

  fillRoundedRect(c, 74 * scale, 74 * scale, 438 * scale, 438 * scale, 112 * scale, CARD);
  fillRoundedRect(c, 77 * scale, 77 * scale, 435 * scale, 435 * scale, 109 * scale, transparentBackground ? [8, 18, 39, 245] : CARD);

  if (!transparentBackground) {
    strokeCircle(c, size / 2, size / 2, 210 * scale, 4 * scale, [34, 197, 94, 35]);
  }

  robot(c, size / 2, 255 * scale, 1.22 * scale);
  fillCircle(c, 117 * scale, 377 * scale, 12 * scale, BLUE);
  fillCircle(c, 395 * scale, 132 * scale, 12 * scale, GREEN);
  return encodePng(size, size, c.data);
}

function drawSplash(width, height) {
  const c = canvas(width, height, BG);
  const s = Math.min(width, height) / 512;
  robot(c, width / 2, height / 2 - height * 0.08, 0.95 * s);
  return encodePng(width, height, c.data);
}

fs.writeFileSync(path.join(outDir, 'icon.png'), drawIcon(1024, false));
fs.writeFileSync(path.join(outDir, 'adaptive-icon.png'), drawIcon(1024, true));
fs.writeFileSync(path.join(outDir, 'play-store-icon.png'), drawIcon(512, false));
fs.writeFileSync(path.join(outDir, 'splash.png'), drawSplash(1242, 2436));
console.log('SmartBots mobile assets generated with aligned robot icon.');
