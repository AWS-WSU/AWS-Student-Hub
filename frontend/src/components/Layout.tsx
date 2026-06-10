import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import type { LayoutProps } from '../types/ui';

function Layout({ theme, toggleTheme }: LayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="layout-container">
      <Navbar theme={theme} toggleTheme={toggleTheme} />
      <main className={`layout-content${isHome ? ' layout-content--no-pad' : ''}`}>
        <Outlet />
      </main>
      <Footer theme={theme} />
    </div>
  );
}

export default Layout;
