"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Shield, BarChart3, FileText, TrendingUp, Building2, Workflow, 
  Server, ShieldCheck, Users, MessageSquare, Database,
  ChevronRight, Bell, Activity, Clock
} from "lucide-react";
import Link from "next/link";

const moduleGroups = [
  {
    title: "Deal & Diligence",
    modules: [
      { id: 2, name: "Deal Radar", icon: BarChart3, path: "/deal-radar", desc: "Pipeline & opportunities" },
      { id: 3, name: "Documents", icon: FileText, path: "/documents", desc: "Intelligent ingestion" },
      { id: 4, name: "Bankability", icon: TrendingUp, path: "/bankability", desc: "Risk scoring" },
      { id: 5, name: "Financial Models", icon: BarChart3, path: "/financial-modeling", desc: "Capital stack" },
    ]
  },
  {
    title: "Execution & Assets",
    modules: [
      { id: 6, name: "Data Room", icon: Building2, path: "/data-room", desc: "Committee ops" },
      { id: 7, name: "Execution", icon: Workflow, path: "/execution", desc: "Project controls" },
      { id: 8, name: "Assets", icon: Server, path: "/assets", desc: "Telemetry & maintenance" },
      { id: 9, name: "ESG", icon: ShieldCheck, path: "/esg", desc: "Compliance" },
    ]
  },
  {
    title: "Intelligence & Operations",
    modules: [
      { id: 10, name: "Portals", icon: Users, path: "/portals", desc: "Client experiences" },
      { id: 11, name: "AI Copilots", icon: MessageSquare, path: "/ai", desc: "Governed AI" },
      { id: 12, name: "Operations", icon: Database, path: "/support-console", desc: "DevSecOps" },
    ]
  }
];

const stats = [
  { label: "Active Deals", value: "24", icon: BarChart3, change: "+3 this week" },
  { label: "Documents", value: "1,847", icon: FileText, change: "+156 this week" },
  { label: "Team Members", value: "12", icon: Users, change: "2 pending" },
  { label: "AI Queries", value: "3,421", icon: MessageSquare, change: "+890 this week" },
];

const recentActivity = [
  { action: "Deal scored", target: "Solar Farm Phase III", time: "2 min ago" },
  { action: "Document uploaded", target: "Environmental Assessment.pdf", time: "15 min ago" },
  { action: "Committee pack generated", target: "Project Atlas Q1 Review", time: "1 hour ago" },
  { action: "AI insight generated", target: "Risk Analysis: Highway 401", time: "2 hours ago" },
];

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional hydration guard
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold">Atlas</span>
            </Link>
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">Executive Access</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors relative">
              <Bell className="w-5 h-5 text-gray-400" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-sm font-medium">
                AM
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">Alexandre Mbiam</p>
                <p className="text-xs text-gray-500">Panthera Capital</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-light mb-2">Welcome back, Alexandre</h1>
          <p className="text-gray-400">Here&apos;s what&apos;s happening with your portfolio</p>
        </motion.div>

        {/* Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {stats.map((stat, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <stat.icon className="w-5 h-5 text-cyan-400" />
                <span className="text-xs text-gray-500">{stat.change}</span>
              </div>
              <p className="text-3xl font-light mb-1">{stat.value}</p>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Modules */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 space-y-8"
          >
            {moduleGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wider">{group.title}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {group.modules.map((mod) => (
                    <Link 
                      key={mod.id}
                      href={mod.path}
                      className="group p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/50 hover:bg-white/[0.05] transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                          <mod.icon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      <h3 className="font-medium mb-1">{mod.name}</h3>
                      <p className="text-sm text-gray-500">{mod.desc}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Activity */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h2 className="font-medium">Recent Activity</h2>
              </div>
              
              <div className="space-y-4">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 pb-4 border-b border-white/5 last:border-0 last:pb-0">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm">{item.action}</p>
                      <p className="text-xs text-cyan-400">{item.target}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {item.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
