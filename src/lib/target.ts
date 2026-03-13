import { readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { imageSize } from "image-size";

import { TARGET_MANIFEST_PATH, TARGETS_DIR, ensureRuntimeDirs } from "./paths.js";

const MIME_EXTENSION: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp"
};

export interface TargetManifest {
  contentType: string;
  fileName: string;
  originalName: string;
  updatedAt: string;
  width: number;
  height: number;
}

export interface TargetState extends TargetManifest {
  absolutePath: string;
}

function getExtension(file: Express.Multer.File) {
  const fromMime = MIME_EXTENSION[file.mimetype];
  if (fromMime) {
    return fromMime;
  }

  const originalName = file.originalname.toLowerCase();
  if (originalName.endsWith(".jpeg") || originalName.endsWith(".jpg")) {
    return "jpg";
  }
  if (originalName.endsWith(".png")) {
    return "png";
  }
  if (originalName.endsWith(".webp")) {
    return "webp";
  }
  if (originalName.endsWith(".gif")) {
    return "gif";
  }
  if (originalName.endsWith(".svg")) {
    return "svg";
  }

  throw new Error(`Unsupported image type: ${file.mimetype || file.originalname}`);
}

async function removeOldTargetFiles() {
  const files = await readdir(TARGETS_DIR);

  await Promise.all(
    files
      .filter((file) => file !== ".gitkeep" && file !== basename(TARGET_MANIFEST_PATH))
      .map((file) => unlink(join(TARGETS_DIR, file)))
  );
}

export async function readCurrentTarget(): Promise<TargetState | null> {
  try {
    const manifest = JSON.parse(await readFile(TARGET_MANIFEST_PATH, "utf8")) as TargetManifest;
    return {
      ...manifest,
      absolutePath: join(TARGETS_DIR, manifest.fileName)
    };
  } catch {
    return null;
  }
}

export async function saveUploadedTarget(file: Express.Multer.File): Promise<TargetState> {
  ensureRuntimeDirs();

  const extension = getExtension(file);
  const dimensions = imageSize(file.buffer);

  if (!dimensions.width || !dimensions.height) {
    throw new Error("Unable to determine target image dimensions.");
  }

  await removeOldTargetFiles();

  const fileName = `current.${extension}`;
  const absolutePath = join(TARGETS_DIR, fileName);
  const manifest: TargetManifest = {
    contentType: file.mimetype || `image/${extension}`,
    fileName,
    originalName: file.originalname || fileName,
    updatedAt: new Date().toISOString(),
    width: dimensions.width,
    height: dimensions.height
  };

  await writeFile(absolutePath, file.buffer);
  await writeFile(TARGET_MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  return {
    ...manifest,
    absolutePath
  };
}

export async function clearTargetArtifacts() {
  try {
    await rm(TARGET_MANIFEST_PATH);
  } catch {
    // Ignore missing manifest.
  }
}

