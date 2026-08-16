import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";

const ALLOWED_PET_TYPES = new Set(["dog", "cat", "bird", "rabbit"]);
const EXPERIENCE_VALUES = new Set(["0-2", "3-5", "5+"]);

function parsePage(value) {
  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseLimit(value) {
  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit < 1) return 5;
  return Math.min(limit, 50);
}

function parseRating(value) {
  if (value === undefined || value === null || value === "") return null;
  const rating = Number.parseInt(value, 10);
  return rating >= 1 && rating <= 5 ? rating : null;
}

function parsePetTypes(value) {
  const raw = Array.isArray(value) ? value.join(",") : String(value ?? "");
  return [
    ...new Set(
      raw
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => ALLOWED_PET_TYPES.has(item))
    ),
  ];
}

function parseExperience(value) {
  if (!value) return null;
  const normalized = String(value)
    .trim()
    .replace(/\s*years$/i, "")
    .trim();
  return EXPERIENCE_VALUES.has(normalized) ? normalized : null;
}

function parseSearch(value) {
  if (!value) return "";
  return String(value)
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

export const sittersService = {
  async listSitters(query = {}) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const filters = {
      q: parseSearch(query.q ?? query.search),
      petTypes: parsePetTypes(query.petTypes ?? query.petType),
      rating: parseRating(query.rating),
      experience: parseExperience(query.experience),
      page,
      limit,
    };

    const { items, total } = await sitterProfilesRepository.findMany(filters);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  },
};
