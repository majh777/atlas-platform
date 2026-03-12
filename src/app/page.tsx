"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Zap, Brain, Eye, Lock, ChevronRight, Globe, Building2, Users, BarChart3, FileText, TrendingUp, Workflow, Database, Server, MessageSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";

const modules = [
  { id: 1, name: "Platform Foundations", icon: Shield, desc: "Enterprise-grade multi-tenancy with SSO, MFA, and audit", path: "/admin" },
  { id: 2, name: "Deal Radar", icon: Globe, desc: "Pipeline management and opportunity origination", path: "/deal-radar" },
  { id: 3, name: "Document Intelligence", icon: FileText, desc: "AI-powered ingestion and evidence extraction", path: "/documents" },
  { id: 4, name: "Bankability Scoring", icon: TrendingUp, desc: "Transparent risk and readiness assessment", path: "/bankability" },
  { id: 5, name: "Financial Models", icon: BarChart3, desc: "Capital stack optimization and scenarios", path: "/financial-modeling" },
  { id: 6, name: "Data Room", icon: Building2, desc: "Secure diligence and committee operations", path: "/data-room" },
  { id: 7, name: "Execution Twin", icon: Workflow, desc: "Digital twin for project controls", path: "/execution" },
  { id: 8, name: "Asset Intelligence", icon: Server, desc: "Telemetry and predictive maintenance", path: "/assets" },
  { id: 9, name: "ESG & Permits", icon: ShieldCheck, desc: "Compliance and regulatory controls", path: "/esg" },
  { id: 10, name: "Portals", icon: Users, desc: "Executive, investor, and operator experiences", path: "/portals" },
  { id: 11, name: "AI Copilots", icon: MessageSquare, desc: "Governed AI assistance and search", path: "/ai" },
  { id: 12, name: "DevSecOps", icon: Database, desc: "Observability and enterprise operations", path: "/support-console" },
];

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } }
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional hydration guard
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Atlas</span>
          </motion.div>
          
          <div className="flex items-center gap-8">
            <a href="#modules" className="text-sm text-gray-400 hover:text-white transition-colors">Modules</a>
            <a href="#enterprise" className="text-sm text-gray-400 hover:text-white transition-colors">Enterprise</a>
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
            <Link href="/request-access" className="px-5 py-2 rounded-full bg-white text-black text-sm font-medium hover:bg-gray-200 transition-colors">
              Request Access
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <span className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-gray-300">
                Panthera Capital Partners
              </span>
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="text-6xl md:text-8xl font-light tracking-tight mb-6"
            >
              <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                Atlas
              </span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-xl md:text-2xl text-gray-400 mb-4 font-light"
            >
              Bankability & Asset Intelligence Operating System
            </motion.p>
            
            <motion.p 
              variants={fadeInUp}
              className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto"
            >
              Where Projects Become Investable. Enterprise-grade platform for project origination, governed diligence, and asset intelligence.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/request-access" className="px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Request Access <ChevronRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="px-8 py-4 rounded-full border border-white/20 text-white font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" /> Sign In
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div 
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2"
          >
            <div className="w-1 h-2 rounded-full bg-white/50" />
          </motion.div>
        </motion.div>
      </section>

      {/* Value Props */}
      <section className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-4 gap-6"
          >
            {[
              { icon: Zap, title: "Speed", desc: "Industrialized diligence cycles" },
              { icon: Brain, title: "Intelligence", desc: "AI-powered insights" },
              { icon: Eye, title: "Transparency", desc: "Full audit trail" },
              { icon: Shield, title: "Control", desc: "Enterprise-grade security" },
            ].map((item, i) => (
              <motion.div 
                key={i}
                variants={fadeInUp}
                className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-colors group"
              >
                <item.icon className="w-8 h-8 text-cyan-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-medium mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Modules Grid */}
      <section id="modules" className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-light mb-4">12 Integrated Modules</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Complete platform coverage from opportunity to asset management
            </p>
          </motion.div>

          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {modules.map((mod) => (
              <motion.div
                key={mod.id}
                variants={fadeInUp}
                className="group p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/50 hover:bg-white/[0.05] transition-all cursor-pointer"
              >
                <mod.icon className="w-8 h-8 text-cyan-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-medium mb-2">{mod.name}</h3>
                <p className="text-sm text-gray-500">{mod.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Access Required <ChevronRight className="w-3 h-3" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Enterprise */}
      <section id="enterprise" className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-light mb-4">Enterprise-Grade</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Built for institutional standards with security, compliance, and scalability at its core
            </p>
          </motion.div>

          <motion.div 
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-6"
          >
            {[
              { title: "SOC 2 Compliant", desc: "Audited security controls" },
              { title: "Bank-Grade Encryption", desc: "AES-256 at rest, TLS 1.3 in transit" },
              { title: "99.5% Uptime SLA", desc: "Enterprise support included" },
            ].map((item, i) => (
              <motion.div 
                key={i}
                variants={fadeInUp}
                className="p-8 rounded-2xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10"
              >
                <h3 className="text-lg font-medium mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2 className="text-4xl md:text-5xl font-light mb-6">Ready to Transform Your Pipeline?</h2>
            <p className="text-gray-400 mb-8">
              Join institutional teams who trust Atlas for their most critical transactions
            </p>
            <Link href="/request-access" className="px-10 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2">
              Request Access <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium">Atlas</span>
            <span className="text-gray-500">by Panthera Capital Partners</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
