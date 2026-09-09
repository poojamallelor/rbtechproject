import React, { useState, useEffect } from 'react';
import { motion, useScroll } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Brain, BarChart2, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function FloatingNavbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  useEffect(() => {
    return scrollY.on('change', (latest) => {
      setIsScrolled(latest > 20);
    });
  }, [scrollY]);

  if (location.pathname === '/login') return null;

  const navItems = [
    { label: 'Monitor', icon: BarChart2, path: '/dashboard' },
    { label: 'Privacy', icon: Shield, action: 'privacy' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[96%] max-w-6xl rounded-2xl transition-all duration-300 ${
        isScrolled
          ? 'bg-[#05050B]/90 backdrop-blur-2xl border border-white/10 shadow-2xl py-3 px-5'
          : 'bg-[#05050B]/60 backdrop-blur-xl border border-white/5 py-3 px-5'
      }`}
    >
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => navigate('/dashboard')}
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-accent-cyan flex items-center justify-center shadow-lg shadow-accent/30 group-hover:shadow-accent/50 transition-shadow">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white leading-none block">AI Classroom</span>
            <span className="text-[10px] text-slate-500 leading-none block">Attention Monitor</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {navItems.map((item) => {
            const active = item.path === location.pathname;
            return (
              <button
                key={item.label}
                onClick={() => item.path ? navigate(item.path) : null}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-accent/20 text-accent-glow border border-accent/30' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User area */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 border border-white/10 bg-white/5 rounded-xl px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-accent-cyan flex items-center justify-center text-xs font-bold text-white">T</div>
            <span className="text-xs text-slate-300 font-medium">Demo Teacher</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
