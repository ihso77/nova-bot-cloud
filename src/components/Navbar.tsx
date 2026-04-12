import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { LogOut, User, Shield, Server, Search, Menu, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const navLinkClass = "text-sm text-muted-foreground hover:text-foreground transition-colors py-2 block";

  const NavLinks = () => (
    <div className="flex flex-col gap-1">
      <Link to="/plans" className={navLinkClass} onClick={() => setOpen(false)}>
        الباقات
      </Link>
      <Link to="/tools" className={`${navLinkClass} flex items-center gap-2`} onClick={() => setOpen(false)}>
        <Wrench className="w-4 h-4" /> ادوات
      </Link>
      {user ? (
        <>
          <Link to="/dashboard" className={navLinkClass} onClick={() => setOpen(false)}>
            لوحة التحكم
          </Link>
          {isAdmin && (
            <Link to="/admin" className={`${navLinkClass} flex items-center gap-2`} onClick={() => setOpen(false)}>
              <Shield className="w-4 h-4" /> الأدمن
            </Link>
          )}
          <div className="border-t border-border/30 pt-2 mt-2">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { signOut(); navigate('/'); setOpen(false); }}>
              <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border/30 pt-3 mt-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => { navigate('/login'); setOpen(false); }}>دخول</Button>
          <Button size="sm" className="w-full gradient-bg text-primary-foreground" onClick={() => { navigate('/register'); setOpen(false); }}>تسجيل</Button>
        </div>
      )}
    </div>
  );

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

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/plans" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            الباقات
          </Link>
          <Link to="/tools" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <Wrench className="w-3 h-3" /> ادوات
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
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>دخول</Button>
              <Button size="sm" className="gradient-bg text-primary-foreground" onClick={() => navigate('/register')}>تسجيل</Button>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-6">
              <SheetTitle className="text-right mb-6">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  <span className="text-lg font-bold gradient-text">Nova VPS</span>
                </div>
              </SheetTitle>
              <NavLinks />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.nav>
  );
}
