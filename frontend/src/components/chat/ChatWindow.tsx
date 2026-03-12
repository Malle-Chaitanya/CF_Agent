"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, RotateCcw } from "lucide-react";
import MessageBubble, {
  TypingIndicator,
  type Message,
} from "./MessageBubble";
import ChatInput from "./ChatInput";
import { askAgent, clearSession } from "@/services/agentApi";

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = useCallback(async (prompt: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const data = await askAgent(prompt);
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          err instanceof Error
            ? `Something went wrong: ${err.message}`
            : "An unexpected error occurred. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClear = () => {
    setMessages([]);
    clearSession(); // reset session so next message starts a fresh conversation
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              AI Assistant
            </p>
            <p className="text-[11px] text-emerald-500">Online</p>
          </div>
        </div>
        {messages.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, rotate: -90 }}
            onClick={handleClear}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="Clear chat"
          >
            <RotateCcw className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-hidden">
        {messages.length === 0 && !isLoading && <EmptyState />}

        <div className="space-y-5">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <AnimatePresence>{isLoading && <TypingIndicator />}</AnimatePresence>
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex h-full flex-col items-center justify-center pb-10 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100">
        <Bot className="h-8 w-8 text-brand-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">
        CloudFuze AI Assistant
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
        Manage your SaaS users with natural language. Try onboarding users,
        listing apps, resetting passwords, and more.
      </p>
    </motion.div>
  );
}
