import express from "express";
import { getRecentMessages } from "../services/chatService.js";
import { handleMindsetChat } from "../services/mindsetCoachService.js";

const router = express.Router();

// GET /api/chat/history
router.get("/history", async (req, res) => {
  try {
    const messages = await getRecentMessages(50);
    res.json({ messages });
  } catch (err) {
    console.error("GET /api/chat/history error", err);
    res.status(500).json({ error: "Failed to load chat history" });
  }
});

// POST /api/chat/message
router.post("/message", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }

    const result = await handleMindsetChat(content);
    res.status(201).json(result);
  } catch (err) {
    console.error("POST /api/chat/message error", err);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

export default router;
