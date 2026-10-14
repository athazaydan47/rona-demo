// Adapter penyimpanan foto ulasan: Vercel Blob bila BLOB_READ_WRITE_TOKEN ada, disk lokal saat dev,
// dan nonaktif di Vercel tanpa token (disk serverless tidak permanen).
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type PhotoStorageKind = "blob" | "lokal" | "nonaktif";

export interface PhotoStorage {
  kind: PhotoStorageKind;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<string>;
}

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
export const LOCAL_MEDIA_PREFIX = "/api/media/";
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function storageKind(env: Record<string, string | undefined> = process.env): PhotoStorageKind {
  if (env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  if (env.VERCEL) return "nonaktif";
  return "lokal";
}

export const isSafeKey = (key: string) => /^(ulasan\/\d+|produk|banner)\/[a-z0-9-]{8,64}\.(webp|jpg|png)$/.test(key);

// Foto katalog dari admin (produk, banner): URL harus berasal dari penyimpanan kita sendiri.
export function storedMediaKey(url: string, prefix: "produk" | "banner"): string | null {
  let key: string | null = null;
  if (url.startsWith(LOCAL_MEDIA_PREFIX)) key = url.slice(LOCAL_MEDIA_PREFIX.length);
  else {
    try {
      const u = new URL(url);
      if (u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX)) key = u.pathname.slice(1);
    } catch {
      key = null;
    }
  }
  return key && isSafeKey(key) && key.startsWith(`${prefix}/`) ? key : null;
}

const localStorage: PhotoStorage = {
  kind: "lokal",
  async put(key, bytes) {
    if (!isSafeKey(key)) throw new Error("Kunci file tidak sah.");
    const file = path.join(LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return `${LOCAL_MEDIA_PREFIX}${key}`;
  },
};

const blobStorage: PhotoStorage = {
  kind: "blob",
  async put(key, bytes, contentType) {
    if (!isSafeKey(key)) throw new Error("Kunci file tidak sah.");
    const { put } = await import("@vercel/blob");
    const res = await put(key, Buffer.from(bytes), { access: "public", contentType, addRandomSuffix: false, token: process.env.BLOB_READ_WRITE_TOKEN });
    return res.url;
  },
};

const disabledStorage: PhotoStorage = {
  kind: "nonaktif",
  async put() {
    throw new Error("Unggah foto sedang tidak tersedia.");
  },
};

export function photoStorage(env: Record<string, string | undefined> = process.env): PhotoStorage {
  const kind = storageKind(env);
  return kind === "blob" ? blobStorage : kind === "lokal" ? localStorage : disabledStorage;
}

// URL foto yang boleh disimpan di ulasan: hanya hasil unggahan milik pembeli itu sendiri.
export function photoKeyFromUrl(url: string, customerId: number): string | null {
  let key: string | null = null;
  if (url.startsWith(LOCAL_MEDIA_PREFIX)) key = url.slice(LOCAL_MEDIA_PREFIX.length);
  else {
    try {
      const u = new URL(url);
      if (u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX)) key = u.pathname.slice(1);
    } catch {
      key = null;
    }
  }
  if (!key || !isSafeKey(key) || !key.startsWith(`ulasan/${customerId}/`)) return null;
  return key;
}

export async function readLocalPhoto(key: string) {
  if (!isSafeKey(key)) return null;
  try {
    return await readFile(path.join(LOCAL_UPLOAD_DIR, key));
  } catch {
    return null;
  }
}

// Hapus semua foto unggahan pengunjung (ulasan, produk, banner) saat reset harian demo.
export async function deleteAllReviewPhotos(env: Record<string, string | undefined> = process.env): Promise<{ kind: PhotoStorageKind; deleted: number }> {
  const kind = storageKind(env);
  if (kind === "blob") {
    const { list, del } = await import("@vercel/blob");
    const token = env.BLOB_READ_WRITE_TOKEN;
    let deleted = 0;
    for (const prefix of ["ulasan/", "produk/", "banner/"]) {
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, cursor, limit: 1000, token });
        if (page.blobs.length) {
          await del(page.blobs.map((b) => b.url), { token });
          deleted += page.blobs.length;
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    }
    return { kind, deleted };
  }
  if (kind === "lokal") {
    for (const dir of ["ulasan", "produk", "banner"]) await rm(path.join(LOCAL_UPLOAD_DIR, dir), { recursive: true, force: true });
    return { kind, deleted: 0 };
  }
  return { kind, deleted: 0 };
}
