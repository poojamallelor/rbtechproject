import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import FloatingNavbar from './components/layout/FloatingNavbar';
import LiveMonitor from './pages/Dashboard';
import Login from './pages/Login';
import GradientOrbs from './components/effects/GradientOrbs';
import CursorGlow from './components/effects/CursorGlow';
import { AuthProvider, useAuth } from './context/AuthContext';

// ── Protected Route ────────────────────────────────────────────────────────────
// Redirects to /login if the user hasn't authenticated yet.
function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;   // AuthProvider shows its own spinner
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#05050B] text-slate-50 font-sans selection:bg-accent/30 selection:text-accent-cyan">
      <CursorGlow />
      <GradientOrbs />
      <FloatingNavbar />

      <div className="relative z-10 w-full h-full pt-20 pb-12 px-4">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <LiveMonitor />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
