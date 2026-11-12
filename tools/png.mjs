// The one RGB PNG encoder of the offline tools (no dependencies beyond node:zlib): 8-bit truecolour, filter 0, no alpha.
// rgb: Uint8Array/Buffer of W*H*3 bytes (a view with a byteOffset is read from its own start).
import { deflateSync } from "node:zlib";

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function encodePng(W, H, rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  const crc = (b) => { let c = ~0; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (type, data) => { const b = Buffer.concat([Buffer.from(type), data]), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(data.length); c.writeUInt32BE(crc(b)); return Buffer.concat([l, b, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
