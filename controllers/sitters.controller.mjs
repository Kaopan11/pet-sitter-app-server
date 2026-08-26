import { sittersService } from "../services/sitters.service.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";

export const sittersController = {
  async list(req, res) {
    try {
      const q = req.query.q ? `%${req.query.q}%` : null;
      const petTypes = req.query.petTypes
        ? String(req.query.petTypes)
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
        : null;
      const rating = req.query.rating ? Number(req.query.rating) : null;
      const experience = req.query.experience
        ? String(req.query.experience).replace(/\s*years$/i, "").trim()
        : null;
      const page = Number(req.query.page) || 1;
      const PAGE_SIZE = Number(req.query.limit) || 5;
      const offset = (page - 1) * PAGE_SIZE;

      const result = await sitterProfilesRepository.findMany({
        q,
        petTypes: petTypes?.length ? petTypes : null,
        rating: Number.isFinite(rating) ? rating : null,
        experience: experience || null,
        pageSize: PAGE_SIZE,
        offset,
      });

      return res.status(200).json({
        data: result.rows,
        pagination: {
          page,
          limit: PAGE_SIZE,
          total: result.total,
          totalPages: Math.ceil(result.total / PAGE_SIZE) || 0,
        },
      });
    } catch (error) {
      return res.status(500).json({
        message: "Server could not read pet sitters because database connection",
      });
    }
  },

  // booking Day 0 — รายละเอียด sitter (ใช้ service จาก dev)
  async getById(req, res, next) {
    try {
      const sitter = await sittersService.getPublicById(req.params.id);
      return res.status(200).json({ data: sitter });
    } catch (error) {
      next(error);
    }
  },

  async getReviews(req, res, next) {
    try {
      const rating = req.query.rating ? Number(req.query.rating) : null;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 5;
      const result = await sittersService.getReviews(req.params.id, {
        rating: Number.isInteger(rating) ? rating : null,
        page,
        limit,
      });

      return res.status(200).json({
        data: result.rows,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit) || 0,
        },
        summary: result.summary,
      });
    } catch (error) {
      next(error);
    }
  },

  async getAvailability(req, res, next) {
    try {
      const slots = await sittersService.getAvailability(req.params.id);
      return res.status(200).json({ data: slots });
    } catch (error) {
      next(error);
    }
  },

  async getMyProfile(req, res, next) {
    try {
      const profile = await sittersService.getProfileByUserId(req.user.id);
      return res.status(200).json({ data: profile });
    } catch (error) {
      next(error);
    }
  },

  async updateMyProfile(req, res, next) {
    try {
      await sittersService.updateMyProfile(req.user.id, {
        body: req.body,
        avatarFile: req.files?.imageFile?.[0],
        galleryFiles: req.files?.galleryFiles ?? [],
      });
      return res.status(200).json({ message: "Profile updated successfully" });
    } catch (error) {
      next(error);
    }
  },

  async deleteMyPhoto(req, res, next) {
    try {
      await sittersService.deleteMyPhoto(req.user.id, req.params.photoId);
      return res.status(200).json({ message: "Photo deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
};
