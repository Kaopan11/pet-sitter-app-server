import { pool } from "./db.mjs";

export const conversationsRepository = {
  async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, owner_id, sitter_id, created_at
       FROM public.conversations
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async findByOwnerAndSitter(ownerId, sitterId) {
    const { rows } = await pool.query(
      `SELECT id, owner_id, sitter_id, created_at
       FROM public.conversations
       WHERE owner_id = $1 AND sitter_id = $2
       LIMIT 1`,
      [ownerId, sitterId]
    );
    return rows[0] ?? null;
  },

  async findBetweenUsers(userA, userB) {
    const { rows } = await pool.query(
      `SELECT id, owner_id, sitter_id, created_at
       FROM public.conversations
       WHERE (owner_id = $1 AND sitter_id = $2)
          OR (owner_id = $2 AND sitter_id = $1)
       LIMIT 1`,
      [userA, userB]
    );
    return rows[0] ?? null;
  },

  async create({ ownerId, sitterId }) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO public.conversations (owner_id, sitter_id)
         VALUES ($1, $2)
         RETURNING id, owner_id, sitter_id, created_at`,
        [ownerId, sitterId]
      );
      return rows[0];
    } catch (error) {
      if (error.code === "23505") {
        return this.findByOwnerAndSitter(ownerId, sitterId);
      }
      throw error;
    }
  },

  async listForUser(userId) {
    const { rows } = await pool.query(
      `SELECT
         conversations.id,
         conversations.owner_id,
         conversations.sitter_id,
         conversations.created_at,
         other_user.id AS other_user_id,
         other_user.name AS other_name,
         other_user.avatar_url AS other_avatar_url,
         last_message.content AS last_message,
         last_message.image_url AS last_image_url,
         last_message.sent_at AS last_sent_at,
         unread.unread_count
       FROM public.conversations
       JOIN public.users AS other_user
         ON other_user.id = CASE
           WHEN conversations.owner_id = $1 THEN conversations.sitter_id
           ELSE conversations.owner_id
         END
       LEFT JOIN LATERAL (
         SELECT content, image_url, sent_at
         FROM public.messages
         WHERE messages.conversation_id = conversations.id
         ORDER BY messages.sent_at DESC
         LIMIT 1
       ) AS last_message ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS unread_count
         FROM public.messages
         WHERE messages.conversation_id = conversations.id
           AND messages.sender_id <> $1
           AND messages.read_at IS NULL
       ) AS unread ON true
       WHERE conversations.owner_id = $1 OR conversations.sitter_id = $1
       ORDER BY COALESCE(last_message.sent_at, conversations.created_at) DESC`,
      [userId]
    );
    return rows;
  },
};
