const multer = require("multer");
const { failure } = require("../utils/response");

const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_IMAGE_COUNT,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
      return;
    }

    cb(null, true);
  },
});

const parseDiseaseImages = (req, res, next) => {
  upload.array("images", MAX_IMAGE_COUNT)(req, res, (error) => {
    if (!error) {
      if (!Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json(failure("BAD_REQUEST", "At least one image is required in images[]"));
      }
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json(failure("FILE_TOO_LARGE", "Each image must be 5MB or smaller"));
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json(failure("TOO_MANY_FILES", `Maximum ${MAX_IMAGE_COUNT} images are allowed`));
      }

      return res
        .status(400)
        .json(failure("INVALID_FILE", "Only PNG and JPG images are allowed in images[]"));
    }

    return next(error);
  });
};

module.exports = {
  parseDiseaseImages,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_BYTES,
};
