"use client";

import React from "react";
import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-gradient-to-br from-brand-500 to-brand-700"
            : "bg-gradient-to-br from-slate-700 to-slate-900"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-md bg-brand-600 text-white"
            : "rounded-tl-md border border-slate-200 bg-white text-slate-800 shadow-card"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            "mt-1.5 text-[10px]",
            isUser ? "text-brand-200" : "text-slate-400"
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </motion.div>
  );
}

/* Typing indicator shown while waiting for the agent */
export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-5 py-3 shadow-card">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block h-2 w-2 rounded-full bg-slate-400"
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
