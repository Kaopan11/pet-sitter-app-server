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

/**
 * @openapi
 * /api/pets:
 *   get:
 *     summary: Get my pets
 *     tags: [Pets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pet list
 *       401:
 *         description: Unauthorized
 */
petsRouter.get("/", requireAuth, petsController.getMyPets);

/**
 * @openapi
 * /api/pets:
 *   post:
 *     summary: Create a pet
 *     tags: [Pets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               pet_type:
 *                 type: string
 *                 example: Dog
 *               breed:
 *                 type: string
 *               sex:
 *                 type: string
 *                 example: Male
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Pet created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
petsRouter.post("/", uploadPetAvatar, requireAuth, petsController.createPet);

/**
 * @openapi
 * /api/pets/{id}:
 *   get:
 *     summary: Get a pet by id
 *     tags: [Pets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pet detail
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Pet not found
 */
petsRouter.get("/:id", requireAuth, petsController.getPetById);

/**
 * @openapi
 * /api/pets/{id}:
 *   put:
 *     summary: Update a pet
 *     tags: [Pets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Pet updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Pet not found
 */
petsRouter.put("/:id", uploadPetAvatar, requireAuth, petsController.updatePet);

/**
 * @openapi
 * /api/pets/{id}:
 *   delete:
 *     summary: Delete a pet
 *     tags: [Pets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pet deleted
 *       400:
 *         description: Pet is used in a booking
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Pet not found
 */
petsRouter.delete("/:id", requireAuth, petsController.deletePet);

export default petsRouter;