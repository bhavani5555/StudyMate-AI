
import { useEffect, useState, useRef, useCallback } from "react";

import {
  Bot,
  User,
  Send,
  Sparkles,
  Plus,
  Trash2,
  MessageSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  GraduationCap,
  LoaderCircle,
  RefreshCw
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { generateAIResponse } from "../services/aiService";

import {
  saveChatToCloud,
  getCloudChats,
  updateCloudChat,
  deleteCloudChat
} from "../services/chatService";

import { confirmDelete } from "../utils/confirmDelete";

import "./AITutor.css";

const STORAGE_KEY = "studymate-ai-chats";

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 340;

const WELCOME_SUGGESTIONS = [
  {
    title: "Explain Java OOP concepts",
    description: "Learn classes, objects, inheritance and polymorphism."
  },
  {
    title: "What is Spring Boot?",
    description: "Understand Spring Boot fundamentals with examples."
  },
  {
    title: "Explain React Hooks",
    description: "Learn useState, useEffect and other React hooks."
  },
  {
    title: "Help me with SQL queries",
    description: "Practice SQL queries and database concepts."
  }
];

/* =====================================
   CHAT HELPERS
===================================== */

const createChat = () => {
  const now = new Date().toISOString();

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: "New chat",
    messages: [],
    pinned: false,
    createdAt: now,
    updatedAt: now
  };
};

function getSavedChats() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "null"
    );

    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Unable to read saved chats:", error);
    return [];
  }
}

function normalizeChats(data) {
  if (!Array.isArray(data)) return [];

  return data
    .filter((chat) => chat && chat.id)
    .map((chat) => ({
      ...chat,
      title: chat.title || "New chat",
      messages: Array.isArray(chat.messages) ? chat.messages : [],
      pinned: Boolean(chat.pinned),
      updatedAt: chat.updatedAt || chat.createdAt || new Date().toISOString()
    }));
}

function sortChats(chats) {
  return [...chats].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() -
      new Date(a.updatedAt).getTime()
  );
}

function getErrorMessage(error) {
  const message = String(error?.message || "");
  const status = Number(error?.status || error?.code);

  if (
    status === 429 ||
    /429|RESOURCE_EXHAUSTED|quota/i.test(message)
  ) {
    return "Gemini API usage limit reached. Please wait and try again.";
  }

  if (
    status === 503 ||
    /503|UNAVAILABLE|high demand/i.test(message)
  ) {
    return "Gemini AI is temporarily unavailable. Please try again later.";
  }

  if (
    status === 504 ||
    /504|DEADLINE_EXCEEDED|timeout/i.test(message)
  ) {
    return "The AI response is taking too long. Please try again.";
  }

  if (/API key|API_KEY_INVALID|401|403|permission/i.test(message)) {
    return "Gemini API key or permission issue. Please check your API configuration.";
  }

  if (/fetch|network|internet/i.test(message)) {
    return "Network connection problem. Please check your internet.";
  }

  return error?.message || "Unable to generate an AI response. Please try again.";
}

function generateChatTitle(question) {
  const cleaned = question.replace(/\s+/g, " ").trim();

  return cleaned.length > 35
    ? `${cleaned.slice(0, 35)}...`
    : cleaned;
}

function createMessage(role, text) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text
  };
}

/* =====================================
   COMPONENT
===================================== */

function AITutor() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [cloudError, setCloudError] = useState("");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [renameChatId, setRenameChatId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const messagesEndRef = useRef(null);
  const renameInputRef = useRef(null);

  const loadStartedRef = useRef(false);
  const sendingRef = useRef(false);
  const mountedRef = useRef(false);

  const resizeStartRef = useRef({
    startX: 0,
    startWidth: DEFAULT_SIDEBAR_WIDTH
  });

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  const messages = activeChat?.messages || [];

  /* =====================================
     LOAD CHATS
  ===================================== */

  const loadChats = useCallback(async (force = false) => {
    if (loadStartedRef.current && !force) return;

    loadStartedRef.current = true;

    setLoadingChats(true);
    setCloudError("");

    try {
      let cloudChats = normalizeChats(await getCloudChats());

      if (cloudChats.length === 0) {
        const previousChats = getSavedChats();

        if (previousChats.length > 0) {
          const migratedChats = [];

          for (const chat of previousChats) {
            const savedChat = await saveChatToCloud(chat);

            if (savedChat?.id) {
              migratedChats.push(savedChat);
            }
          }

          cloudChats = normalizeChats(migratedChats);

          if (cloudChats.length > 0) {
            localStorage.removeItem(STORAGE_KEY);
          }
        }

        if (cloudChats.length === 0) {
          const firstChat = await saveChatToCloud(createChat());

          if (!firstChat?.id) {
            throw new Error("Unable to create your first conversation.");
          }

          cloudChats = normalizeChats([firstChat]);
        }
      }

      if (!mountedRef.current) return;

      const sortedChats = sortChats(cloudChats);

      setChats(sortedChats);

      setActiveChatId((previousId) =>
        sortedChats.some((chat) => chat.id === previousId)
          ? previousId
          : sortedChats[0]?.id || null
      );
    } catch (error) {
      console.error("Unable to load AI Tutor chats:", error);

      if (mountedRef.current) {
        setCloudError(
          "Unable to load conversations. Please check your connection and try again."
        );
      }

      loadStartedRef.current = false;
    } finally {
      if (mountedRef.current) {
        setLoadingChats(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    loadChats();

    return () => {
      mountedRef.current = false;
      loadStartedRef.current = false;
    };
  }, [loadChats]);

  /* =====================================
     AUTO SCROLL
  ===================================== */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end"
    });
  }, [messages, loading]);

  /* =====================================
     RENAME INPUT FOCUS
  ===================================== */

  useEffect(() => {
    if (renameChatId !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renameChatId]);

  /* =====================================
     SIDEBAR RESIZING
  ===================================== */

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event) => {
      const difference =
        event.clientX - resizeStartRef.current.startX;

      const nextWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(
          MIN_SIDEBAR_WIDTH,
          resizeStartRef.current.startWidth + difference
        )
      );

      setSidebarWidth(nextWidth);
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", stopResizing);
    document.addEventListener("pointercancel", stopResizing);

    document.body.classList.add("ai-sidebar-resizing");

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", stopResizing);
      document.removeEventListener("pointercancel", stopResizing);

      document.body.classList.remove("ai-sidebar-resizing");
    };
  }, [isResizing]);

  const startSidebarResize = (event) => {
    if (sidebarCollapsed) return;

    event.preventDefault();

    resizeStartRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth
    };

    setIsResizing(true);
  };

  /* =====================================
     UPDATE CHAT
  ===================================== */

  const updateChat = async (chatId, updates) => {
    try {
      setCloudError("");

      await updateCloudChat(chatId, updates);

      if (!mountedRef.current) return true;

      setChats((previousChats) =>
        previousChats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                ...updates,
                updatedAt: new Date().toISOString()
              }
            : chat
        )
      );

      return true;
    } catch (error) {
      console.error("Unable to update chat:", error);

      setCloudError(
        "Unable to save your changes. Please try again."
      );

      return false;
    }
  };

  /* =====================================
     NEW CHAT
  ===================================== */

  const newChat = async () => {
    if (sendingRef.current || loadingChats) return;

    try {
      setCloudError("");

      const chat = await saveChatToCloud(createChat());

      if (!chat?.id) {
        throw new Error("New conversation could not be created.");
      }

      if (!mountedRef.current) return;

      setChats((previousChats) => [
        chat,
        ...previousChats
      ]);

      setActiveChatId(chat.id);
      setInput("");
      setOpenMenuId(null);
    } catch (error) {
      console.error("Unable to create chat:", error);

      setCloudError(
        "Unable to create a new conversation. Please try again."
      );
    }
  };

  /* =====================================
     SELECT CHAT
  ===================================== */

  const selectChat = (chatId) => {
    if (sendingRef.current) return;

    setActiveChatId(chatId);
    setInput("");
    setOpenMenuId(null);
  };

  /* =====================================
     BUILD AI PROMPT
  ===================================== */

  const buildPrompt = (history, question) => {
    const previousHistory = history
      .map((message) => {
        const role =
          message.role === "user" ? "User" : "Assistant";

        return `${role}: ${message.text}`;
      })
      .join("\n\n");

    return `
You are StudyMate AI, an intelligent personal learning assistant.

Your purpose is to help students learn technical subjects and prepare for interviews.

Instructions:
1. Explain concepts in simple, clear English.
2. Support Java, Spring Boot, Spring AI, React, JavaScript, SQL, MySQL, HTML, CSS and other technical subjects.
3. Give practical examples wherever useful.
4. For programming questions, provide correct and complete code.
5. Explain code step by step when necessary.
6. Format responses using Markdown.
7. Use headings, bullet points, tables and code blocks where appropriate.
8. Give interview-focused explanations suitable for freshers.
9. Answer general knowledge and non-programming questions too.
10. Maintain context from the current conversation.
11. If a question is ambiguous, ask a relevant clarification.
12. Never claim code was tested when it was not.

Previous conversation:
${previousHistory || "This is a new conversation."}

Current user question:
${question}

Provide a helpful and accurate answer.
`;
  };

  /* =====================================
     SEND MESSAGE
  ===================================== */

  const sendMessage = async (event, suggestedQuestion = null) => {
    event?.preventDefault();

    const question = (
      suggestedQuestion !== null ? suggestedQuestion : input
    ).trim();

    if (
      !question ||
      sendingRef.current ||
      loadingChats ||
      !activeChat
    ) {
      return;
    }

    sendingRef.current = true;

    const chatId = activeChat.id;
    const previousMessages = activeChat.messages || [];

    const userMessage = createMessage("user", question);

    const updatedMessages = [
      ...previousMessages,
      userMessage
    ];

    const newTitle =
      activeChat.title === "New chat"
        ? generateChatTitle(question)
        : activeChat.title;

    const prompt = buildPrompt(previousMessages, question);

    setInput("");
    setLoading(true);
    setCloudError("");

    setChats((previousChats) =>
      previousChats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: updatedMessages,
              title: newTitle
            }
          : chat
      )
    );

    // Save the user message before requesting the AI response.
    try {
      await updateCloudChat(chatId, {
        messages: updatedMessages,
        title: newTitle
      });
    } catch (error) {
      console.error("Unable to save user message:", error);

      setCloudError(
        "Your message could not be saved. Please check your internet connection."
      );

      setChats((previousChats) =>
        previousChats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: previousMessages,
                title: activeChat.title
              }
            : chat
        )
      );

      setLoading(false);
      sendingRef.current = false;
      return;
    }

    let response;

    // Generate the AI response independently of the cloud save.
    try {
      response = await generateAIResponse(prompt);

      if (typeof response !== "string" || !response.trim()) {
        throw new Error("Gemini returned an empty response.");
      }
    } catch (error) {
      console.error("StudyMate AI generation error:", error);

      response = getErrorMessage(error);
    }

    const aiMessage = createMessage(
      "assistant",
      response.trim()
    );

    const finalMessages = [
      ...updatedMessages,
      aiMessage
    ];

    // Update the UI even if the subsequent cloud save fails.
    if (mountedRef.current) {
      setChats((previousChats) =>
        previousChats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: finalMessages,
                title: newTitle,
                updatedAt: new Date().toISOString()
              }
            : chat
        )
      );
    }

    // Save the complete conversation.
    try {
      await updateCloudChat(chatId, {
        messages: finalMessages,
        title: newTitle
      });
    } catch (error) {
      console.error("Unable to save AI response:", error);

      if (mountedRef.current) {
        setCloudError(
          "Your AI response was generated, but could not be saved to the cloud."
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }

      sendingRef.current = false;
    }
  };

  /* =====================================
     RENAME CHAT
  ===================================== */

  const openRenameModal = (chat) => {
    setRenameChatId(chat.id);
    setRenameValue(chat.title);
    setOpenMenuId(null);
  };

  const saveRename = async (event) => {
    event.preventDefault();

    const newTitle = renameValue.trim();

    if (!newTitle || renameChatId === null) return;

    const success = await updateChat(renameChatId, {
      title: newTitle
    });

    if (success) {
      setRenameChatId(null);
      setRenameValue("");
    }
  };

  /* =====================================
     PIN / UNPIN CHAT
  ===================================== */

  const togglePin = async (chat) => {
    const success = await updateChat(chat.id, {
      pinned: !chat.pinned
    });

    if (success) {
      setOpenMenuId(null);
    }
  };

  /* =====================================
     DELETE CHAT
  ===================================== */

  const deleteChat = async (chatId) => {
    if (sendingRef.current) return;

    const confirmed = await confirmDelete(
      "Are you sure you want to delete this conversation?"
    );

    if (!confirmed) return;

    try {
      setCloudError("");

      await deleteCloudChat(chatId);

      const remainingChats = chats.filter(
        (chat) => chat.id !== chatId
      );

      if (remainingChats.length === 0) {
        const freshChat = await saveChatToCloud(createChat());

        if (!freshChat?.id) {
          throw new Error("Unable to create a replacement conversation.");
        }

        setChats([freshChat]);
        setActiveChatId(freshChat.id);
      } else {
        const sortedChats = sortChats(remainingChats);

        setChats(sortedChats);

        if (activeChatId === chatId) {
          setActiveChatId(sortedChats[0].id);
        }
      }

      setOpenMenuId(null);
    } catch (error) {
      console.error("Unable to delete conversation:", error);

      setCloudError(
        "Unable to delete this conversation. Please try again."
      );
    }
  };

  /* =====================================
     DERIVED CHAT LISTS
  ===================================== */

  const pinnedChats = sortChats(
    chats.filter((chat) => chat.pinned)
  );

  const recentChats = sortChats(
    chats.filter((chat) => !chat.pinned)
  );

  /* =====================================
     RENDER
  ===================================== */

  return (
    <div
      className={`ai-tutor-page ${
        sidebarCollapsed ? "sidebar-collapsed" : ""
      } ${isResizing ? "is-resizing" : ""}`}
      style={{
        "--chat-sidebar-width": `${sidebarWidth}px`
      }}
    >
      {/* CHAT HISTORY SIDEBAR */}

      <aside className="ai-chat-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Sparkles size={22} />
          </div>

          <span>StudyMate AI</span>
        </div>

        <button
          type="button"
          className="sidebar-new-chat"
          onClick={newChat}
          disabled={loading || loadingChats}
        >
          <Plus size={19} />
          New Chat
        </button>

        <div className="sidebar-history">
          {loadingChats ? (
            <div className="sidebar-empty">
              <LoaderCircle size={25} className="spin-icon" />
              <p>Loading conversations...</p>
            </div>
          ) : (
            <>
              {pinnedChats.length > 0 && (
                <div className="history-section">
                  <h4>
                    <Pin size={13} />
                    Pinned
                  </h4>

                  {pinnedChats.map((chat) => (
                    <HistoryItem
                      key={chat.id}
                      chat={chat}
                      active={activeChatId === chat.id}
                      loading={loading}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      onSelect={selectChat}
                      onRename={openRenameModal}
                      onPin={togglePin}
                      onDelete={deleteChat}
                    />
                  ))}
                </div>
              )}

              <div className="history-section">
                <h4>Recent</h4>

                {recentChats.length > 0 ? (
                  recentChats.map((chat) => (
                    <HistoryItem
                      key={chat.id}
                      chat={chat}
                      active={activeChatId === chat.id}
                      loading={loading}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      onSelect={selectChat}
                      onRename={openRenameModal}
                      onPin={togglePin}
                      onDelete={deleteChat}
                    />
                  ))
                ) : (
                  <div className="sidebar-empty">
                    <MessageSquare size={27} />
                    <p>Your conversations will appear here.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-icon">
            <Sparkles size={19} />
          </div>

          <div>
            <strong>StudyMate AI</strong>
            <span>Your learning companion</span>
          </div>
        </div>
      </aside>

      {/* RESIZE HANDLE */}

      <div
        className={`ai-sidebar-resize-handle ${
          isResizing ? "resizing" : ""
        }`}
        onPointerDown={startSidebarResize}
        title="Drag to resize Recent Chats"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat history sidebar"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={Math.round(sidebarWidth)}
      >
        <span />
      </div>

      {/* MAIN CHAT AREA */}

      <section className="ai-chat-main">
        <div className="ai-chat-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() =>
                setSidebarCollapsed((previous) => !previous)
              }
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              aria-label={
                sidebarCollapsed ? "Show sidebar" : "Hide sidebar"
              }
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={21} />
              ) : (
                <PanelLeftClose size={21} />
              )}
            </button>

            <div className="topbar-title">
              AI Tutor

              <span className="topbar-subtitle">
                Your personal learning assistant
              </span>
            </div>
          </div>

          <button
            type="button"
            className="topbar-new-chat"
            onClick={newChat}
            disabled={loading || loadingChats}
          >
            <Plus size={17} />
            New Chat
          </button>
        </div>

        {cloudError && (
          <div className="ai-cloud-error" role="alert">
            <span>{cloudError}</span>

            <button
              type="button"
              onClick={() => setCloudError("")}
              title="Dismiss"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div
          className={`ai-chat-content ${
            messages.length === 0 ? "welcome-mode" : ""
          }`}
        >
          {loadingChats ? (
            <div className="ai-welcome-screen">
              <LoaderCircle size={34} className="spin-icon" />
              <h2>Loading your conversations...</h2>
            </div>
          ) : cloudError && chats.length === 0 ? (
            <div className="ai-welcome-screen">
              <MessageSquare size={34} />
              <h2>Unable to load conversations</h2>
              <p>{cloudError}</p>

              <button
                type="button"
                className="topbar-new-chat"
                onClick={() => loadChats(true)}
              >
                <RefreshCw size={17} />
                Try Again
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="ai-welcome-screen">
              <div className="welcome-icon">
                <GraduationCap size={34} />
              </div>

              <h1>What would you like to learn today?</h1>

              <p>
                Ask me anything about programming, development,
                databases or interview preparation. Let's learn
                something new together.
              </p>

              <div className="welcome-suggestions">
                {WELCOME_SUGGESTIONS.map((item) => (
                  <button
                    type="button"
                    key={item.title}
                    className="welcome-suggestion-card"
                    disabled={loading}
                    onClick={() => sendMessage(null, item.title)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message-row ${message.role}`}
                >
                  <div className="message-avatar">
                    {message.role === "assistant" ? (
                      <Bot size={19} />
                    ) : (
                      <User size={19} />
                    )}
                  </div>

                  <div className="message-content">
                    <span className="message-sender">
                      {message.role === "assistant"
                        ? "StudyMate AI"
                        : "You"}
                    </span>

                    <div className="message-bubble">
                      {message.role === "assistant" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.text}
                        </ReactMarkdown>
                      ) : (
                        message.text
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-row assistant">
                  <div className="message-avatar">
                    <Bot size={19} />
                  </div>

                  <div className="message-content">
                    <span className="message-sender">
                      StudyMate AI
                    </span>

                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* MESSAGE INPUT */}

        <form
          className="ai-input-section"
          onSubmit={sendMessage}
        >
          <div className="ai-input-box">
            <input
              type="text"
              placeholder="Ask StudyMate AI anything..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={loading || loadingChats || !activeChat}
              aria-label="Ask StudyMate AI"
            />

            <button
              type="submit"
              disabled={
                !input.trim() ||
                loading ||
                loadingChats ||
                !activeChat
              }
              title="Send message"
              aria-label="Send message"
            >
              {loading ? (
                <LoaderCircle size={19} className="spin-icon" />
              ) : (
                <Send size={19} />
              )}
            </button>
          </div>

          <p>
            StudyMate AI can make mistakes. Verify important information.
          </p>
        </form>
      </section>

      {/* RENAME MODAL */}

      {renameChatId !== null && (
        <div
          className="rename-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setRenameChatId(null);
            }
          }}
        >
          <form className="rename-modal" onSubmit={saveRename}>
            <div className="rename-modal-header">
              <h3>Rename conversation</h3>

              <button
                type="button"
                onClick={() => setRenameChatId(null)}
                aria-label="Close rename dialog"
              >
                <X size={18} />
              </button>
            </div>

            <label htmlFor="chat-rename">
              Conversation name
            </label>

            <input
              ref={renameInputRef}
              id="chat-rename"
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={60}
              placeholder="Enter chat name"
            />

            <div className="rename-modal-actions">
              <button
                type="button"
                className="rename-cancel-btn"
                onClick={() => setRenameChatId(null)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rename-save-btn"
                disabled={!renameValue.trim()}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* =====================================
   HISTORY ITEM
===================================== */

function HistoryItem({
  chat,
  active,
  loading,
  openMenuId,
  setOpenMenuId,
  onSelect,
  onRename,
  onPin,
  onDelete
}) {
  const menuOpen = openMenuId === chat.id;

  return (
    <div
      className={`history-chat-item ${active ? "active" : ""}`}
    >
      <button
        type="button"
        className="history-chat-select"
        onClick={() => onSelect(chat.id)}
        disabled={loading}
        title={chat.title}
      >
        <MessageSquare size={17} />
        <span>{chat.title}</span>
      </button>

      <button
        type="button"
        className="history-more-btn"
        onClick={() =>
          setOpenMenuId(menuOpen ? null : chat.id)
        }
        title="Chat options"
        aria-label="Chat options"
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={19} />
      </button>

      {menuOpen && (
        <div className="history-context-menu">
          <button
            type="button"
            onClick={() => onRename(chat)}
          >
            <Pencil size={15} />
            Rename
          </button>

          <button
            type="button"
            onClick={() => onPin(chat)}
          >
            {chat.pinned ? (
              <PinOff size={15} />
            ) : (
              <Pin size={15} />
            )}

            {chat.pinned ? "Unpin" : "Pin"}
          </button>

          <button
            type="button"
            className="delete-menu-option"
            onClick={() => onDelete(chat.id)}
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default AITutor;
