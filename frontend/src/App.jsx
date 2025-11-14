import { useEffect, useRef, useState } from "react";
import { fetchChatHistory, sendChatMessage } from "./api/chatApi";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        setIsLoadingHistory(true);
        setError("");
        const history = await fetchChatHistory();
        setMessages(history);
      } catch (err) {
        console.error(err);
        setError("Failed to load previous conversation.");
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadHistory();
  }, []);

  async function handleSendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setError("");

    // Optimistically show the user message in the UI
    const tempUserMessage = {
      id: Date.now(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setInput("");
    setIsSending(true);

    try {
      const { assistantMessage } = await sendChatMessage(trimmed);

      // Append the assistant message returned from the backend
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to send message.");
      // Optionally mark the last temporary user message as failed, etc.
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  return (
    <div className="app-root">
      <div className="chat-shell">
        <header className="chat-header">
          <div className="chat-title">Pickleball Mindset Coach</div>
          <div className="chat-subtitle">
            Ask about nerves, confidence, pressure, and between-point resets.
          </div>
        </header>

        <main className="chat-main">
          {isLoadingHistory && (
            <div className="chat-status">Loading your conversation…</div>
          )}

          {error && <div className="chat-error">{error}</div>}

          <div className="messages-list">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id ?? Math.random()}
                  className={`message-row ${isUser ? "message-row-user" : "message-row-coach"}`}
                >
                  <div
                    className={`message-bubble ${
                      isUser ? "message-user" : "message-coach"
                    }`}
                  >
                    {!isUser && (
                      <div className="message-label">Coach</div>
                    )}
                    {isUser && (
                      <div className="message-label message-label-user">You</div>
                    )}
                    <div className="message-content">{msg.content}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="chat-footer">
          <div className="input-wrapper">
            <textarea
              className="chat-input"
              placeholder="Ask about a match, nerves, or a situation you’re struggling with…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <button
              className="send-button"
              onClick={handleSendMessage}
              disabled={isSending || !input.trim()}
            >
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>
          <div className="input-hint">
            Press Enter to send, Shift+Enter for a new line.
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;

