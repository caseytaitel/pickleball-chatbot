import { prisma } from "../db/client.js";

const DEFAULT_CONVERSATION_ID = 1;

export async function ensureDefaultConversation() {
  let convo = await prisma.conversation.findFirst({
    where: { id: DEFAULT_CONVERSATION_ID },
  });

  if (!convo) {
    convo = await prisma.conversation.create({
      data: {
        id: DEFAULT_CONVERSATION_ID,
        title: "Default Conversation",
      },
    });
  }

  return convo;
}

export async function getRecentMessages(limit = 50) {
  await ensureDefaultConversation();

  return prisma.message.findMany({
    where: { conversationId: DEFAULT_CONVERSATION_ID },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function addUserAndAssistantMessages(userContent, assistantContent) {
  await ensureDefaultConversation();

  const [userMessage, assistantMessage] = await prisma.$transaction([
    prisma.message.create({
      data: {
        role: "user",
        content: userContent,
        conversationId: DEFAULT_CONVERSATION_ID,
      },
    }),
    prisma.message.create({
      data: {
        role: "assistant",
        content: assistantContent,
        conversationId: DEFAULT_CONVERSATION_ID,
      },
    }),
  ]);

  return { userMessage, assistantMessage };
}

// New: clear all messages for the default conversation
export async function clearConversationMessages() {
  await ensureDefaultConversation();

  await prisma.message.deleteMany({
    where: { conversationId: DEFAULT_CONVERSATION_ID },
  });
}
