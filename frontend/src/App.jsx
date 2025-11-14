import { useEffect, useRef, useState } from "react";
import { fetchChatHistory, API_BASE_URL } from "./api/chatApi";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [thinkingPhase, setThinkingPhase] = useState(null); // "clarifying" | "organizing" | "summarizing" | "error" | null
  const [lastQuestion, setLastQuestion] = useState(null); // for retry after error

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

  async function handleSendMessage(customContent) {
    const rawContent = customContent ?? input;
    const trimmed = rawContent.trim();
    if (!trimmed || isSending) return;

    setError("");
    setLastQuestion(trimmed);

    // Create a temp user message and assistant placeholder
    const nowIso = new Date().toISOString();
    const userId = Date.now();
    const assistantId = `${userId}-assistant`;

    const tempUserMessage = {
      id: userId,
      role: "user",
      content: trimmed,
      createdAt: nowIso,
    };

    const tempAssistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: nowIso,
    };

    // Add both to the UI immediately
    setMessages((prev) => [...prev, tempUserMessage, tempAssistantMessage]);
    setInput("");
    setIsSending(true);
    setThinkingPhase("clarifying");

    const phaseTimeouts = [];
    phaseTimeouts.push(
      setTimeout(() => {
        setThinkingPhase((prev) => (prev ? "organizing" : prev));
      }, 2000)
    );
    phaseTimeouts.push(
      setTimeout(() => {
        setThinkingPhase((prev) => (prev ? "summarizing" : prev));
      }, 5000)
    );

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start streaming from the coach.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const chunkText = decoder.decode(value, { stream: !done });
          if (chunkText) {
            setMessages((prev) => {
              const updated = [...prev];
              const index = updated.findIndex((m) => m.id === assistantId);
              if (index !== -1) {
                updated[index] = {
                  ...updated[index],
                  content: (updated[index].content || "") + chunkText,
                };
              }
              return updated;
            });
          }
        }
      }

      setThinkingPhase(null);
      // Optional: could refresh from history, but not required
    } catch (err) {
      console.error(err);
      setError(
        "Connection lost while the coach was responding. You can retry your last question."
      );
      setThinkingPhase("error");
      // Note: partial text (if any) remains in the assistant bubble.
    } finally {
      setIsSending(false);
      phaseTimeouts.forEach(clearTimeout);
    }
  }

  async function handleResetConversation() {
    try {
      setError("");
      setThinkingPhase(null);
      setIsSending(false);
      setLastQuestion(null);

      const response = await fetch(`${API_BASE_URL}/api/chat/reset`, {
        method: "POST",
      });

      if (!response.ok && response.status !== 204) {
        throw new Error("Failed to reset conversation");
      }

      // Clear UI messages
      setMessages([]);
    } catch (err) {
      console.error(err);
      setError("Could not reset the conversation. Please try again.");
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function renderThinkingText() {
    if (!thinkingPhase) return null;

    if (thinkingPhase === "error") {
      return "Coach connection interrupted.";
    }

    if (thinkingPhase === "clarifying") {
      return "Coach is clarifying your situation…";
    }
    if (thinkingPhase === "organizing") {
      return "Coach is organizing your plan…";
    }
    if (thinkingPhase === "summarizing") {
      return "Coach is summarizing your next steps…";
    }

    return null;
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
                  className={`message-row ${
                    isUser ? "message-row-user" : "message-row-coach"
                  }`}
                >
                  <div
                    className={`message-bubble ${
                      isUser ? "message-user" : "message-coach"
                    }`}
                  >
                    {!isUser && <div className="message-label">Coach</div>}
                    {isUser && (
                      <div className="message-label message-label-user">
                        You
                      </div>
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
          {/* Top row: thinking + reset + optional retry */}
          <div className="footer-status-row">
            {thinkingPhase && (
              <div className="thinking-bar">
                <div className="thinking-dots">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </div>
                <div className="thinking-text">{renderThinkingText()}</div>
              </div>
            )}

            <div className="footer-buttons">
              <button
                type="button"
                className="secondary-button"
                onClick={handleResetConversation}
                disabled={isSending || messages.length === 0}
              >
                Reset Conversation
              </button>

              {error && lastQuestion && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleSendMessage(lastQuestion)}
                  disabled={isSending}
                >
                  Retry Last Question
                </button>
              )}
            </div>
          </div>

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
              onClick={() => handleSendMessage()}
              disabled={isSending || !input.trim()}
            >
              {isSending ? "Coach is thinking…" : "Send"}
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
