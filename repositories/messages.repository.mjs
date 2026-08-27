import { pool } from "./db.mjs";

export const messagesRepository = {
  async listByConversationId(conversationId) {
    const { rows } = await pool.query(
      `SELECT id, conversation_id, sender_id, content, image_url, sent_at, read_at
       FROM public.messages
       WHERE conversation_id = $1
       ORDER BY sent_at ASC`,
      [conversationId]
    );
    return rows;
  },

  async create({ conversationId, senderId, content, imageUrl }) {
    const { rows } = await pool.query(
      `INSERT INTO public.messages (conversation_id, sender_id, content, image_url, sent_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, conversation_id, sender_id, content, image_url, sent_at, read_at`,
      [conversationId, senderId, content, imageUrl]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, conversation_id, sender_id, content, image_url, sent_at, read_at
       FROM public.messages
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async markRead({ conversationId, readerId }) {
    await pool.query(
      `UPDATE public.messages
       SET read_at = NOW()
       WHERE conversation_id = $1
         AND sender_id <> $2
         AND read_at IS NULL`,
      [conversationId, readerId]
    );
  },
};
