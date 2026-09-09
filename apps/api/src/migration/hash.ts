import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function isDirectory(root: string): boolean {
  try {
    return statSync(root).isDirectory();
  } catch {
    return false;
  }
}

function walkFiles(root: string, acc: string[] = []): string[] {
  if (!isDirectory(root)) {
    return acc;
  }
  for (const name of readdirSync(root).sort()) {
    const full = join(root, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else if (st.isFile()) acc.push(full);
  }
  return acc;
}

export function mediaManifest(root: string): { count: number; hash: string } {
  const files = walkFiles(root);
  const h = createHash('sha256');
  for (const file of files) {
    const rel = file.slice(root.length).replace(/^[\\/]+/, '').replace(/\\/g, '/');
    const body = readFileSync(file);
    h.update(rel);
    h.update('\0');
    h.update(String(body.length));
    h.update('\0');
    h.update(createHash('sha256').update(body).digest('hex'));
    h.update('\n');
  }
  return { count: files.length, hash: h.digest('hex') };
}

/** Absolute-path tree hash for immutability of an unchanged directory. */
export function hashMediaTree(root: string): { count: number; hash: string } {
  const files = walkFiles(root);
  const h = createHash('sha256');
  for (const file of files) {
    h.update(file);
    h.update(readFileSync(file));
  }
  return { count: files.length, hash: h.digest('hex') };
}
