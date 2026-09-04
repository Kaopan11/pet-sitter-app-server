import { sittersService } from "../services/sitters.service.mjs";
import { payoutService } from "../services/payout.service.mjs";
import { payoutBankService } from "../services/payoutBank.service.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";

export const sittersController = {
  // Landing page — list/search พี่เลี้ยงสัตว์เลี้ยง
  // อ่าน query string จากหน้าเว็บ (คำค้น, ตัวกรอง, หน้า/limit) แล้วส่งต่อให้
  // sitterProfilesRepository.findMany ไปสร้าง SQL query จริง จากนั้นห่อผลลัพธ์
  // เป็น { data, pagination } กลับไปให้ frontend render การ์ด sitter + ปุ่มเปลี่ยนหน้า
  async list(req, res) {
    try {
      // คำค้นหา (ชื่อ/พื้นที่) — ห่อด้วย % สำหรับ ILIKE แบบ partial match
      const q = req.query.q ? `%${req.query.q}%` : null;
      // ตัวกรองประเภทสัตว์เลี้ยง เช่น "dog,cat" -> ["dog", "cat"]
      const petTypes = req.query.petTypes
        ? String(req.query.petTypes)
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
        : null;
      // ตัวกรองคะแนนรีวิว เช่น "4,5" -> [4, 5] (รับเฉพาะ 1-5)
      const ratings = req.query.rating
        ? String(req.query.rating)
            .split(",")
            .map((item) => Number.parseInt(item.trim(), 10))
            .filter((item) => item >= 1 && item <= 5)
        : null;
      // ตัวกรองปีประสบการณ์ ตัดคำว่า "years" ต่อท้ายทิ้ง (เผื่อ frontend ส่งมาแบบ "3 years")
      const experience = req.query.experience
        ? String(req.query.experience).replace(/\s*years$/i, "").trim()
        : null;
      // การแบ่งหน้า — ค่าเริ่มต้นคือหน้า 1 แสดงทีละ 5 รายการ
      const page = Number(req.query.page) || 1;
      const PAGE_SIZE = Number(req.query.limit) || 5;
      const offset = (page - 1) * PAGE_SIZE;

      // ยิง query ไปที่ DB ครั้งเดียว ได้ทั้งรายการของหน้านี้ + จำนวนทั้งหมดที่ตรงเงื่อนไข
      const result = await sitterProfilesRepository.findMany({
        q,
        petTypes: petTypes?.length ? petTypes : null,
        rating: ratings?.length ? [...new Set(ratings)] : null,
        experience: experience || null,
        pageSize: PAGE_SIZE,
        offset,
      });

      // ส่งกลับพร้อม metadata การแบ่งหน้าให้ frontend ทำปุ่ม next/prev ได้เอง
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
      console.error("sitters.list", error);
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

  async getMyPayout(req, res, next) {
    try {
      const data = await payoutService.getMyPayout(req.user.id, req.query);
      return res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  },

  async getMyPayoutBankAccount(req, res, next) {
    try {
      const data = await payoutBankService.getBankAccount(req.user.id);
      return res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  },

  async updateMyPayoutBankAccount(req, res, next) {
    try {
      const data = await payoutBankService.updateBankAccount(
        req.user.id,
        req.body
      );
      return res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  },

  async uploadMyPayoutBookBankImage(req, res, next) {
    try {
      const data = await payoutBankService.uploadBookBankImage(
        req.user.id,
        req.file
      );
      return res.status(200).json({ data });
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
};
