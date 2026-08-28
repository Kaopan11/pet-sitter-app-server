import {
  calculateBookingTotal,
  calculateNightlyTotal,
  resolveDurationHours,
  resolveNights,
} from "../utils/bookingPricing.mjs";
import { httpError } from "../utils/httpError.mjs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DURATION_UNIT_HOURS = "hours";
export const DURATION_UNIT_DAY = "Day";

/**
 * รองรับ startDate+endDate (ใหม่) และ date (legacy FE)
 * many-days: endDate > startDate · one-day: วันเดียวกัน
 */
export function resolveBookingDateRange(body) {
  const { date, startDate, endDate } = body ?? {};

  let start;
  let end;

  if (typeof startDate === "string" && startDate.trim()) {
    start = startDate.trim();
    end =
      typeof endDate === "string" && endDate.trim()
        ? endDate.trim()
        : start;
  } else if (typeof date === "string" && date.trim()) {
    start = date.trim();
    end = date.trim();
  } else {
    throw httpError(400, "Invalid date format");
  }

  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw httpError(400, "Invalid date format");
  }

  if (end < start) {
    throw httpError(400, "endDate must be after startDate");
  }

  return { startDate: start, endDate: end };
}

/** แยกโหมดราคา: วันเดียว = hourly · หลายวัน = per night */
export function resolveBookingPricing({
  startDate,
  endDate,
  startTime,
  endTime,
  petCount,
}) {
  if (startDate === endDate) {
    const duration = resolveDurationHours(startTime, endTime);
    return {
      duration,
      durationUnit: DURATION_UNIT_HOURS,
      totalPrice: calculateBookingTotal(duration, petCount),
    };
  }

  const nights = resolveNights(startDate, endDate);
  return {
    duration: nights,
    durationUnit: DURATION_UNIT_DAY,
    totalPrice: calculateNightlyTotal(nights, petCount),
  };
}
