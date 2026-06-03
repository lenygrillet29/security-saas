import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Planning from './pages/Planning';
import Agents from './pages/Agents';
import Clients from './pages/Clients';
import Sites from './pages/Sites';
import Absences from './pages/Absences';
import Quotes from './pages/Quotes';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Contracts from './pages/Contracts';
import SignContract from './pages/SignContract';
import Invoices from './pages/Invoices';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Chargement…</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Pages publiques */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* Page de signature de contrat (publique) */}
            <Route path="/sign-contract/:token" element={<SignContract />} />

            {/* Application protégée */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="planning" element={<Planning />} />
              <Route path="agents" element={<Agents />} />
              <Route path="clients" element={<Clients />} />
              <Route path="sites" element={<Sites />} />
              <Route path="absences" element={<Absences />} />
              <Route path="quotes" element={<Quotes />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="invoices"  element={<Invoices />} />
              <Route path="settings" element={<Settings />} />
              <Route path="billing" element={<Billing />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
