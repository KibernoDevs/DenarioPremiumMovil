-- =============================================================================
-- Rollback V2: elimina trigger BANK / catálogo VE
-- No borra filas de public.bank (los bancos ya insertados se quedan).
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_bank_seed_ve ON public.bank;

DROP FUNCTION IF EXISTS public.fn_trg_bank_seed_from_catalog();
DROP FUNCTION IF EXISTS public.fn_bank_seed_catalog_all_enterprises();
DROP FUNCTION IF EXISTS public.fn_bank_seed_catalog_for_enterprise(bigint, varchar);
DROP FUNCTION IF EXISTS public.fn_bank_next_id();
DROP FUNCTION IF EXISTS public.fn_bank_catalog_matches(text, text, text, text);
DROP FUNCTION IF EXISTS public.fn_bank_normalize_name(text);
DROP FUNCTION IF EXISTS public.fn_bank_normalize_code(text);

DROP TABLE IF EXISTS public.bank_catalog_ve;

COMMIT;
