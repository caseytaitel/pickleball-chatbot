import OpenAI from "openai";
import { getRecentMessages, addUserAndAssistantMessages } from "./chatService.js";

// Exported so other modules (like routes) can reuse it for streaming
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are a pickleball mindset and mental performance coach.

Focus on:
- Confidence under pressure
- Handling nerves and anxiety
- Recovering after errors
- Pre-match and between-point routines
- Reset strategies and self-talk
- Perspective, composure, and enjoyment of the game

Guidelines:
- Keep answers practical and specific to pickleball.
- Use simple language and short paragraphs.
- Offer 2–4 concrete actions or micro-routines when possible.
- Never discuss swing mechanics; stay on mindset and decision-making.
`;

// Build the messages array using DB history + new user content
async function buildMindsetMessagesInternal(userContent) {
  const history = await getRecentMessages(50);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: userContent },
  ];

  return messages;
}

// Exported helper: used by both non-streaming and streaming paths
export async function buildMindsetMessages(userContent) {
  return buildMindsetMessagesInternal(userContent);
}

// Existing non-streaming handler (used by /api/chat/message)
export async function handleMindsetChat(userContent) {
  const messages = await buildMindsetMessagesInternal(userContent);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages,
    temperature: 0.7,
  });

  const assistantContent = completion.choices[0]?.message?.content?.trim() ?? "";

  const { userMessage, assistantMessage } = await addUserAndAssistantMessages(
    userContent,
    assistantContent
  );

  return { userMessage, assistantMessage };
}
