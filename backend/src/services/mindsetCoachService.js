import OpenAI from "openai";
import { getRecentMessages, addUserAndAssistantMessages } from "./chatService.js";

const openai = new OpenAI({
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

export async function handleMindsetChat(userContent) {
  const history = await getRecentMessages(50);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: userContent },
  ];

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
