import { bookingsService } from "../services/bookings.service.mjs";

export const bookingsController = {
  async getMyBookings(req, res, next) {
    try {
      const sitterId = req.user.id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 7;
      const offset = (page - 1) * limit;
      const search = req.query.search ? `%${req.query.search}%` : null;
      const status =
        req.query.status && req.query.status !== "all"
          ? req.query.status
          : null;

      const { rows, totalBookings } = await bookingsService.getMyBookings(
        sitterId,
        search,
        status,
        limit,
        offset
      );

      const totalPages = Math.ceil(totalBookings / limit) || 1;

      return res.status(200).json({
        totalBookings,
        totalPages,
        currentPage: page,
        limit,
        data: rows,
        nextPage: page < totalPages ? page + 1 : null,
      });
    } catch (error) {
      next(error);
    }
  },

  async getMyBookingById(req, res, next) {
    try {
      const booking = await bookingsService.getMyBookingById(
        req.user.id,
        req.params.id
      );

      return res.status(200).json({ data: booking });
    } catch (error) {
      next(error);
    }
  },

  // Booking History (list) — อ่าน page/limit/search/status จาก query string,
  // แปลง status "all" ให้เป็น null (คือไม่กรอง) แล้วให้ service ไปดึงข้อมูลของ
  // owner คนที่ login อยู่เท่านั้น (req.user.id) จากนั้นคำนวณ totalPages/nextPage
  // ให้ frontend ใช้ทำปุ่มเปลี่ยนหน้า
  async getOwnerBookings(req, res, next) {
    try {
      const ownerId = req.user.id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search ? `%${req.query.search}%` : null;
      const status =
        req.query.status && req.query.status !== "all"
          ? req.query.status
          : null;

      const { rows, totalBookings } = await bookingsService.getOwnerBookings(
        ownerId,
        search,
        status,
        limit,
        offset
      );

      const totalPages = Math.ceil(totalBookings / limit) || 1;

      return res.status(200).json({
        totalBookings,
        totalPages,
        currentPage: page,
        limit,
        data: rows,
        nextPage: page < totalPages ? page + 1 : null,
      });
    } catch (error) {
      next(error);
    }
  },

  // Booking History (detail) — ดึง booking รายการเดียวแบบละเอียด (รวมข้อมูล pet,
  // sitter, การชำระเงิน, รีวิว) ของ owner ที่ login อยู่ ใช้เปิดหน้า/ป๊อปอัปรายละเอียด
  async getOwnerBookingById(req, res, next) {
    try {
      const booking = await bookingsService.getOwnerBookingById(
        req.user.id,
        req.params.id
      );

      return res.status(200).json({ data: booking });
    } catch (error) {
      next(error);
    }
  },

  // Booking History — ปุ่ม "ยกเลิก" บนรายการ booking; business rule (เช่น
  // ยกเลิกได้เฉพาะตอน waiting_confirm, cancel payment intent ของ stripe ถ้าจ่ายด้วยบัตร)
  // อยู่ใน bookingsService.cancelOwnerBooking ทั้งหมด
  async cancelOwnerBooking(req, res, next) {
    try {
      const cancelled = await bookingsService.cancelOwnerBooking(
        req.user.id,
        req.params.id
      );

      return res.status(200).json({
        message: "Booking cancelled successfully",
        data: cancelled,
      });
    } catch (error) {
      next(error);
    }
  },

  // Booking History — ปุ่ม "เลื่อนวัน/เวลา"; ส่ง body (วัน/เวลาใหม่) ต่อให้ service
  // ตรวจสอบเงื่อนไข (สถานะ, ไม่ชนกับ booking อื่น, ราคาต้องเท่าเดิมถ้าจ่ายผ่าน stripe)
  async rescheduleOwnerBooking(req, res, next) {
    try {
      const rescheduled = await bookingsService.rescheduleOwnerBooking(
        req.user.id,
        req.params.id,
        req.body
      );

      return res.status(200).json({
        message: "Booking date updated successfully",
        data: rescheduled,
      });
    } catch (error) {
      next(error);
    }
  },

  // Booking History — ปุ่ม "รีวิว" บน booking ที่จบงานแล้ว
  // ตรวจ rating เบื้องต้นที่ controller (ต้อง 1-5) ส่วนเงื่อนไขอื่น ๆ (ต้อง success,
  // ยังไม่เคยรีวิวมาก่อน) ตรวจใน service
  async submitOwnerReview(req, res, next) {
    try {
      const { rating, text } = req.body;
      const numericRating = Number(rating);

      if (!numericRating || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      const review = await bookingsService.submitReview(
        req.user.id,
        req.params.id,
        numericRating,
        text || ""
      );

      return res.status(201).json({
        message: "Review submitted successfully",
        data: review,
      });
    } catch (error) {
      next(error);
    }
  },

  // Booking History — ปุ่ม "แจ้งปัญหา" บน booking รายการหนึ่ง ต้องมี subject เสมอ
  async submitOwnerReport(req, res, next) {
    try {
      const { subject, description } = req.body;

      if (!subject || !subject.trim()) {
        return res.status(400).json({ message: "Subject is required" });
      }

      const report = await bookingsService.submitReport(
        req.user.id,
        req.params.id,
        subject.trim(),
        description || ""
      );

      return res.status(201).json({
        message: "Report submitted successfully",
        data: report,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateMyBookingStatus(req, res, next) {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const updated = await bookingsService.updateMyBookingStatus(
        req.user.id,
        req.params.id,
        status
      );

      return res.status(200).json({
        message: "Booking status updated successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  // owner booking — POST /api/bookings (cash | stripe)
  async create(req, res, next) {
    try {
      const created = await bookingsService.createBooking(req.user, req.body);

      return res.status(201).json({ data: created });
    } catch (error) {
      next(error);
    }
  },
};
