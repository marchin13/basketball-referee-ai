-- Daily report cron job setup
-- Runs at 23:00 UTC (= 08:00 JST) every day

-- Enable pg_cron and pg_net extensions (if not already enabled)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule the daily report Edge Function
-- Every day at 23:00 UTC = 08:00 JST
select cron.schedule(
  'daily-report-email',
  '0 23 * * *',
  $$
  select net.http_post(
    url := 'https://hzjvhbmtzapsinuvyfuc.supabase.co/functions/v1/daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- To check scheduled jobs:
-- select * from cron.job;

-- To unschedule:
-- select cron.unschedule('daily-report-email');
