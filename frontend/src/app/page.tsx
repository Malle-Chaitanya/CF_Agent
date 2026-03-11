"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import StatsCards from "@/components/dashboard/StatsCards";
import ChatWindow from "@/components/chat/ChatWindow";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Overview of your SaaS environment",
  },
  users: { title: "Users", subtitle: "Manage your organisation's users" },
  apps: { title: "Applications", subtitle: "Connected SaaS applications" },
  analytics: {
    title: "Analytics",
    subtitle: "Usage and cost insights",
  },
  assistant: {
    title: "AI Assistant",
    subtitle: "Manage users with natural language",
  },
  settings: { title: "Settings", subtitle: "Application configuration" },
};

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -8 },
};

export default function Home() {
  const [activeNav, setActiveNav] = useState("assistant");
  const meta = PAGE_TITLES[activeNav] ?? PAGE_TITLES.dashboard;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      <Sidebar activeId={activeNav} onNavigate={setActiveNav} />

      <div className="ml-[260px] flex flex-1 flex-col overflow-hidden">
        <Header title={meta.title} subtitle={meta.subtitle} />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeNav}
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              transition={{ duration: 0.25 }}
              className="mx-auto h-full max-w-7xl"
            >
              {activeNav === "assistant" ? (
                <AssistantView />
              ) : activeNav === "dashboard" ? (
                <DashboardView />
              ) : (
                <PlaceholderView label={meta.title} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function AssistantView() {
  return (
    <div className="flex h-full flex-col gap-6">
      <StatsCards />
      <div className="min-h-0 flex-1">
        <ChatWindow />
      </div>
    </div>
  );
}

function DashboardView() {
  return (
    <div className="space-y-8">
      <StatsCards />
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-card">
        <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
        <p className="mt-2 text-sm text-slate-500">
          Activity timeline will appear here once the backend is connected.
        </p>
      </div>
    </div>
  );
}

function PlaceholderView({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-300">{label}</h2>
        <p className="mt-2 text-sm text-slate-400">
          This section is under construction.
        </p>
      </div>
    </div>
  );
}
