import {
  calculateBookingTotal,
  calculateNightlyTotal,
  resolveDurationHours,
  resolveNights,
} from "../utils/bookingPricing.mjs";
import { httpError } from "../utils/httpError.mjs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DURATION_UNIT_HOURS = "hours";
export const DURATION_UNIT_DAY = "Day";

/** many-days ไม่ส่งเวลา → ใช้ค่านี้ตอน INSERT DB */
export const MANY_DAY_DEFAULT_START_TIME = "00:00";
export const MANY_DAY_DEFAULT_END_TIME = "23:59";

/** หลายวัน = endDate มากกว่า startDate */
export function isManyDayBooking(startDate, endDate) {
  return endDate > startDate;
}

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

/**
 * Ticket A — one-day ต้องมีเวลา · many-days เวลา optional (default 00:00–23:59)
 */
export function resolveBookingTimes({ startDate, endDate, startTime, endTime }) {
  if (isManyDayBooking(startDate, endDate)) {
    const resolvedStart =
      typeof startTime === "string" && startTime.trim()
        ? startTime.trim()
        : MANY_DAY_DEFAULT_START_TIME;
    const resolvedEnd =
      typeof endTime === "string" && endTime.trim()
        ? endTime.trim()
        : MANY_DAY_DEFAULT_END_TIME;

    if (!TIME_RE.test(resolvedStart) || !TIME_RE.test(resolvedEnd)) {
      throw httpError(400, "Invalid time format");
    }

    return { startTime: resolvedStart, endTime: resolvedEnd };
  }

  if (typeof startTime !== "string" || !startTime.trim()) {
    throw httpError(400, "startTime is required");
  }
  if (typeof endTime !== "string" || !endTime.trim()) {
    throw httpError(400, "endTime is required");
  }

  return { startTime: startTime.trim(), endTime: endTime.trim() };
}

function parseTimeToMinutes(value) {
  if (!TIME_RE.test(value)) {
    throw httpError(400, "Invalid time format");
  }
  const [, hh, mm] = value.match(TIME_RE);
  return Number(hh) * 60 + Number(mm);
}

/** one-day บนวันเดียวกัน — ช่วงเวลาทับกันไหม */
function doOneDayTimesOverlap(a, b) {
  const aStart = parseTimeToMinutes(a.startTime);
  const aEnd = parseTimeToMinutes(a.endTime);
  const bStart = parseTimeToMinutes(b.startTime);
  const bEnd = parseTimeToMinutes(b.endTime);
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Ticket B — many-days เทียบช่วงวัน [start, end) · one-day เทียบเวลาบนวันเดียวกัน
 */
export function doBookingsOverlap(existing, incoming) {
  const existingMany = isManyDayBooking(existing.startDate, existing.endDate);
  const incomingMany = isManyDayBooking(incoming.startDate, incoming.endDate);

  if (existingMany && incomingMany) {
    return (
      existing.startDate < incoming.endDate &&
      incoming.startDate < existing.endDate
    );
  }

  if (existingMany && !incomingMany) {
    return (
      incoming.startDate >= existing.startDate &&
      incoming.startDate < existing.endDate
    );
  }

  if (!existingMany && incomingMany) {
    return (
      existing.startDate >= incoming.startDate &&
      existing.startDate < incoming.endDate
    );
  }

  if (existing.startDate !== incoming.startDate) {
    return false;
  }

  return doOneDayTimesOverlap(existing, incoming);
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
