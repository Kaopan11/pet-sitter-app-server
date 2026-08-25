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

  async getOwnerBookings(req, res, next) {
    try {
      const data = await bookingsService.getOwnerBookings(req.user.id);
      return res.status(200).json({ data });
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
};
