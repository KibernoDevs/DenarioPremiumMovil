-- ============================================================================
--  HIDROPONIAS · asignar INVERSIONES 250 LA CORNETERIA al vendedor V3
--  Dato de prueba para desbloquear DM-SUG-011.  QA: Grecia · 08/09/2026
--  Ejecutar con usuario de ESCRITURA.
-- ============================================================================
--
--  POR QUÉ
--  -------
--  DM-SUG-011 comprueba que el despacho SUMA un mismo producto que aparece en
--  dos facturas del mismo día. En toda la base hay UN solo cliente con ese
--  escenario:
--
--      9999932 · INVERSIONES 250 LA CORNETERIA · id_address_client 931
--      última fecha facturada 2026-09-07, dos facturas:
--          20118201  →  CAMPROLEC012BOLUNI × 25
--          20118244  →  CAMPROLEC012BOLUNI × 25
--
--  ⇒ oráculo limpísimo: con el bug daría 25 (solo la factura ganadora),
--    con el fix debe dar 50.
--
--  Pero ese cliente NO TIENE VENDEDOR ASIGNADO, así que no baja a ningún
--  dispositivo y el caso quedó sin ejercitar también en la corrida del 01/09.
--  Esta fila lo mete en la cartera de V3 (el usuario cargado hoy en el equipo).
--
--  ⚠ DESPUÉS DE INSERTAR hay que SINCRONIZAR el dispositivo para que bajen el
--    cliente y sus facturas.
--  ⚠ NO ejecutar mientras el agente esté corriendo la app: la sincronización
--    lo interrumpe a media prueba.
-- ============================================================================

INSERT INTO user_address_clients
       (co_user_address_clients, id_address_client, co_address_client,
        id_user, co_user, na_user, id_enterprise, co_enterprise,
        co_operation, da_update)
SELECT (extract(epoch from now()) * 1000)::bigint::text,
       931, '9999932',
       469, 'V3', 'ROGER MUESES', 1, 'HIDRO_A',
       'I', now()
WHERE NOT EXISTS (
  SELECT 1 FROM user_address_clients
   WHERE id_address_client = 931 AND id_user = 469
);

-- Comprobación: debe devolver UNA fila
SELECT id_user_address_clients, co_user_address_clients, id_address_client,
       co_address_client, co_user, na_user
FROM   user_address_clients
WHERE  id_address_client = 931;

-- ============================================================================
--  DESHACER (cuando el caso ya esté probado y se quiera dejar la data como estaba)
-- ============================================================================
-- DELETE FROM user_address_clients WHERE id_address_client = 931 AND id_user = 469;
