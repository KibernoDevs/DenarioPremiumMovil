-- =============================================================================
-- Trigger BANK V2: completar bancos VE desde catálogo sin duplicar
-- Motor: PostgreSQL
-- Carpeta: /Users/kiberno/Documents/Requerimientos/TriggerBank/V2
--
-- Precedencia: lo que ya está en public.bank NUNCA se actualiza.
-- El catálogo solo INSERTA filas cuyo código y nombre no coincidan
-- (normalizados) con un banco existente de la misma empresa.
--
-- Este script:
--   1) Crea catálogo + funciones + trigger (INSERT futuros)
--   2) Backfill de TODAS las empresas activas en public.enterprise
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.bank_catalog_ve (
    co_bank varchar(10) NOT NULL,
    na_bank varchar(200) NOT NULL,
    CONSTRAINT pk_bank_catalog_ve PRIMARY KEY (co_bank)
);

INSERT INTO public.bank_catalog_ve (co_bank, na_bank) VALUES
    ('0102', 'BANCO DE VENEZUELA'),
    ('0104', 'BANCO VENEZOLANO DE CREDITO'),
    ('0105', 'BANCO MERCANTIL'),
    ('0108', 'BBVA PROVINCIAL'),
    ('0114', 'BANCARIBE'),
    ('0115', 'BANCO EXTERIOR'),
    ('0128', 'BANCO CARONI'),
    ('0134', 'BANESCO'),
    ('0137', 'BANCO SOFITASA'),
    ('0138', 'BANCO PLAZA'),
    ('0146', 'BANGENTE'),
    ('0151', 'BANCO FONDO COMUN'),
    ('0156', '100% BANCO'),
    ('0157', 'DELSUR BANCO UNIVERSAL'),
    ('0163', 'BANCO DEL TESORO'),
    ('0168', 'BANCRECER'),
    ('0169', 'R4 BANCO MICROFINANCIERO C.A.'),
    ('0171', 'BANCO ACTIVO'),
    ('0172', 'BANCAMIGA BANCO UNIVERSAL, C.A.'),
    ('0173', 'BANCO INTERNACIONAL DE DESARROLLO'),
    ('0174', 'BANPLUS'),
    ('0175', 'BANCO DIGITAL DE LOS TRABAJADORES, BANCO UNIVERSAL'),
    ('0177', 'BANFANB'),
    ('0178', 'N58 BANCO DIGITAL BANCO MICROFINANCIERO S A'),
    ('0191', 'BANCO NACIONAL DE CREDITO')
ON CONFLICT (co_bank) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_bank_normalize_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN p_code IS NULL OR regexp_replace(p_code, '\D', '', 'g') = '' THEN ''
        ELSE lpad(regexp_replace(p_code, '\D', '', 'g'), 4, '0')
    END
$$;

CREATE OR REPLACE FUNCTION public.fn_bank_normalize_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    v text;
BEGIN
    IF p_name IS NULL THEN
        RETURN '';
    END IF;

    v := upper(trim(p_name));
    v := translate(v,
        'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑáàäâéèëêíìïîóòöôúùüûñ',
        'AAAAEEEEIIIIOOOOUUUUNAAAAEEEEIIIIOOOOUUUUN');
    v := regexp_replace(v, '[^A-Z0-9]+', ' ', 'g');
    v := regexp_replace(v, '\yC A\y', ' ', 'g');
    v := regexp_replace(v, '\yS A\y', ' ', 'g');
    v := regexp_replace(v, '\yCA\y', ' ', 'g');
    v := regexp_replace(v, '\ySA\y', ' ', 'g');

    LOOP
        v := trim(regexp_replace(v, '\s+', ' ', 'g'));
        IF v ~ ' BANCO UNIVERSAL$' THEN
            v := regexp_replace(v, ' BANCO UNIVERSAL$', '');
        ELSIF v ~ ' BANCO MICROFINANCIERO$' THEN
            v := regexp_replace(v, ' BANCO MICROFINANCIERO$', '');
        ELSIF v ~ ' BANCO DIGITAL$' THEN
            v := regexp_replace(v, ' BANCO DIGITAL$', '');
        ELSE
            EXIT;
        END IF;
    END LOOP;

    RETURN trim(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_bank_catalog_matches(
    p_existing_code text,
    p_existing_name text,
    p_catalog_code text,
    p_catalog_name text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    v_ex_code text := public.fn_bank_normalize_code(p_existing_code);
    v_cat_code text := public.fn_bank_normalize_code(p_catalog_code);
    v_ex_name text := public.fn_bank_normalize_name(p_existing_name);
    v_cat_name text := public.fn_bank_normalize_name(p_catalog_name);
    v_min_len int;
BEGIN
    IF v_ex_code <> '' AND v_cat_code <> '' AND v_ex_code = v_cat_code THEN
        RETURN true;
    END IF;

    IF v_ex_name <> '' AND v_cat_name <> '' AND v_ex_name = v_cat_name THEN
        RETURN true;
    END IF;

    IF v_ex_name = '' OR v_cat_name = '' THEN
        RETURN false;
    END IF;

    v_min_len := LEAST(length(v_ex_name), length(v_cat_name));
    IF v_min_len < 6 THEN
        RETURN false;
    END IF;

    RETURN position(v_cat_name IN v_ex_name) > 0
        OR position(v_ex_name IN v_cat_name) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_bank_next_id()
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_seq text;
BEGIN
    v_seq := pg_get_serial_sequence('public.bank', 'id_bank');
    IF v_seq IS NULL AND to_regclass('public.bank_id_bank_seq') IS NOT NULL THEN
        v_seq := 'public.bank_id_bank_seq';
    END IF;
    IF v_seq IS NOT NULL THEN
        RETURN nextval(v_seq);
    END IF;
    RETURN (SELECT COALESCE(MAX(id_bank), 0) FROM public.bank) + 1;
END;
$$;

-- Siembra el catálogo para UNA empresa.
--   SELECT public.fn_bank_seed_catalog_for_enterprise(123, 'EMP01');
CREATE OR REPLACE FUNCTION public.fn_bank_seed_catalog_for_enterprise(
    p_id_enterprise bigint,
    p_co_enterprise varchar
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    rec record;
    v_inserted int := 0;
BEGIN
    IF p_id_enterprise IS NULL THEN
        RETURN 0;
    END IF;

    PERFORM set_config('denario.bank_seeding', '1', true);
    PERFORM pg_advisory_xact_lock(82917701, hashtext('bank_seed_ve:' || p_id_enterprise::text));

    FOR rec IN
        SELECT c.co_bank, c.na_bank
        FROM public.bank_catalog_ve c
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.bank b
            WHERE b.id_enterprise = p_id_enterprise
              AND public.fn_bank_catalog_matches(b.co_bank, b.na_bank, c.co_bank, c.na_bank)
        )
        ORDER BY c.co_bank
    LOOP
        INSERT INTO public.bank (
            id_bank, co_bank, na_bank, id_enterprise, co_enterprise, co_operation, da_update
        )
        VALUES (
            public.fn_bank_next_id(),
            rec.co_bank,
            rec.na_bank,
            p_id_enterprise,
            p_co_enterprise,
            'I',
            now()
        );
        v_inserted := v_inserted + 1;
    END LOOP;

    RETURN v_inserted;
END;
$$;

-- Backfill / re-siembra: recorre public.enterprise (no solo empresas que ya tienen bank).
CREATE OR REPLACE FUNCTION public.fn_bank_seed_catalog_all_enterprises()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    r record;
    n int;
    v_total int := 0;
BEGIN
    FOR r IN
        SELECT e.id_enterprise, e.co_enterprise
        FROM public.enterprise e
        WHERE e.id_enterprise IS NOT NULL
          AND COALESCE(e.co_operation, 'I') <> 'D'
        ORDER BY e.id_enterprise
    LOOP
        n := public.fn_bank_seed_catalog_for_enterprise(r.id_enterprise, r.co_enterprise);
        v_total := v_total + n;
        RAISE NOTICE 'Empresa % (%): insertados % bancos del catálogo',
            r.id_enterprise, r.co_enterprise, n;
    END LOOP;
    RAISE NOTICE 'Backfill terminado. Total insertados: %', v_total;
    RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trg_bank_seed_from_catalog()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('denario.bank_seeding', true) = '1' THEN
        RETURN NEW;
    END IF;

    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    PERFORM public.fn_bank_seed_catalog_for_enterprise(NEW.id_enterprise, NEW.co_enterprise);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_seed_ve ON public.bank;
CREATE TRIGGER trg_bank_seed_ve
    AFTER INSERT ON public.bank
    FOR EACH ROW
    EXECUTE PROCEDURE public.fn_trg_bank_seed_from_catalog();

-- El trigger NO corre al crear el objeto; hay que sembrar empresas existentes.
SELECT public.fn_bank_seed_catalog_all_enterprises();

COMMIT;
