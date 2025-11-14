import express from "express";
import {
  getRecentMessages,
  addUserAndAssistantMessages,
  clearConversationMessages,
} from "../services/chatService.js";
import {
  handleMindsetChat,
  buildMindsetMessages,
  openai,
} from "../services/mindsetCoachService.js";

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

// POST /api/chat/message  (non-streaming fallback)
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

// POST /api/chat/stream  (streaming endpoint)
router.post("/stream", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }

    // Build messages array (system + history + new user message)
    const messages = await buildMindsetMessages(content);

    // Headers for chunked text streaming
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    let fullText = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (!delta) continue;

      fullText += delta;
      res.write(delta);
    }

    res.end();

    await addUserAndAssistantMessages(content, fullText);
  } catch (err) {
    console.error("POST /api/chat/stream error", err);

    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to stream chat message" });
    }

    try {
      res.end();
    } catch (_) {
      // ignore
    }
  }
});

// POST /api/chat/reset  (clear conversation)
router.post("/reset", async (req, res) => {
  try {
    await clearConversationMessages();
    // 204 No Content = success with empty body
    res.status(204).end();
  } catch (err) {
    console.error("POST /api/chat/reset error", err);
    res.status(500).json({ error: "Failed to reset conversation" });
  }
});

export default router;
