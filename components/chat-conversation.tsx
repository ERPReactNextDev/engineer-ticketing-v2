"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, onSnapshot, Timestamp, arrayUnion, setDoc, serverTimestamp, deleteDoc, query, collection, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Send,
  Paperclip,
  X,
  CheckCircle2,
  ThumbsUp,
  Heart,
  Smile,
  Reply,
  MoreHorizontal,
  ChevronDown,
  ImagePlus,
  CornerUpLeft,
  MessageSquare,
  Eye,
  Loader2,
  CornerDownRight,
} from "lucide-react";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderImage?: string;
  text: string;
  time: string;
  isSystem?: boolean;
  isResolved?: boolean;
  imageUrl?: string;
  reactions?: Record<string, string[]>;
  replyTo?: {
    originalMsgId: string;
    senderName: string;
    text: string;
  } | null;
  seenBy?: string[];
}

interface ChatConversationProps {
  requestId: string;
  collectionName: string;
  messages: Message[];
  currentUserId: string;
  userName: string;
  userRole: string;
  status: string;
  profilePicture?: string;
  title: string;
  searchQuery?: string;
}

export default function ChatConversation({
  requestId,
  collectionName,
  messages: initialMessages,
  currentUserId,
  userName,
  userRole,
  status,
  profilePicture,
  title,
  searchQuery = "",
}: ChatConversationProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [chatMessage, setChatMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Filter messages based on search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    return messages.filter(m => 
      m.text?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastScrollHeight = useRef(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<string | null>(null);
  const [lastSeenTime, setLastSeenTime] = useState<number>(Date.now());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sentSound = useRef<HTMLAudioElement | null>(null);
  const receivedSound = useRef<HTMLAudioElement | null>(null);
  const prevMessagesCount = useRef(messages.length);

  // Initialize sound effects
  useEffect(() => {
    sentSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    receivedSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    if (sentSound.current) sentSound.current.volume = 0.3;
    if (receivedSound.current) receivedSound.current.volume = 0.3;
  }, []);

  // FEATURE: TYPING INDICATORS (WRITE) - When user types
  useEffect(() => {
    if (!requestId || !currentUserId) return;
    const typingRef = doc(db, "typing_indicators", `${requestId}_${currentUserId}`);
    if (chatMessage.length > 0) {
      setDoc(typingRef, { userName, updatedAt: serverTimestamp() });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => deleteDoc(typingRef), 3000);
    } else {
      deleteDoc(typingRef);
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      deleteDoc(typingRef);
    };
  }, [chatMessage, requestId, currentUserId, userName]);

  // Real-time sync
  useEffect(() => {
    if (!requestId || !collectionName) return;
    const docRef = doc(db, collectionName, requestId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.messages) {
          setMessages(data.messages);
        }
      }
    });
    return () => unsubscribe();
  }, [requestId, collectionName]);

  // FEATURE: TYPING INDICATORS (READ) - Listen to other users typing
  useEffect(() => {
    if (!requestId) return;
    const typingQuery = query(
      collection(db, "typing_indicators"),
      where("requestId", "==", requestId)
    );
    const unsubscribe = onSnapshot(typingQuery, (snapshot) => {
      const users: string[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userName && data.userName !== userName) {
          users.push(data.userName);
        }
      });
      setTypingUsers(users);
    });
    return () => unsubscribe();
  }, [requestId, userName]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    const isNearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 100;
    if (isNearBottom) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  }, [messages]);

  // FEATURE: SYSTEM MESSAGES (STATUS CHANGE)
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== status && status !== "PENDING" && requestId) {
      const injectSystemMessage = async () => {
        try {
          const docRef = doc(db, collectionName, requestId);
          await updateDoc(docRef, {
            messages: arrayUnion({
              id: `sys-${Date.now()}`,
              text: `PROJECT STATUS UPDATED TO: ${status}`,
              senderId: "system",
              senderName: "System",
              role: "system",
              time: new Date().toISOString(),
              isSystem: true,
              seenBy: [currentUserId]
            })
          });
        } catch (e) { console.error("System message failed", e); }
      };
      injectSystemMessage();
    }
    prevStatus.current = status;
  }, [status, requestId, collectionName, currentUserId]);

  // Handle scroll button visibility
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    const handleScroll = () => {
      const isNearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };
    scrollEl.addEventListener("scroll", handleScroll);
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [chatMessage]);

  // Click outside to close message actions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMessageId && !(e.target as Element).closest("[data-message-id]")) {
        setActiveMessageId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [activeMessageId]);

  // FEATURE: ANCHOR POINT - Scroll to specific message
  const scrollToMessage = (msgId: string) => {
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-blue-400", "ring-offset-2", "rounded-xl");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-blue-400", "ring-offset-2", "rounded-xl");
      }, 2000);
    } else {
      toast.error("Message not found in history");
    }
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior });
      setLastSeenTime(Date.now());
    }
  }, []);

  // FEATURE: MENTION SUPPORT - Render @mentions with highlight
  const renderMessageText = (text: string) => {
    const mentionRegex = /(@[a-zA-Z0-9 ]+)/g;
    const parts = text.split(mentionRegex);
    return parts.map((part, i) => {
      if (part.match(mentionRegex)) {
        const isMe = part.toLowerCase() === `@${userName.toLowerCase()}`;
        return (
          <span key={i} className={cn(
            "font-black px-1.5 py-0.5 rounded-md",
            isMe ? "bg-yellow-400 text-slate-900" : "bg-blue-500/20 text-blue-700"
          )}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Play sound when receiving new messages
  useEffect(() => {
    if (messages.length > prevMessagesCount.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== currentUserId) {
        receivedSound.current?.play().catch(() => {});
      }
    }
    prevMessagesCount.current = messages.length;
  }, [messages, currentUserId]);

  // Send message - Fixed to use arrayUnion like collaboration-hub
  const sendChat = useCallback(async () => {
    if (!chatMessage.trim() || !requestId || !collectionName || isSending) return;
    setIsSending(true);
    const content = chatMessage;
    const currentReply = replyingTo;
    setChatMessage("");
    setReplyingTo(null);

    try {
      const docRef = doc(db, collectionName, requestId);
      const newMessage = {
        id: Math.random().toString(36).substring(2, 11),
        text: content,
        senderId: currentUserId,
        senderName: userName,
        senderImage: profilePicture || "",
        role: userRole,
        time: new Date().toISOString(),
        isResolved: false,
        isSystem: false,
        seenBy: [currentUserId],
        reactions: {},
        replyTo: currentReply ? {
          text: currentReply.text,
          senderName: currentReply.senderName,
          originalMsgId: currentReply.id
        } : null
      };

      try {
        await updateDoc(docRef, {
          messages: arrayUnion(newMessage),
          updatedAt: serverTimestamp()
        });
      } catch (docError: any) {
        // If document doesn't exist, create it with setDoc
        if (docError.code === 'not-found') {
          await setDoc(docRef, {
            messages: [newMessage],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          throw docError;
        }
      }
      sentSound.current?.play().catch(() => {});
      setLastSeenTime(Date.now());
      setTimeout(() => scrollToBottom("auto"), 100);
    } catch (error: any) {
      console.error("Firebase send error:", error);
      toast.error("Failed to send message");
      setChatMessage(content); // Restore message on error
    } finally {
      setIsSending(false);
    }
  }, [chatMessage, currentUserId, userName, userRole, profilePicture, replyingTo, requestId, collectionName, scrollToBottom, isSending]);

  // Keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  // Toggle reaction
  const toggleReaction = async (msgId: string, emoji: string) => {
    try {
      const docRef = doc(db, collectionName, requestId);
      const updatedMessages = messages.map((m) => {
        if (m.id !== msgId) return m;
        const reactions = { ...(m.reactions || {}) };
        const users = reactions[emoji] || [];
        if (users.includes(currentUserId)) {
          reactions[emoji] = users.filter((id) => id !== currentUserId);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji] = [...users, currentUserId];
        }
        return { ...m, reactions };
      });
      await updateDoc(docRef, { messages: updatedMessages });
    } catch (e) {
      toast.error("Failed to update reaction");
    }
  };

  // Toggle resolve
  const toggleResolve = async (msgId: string) => {
    try {
      const docRef = doc(db, collectionName, requestId);
      const updatedMessages = messages.map((m) =>
        m.id === msgId ? { ...m, isResolved: !m.isResolved } : m
      );
      await updateDoc(docRef, { messages: updatedMessages });
      toast.success("Status updated");
      setActiveMessageId(null);
    } catch (e) {
      toast.error("Failed to update");
    }
  };

  // Memoized sorted messages (use filteredMessages if search is active)
  const sortedMessages = useMemo(() => {
    return [...filteredMessages].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
  }, [filteredMessages]);

  // First unread index
  const firstUnreadIndex = useMemo(() => {
    if (!lastReadTimestamp) return -1;
    return sortedMessages.findIndex(
      (m) => new Date(m.time) > new Date(lastReadTimestamp)
    );
  }, [sortedMessages, lastReadTimestamp]);

  // Unread count - using seenBy like collaboration-hub
  const unreadCount = useMemo(() => {
    return messages.filter(msg => 
      msg.senderId !== currentUserId && 
      !msg.seenBy?.includes(currentUserId)
    ).length;
  }, [messages, currentUserId]);

  // Empty state
  if (!filteredMessages || filteredMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <MessageSquare size={28} className="text-slate-400" />
        </div>
        <p className="text-slate-500 text-sm font-medium">
          {searchQuery ? "No messages found" : "No messages yet"}
        </p>
        <p className="text-slate-400 text-xs mt-1">
          {searchQuery ? "Try a different search term" : "Start the conversation!"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* MESSAGES - Telegram/Viber Style - ONLY THIS AREA SCROLLS */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 scroll-smooth"
        style={{
          backgroundColor: "#e5ded6",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {sortedMessages.map((msg, i) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <span className="px-4 py-1.5 bg-slate-200/70 text-slate-500 text-[11px] font-medium rounded-full">
                  {msg.text}
                </span>
              </div>
            );
          }

          const isMe = msg.senderId === currentUserId;
          const isFirstUnread = i === firstUnreadIndex;
          const isActive = activeMessageId === msg.id;
          const seenByOthers = (msg.seenBy || []).filter((id) => id !== currentUserId);

          return (
            <React.Fragment key={msg.id}>
              {isFirstUnread && unreadCount > 0 && (
                <div className="flex justify-center my-4">
                  <span className="px-4 py-1.5 bg-blue-100 text-blue-600 text-[11px] font-medium rounded-full">
                    {unreadCount} new message{unreadCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div
                id={`msg-${msg.id}`}
                data-message-id={msg.id}
                className={cn(
                  "flex gap-3 group relative transition-all duration-300",
                  isMe ? "flex-row-reverse" : "flex-row"
                )}
              >
                <Avatar className="h-9 w-9 shrink-0 self-end border-2 border-white shadow-sm">
                  <AvatarImage
                    src={isMe ? profilePicture : msg.senderImage}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-blue-600 text-[10px] text-white">
                    {(msg.senderName || "U").charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    "flex flex-col gap-0.5 max-w-[75%]",
                    isMe ? "items-end" : "items-start"
                  )}
                >
                  {!isMe && (
                    <div className="flex items-center gap-1.5 ml-1 mb-1">
                      <Avatar className="size-5">
                        <AvatarImage
                          src={msg.senderImage}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-slate-200 text-[8px] text-slate-600">
                          {(msg.senderName || "U").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] font-semibold text-slate-600">
                        {msg.senderName}
                      </span>
                    </div>
                  )}

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMessageId(isActive ? null : msg.id);
                    }}
                    className={cn(
                      "px-3 py-2 text-[14px] leading-relaxed relative transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md",
                      isMe
                        ? "bg-[#0084ff] text-white rounded-[18px] rounded-br-[4px]"
                        : "bg-white text-slate-800 rounded-[18px] rounded-bl-[4px] border border-slate-100",
                      msg.isResolved && "opacity-70",
                      isActive && "ring-2 ring-blue-400 ring-offset-1"
                    )}
                  >
                    {/* Message actions */}
                    <div
                      className={cn(
                        "absolute -top-11 flex items-center gap-0.5 transition-all z-20 bg-white/95 backdrop-blur-sm shadow-lg rounded-full p-1 border border-slate-200/60",
                        isActive
                          ? "opacity-100 scale-100 visible"
                          : "opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible",
                        isMe ? "right-0" : "left-0"
                      )}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReaction(msg.id, "👍");
                        }}
                        className="p-1.5 hover:bg-slate-50 rounded-full transition-colors"
                      >
                        <ThumbsUp size={14} className="text-blue-500" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReaction(msg.id, "❤️");
                        }}
                        className="p-1.5 hover:bg-slate-50 rounded-full transition-colors"
                      >
                        <Heart size={14} className="text-red-500" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReaction(msg.id, "😊");
                        }}
                        className="p-1.5 hover:bg-slate-50 rounded-full transition-colors"
                      >
                        <Smile size={14} className="text-yellow-500" />
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyingTo(msg);
                          setActiveMessageId(null);
                        }}
                        className="p-1.5 hover:bg-slate-50 rounded-full text-slate-600"
                      >
                        <Reply size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleResolve(msg.id);
                        }}
                        className="p-1.5 hover:bg-slate-50 rounded-full text-green-600"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    </div>

                    {/* Resolved badge */}
                    {msg.isResolved && (
                      <div className="flex items-center gap-1 mb-1.5 text-[10px] font-semibold text-green-600 bg-green-50/80 px-2 py-0.5 rounded-full w-fit">
                        <CheckCircle2 size={10} className="text-green-500" />{" "}
                        Resolved
                      </div>
                    )}

                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (msg.replyTo?.originalMsgId)
                            scrollToMessage(msg.replyTo.originalMsgId);
                        }}
                        className="mb-2 p-2 bg-black/10 rounded-lg text-[10px] opacity-90 border-l-2 border-white/50 cursor-pointer hover:bg-black/20 transition-all"
                      >
                        <div className="font-semibold">{msg.replyTo.senderName}</div>
                        <div className="line-clamp-2">{msg.replyTo.text}</div>
                      </div>
                    )}

                    {/* Message text with mention support */}
                    <div className="whitespace-pre-wrap">{renderMessageText(msg.text)}</div>

                    {/* Reactions */}
                    {msg.reactions &&
                      Object.entries(msg.reactions).some(
                        ([_, users]) => users.length > 0
                      ) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(msg.reactions).map(
                            ([emoji, users]) =>
                              users.length > 0 && (
                                <span
                                  key={emoji}
                                  className="bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[10px] border border-white/10"
                                >
                                  {emoji} {users.length}
                                </span>
                              )
                          )}
                        </div>
                      )}

                    {/* Time and read status */}
                    <div
                      className={cn(
                        "flex items-center justify-end gap-1 text-[11px] mt-1.5 font-medium",
                        isMe ? "text-blue-100/80" : "text-slate-400"
                      )}
                    >
                      {new Date(msg.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {isMe && (
                        <span className="ml-0.5">
                          {seenByOthers.length > 0 ? (
                            <svg
                              className="w-4 h-4 text-blue-200"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 12a4 4 0 110-8 4 4 0 010 8z" />
                              <path
                                d="M12 8a4 4 0 11-8 0 4 4 0 018 0z"
                                opacity="0.5"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 text-blue-300/50"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 12a4 4 0 110-8 4 4 0 010 8z" />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-24 right-6 z-30 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all border border-slate-200"
        >
          <ChevronDown size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
        </button>
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 bg-white border-t border-slate-100">
          <span className="text-[12px] text-slate-500 italic">
            {typingUsers.join(", ")} typing...
          </span>
        </div>
      )}

      {/* Reply bar */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CornerUpLeft size={16} className="text-blue-500" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-slate-700">
                Replying to {replyingTo.senderName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {replyingTo.text}
              </div>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-slate-200 rounded-full transition-colors ml-2"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>
      )}

      {/* INPUT AREA - FIXED AT BOTTOM */}
      <div className="bg-white p-3 border-t border-slate-200 flex items-end gap-2 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={() => {}}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors shrink-0"
        >
          <Paperclip size={22} />
        </button>

        <div className="flex-1 bg-slate-100 rounded-2xl flex items-end px-3 py-2">
          <textarea
            ref={inputRef}
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="w-full bg-transparent border-0 resize-none focus:ring-0 focus:outline-none text-[14px] py-1 px-0 min-h-[24px] max-h-[120px]"
            rows={1}
          />
        </div>

        <button
          onClick={sendChat}
          disabled={!chatMessage.trim() || isSending}
          className={cn(
            "p-2.5 rounded-full transition-all shrink-0",
            chatMessage.trim()
              ? "bg-[#0084ff] text-white hover:bg-blue-600 shadow-md"
              : "bg-slate-100 text-slate-400"
          )}
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={20} className={cn("ml-0.5", chatMessage.trim() && "-rotate-45")} />
          )}
        </button>
      </div>
    </div>
  );
}


