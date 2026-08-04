const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

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

function png(width, height, painter) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = painter(x, y, width, height);
      const i = row + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
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

function iconPainter(x, y, w, h) {
  const bg = [2, 6, 23, 255];
  const green = [34, 197, 94, 255];
  const light = [236, 253, 245, 255];
  const dark = [15, 23, 42, 255];
  const cx = w / 2, cy = h / 2;
  const dx = x - cx, dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r < w * 0.36) {
    if (Math.abs(dx) < w * 0.23 && Math.abs(dy) < h * 0.14) return dark;
    if ((x > w * 0.32 && x < w * 0.43 && y > h * 0.43 && y < h * 0.54) || (x > w * 0.57 && x < w * 0.68 && y > h * 0.43 && y < h * 0.54)) return light;
    if (y > h * 0.59 && y < h * 0.65 && x > w * 0.37 && x < w * 0.63) return light;
    return green;
  }
  if (r < w * 0.40) return [14, 165, 90, 255];
  return bg;
}

function splashPainter(x, y, w, h) {
  const bg = [2, 6, 23, 255];
  const green = [34, 197, 94, 255];
  const cx = w / 2, cy = h / 2 - h * 0.08;
  const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  if (r < Math.min(w, h) * 0.16) return green;
  return bg;
}

fs.writeFileSync(path.join(outDir, 'icon.png'), png(1024, 1024, iconPainter));
fs.writeFileSync(path.join(outDir, 'adaptive-icon.png'), png(1024, 1024, iconPainter));
fs.writeFileSync(path.join(outDir, 'splash.png'), png(1242, 2436, splashPainter));
console.log('SmartBots mobile assets generated.');
