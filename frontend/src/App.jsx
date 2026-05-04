import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Planning from './pages/Planning';
import Agents from './pages/Agents';
import Clients from './pages/Clients';
import Sites from './pages/Sites';
import Absences from './pages/Absences';
import Quotes from './pages/Quotes';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="planning" element={<Planning />} />
            <Route path="agents" element={<Agents />} />
            <Route path="clients" element={<Clients />} />
            <Route path="sites" element={<Sites />} />
            <Route path="absences" element={<Absences />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
