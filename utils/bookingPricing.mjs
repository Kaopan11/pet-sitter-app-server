import { httpError } from "./httpError.mjs";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function parseTimeToMinutes(value) {
  if (typeof value !== "string" || !TIME_RE.test(value.trim())) {
    throw httpError(400, "Invalid time format");
  }

  const [, hh, mm] = value.trim().match(TIME_RE);
  return Number(hh) * 60 + Number(mm);
}

/** Whole hours only (Q7). end > start. */
export function resolveDurationHours(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    throw httpError(400, "endTime must be after startTime");
  }

  const durationMinutes = endMinutes - startMinutes;
  if (durationMinutes % 60 !== 0) {
    throw httpError(400, "Duration must be whole hours");
  }

  return durationMinutes / 60;
}

/** total = hours × (200 + 100 × (petCount - 1)) */
export function calculateBookingTotal(hours, petCount) {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw httpError(400, "Invalid duration");
  }
  if (!Number.isInteger(petCount) || petCount < 1) {
    throw httpError(400, "At least one pet is required");
  }

  return hours * (200 + 100 * (petCount - 1));
}
