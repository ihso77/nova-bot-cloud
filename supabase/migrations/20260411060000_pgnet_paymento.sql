-- تفعيل pg_net (للسماح بالطلبات HTTP من الداتابيز)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- دالة إنشاء دفع Paymento من الداتابيز مباشرة (بدون CORS)
CREATE OR REPLACE FUNCTION create_paymento_payment(
  p_plan_id UUID,
  p_user_id UUID,
  p_amount DECIMAL,
  p_success_url TEXT,
  p_cancel_url TEXT
) RETURNS JSONB AS $$
DECLARE
  v_api_key TEXT;
  v_secret_key TEXT;
  v_request_id BIGINT;
  v_status_code INTEGER;
  v_content TEXT;
  v_response JSONB;
BEGIN
  -- جلب مفاتيح Paymento من settings
  SELECT value::TEXT INTO v_api_key FROM settings WHERE key = 'paymento_api_key';
  SELECT value::TEXT INTO v_secret_key FROM settings WHERE key = 'paymento_secret_key';

  -- حذف علامات الاقتباس إن وجدت (JSONB يضيفها)
  v_api_key := REPLACE(v_api_key, '"', '');
  v_secret_key := REPLACE(v_secret_key, '"', '');

  IF v_api_key IS NULL OR v_secret_key IS NULL THEN
    RETURN '{"error": "بوابة الدفع غير متاحة حالياً"}'::jsonb;
  END IF;

  -- طلب HTTP لـ Paymento من السيرفر (بدون CORS)
  SELECT id INTO v_request_id FROM net.http_post(
    url := 'https://api.paymento.io/v1/payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_api_key,
      'X-Secret-Key', v_secret_key
    ),
    body := jsonb_build_object(
      'amount', p_amount,
      'currency', 'USD',
      'description', 'Nova VPS subscription',
      'success_url', p_success_url,
      'cancel_url', p_cancel_url,
      'metadata', jsonb_build_object('planId', p_plan_id, 'userId', p_user_id)
    )
  );

  -- انتظار الرد (3 ثوان)
  PERFORM pg_sleep(3);

  -- جلب نتيجة الطلب
  SELECT status_code, content INTO v_status_code, v_content
  FROM net.http_get_result(v_request_id);

  IF v_content IS NULL THEN
    RETURN '{"error": "انتهت مهلة الاتصال ببوابة الدفع"}'::jsonb;
  END IF;

  -- محاولة تحويل الرد إلى JSON
  BEGIN
    v_response := v_content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'فشل في قراءة رد بوابة الدفع', 'status', v_status_code);
  END;

  RETURN v_response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
