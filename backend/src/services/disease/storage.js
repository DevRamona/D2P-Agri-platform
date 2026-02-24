const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class StorageProvider {
  async save() {
    throw new Error("save() not implemented");
  }
}

class NoopStorageProvider extends StorageProvider {
  async save() {
    return null;
  }
}

class LocalDiskStorageProvider extends StorageProvider {
  constructor({ rootDir }) {
    super();
    this.rootDir = rootDir;
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  async save({ buffer, mimeType, originalName }) {
    const extension =
      mimeType === "image/png" ? ".png" : mimeType === "image/jpeg" || mimeType === "image/jpg" ? ".jpg" : "";
    const safeBase = String(originalName || "upload")
      .replace(/[^a-zA-Z0-9_.-]/g, "_")
      .replace(/\.[^.]+$/, "");
    const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeBase}${extension}`;
    const fullPath = path.join(this.rootDir, fileName);
    await fs.promises.writeFile(fullPath, buffer);
    return {
      provider: "local",
      key: fileName,
      path: fullPath,
    };
  }
}

class S3CompatibleStorageProvider extends StorageProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async save() {
    throw new Error(
      "S3-compatible storage provider is defined but not enabled in this build. Use local storage or add an S3 client implementation.",
    );
  }
}

const createStorageProvider = () => {
  const saveUploads = String(process.env.SAVE_UPLOADS || "false").toLowerCase() === "true";
  if (!saveUploads) {
    return new NoopStorageProvider();
  }

  const backend = String(process.env.UPLOAD_STORAGE_BACKEND || "local").toLowerCase();

  if (backend === "s3") {
    return new S3CompatibleStorageProvider({
      endpoint: process.env.S3_ENDPOINT,
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
    });
  }

  const uploadDir = path.resolve(process.cwd(), process.env.DISEASE_UPLOAD_DIR || "uploads/disease-scans");
  return new LocalDiskStorageProvider({ rootDir: uploadDir });
};

module.exports = {
  StorageProvider,
  NoopStorageProvider,
  LocalDiskStorageProvider,
  S3CompatibleStorageProvider,
  createStorageProvider,
};
