import multer from "multer";

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
      callback(new Error("Image must be .jpg, .jpeg, or .png"));
      return;
    }
    callback(null, true);
  },
});

const bookBankUpload = multerUpload.single("bookBankImage");

/** T05 — upload รูปสมุดบัญชี (field: bookBankImage) */
export function uploadBookBankImage(req, res, next) {
  bookBankUpload(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image must be 2MB or smaller"
        : error.message;
    return res.status(400).json({ message });
  });
}
