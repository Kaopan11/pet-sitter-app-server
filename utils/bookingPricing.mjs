import { httpError } from "./httpError.mjs";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/** แปลง YYYY-MM-DD เป็น UTC midnight — หลีกเลี่ยง timezone shift */
function parseDateOnly(value) {
  if (typeof value !== "string" || !DATE_RE.test(value.trim())) {
    throw httpError(400, "Invalid date format");
  }

  const [year, month, day] = value.trim().split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * many-days: nights = endDate − startDate (ไม่ inclusive)
 * 27 Aug → 29 Aug = 2 คืน — วันเดียวกันใช้ resolveDurationHours แทน
 */
export function resolveNights(startDate, endDate) {
  const startMs = parseDateOnly(startDate);
  const endMs = parseDateOnly(endDate);
  const nights = Math.round((endMs - startMs) / MS_PER_DAY);

  if (nights <= 0) {
    throw httpError(400, "endDate must be after startDate");
  }

  return nights;
}

/** total = hours × (200 + 100 × (petCount - 1)) — one-day hourly */
export function calculateBookingTotal(hours, petCount) {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw httpError(400, "Invalid duration");
  }
  if (!Number.isInteger(petCount) || petCount < 1) {
    throw httpError(400, "At least one pet is required");
  }

  return hours * (200 + 100 * (petCount - 1));
}

/** total = nights × (1000 + 500 × (petCount - 1)) — many-days per night */
export function calculateNightlyTotal(nights, petCount) {
  if (!Number.isInteger(nights) || nights < 1) {
    throw httpError(400, "Invalid nights");
  }
  if (!Number.isInteger(petCount) || petCount < 1) {
    throw httpError(400, "At least one pet is required");
  }

  return nights * (1000 + 500 * (petCount - 1));
}
