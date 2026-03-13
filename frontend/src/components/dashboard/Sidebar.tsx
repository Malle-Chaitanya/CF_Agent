"use client";

import React from "react";
import {
  LayoutDashboard,
  Unplug,
  AppWindow,
  ShieldCheck,
  Workflow,
  MonitorCheck,
  Settings,
  Bot,
} from "lucide-react";

const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIcAAABKCAMAAACmT7dSAAAArlBMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8tivQqAAAAOXRSTlMA+gTwDBAU9AgY6xzXypZhJi/mRSCmN8A7QMS7LdszobWBmypPbN/SzuOrkVywh1eMcUtTfHR4aGUNiq33AAAKqUlEQVRo3u2Z2ZajNhCGtbFjwIAxeMULXvG+6v1fLFWCscedziQ93Unf5D9nxrSFpU+lqqIkyKfEtEEUk++XdQ5p9/tBmM+lpHtGXmRqum4y8h/oxyBBQ4Ls9GeISXTbrveXU2CSf1uanxGlmyFRK/YA7B02M4NKaSzzQif/rth12UnURVcq8UHdot+6NpW1bC8g/6riuTTWDL3UltWoV4TSHWcUUvkUH/67HnwA51z04CJrnwY3F0ZsM/OU92czLl9kjC3yxWK9R5cip2D0G1yp7/xQyuUkyOU7MvaOML/UX3fLh5ETtAAda2otYs3aUMlv+t54C0EBNxxuz/doEIsvCmO9IcMbq4MklKBuQPTk5q12rOBAZfrhC8OssxqOV13XQJ7+5hzpX2MOKuXQISg2Ul4wj8SlYVC61tMQqLS0IZ+arXdNSwg9mO5dqhbI9aZfsD5sJcE1M4IyvXCILlFabQnKJ3of2oI4f3pFvrPgPoGLoR9zWlnIPWifT1wzzAd3NSMxbAVX+KvQ1QjzjAFP/yjG9AfG2WFsch/nG6+YwJVXNyy3nwbpGbYhYQnw2llNiRZKYySGOADfkTX4410tFzUM6p4ECdZ9Dj+gfOZNmFbU4cxHn12aMhxcqcxVxEzWiUXGknr6VoXI2SwkUJFitjinsdNzmOnP5EPL0jTvS84x2fdPn+Q4j0lvLjuBss293JIplUPrghzwOZVAxab7Xu1MO1v+JHvHtN35vM+XFNg/x7HNiL6W/YFal3TTFz1bruJS2TuPEwwmUzAWD6IoS3aA9wISMYJqerNG+jkO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";

interface NavItem {
  label: string;
  icon: React.ElementType;
  id: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { label: "AI Assistant", icon: Bot, id: "assistant" },
  { label: "Integrations", icon: Unplug, id: "integrations" },
  { label: "Applications", icon: AppWindow, id: "applications" },
  { label: "Data", icon: ShieldCheck, id: "data" },
  { label: "Workflow", icon: Workflow, id: "workflow" },
  { label: "Browser Activity", icon: MonitorCheck, id: "browser-activity" },
  { label: "Settings", icon: Settings, id: "settings" },
];

interface SidebarProps {
  activeId: string;
  onNavigate: (id: string) => void;
}

export default function Sidebar({ activeId, onNavigate }: SidebarProps) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 flex w-[90px] flex-col text-white"
      style={{ backgroundColor: "#001a6f" }}
    >
      <div className="flex flex-col items-center justify-center py-4 px-2">
        <img src={LOGO_B64} alt="CloudFuze Logo" className="w-[60px] h-auto" />
      </div>

      <nav className="flex flex-col items-center gap-1 px-2 mt-1">
        {navItems.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex flex-col items-center justify-center w-full rounded-lg py-2.5 px-1 gap-1 transition-colors"
              style={{ backgroundColor: isActive ? "#1a56db" : "transparent" }}
              onMouseEnter={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.1)";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              }}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="text-[10px] font-medium leading-tight text-center">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
