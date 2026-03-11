"use client";

import React from "react";
import { Bell, Search } from "lucide-react";
import { motion } from "framer-motion";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">
            3
          </span>
        </motion.button>

        {/* Avatar */}
        <div className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
            RA
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold leading-tight text-slate-900">
              Ravi Admin
            </p>
            <p className="text-[11px] leading-tight text-slate-400">
              Super Admin
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
