import { Router } from "express";
import { petsController } from "../controllers/pets.controller.mjs";
import { requireAuth } from "../middlewares/auth.middleware.mjs";
import multer from "multer";


/*
multer: 
- POST / PUT แบบ JSON → อ่าน req.body ได้ แต่ ไม่มีไฟล์
- รูปต้องส่งแบบ multipart/form-data
- multer ดึงไฟล์จากฟิลด์ชื่อ avatar ใส่ req.file
- pets.service.mjs จะอัปโหลดขึ้น bucket photos แล้วเก็บ URL ใน avatar_url
*/
//set up multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, callback) => {
    const mime = String(file.mimetype ?? "").toLowerCase();
    const name = String(file.originalname ?? "").toLowerCase();
    const allowedMime = ["image/jpeg", "image/jpg", "image/pjpeg", "image/png"];
    const allowedExt = /\.(jpe?g|png)$/;
    const ok =
      allowedMime.includes(mime) ||
      (mime === "application/octet-stream" && allowedExt.test(name)) ||
      allowedExt.test(name);

    if (!ok) {
      callback(new Error("Image must be .jpg, .jpeg, or .png"));
      return;
    }
    callback(null, true);
  },
});

//Middleware
//ไม่มี error → next() ไป auth แล้ว controller
function uploadPetAvatar(req, res, next) {
  upload.single("avatar")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image must be 2MB or smaller"
        : error.message;
    return res.status(400).json({ message });
  }); //มี error → ตอบ 400 ทันที ไม่ไปต่อ
}

const petsRouter = Router();

petsRouter.get("/", requireAuth, petsController.getMyPets);
petsRouter.post("/", uploadPetAvatar, requireAuth, petsController.createPet);
petsRouter.get("/:id", requireAuth, petsController.getPetById);
petsRouter.put("/:id", uploadPetAvatar, requireAuth, petsController.updatePet);
petsRouter.delete("/:id", requireAuth, petsController.deletePet);

export default petsRouter;