-- Cleanup the stuck user so you can try again
DELETE FROM auth.users WHERE email = 'focean445@gmail.com';

-- Just in case a half-created clinic exists
DELETE FROM public.clinics WHERE email = 'focean445@gmail.com';
