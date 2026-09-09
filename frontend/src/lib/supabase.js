// ── Supabase REST Client (no npm package needed) ─────────────────────────────
// Directly calls Supabase Auth REST API so @supabase/supabase-js is not required.

const SUPABASE_URL      = 'https://ptjmdrhmdzowmzaobdrf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sKvcSEwIZPFskk-Sdlh8WA_zAeFcBDt';

const BASE = `${SUPABASE_URL}/auth/v1`;

const headers = () => ({
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${getSession()?.access_token ?? SUPABASE_ANON_KEY}`,
});

// ── Session helpers ──────────────────────────────────────────────────────────
const SESSION_KEY = 'attensys_supabase_session';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch { return null; }
}

function saveSession(data) {
  if (data) localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  else localStorage.removeItem(SESSION_KEY);
}

// ── Auth callbacks ───────────────────────────────────────────────────────────
let _listeners = [];
export function onAuthChange(cb) {
  _listeners.push(cb);
  return () => { _listeners = _listeners.filter(l => l !== cb); };
}
function emit(session) { _listeners.forEach(cb => cb(session)); }

// ── API helpers ──────────────────────────────────────────────────────────────
async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { data: null, error: { message: data.error_description || data.msg || data.error || 'Unknown error' } };
  return { data, error: null };
}

// ── Public API (mirrors @supabase/supabase-js surface) ───────────────────────
export const supabase = {
  auth: {
    getSession() {
      const s = getSession();
      return Promise.resolve({ data: { session: s }, error: null });
    },

    async signInWithPassword({ email, password }) {
      const { data, error } = await post('/token?grant_type=password', { email, password });
      if (error) return { data: null, error };
      const session = {
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_in:    data.expires_in,
        user: data.user,
      };
      saveSession(session);
      emit(session);
      return { data: { session, user: data.user }, error: null };
    },

    async signUp({ email, password }) {
      const { data, error } = await post('/signup', { email, password });
      if (error) return { data: null, error };
      // If email confirmation required, user object exists but no session
      const session = data.access_token ? {
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      } : null;
      if (session) { saveSession(session); emit(session); }
      return { data: { session, user: data.user ?? data }, error: null };
    },

    async resetPasswordForEmail(email) {
      const { error } = await post('/recover', { email });
      return { error };
    },

    signInWithOAuth({ provider }) {
      // Redirect to Supabase OAuth endpoint
      const url = `${BASE}/authorize?provider=${provider}&redirect_to=${encodeURIComponent(window.location.origin + '/dashboard')}`;
      window.location.href = url;
      return Promise.resolve({ error: null });
    },

    async signOut() {
      saveSession(null);
      emit(null);
      return { error: null };
    },

    // Listen to auth changes
    onAuthStateChange(cb) {
      // Fire immediately with current session
      const current = getSession();
      cb('INITIAL_SESSION', current);
      const unsub = onAuthChange(session => cb(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
      return { data: { subscription: { unsubscribe: unsub } } };
    },
  },
};
