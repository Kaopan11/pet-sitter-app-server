import { chatService } from "../services/chat.service.mjs";
import { subscribeChatEvents } from "../services/chatEvents.mjs";

export const chatController = {
  async createConversation(req, res, next) {
    try {
      const conversation = await chatService.createConversation(
        req.user.id,
        req.body?.sitterId
      );
      res.status(200).json({ data: conversation });
    } catch (error) {
      next(error);
    }
  },

  async listConversations(req, res, next) {
    try {
      const conversations = await chatService.listConversations(req.user.id);
      res.status(200).json({ data: conversations });
    } catch (error) {
      next(error);
    }
  },

  async listMessages(req, res, next) {
    try {
      const messages = await chatService.listMessages(
        req.user.id,
        req.params.id
      );
      res.status(200).json({ data: messages });
    } catch (error) {
      next(error);
    }
  },

  async sendMessage(req, res, next) {
    try {
      const message = await chatService.sendMessage(req.user.id, req.params.id, {
        content: req.body?.content,
        imageFile: req.file,
      });
      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  },

  streamEvents(req, res, next) {
    try {
      subscribeChatEvents(req.user.id, req, res);
    } catch (error) {
      next(error);
    }
  },
};
