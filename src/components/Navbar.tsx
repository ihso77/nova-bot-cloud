import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { LogOut, Shield, Server, Menu, Wrench, Languages, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const toggleLang = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  const navLinkClass = "px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition";

  const LangButton = ({ className = '' }: { className?: string }) => (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setLangOpen(!langOpen)}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5"
      >
        <Languages className="w-4 h-4" />
        <span className="font-medium">{i18n.language === 'ar' ? 'العربية' : 'English'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {langOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 right-0 bg-[#111118] border border-white/8 rounded-xl shadow-lg overflow-hidden z-50 min-w-[120px]"
            onMouseLeave={() => setLangOpen(false)}
          >
            <button
              onClick={() => { i18n.changeLanguage('ar'); document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; setLangOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors ${i18n.language === 'ar' ? 'text-[#4a90ff] bg-white/5' : 'text-zinc-400'}`}
            >
              العربية
            </button>
            <button
              onClick={() => { i18n.changeLanguage('en'); document.documentElement.dir = 'ltr'; document.documentElement.lang = 'en'; setLangOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors ${i18n.language === 'en' ? 'text-[#4a90ff] bg-white/5' : 'text-zinc-400'}`}
            >
              English
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const NavLinks = () => (
    <div className="flex flex-col gap-1">
      <Link to="/plans" className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition" onClick={() => setOpen(false)}>
        <span>{t('nav.plans')}</span>
      </Link>
      <Link to="/tools" className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition" onClick={() => setOpen(false)}>
        <Wrench className="w-5 text-center" />
        <span>{t('nav.tools')}</span>
      </Link>
      {user ? (
        <>
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition" onClick={() => setOpen(false)}>
            <span>{t('nav.dashboard')}</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition" onClick={() => setOpen(false)}>
              <Shield className="w-5 text-center" />
              <span>{t('nav.admin')}</span>
            </Link>
          )}
          <div className="border-t border-white/8 pt-2 mt-2">
            <Button variant="ghost" size="sm" className="w-full justify-start text-zinc-400 hover:text-white" onClick={() => { signOut(); navigate('/'); setOpen(false); }}>
              <LogOut className="w-4 h-4 ml-2" /> {t('nav.logout')}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 border-t border-white/8 pt-3 mt-2">
          <Button variant="ghost" size="sm" className="w-full text-zinc-300 hover:text-white" onClick={() => { navigate('/login'); setOpen(false); }}>{t('nav.login')}</Button>
          <Button size="sm" className="w-full bg-[#002b86] hover:bg-[#0035a0] text-white" onClick={() => { navigate('/register'); setOpen(false); }}>{t('nav.register')}</Button>
        </div>
      )}
    </div>
  );

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass-nav"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <Server className="w-6 h-6 text-[#002b86]" />
          <span className="text-xl font-bold gradient-text">Nova VPS</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          <Link to="/plans" className={navLinkClass}>
            {t('nav.plans')}
          </Link>
          <Link to="/tools" className={`${navLinkClass} flex items-center gap-1.5`}>
            <Wrench className="w-3.5 h-3.5" /> {t('nav.tools')}
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" className={navLinkClass}>
                {t('nav.dashboard')}
              </Link>
              {isAdmin && (
                <Link to="/admin" className={`${navLinkClass} flex items-center gap-1.5`}>
                  <Shield className="w-3.5 h-3.5" /> {t('nav.admin')}
                </Link>
              )}
              <LangButton />
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/5" onClick={() => { signOut(); navigate('/'); }}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <LangButton />
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/5" onClick={() => navigate('/login')}>{t('nav.login')}</Button>
              <Button size="sm" className="bg-[#002b86] hover:bg-[#0035a0] text-white" onClick={() => navigate('/register')}>{t('nav.register')}</Button>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <Languages className="w-3.5 h-3.5" />
            {i18n.language === 'ar' ? 'EN' : 'عربي'}
          </button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-400 hover:text-white">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={i18n.language === 'ar' ? 'right' : 'left'} className="w-72 p-6 bg-[#111118] border-white/8">
              <SheetTitle className="mb-6">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-[#002b86]" />
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
