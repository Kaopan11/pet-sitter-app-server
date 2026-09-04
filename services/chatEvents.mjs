import { pool } from "../repositories/db.mjs";
import { messagesRepository } from "../repositories/messages.repository.mjs";
import { toMessage } from "./chat.service.mjs";

const CHANNEL = "chat_events";
const clients = new Map();

let listenClient = null;
let reconnectTimer = null;

function clientKey(userId) {
  return String(userId ?? "");
}

function sendEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof res.flush === "function") res.flush();
}

function removeClient(userId, res) {
  const key = clientKey(userId);
  const set = clients.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(key);
}

function broadcast(payload) {
  const targets = new Set(
    [payload.ownerId, payload.sitterId].filter(Boolean).map(clientKey),
  );

  for (const userId of targets) {
    const set = clients.get(userId);
    if (!set) continue;
    for (const res of [...set]) {
      try {
        sendEvent(res, payload);
      } catch {
        removeClient(userId, res);
      }
    }
  }
}

export function publishChatEvent({
  type,
  conversationId,
  message = null,
  ownerId,
  sitterId,
}) {
  broadcast({
    type,
    conversationId: String(conversationId ?? ""),
    message,
    ownerId,
    sitterId,
  });
}

async function handleNotification(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  const conversationId = String(parsed.conversationId ?? "");
  const op = parsed.op === "UPDATE" ? "read" : "message";
  let message = null;

  if (op === "message" && parsed.messageId != null) {
    const row = await messagesRepository.findById(parsed.messageId);
    if (row) message = toMessage(row);
  }

  broadcast({
    type: op,
    conversationId,
    message,
    ownerId: parsed.ownerId,
    sitterId: parsed.sitterId,
  });
}

async function ensureNotifyTrigger(client) {
  await client.query(`
    CREATE OR REPLACE FUNCTION public.notify_chat_event()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      payload jsonb;
      owner_uuid uuid;
      sitter_uuid uuid;
    BEGIN
      SELECT owner_id, sitter_id
        INTO owner_uuid, sitter_uuid
      FROM public.conversations
      WHERE id = NEW.conversation_id;

      payload := jsonb_build_object(
        'op', TG_OP,
        'conversationId', NEW.conversation_id,
        'messageId', NEW.id,
        'senderId', NEW.sender_id,
        'ownerId', owner_uuid,
        'sitterId', sitter_uuid
      );

      PERFORM pg_notify('chat_events', payload::text);
      RETURN NEW;
    END;
    $$;
  `);

  await client.query(
    `DROP TRIGGER IF EXISTS messages_chat_notify ON public.messages`
  );

  try {
    await client.query(`
      CREATE TRIGGER messages_chat_notify
      AFTER INSERT OR UPDATE OF read_at ON public.messages
      FOR EACH ROW
      EXECUTE FUNCTION public.notify_chat_event()
    `);
  } catch {
    await client.query(`
      CREATE TRIGGER messages_chat_notify
      AFTER INSERT OR UPDATE OF read_at ON public.messages
      FOR EACH ROW
      EXECUTE PROCEDURE public.notify_chat_event()
    `);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startChatListener();
  }, 3000);
}

export async function startChatListener() {
  if (listenClient) {
    try {
      listenClient.removeAllListeners();
      listenClient.release();
    } catch {
      // ignore
    }
    listenClient = null;
  }

  try {
    const client = await pool.connect();
    listenClient = client;

    client.on("error", (error) => {
      console.error("Chat realtime connection error:", error.message);
      listenClient = null;
      try {
        client.release();
      } catch {
        // ignore
      }
      scheduleReconnect();
    });

    client.on("notification", (notification) => {
      if (notification.channel !== CHANNEL || !notification.payload) return;
      handleNotification(notification.payload).catch((error) => {
        console.error("Chat realtime notify failed:", error.message);
      });
    });

    await ensureNotifyTrigger(client);
    await client.query(`LISTEN ${CHANNEL}`);
    console.log("Chat realtime listener ready");
  } catch (error) {
    listenClient = null;
    console.error("Chat realtime listener failed:", error.message);
    scheduleReconnect();
  }
}

export function subscribeChatEvents(userId, req, res) {
  req.socket?.setTimeout?.(0);
  res.setTimeout?.(0);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.status(200);
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const key = clientKey(userId);
  let set = clients.get(key);
  if (!set) {
    set = new Set();
    clients.set(key, set);
  }
  set.add(res);

  sendEvent(res, { type: "connected" });

  const ping = setInterval(() => {
    try {
      res.write(":\n\n");
    } catch {
      cleanup();
    }
  }, 15000);

  function cleanup() {
    clearInterval(ping);
    removeClient(userId, res);
  }

  req.on("close", cleanup);
  res.on("close", cleanup);
}
