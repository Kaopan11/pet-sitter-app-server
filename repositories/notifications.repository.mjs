import { pool } from "./db.mjs";

function encodeContent({ title, body, href, bookingId }) {
  return JSON.stringify({
    title,
    body: body ?? "",
    href: href ?? null,
    bookingId: bookingId != null ? String(bookingId) : null,
  });
}

function decodeContent(row) {
  const fallback = {
    title: row.type,
    body: row.content ?? "",
    href: null,
    bookingId: null,
  };

  if (!row.content) return fallback;

  try {
    const parsed = JSON.parse(row.content);
    if (parsed && typeof parsed === "object" && parsed.title) {
      return {
        title: parsed.title,
        body: parsed.body ?? "",
        href: parsed.href ?? null,
        bookingId: parsed.bookingId != null ? String(parsed.bookingId) : null,
      };
    }
  } catch {
    // legacy plain-text content
  }

  return fallback;
}

function mapRow(row) {
  const payload = decodeContent(row);
  return {
    id: String(row.id),
    type: row.type,
    title: payload.title,
    body: payload.body,
    href: payload.href,
    bookingId: payload.bookingId,
    readAt: row.is_read ? row.created_at : null,
    createdAt: row.created_at,
  };
}

export const notificationsRepository = {
  async create({ userId, type, title, body, href, bookingId }) {
    const { rows } = await pool.query(
      `INSERT INTO public.notifications (user_id, type, content, is_read)
       VALUES ($1, $2, $3, false)
       RETURNING id, type, content, is_read, created_at`,
      [userId, type, encodeContent({ title, body, href, bookingId })]
    );
    return mapRow(rows[0]);
  },

  async listByUserId(userId, { limit = 30 } = {}) {
    const { rows } = await pool.query(
      `SELECT id, type, content, is_read, created_at
       FROM public.notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map(mapRow);
  },

  async countUnread(userId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM public.notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return rows[0]?.count ?? 0;
  },

  async markRead(userId, notificationId) {
    const { rows } = await pool.query(
      `UPDATE public.notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2 AND is_read = false
       RETURNING id`,
      [notificationId, userId]
    );
    return Boolean(rows[0]);
  },

  async markAllRead(userId) {
    const { rowCount } = await pool.query(
      `UPDATE public.notifications
       SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return rowCount ?? 0;
  },
};
