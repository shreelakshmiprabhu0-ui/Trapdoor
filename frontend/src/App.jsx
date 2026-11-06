import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Navigation from './components/Navigation.jsx';
import Status from './components/Status.jsx';
import Login from './pages/Login.jsx';
import Portal from './pages/Portal.jsx';
import Defender from './pages/Defender.jsx';

// UI guard only. The server is what really enforces roles.
function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Status kind="loading" message="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) {
    return (
      <Status
        kind="error"
        title="You don't have access to this page"
        message="This view is only available to defender accounts."
      />
    );
  }
  return children;
}

export default function App() {
  return (
    <>
      <Navigation />
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/portal" element={<RequireAuth><Portal /></RequireAuth>} />
          <Route path="/defender" element={<RequireAuth role="DEFENDER"><Defender /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </main>
    </>
  );
}
