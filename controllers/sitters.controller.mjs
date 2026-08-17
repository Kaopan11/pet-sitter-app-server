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
};
