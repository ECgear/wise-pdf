/** Store-only ZIP packaging (fflate). Images/JPEGs are already compressed, so we
 *  use level 0 (store) — same approach as the make-good-life image tool. */
import { zipSync, type Zippable } from 'fflate';

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

export function zipStore(entries: ZipEntry[]): Uint8Array {
  const map: Zippable = {};
  const used = new Set<string>();
  for (const e of entries) {
    let name = e.name;
    let k = 1;
    while (used.has(name)) {
      name = e.name.replace(/(\.[^.]+)$/, ` (${k++})$1`);
      if (!/(\.[^.]+)$/.test(e.name)) name = `${e.name} (${k - 1})`;
    }
    used.add(name);
    map[name] = [e.bytes, { level: 0 }];
  }
  return zipSync(map);
}
