-- =============================================================================
-- Trigger BANK V2: re-siembra idempotente (no instala objetos).
-- Requiere haber corrido antes trg_bank_seed_ve.sql (V1 o V2).
-- Recorre public.enterprise y solo INSERTA faltantes. Nunca UPDATE de bank.
-- =============================================================================

SELECT public.fn_bank_seed_catalog_all_enterprises();
