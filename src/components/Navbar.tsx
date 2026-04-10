import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Shield, Server, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/30"
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <Server className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold gradient-text">Nova VPS</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link to="/plans" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            الباقات
          </Link>
          <Link to="/tools/discord-username-checker" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <Search className="w-3 h-3" /> فاحص اليوزرات
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                لوحة التحكم
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <Shield className="w-3 h-3" /> الأدمن
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate('/'); }}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">دخول</Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="gradient-bg text-primary-foreground">تسجيل</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
