import { readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { imageSize } from "image-size";

import {
  PRIVATE_TARGETS_DIR,
  TARGET_INFO_PATH,
  ensureRuntimeDirs
} from "./paths.js";

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
  const files = await readdir(PRIVATE_TARGETS_DIR);

  await Promise.all(
    files
      .filter((file) => file !== ".gitkeep")
      .map((file) => unlink(join(PRIVATE_TARGETS_DIR, file)))
  );
}

export async function readCurrentTarget(): Promise<TargetState | null> {
  try {
    const manifest = JSON.parse(await readFile(TARGET_INFO_PATH, "utf8")) as TargetManifest;
    return {
      ...manifest,
      absolutePath: join(PRIVATE_TARGETS_DIR, manifest.fileName)
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
  const absolutePath = join(PRIVATE_TARGETS_DIR, fileName);
  const manifest: TargetManifest = {
    contentType: file.mimetype || `image/${extension}`,
    fileName,
    originalName: file.originalname || fileName,
    updatedAt: new Date().toISOString(),
    width: dimensions.width,
    height: dimensions.height
  };

  await writeFile(absolutePath, file.buffer);
  await writeFile(TARGET_INFO_PATH, JSON.stringify(manifest, null, 2));

  return {
    ...manifest,
    absolutePath
  };
}

export async function clearTargetArtifacts() {
  try {
    await rm(TARGET_INFO_PATH);
  } catch {
    // Ignore missing manifest.
  }

  try {
    await removeOldTargetFiles();
  } catch {
    // Ignore missing files.
  }
}
