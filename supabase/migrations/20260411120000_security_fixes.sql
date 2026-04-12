-- ============================================================
-- Security Fixes Migration
-- Fixes: CRITICAL-3 (gifts RLS), MEDIUM-1 (payments INSERT),
--         MEDIUM-2 (settings read), MEDIUM-3 (banned role)
-- ============================================================

-- 1. Add 'banned' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'banned';

-- 2. Fix settings table: restrict read to authenticated users only
DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;
CREATE POLICY "Authenticated users can read settings" ON public.settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. Add missing INSERT/UPDATE policies on payments table
CREATE POLICY "Users can create own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments" ON public.payments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Protect gifts table with proper RLS
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

-- Remove any open policies
DROP POLICY IF EXISTS "Anyone can read gifts by email" ON public.gifts;
DROP POLICY IF EXISTS "Admin can insert gifts" ON public.gifts;
DROP POLICY IF EXISTS "Anyone can update gifts" ON public.gifts;

-- Only authenticated users can read gifts (for claiming their own)
CREATE POLICY "Authenticated can read active gifts" ON public.gifts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can insert gifts
CREATE POLICY "Admins can insert gifts" ON public.gifts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Only admins can update gifts
CREATE POLICY "Admins can update gifts" ON public.gifts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 5. Add UPDATE/DELETE policies for subscriptions (admin only)
CREATE POLICY "Admins can update subscriptions" ON public.subscriptions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete subscriptions" ON public.subscriptions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 6. Add DELETE policy for profiles (admin only)
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
