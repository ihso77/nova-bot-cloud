import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  User,
  Mail,
  Calendar,
  Crown,
  Shield,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const OWNER_EMAIL = 'piohio309j@gmail.com';

export default function Profile() {
  const { user, isAdmin, updatePassword } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const isOwner = user?.email === OWNER_EMAIL;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      const meta = user.user_metadata || {};
      setDisplayName(meta.display_name || '');
      setEmail(user.email || '');

      if (user.created_at) {
        const date = new Date(user.created_at);
        const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
        setCreatedAt(
          date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        );
      }

      setProfileLoading(false);
    };

    fetchProfile();
  }, [user, navigate, i18n.language]);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error(i18n.language === 'ar' ? 'الرجاء ملء جميع الحقول' : 'Please fill all fields');
      return;
    }

    if (newPassword.length < 8) {
      toast.error(
        i18n.language === 'ar'
          ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'
          : 'Password must be at least 8 characters'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        i18n.language === 'ar'
          ? 'كلمتا المرور غير متطابقتين'
          : 'Passwords do not match'
      );
      return;
    }

    setChangingPassword(true);
    const { error } = await updatePassword(newPassword);
    setChangingPassword(false);

    if (error) {
      toast.error(error.message || (i18n.language === 'ar' ? 'حدث خطأ' : 'An error occurred'));
    } else {
      toast.success(
        i18n.language === 'ar'
          ? 'تم تغيير كلمة المرور بنجاح'
          : 'Password changed successfully'
      );
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  if (profileLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a12]">
        <div className="w-8 h-8 border-2 border-[#4a90ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] pt-24 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('profile.backToDashboard')}
          </button>
          <h1 className="text-3xl font-bold text-white">{t('profile.title')}</h1>
        </motion.div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-[#111118] border-white/8 mb-6">
            <CardContent className="pt-6">
              {/* Avatar & Info */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="relative">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
                      isOwner
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                        : isAdmin
                        ? 'bg-gradient-to-br from-[#002b86] to-[#4a90ff] text-white'
                        : 'bg-gradient-to-br from-zinc-600 to-zinc-800 text-zinc-300'
                    }`}
                  >
                    {displayName ? displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                  {isOwner && (
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#111118]">
                      <Crown className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {isAdmin && !isOwner && (
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#4a90ff] rounded-full flex items-center justify-center border-2 border-[#111118]">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-start">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                    <h2 className="text-xl font-bold text-white">
                      {displayName || (i18n.language === 'ar' ? 'بدون اسم' : 'No name')}
                    </h2>
                    {isOwner && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Crown className="w-3 h-3" />
                        Owner
                      </span>
                    )}
                    {isAdmin && !isOwner && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#4a90ff]/15 text-[#4a90ff] border border-[#4a90ff]/30">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    )}
                  </div>

                  {/* Owner subtitle */}
                  {isOwner && (
                    <p className="text-amber-400/80 text-sm font-medium mb-1">
                      Owner Of Nova-store.dev
                    </p>
                  )}

                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-zinc-400">
                      <Mail className="w-4 h-4" />
                      <span>{email}</span>
                    </div>
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-zinc-400">
                      <Calendar className="w-4 h-4" />
                      <span>{i18n.language === 'ar' ? 'انضم في' : 'Joined'} {createdAt}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner Banner */}
              {isOwner && (
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-amber-400 font-semibold text-sm">{t('profile.ownerTitle')}</p>
                      <p className="text-amber-400/60 text-xs">{t('profile.ownerDesc')}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Change Password Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-[#111118] border-white/8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white text-lg">
                <Lock className="w-5 h-5 text-[#4a90ff]" />
                {t('profile.changePassword')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  {t('profile.newPassword')}
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('profile.newPasswordPlaceholder')}
                    className="bg-[#0a0a12] border-white/10 text-white placeholder:text-zinc-600 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  {t('profile.confirmPassword')}
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('profile.confirmPasswordPlaceholder')}
                    className="bg-[#0a0a12] border-white/10 text-white placeholder:text-zinc-600 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="text-xs text-zinc-500 space-y-1">
                <p>{t('profile.passwordRequirements')}</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li className={newPassword.length >= 8 ? 'text-green-400' : ''}>
                    {t('profile.reqMinLength')}
                  </li>
                  <li className={newPassword === confirmPassword && confirmPassword.length > 0 ? 'text-green-400' : ''}>
                    {t('profile.reqMatch')}
                  </li>
                </ul>
              </div>

              {/* Submit */}
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
                className="w-full bg-[#002b86] hover:bg-[#0035a0] text-white h-11"
              >
                {changingPassword ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 me-2" />
                    {t('profile.updatePassword')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
