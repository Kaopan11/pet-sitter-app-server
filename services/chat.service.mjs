import { conversationsRepository } from "../repositories/conversations.repository.mjs";
import { messagesRepository } from "../repositories/messages.repository.mjs";
import { sitterProfilesRepository } from "../repositories/sitterProfiles.repository.mjs";
import { httpError } from "../utils/httpError.mjs";
import supabase from "../repositories/supabase.mjs";

const PHOTOS_BUCKET = "photos";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_PATTERN.test(String(value ?? ""));
}

function parseConversationId(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) {
    throw httpError(400, "Invalid conversation id");
  }
  return text;
}

async function uploadChatImage(file, userId) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw httpError(400, "Image must be .jpg, .jpeg, or .png");
  }

  const safeName = String(file.originalname ?? "image")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80);
  const filePath = `chat/${userId}-${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw httpError(400, error.message || "Failed to upload image");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(data.path);

  return publicUrl;
}

function previewText(row) {
  const content = String(row.last_message ?? "").trim();
  if (content) return content;
  if (row.last_image_url) return "Sent a photo";
  return "";
}

function toConversation(row) {
  return {
    id: String(row.id),
    ownerId: row.owner_id,
    sitterId: row.sitter_id,
    createdAt: row.created_at,
    otherUser: {
      id: row.other_user_id,
      name: row.other_name || "User",
      avatarUrl: row.other_avatar_url ?? null,
    },
    lastMessage: previewText(row),
    lastSentAt: row.last_sent_at ?? null,
    unreadCount: row.unread_count ?? 0,
  };
}

export function toMessage(row) {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: row.sender_id,
    content: row.content,
    imageUrl: row.image_url ?? null,
    sentAt: row.sent_at,
    readAt: row.read_at ?? null,
  };
}

function assertMember(conversation, userId) {
  if (
    conversation.owner_id !== userId &&
    conversation.sitter_id !== userId
  ) {
    throw httpError(403, "You cannot access this conversation");
  }
}

export const chatService = {
  async createConversation(userId, sitterId) {
    if (!isUuid(sitterId)) {
      throw httpError(400, "sitterId is required");
    }
    if (sitterId === userId) {
      throw httpError(400, "You cannot chat with yourself");
    }

    const sitter = await sitterProfilesRepository.findByUserId(sitterId);
    if (!sitter) {
      throw httpError(404, "Pet sitter not found");
    }

    const existing = await conversationsRepository.findByOwnerAndSitter(
      userId,
      sitterId
    );
    const conversation =
      existing ??
      (await conversationsRepository.create({
        ownerId: userId,
        sitterId,
      }));

    return {
      id: String(conversation.id),
      ownerId: conversation.owner_id,
      sitterId: conversation.sitter_id,
      createdAt: conversation.created_at,
    };
  },

  async listConversations(userId) {
    const rows = await conversationsRepository.listForUser(userId);
    return rows.map(toConversation);
  },

  async listMessages(userId, conversationId) {
    const id = parseConversationId(conversationId);

    const conversation = await conversationsRepository.findById(id);
    if (!conversation) throw httpError(404, "Conversation not found");
    assertMember(conversation, userId);

    await messagesRepository.markRead({
      conversationId: id,
      readerId: userId,
    });

    const rows = await messagesRepository.listByConversationId(id);
    return rows.map(toMessage);
  },

  async sendMessage(userId, conversationId, { content, imageFile } = {}) {
    const id = parseConversationId(conversationId);

    const text = String(content ?? "").trim();
    if (!text && !imageFile) {
      throw httpError(400, "Message is required");
    }

    const conversation = await conversationsRepository.findById(id);
    if (!conversation) throw httpError(404, "Conversation not found");
    assertMember(conversation, userId);

    const imageUrl = imageFile
      ? await uploadChatImage(imageFile, userId)
      : null;

    const row = await messagesRepository.create({
      conversationId: id,
      senderId: userId,
      content: text || null,
      imageUrl,
    });
    return toMessage(row);
  },
};
