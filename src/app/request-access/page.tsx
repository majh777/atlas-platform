"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

export default function RequestAccess() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", organization: "", email: "", useCase: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-3xl font-light mb-4">Request Received</h1>
          <p className="text-gray-400 mb-8">
            Thank you for your interest in Atlas. Our team will review your request and contact you within 2 business days.
          </p>
          <Link href="/" className="text-cyan-400 hover:underline inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg"
      >
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-light mb-2">Request Access</h1>
          <p className="text-gray-400">Tell us about your organization and use case</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-cyan-500/50 focus:outline-none transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Organization</label>
              <input
                type="text"
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
                className="w-full px-4 py-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-cyan-500/50 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Work Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-cyan-500/50 focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Use Case</label>
            <select
              value={form.useCase}
              onChange={(e) => setForm({ ...form, useCase: e.target.value })}
              className="w-full px-4 py-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-cyan-500/50 focus:outline-none transition-colors"
              required
            >
              <option value="">Select your primary use case</option>
              <option value="project-finance">Project Finance & Advisory</option>
              <option value="asset-management">Asset Management</option>
              <option value="investment-banking">Investment Banking</option>
              <option value="infrastructure">Infrastructure Development</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Message (Optional)</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={3}
              className="w-full px-4 py-4 rounded-xl bg-white/[0.03] border border-white/10 focus:border-cyan-500/50 focus:outline-none transition-colors resize-none"
              placeholder="Tell us more about your needs..."
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity"
          >
            Submit Request
          </button>
        </form>
      </motion.div>
    </div>
  );
}
