// Reading one file out of a ZIP archive, for a package's meta.json. The
// engine unpacks packages itself; this is only for what the extension has
// to know before it hands one over.

const u16 = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u32 = (b: Uint8Array, at: number) => (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0;

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** readZipEntry returns the first file whose path matches, or nothing. */
export async function readZipEntry(zip: Uint8Array, match: (path: string) => boolean): Promise<Uint8Array | undefined> {
  // The end-of-central-directory record is the last thing in the archive,
  // before a comment of at most 64 KiB.
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (u32(zip, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return undefined;

  let at = u32(zip, end + 16);
  for (let n = u16(zip, end + 10); n > 0 && u32(zip, at) === 0x02014b50; n--) {
    const method = u16(zip, at + 10);
    const size = u32(zip, at + 20);
    const nameLen = u16(zip, at + 28);
    const path = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLen));
    if (match(path)) {
      const local = u32(zip, at + 42);
      const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28);
      const data = zip.subarray(start, start + size);
      if (method === 0) return data;
      return method === 8 ? inflate(data) : undefined;
    }
    at += 46 + nameLen + u16(zip, at + 30) + u16(zip, at + 32);
  }
  return undefined;
}
