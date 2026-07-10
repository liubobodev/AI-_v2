import fs from "fs";
import path from "path";
import { del, get, list, put } from "@vercel/blob";

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_ROOT = path.join(process.cwd(), "data");
const memoryCache = new Map<string, unknown>();
const deletedKeys = new Set<string>();

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localPath(key: string) {
  return path.join(LOCAL_ROOT, key);
}

function ensureLocalDir(key: string) {
  fs.mkdirSync(path.dirname(localPath(key)), { recursive: true });
}

export async function readJson<T>(key: string): Promise<T | null> {
  if (memoryCache.has(key) && !deletedKeys.has(key)) {
    return cloneJson(memoryCache.get(key) as T);
  }
  if (USE_BLOB) {
    const result = await get(key, { access: "private" }).catch(() => null);
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as T;
    memoryCache.set(key, cloneJson(parsed));
    deletedKeys.delete(key);
    return parsed;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(localPath(key), "utf-8")) as T;
    memoryCache.set(key, cloneJson(parsed));
    deletedKeys.delete(key);
    return parsed;
  } catch {
    return null;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  const body = JSON.stringify(value, null, 2);
  memoryCache.set(key, cloneJson(value));
  deletedKeys.delete(key);
  if (USE_BLOB) {
    await put(key, body, {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
    });
    return;
  }
  ensureLocalDir(key);
  fs.writeFileSync(localPath(key), body, "utf-8");
}

export async function deleteJson(key: string): Promise<void> {
  memoryCache.delete(key);
  deletedKeys.add(key);
  if (USE_BLOB) {
    await del(key).catch(() => {});
    return;
  }
  const p = localPath(key);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export async function listJson<T>(prefix: string): Promise<T[]> {
  const out: T[] = [];
  const seen = new Set<string>();
  if (USE_BLOB) {
    let cursor: string | undefined;
    do {
      const result = await list({ prefix, cursor });
      cursor = result.cursor;
      for (const blob of result.blobs.filter((b) => b.pathname.endsWith(".json"))) {
        if (deletedKeys.has(blob.pathname)) continue;
        seen.add(blob.pathname);
        const item = await readJson<T>(blob.pathname);
        if (item) out.push(item);
      }
    } while (cursor);
    for (const [key, value] of memoryCache.entries()) {
      if (key.startsWith(prefix) && key.endsWith(".json") && !seen.has(key) && !deletedKeys.has(key)) {
        out.push(cloneJson(value as T));
      }
    }
    return out;
  }

  const dir = localPath(prefix);
  try {
    fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const key = path.join(prefix, f);
        if (deletedKeys.has(key)) return null;
        seen.add(key);
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as T;
          memoryCache.set(key, cloneJson(parsed));
          return parsed;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .forEach((item) => out.push(item as T));
  } catch {
    // Keep cached values below available even when the local directory is absent.
  }
  for (const [key, value] of memoryCache.entries()) {
    if (key.startsWith(prefix) && key.endsWith(".json") && !seen.has(key) && !deletedKeys.has(key)) {
      out.push(cloneJson(value as T));
    }
  }
  return out;
}
