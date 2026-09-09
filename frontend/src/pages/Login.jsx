import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Eye, Users, BarChart2, Shield,
  Mail, Lock, ArrowRight, Loader2, AlertCircle,
  CheckCircle2, KeyRound, UserPlus, LogIn, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Static feature list (left panel) ─────────────────────────────────────────
const features = [
  { icon: Eye,       text: 'Head Pose & Gaze Detection' },
  { icon: Users,     text: 'Anonymous Multi-Student Tracking' },
  { icon: BarChart2, text: 'Real-time Attention Analytics' },
  { icon: Shield,    text: 'Privacy-First Architecture' },
];

// ── Tab types ────────────────────────────────────────────────────────────────
const TAB = { LOGIN: 'login', SIGNUP: 'signup', RESET: 'reset' };

// ── Small reusable components ─────────────────────────────────────────────────
function InputField({ id, label, type = 'text', placeholder, value, onChange, icon: Icon, disabled }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={type === 'password' ? 'current-password' : 'email'}
          className="
            w-full pl-10 pr-4 py-3 rounded-xl text-sm
            bg-white/5 border border-white/10
            text-slate-100 placeholder-slate-600
            focus:outline-none focus:border-violet-500/60 focus:bg-white/8
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
          "
        />
      </div>
    </div>
  );
}

function Alert({ type, message }) {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
        isError
          ? 'bg-red-500/10 border border-red-500/30 text-red-400'
          : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
      }`}
    >
      {isError
        ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
      <span>{message}</span>
    </motion.div>
  );
}

// ── Login Form ─────────────────────────────────────────────────────────────────
function LoginForm({ onSwitch }) {
  const navigate = useNavigate();
  const { signInWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGL]    = useState(false);
  const [error, setError]         = useState('');

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    const { error: err } = await signInWithEmail(email, password);
    setLoading(false);
    if (err) { setError(err.message); return; }
    navigate('/dashboard');
  };

  const handleGoogle = async () => {
    setError('');
    setGL(true);
    const { error: err } = await signInWithGoogle();
    setGL(false);
    if (err) setError(err.message);
    // Supabase will redirect automatically on success
  };

  return (
    <form onSubmit={handleEmailLogin} className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-white">Welcome back 👋</h3>
        <p className="text-slate-400 text-sm mt-1">Sign in to your classroom dashboard.</p>
      </div>

      <Alert type="error" message={error} />

      {/* Google OAuth */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
        className="w-full group flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 px-5 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {googleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Continue with Google
      </button>

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-slate-500">or sign in with email</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Email + Password */}
      <InputField
        id="login-email"
        label="Email Address"
        type="email"
        placeholder="teacher@school.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        icon={Mail}
        disabled={loading}
      />
      <InputField
        id="login-password"
        label="Password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        icon={Lock}
        disabled={loading}
      />

      {/* Forgot Password */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onSwitch(TAB.RESET)}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Forgot password?
        </button>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || googleLoading}
        className="
          w-full flex items-center justify-center gap-2
          bg-gradient-to-r from-violet-600 to-purple-600
          hover:from-violet-500 hover:to-purple-500
          text-white px-5 py-3.5 rounded-xl font-semibold text-sm
          transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40
          hover:-translate-y-0.5 active:translate-y-0
          disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0
        "
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

      {/* Switch to Sign Up */}
      <p className="text-center text-sm text-slate-500">
        No account?{' '}
        <button
          type="button"
          onClick={() => onSwitch(TAB.SIGNUP)}
          className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
        >
          Create one
        </button>
      </p>
    </form>
  );
}

// ── Sign-Up Form ───────────────────────────────────────────────────────────────
function SignUpForm({ onSwitch }) {
  const { signUpWithEmail } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email || !password || !confirm) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { error: err } = await signUpWithEmail(email, password);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess('Account created! Check your email to confirm your address, then sign in.');
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-white">Create an account ✨</h3>
        <p className="text-slate-400 text-sm mt-1">Join AI Classroom in seconds.</p>
      </div>

      <Alert type="error"   message={error} />
      <Alert type="success" message={success} />

      <InputField id="su-email"    label="Email Address" type="email"    placeholder="teacher@school.edu" value={email}    onChange={(e) => setEmail(e.target.value)}    icon={Mail}    disabled={loading || !!success} />
      <InputField id="su-password" label="Password"      type="password" placeholder="Min 6 characters"   value={password} onChange={(e) => setPassword(e.target.value)} icon={Lock}    disabled={loading || !!success} />
      <InputField id="su-confirm"  label="Confirm Password" type="password" placeholder="Repeat password"  value={confirm}  onChange={(e) => setConfirm(e.target.value)}  icon={KeyRound} disabled={loading || !!success} />

      <button
        type="submit"
        disabled={loading || !!success}
        className="
          w-full flex items-center justify-center gap-2
          bg-gradient-to-r from-emerald-600 to-teal-600
          hover:from-emerald-500 hover:to-teal-500
          text-white px-5 py-3.5 rounded-xl font-semibold text-sm
          transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40
          hover:-translate-y-0.5 active:translate-y-0
          disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0
        "
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        {loading ? 'Creating account…' : 'Create Account'}
      </button>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <button type="button" onClick={() => onSwitch(TAB.LOGIN)} className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
          Sign in
        </button>
      </p>
    </form>
  );
}

// ── Forgot Password Form ───────────────────────────────────────────────────────
function ResetForm({ onSwitch }) {
  const { resetPassword } = useAuth();

  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email) { setError('Please enter your email.'); return; }
    setLoading(true);
    const { error: err } = await resetPassword(email);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess('Password reset email sent! Check your inbox.');
  };

  return (
    <form onSubmit={handleReset} className="space-y-4">
      <button
        type="button"
        onClick={() => onSwitch(TAB.LOGIN)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Back to sign in
      </button>

      <div>
        <h3 className="text-2xl font-black text-white">Reset password 🔑</h3>
        <p className="text-slate-400 text-sm mt-1">We'll send a reset link to your email.</p>
      </div>

      <Alert type="error"   message={error} />
      <Alert type="success" message={success} />

      <InputField
        id="reset-email"
        label="Email Address"
        type="email"
        placeholder="teacher@school.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        icon={Mail}
        disabled={loading || !!success}
      />

      <button
        type="submit"
        disabled={loading || !!success}
        className="
          w-full flex items-center justify-center gap-2
          bg-gradient-to-r from-violet-600 to-purple-600
          hover:from-violet-500 hover:to-purple-500
          text-white px-5 py-3.5 rounded-xl font-semibold text-sm
          transition-all shadow-lg shadow-violet-500/25
          hover:-translate-y-0.5 active:translate-y-0
          disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0
        "
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        {loading ? 'Sending…' : 'Send Reset Link'}
      </button>
    </form>
  );
}

// ── Main Login Page ────────────────────────────────────────────────────────────
export default function Login() {
  const [tab, setTab] = useState(TAB.LOGIN);

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-10 items-center">

        {/* ── Left: Branding ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden md:block"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">AI Classroom</h2>
              <p className="text-xs text-violet-400 font-medium">Intelligent Attention Monitor</p>
            </div>
          </div>

          <h1 className="text-4xl font-black text-white mb-4 leading-tight">
            Understand classroom<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
              engagement.
            </span>
          </h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-sm">
            A privacy-first, computer vision–powered system that helps educators
            understand and improve student attention in real time.
          </p>

          {/* Feature list */}
          <div className="space-y-3">
            {features.map((f, i) => (
              <motion.div
                key={f.text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                  <f.icon className="w-3.5 h-3.5 text-violet-400" />
                </div>
                {f.text}
              </motion.div>
            ))}
          </div>

          {/* Powered-by badge */}
          <div className="mt-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Powered by Supabase Auth
          </div>
        </motion.div>

        {/* ── Right: Auth Card ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="relative bg-[#0d0d1a]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-8 md:hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white">AI Classroom</span>
            </div>

            {/* Animated tab content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="relative z-10"
              >
                {tab === TAB.LOGIN  && <LoginForm  onSwitch={setTab} />}
                {tab === TAB.SIGNUP && <SignUpForm  onSwitch={setTab} />}
                {tab === TAB.RESET  && <ResetForm   onSwitch={setTab} />}
              </motion.div>
            </AnimatePresence>

            {/* Footer */}
            <p className="text-center text-xs text-slate-700 mt-8 relative z-10">
              🔒 Secured by{' '}
              <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-300 transition-colors">
                Supabase
              </a>
              {' '}· End-to-end encrypted
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
