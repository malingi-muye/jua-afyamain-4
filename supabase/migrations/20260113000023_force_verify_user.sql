-- Force verify the specific user who is stuck
UPDATE auth.users 
SET email_confirmed_at = now(), updated_at = now()
WHERE email = 'champcode37@gmail.com';
