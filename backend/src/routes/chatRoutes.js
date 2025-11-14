import express from "express";
import { getRecentMessages, addUserAndAssistantMessages } from "../services/chatService.js";
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

    // In some environments, you can flush headers explicitly
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    let fullText = "";

    // Call OpenAI with streaming enabled
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

    // End the HTTP response once streaming is complete
    res.end();

    // Persist user + assistant messages to the DB
    await addUserAndAssistantMessages(content, fullText);
  } catch (err) {
    console.error("POST /api/chat/stream error", err);

    // If headers haven't been sent, send JSON error
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to stream chat message" });
    }

    // If we were mid-stream, just end the response
    try {
      res.end();
    } catch (_) {
      // ignore
    }
  }
});

export default router;

