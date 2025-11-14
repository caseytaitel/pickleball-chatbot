export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export async function fetchChatHistory() {
  const response = await fetch(`${API_BASE_URL}/api/chat/history`);

  if (!response.ok) {
    throw new Error("Failed to load chat history");
  }

  const data = await response.json();
  // data = { messages: [...] }
  return data.messages || [];
}

// Non-streaming fallback (still available if you ever want it)
export async function sendChatMessage(content) {
  const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || "Failed to send chat message";
    throw new Error(message);
  }

  const data = await response.json();
  // data = { userMessage, assistantMessage }
  return data;
}
