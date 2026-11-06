import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="brand">TRAPDOOR</NavLink>
        {user && (
          <nav className="nav-links" aria-label="Main">
            <NavLink to="/portal">Portal</NavLink>
            {user.role === 'DEFENDER' && <NavLink to="/defender">Defender</NavLink>}
          </nav>
        )}
        {user && (
          <div className="nav-user">
            <span className="nav-name">{user.name}</span>
            <button className="btn btn-ghost" onClick={handleLogout}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}
