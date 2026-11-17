-- PORTIA: drop legacy promotion RPC overloads (Phase 16, 16-14 production postflight). Forward-only.
--
-- Why: the production fingerprint showed two overloads that exist in no canonical migration:
--   portia_promo_confirm_assignment(uuid, jsonb)        -- created by 43895f8 (14-02)
--   portia_promo_confirm_test(uuid, jsonb, text)        -- created by 43895f8 (14-02)
-- They were superseded (never dropped) by the rank-authoritative bank signatures from 4d527f6, are
-- SECURITY DEFINER and executable by authenticated, so they could bypass the bank/version checks.
-- No code path calls them: app/api/promotion/banks/route.ts uses the p_bank_id/p_bank_version signatures.
-- On a canonical database (built from the baseline) they do not exist, so this is a no-op there.
-- Exactly these two signatures; nothing else is dropped. Idempotent: safe to re-run.

drop function if exists public.portia_promo_confirm_assignment(uuid, jsonb);
drop function if exists public.portia_promo_confirm_test(uuid, jsonb, text);
