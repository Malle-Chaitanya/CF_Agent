"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  AppWindow,
  BarChart3,
  Bot,
  Cloud,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  id: string;
}

const topNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { label: "Users", icon: Users, id: "users" },
  { label: "Applications", icon: AppWindow, id: "apps" },
  { label: "Analytics", icon: BarChart3, id: "analytics" },
  { label: "AI Assistant", icon: Bot, id: "assistant" },
];

const bottomNav: NavItem[] = [
  { label: "Settings", icon: Settings, id: "settings" },
];

interface SidebarProps {
  activeId: string;
  onNavigate: (id: string) => void;
}

export default function Sidebar({ activeId, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col bg-sidebar text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <Cloud className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">CloudFuze</span>
        <span className="ml-1 rounded bg-brand-600/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
          AI
        </span>
      </div>

      {/* Main nav */}
      <nav className="mt-4 flex-1 space-y-1 px-3">
        {topNav.map((item) => {
          const isActive = activeId === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-white/10 px-3 pb-4 pt-3 space-y-1">
        {bottomNav.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </button>
        ))}
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
          <LogOut className="h-[18px] w-[18px]" />
          Log out
        </button>
      </div>
    </aside>
  );
}
