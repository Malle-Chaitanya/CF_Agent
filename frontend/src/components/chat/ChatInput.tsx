"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "How many users exist?",
  "List inactive Slack users",
  "What apps does Rahul use?",
  "Onboard john@company.com to Slack",
];

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-3">
      {/* Suggestions */}
      {value.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <motion.button
              key={s}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setValue(s);
                textareaRef.current?.focus();
              }}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              <Sparkles className="h-3 w-3" />
              {s}
            </motion.button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 transition-colors focus-within:border-brand-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI assistant anything..."
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            value.trim() && !disabled
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "bg-slate-200 text-slate-400"
          )}
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </div>

      <p className="mt-2 text-center text-[11px] text-slate-400">
        CloudFuze AI may produce inaccurate results. Verify critical actions.
      </p>
    </div>
  );
}
