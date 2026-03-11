"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, AppWindow, UserX, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCard {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend: string;
  trendUp: boolean;
}

const stats: StatCard[] = [
  {
    label: "Total Users",
    value: 2847,
    icon: Users,
    color: "text-brand-600",
    bgColor: "bg-brand-50",
    trend: "+12.5%",
    trendUp: true,
  },
  {
    label: "Active Apps",
    value: 24,
    icon: AppWindow,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    trend: "+3",
    trendUp: true,
  },
  {
    label: "Inactive Users",
    value: 183,
    icon: UserX,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    trend: "-8.2%",
    trendUp: false,
  },
  {
    label: "Monthly SaaS Spend",
    value: 48250,
    prefix: "$",
    icon: DollarSign,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    trend: "+5.1%",
    trendUp: true,
  },
];

function AnimatedCounter({
  target,
  prefix = "",
}: {
  target: number;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), target);
      setCount(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <span>
      {prefix}
      {count.toLocaleString("en-US")}
    </span>
  );
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function StatsCards() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          variants={cardVariants}
          whileHover={{ y: -3, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.1)" }}
          className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-card transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                <AnimatedCounter target={stat.value} prefix={stat.prefix} />
              </p>
            </div>
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                stat.bgColor
              )}
            >
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span
              className={cn(
                "text-xs font-semibold",
                stat.trendUp ? "text-emerald-600" : "text-amber-600"
              )}
            >
              {stat.trend}
            </span>
            <span className="text-xs text-slate-400">vs last month</span>
          </div>

          {/* Decorative gradient */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-slate-100/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </motion.div>
      ))}
    </motion.div>
  );
}
