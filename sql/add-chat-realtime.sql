-- แจ้ง server เมื่อมีข้อความใหม่ / อ่านแล้ว เพื่อส่ง realtime ไป frontend
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

DROP TRIGGER IF EXISTS messages_chat_notify ON public.messages;

CREATE TRIGGER messages_chat_notify
AFTER INSERT OR UPDATE OF read_at ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_chat_event();
