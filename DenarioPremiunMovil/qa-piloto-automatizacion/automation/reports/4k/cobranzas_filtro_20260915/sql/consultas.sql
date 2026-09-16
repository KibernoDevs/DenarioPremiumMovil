-- ══════════════════════════════════════════════════════════════════════════════
-- 4K · Indicadores › Cobros › Cobranzas — ¿ignora el filtro de vendedor?
-- Base: 4k  ·  Ejecución: node automation/db/query.js 4k "<SQL>"
-- TODO SELECT. Ninguna escritura. 2026-09-15
-- ══════════════════════════════════════════════════════════════════════════════

-- Q1 · Censo de cobros de agosto 2026 por vendedor (el contraste del encargo).
--      Confirma la tabla del encargo y añade 2 usuarios que ésta no listaba:
--      V.0016 JENNY RIVERO (rol 6, supervisora, 13 cobros) y V.0014 WUILMAN GRATEROL (10).
SELECT sv.id AS sv_id, sv.id_user, sv.co_user, sv.na_user, sv.co_role,
       COUNT(c.id_collection) AS cobros,
       COALESCE(SUM(c.nu_amount_total),0) AS suma_total,
       COALESCE(SUM(c.nu_amount_final),0) AS suma_final
FROM salesman_view sv
LEFT JOIN collection c ON c.id_user = sv.id_user
     AND c.da_collection >= DATE '2026-08-01' AND c.da_collection < DATE '2026-09-01'
GROUP BY 1,2,3,4,5
ORDER BY cobros DESC;

-- Q2 · Agosto por vendedor, convertido a US$ (USD nativo tal cual; Bs por su conversión).
SELECT sv.co_user, sv.na_user, COUNT(*) n,
       ROUND(SUM(CASE WHEN c.co_currency='USD' THEN c.nu_amount_total
                      ELSE c.nu_amount_total_conversion END),2) usd_total
FROM collection c JOIN salesman_view sv ON sv.id_user = c.id_user
WHERE c.da_collection >= DATE '2026-08-01' AND c.da_collection < DATE '2026-09-01'
GROUP BY ROLLUP((sv.co_user, sv.na_user))
ORDER BY n DESC;

-- ── ORÁCULO DEL GRÁFICO DE BARRAS «Cobros por métodos de pago por rango de fecha» ──
-- Q3 🔑 · EL HALLAZGO. El universo que pinta el gráfico = EXACTAMENTE los 11 usuarios
--      que ofrece su propio combo de vendedor, sumados TODOS, se elija a quien se elija.
--      Cuadra AL CÉNTIMO con las tres barras de pantalla (tr / de / ef).
SELECT cp.co_payment_method, COUNT(*) n,
       ROUND(SUM(CASE WHEN c.co_currency='USD' THEN cp.nu_amount_partial
                      ELSE cp.nu_amount_partial_conversion END),2) usd
FROM collection_payment cp
JOIN collection c ON c.id_collection = cp.id_collection
WHERE c.da_collection >= DATE '2026-08-01' AND c.da_collection < DATE '2026-09-01'
  AND c.id_user IN (341,300,323,301,304,338,339,303,331,302,305)   -- los 11 del combo
GROUP BY 1 ORDER BY 1;
-- → de 6465.26 · ef 2492.00 · tr 234160.48   ==  las 3 barras de pantalla, exacto.

-- Q4 · Sin la restricción de universo (todos los usuarios) la suma NO cuadra:
--      sobra exactamente lo de V.0016 JENNY RIVERO (rol 6), que NO está en el combo.
SELECT cp.co_payment_method, COUNT(*) n,
       ROUND(SUM(CASE WHEN c.co_currency='USD' THEN cp.nu_amount_partial
                      ELSE cp.nu_amount_partial_conversion END),2) usd
FROM collection_payment cp
JOIN collection c ON c.id_collection = cp.id_collection
WHERE c.da_collection >= DATE '2026-08-01' AND c.da_collection < DATE '2026-09-01'
GROUP BY 1 ORDER BY 1;
-- → de 6465.26 · ef 2942.00 · tr 236563.38   (ef +450.00 y tr +2402.90 = JENNY RIVERO)

-- Q5 · Lo que el gráfico DEBERÍA pintar con V.0030 (338) seleccionado.
SELECT cp.co_payment_method, COUNT(*) n,
       ROUND(SUM(CASE WHEN c.co_currency='USD' THEN cp.nu_amount_partial
                      ELSE cp.nu_amount_partial_conversion END),2) usd
FROM collection_payment cp
JOIN collection c ON c.id_collection = cp.id_collection
WHERE c.da_collection >= DATE '2026-08-01' AND c.da_collection < DATE '2026-09-01'
  AND c.id_user = 338
GROUP BY 1 ORDER BY 1;
-- → de 4050.76 · ef 600.00 · tr 12979.46   (Σ 17 630,22)

-- Q6 · Lo que el gráfico DEBERÍA pintar con V.0019 (339): una sola barra.
--      Igual que Q5 con  c.id_user = 339  → de 250.00 (Σ 250,00)

-- ── ORÁCULO DE LAS 4 TARJETAS KPI (éstas SÍ filtran, y cuadran al céntimo) ──
-- Q7 🔑 · Tarjetas «Mes» y «por Fecha (filtro)»: SOLO cobros emitidos en la moneda
--      elegida (USD nativo), NO el equivalente en US$ de todo. Distinto criterio
--      de moneda que el gráfico de la misma pantalla (Q3).
SELECT COALESCE(sv.co_user,'TOTAL-COMBO') u, COUNT(*) n, ROUND(SUM(c.nu_amount_total),2) usd
FROM collection c JOIN salesman_view sv ON sv.id_user = c.id_user
WHERE c.da_collection >= DATE '2026-08-01' AND c.da_collection < DATE '2026-09-01'
  AND c.co_currency = 'USD'
  AND c.id_user IN (341,300,323,301,304,338,339,303,331,302,305)
GROUP BY ROLLUP(sv.co_user) ORDER BY 3 DESC;
-- → TOTAL-COMBO 202231.96 | V.0002 179450.70 | V.0030 7574.76 | V.0019 250.00  == pantalla

-- Q8 · Tarjeta «Año (año fecha hasta)» — mismo criterio, ventana 2026 completa.
SELECT COALESCE(sv.co_user,'TOTAL-COMBO') u, COUNT(*) n, ROUND(SUM(c.nu_amount_total),2) usd
FROM collection c JOIN salesman_view sv ON sv.id_user = c.id_user
WHERE c.da_collection >= DATE '2026-01-01' AND c.da_collection < DATE '2027-01-01'
  AND c.co_currency = 'USD'
  AND c.id_user IN (341,300,323,301,304,338,339,303,331,302,305)
GROUP BY ROLLUP(sv.co_user) ORDER BY 3 DESC;
-- → TOTAL-COMBO 526504.39 | V.0030 46838.43 | V.0019 797.00  == pantalla

-- Q9 · Tarjetas con Tipo Cobro = Anticipo/Prepago (co_type = 1): también cuadran.
SELECT c.co_type, COUNT(*) n, ROUND(SUM(c.nu_amount_total),2) usd
FROM collection c
WHERE c.da_collection >= DATE '2026-08-01' AND c.da_collection < DATE '2026-09-01'
  AND c.co_currency = 'USD'
  AND c.id_user IN (341,300,323,301,304,338,339,303,331,302,305)
GROUP BY 1 ORDER BY 1;
-- → co_type 0 = 15001.50 · co_type 1 = 187230.46 ; 0+1 = 202231.96 (tarjeta «Todos»)

-- Q10 · Control del filtro de cliente: MSDIESEL 2022 (628) en agosto sólo tiene cobros
--       en Bs ⇒ la tarjeta en USD debe dar 0,00 (y da 0,00); en el año, 11 990,00 USD.
SELECT co_currency, COUNT(*) n, SUM(nu_amount_total) t FROM collection
WHERE da_collection >= DATE '2026-08-01' AND da_collection < DATE '2026-09-01' AND id_client = 628
GROUP BY 1;
SELECT COUNT(*) n, SUM(nu_amount_total) t FROM collection
WHERE da_collection >= DATE '2026-01-01' AND da_collection < DATE '2027-01-01'
  AND id_client = 628 AND co_currency = 'USD';

-- Q11 · Desglose de moneda de V.0030 y V.0019 (por qué 36 cobros ≠ 8 cobros en la tarjeta).
SELECT sv.co_user, c.co_currency, COUNT(*) n, SUM(c.nu_amount_total) total,
       SUM(c.nu_amount_total_conversion) total_conv
FROM collection c JOIN salesman_view sv ON sv.id_user = c.id_user
WHERE c.da_collection >= DATE '2026-08-01' AND c.da_collection < DATE '2026-09-01'
  AND sv.co_user IN ('V.0030','V.0019')
GROUP BY 1,2 ORDER BY 1,2;
-- → V.0030: 8 en USD (7 574,76) + 28 en Bs (≡ 4 158,62 US$) = 36 cobros ≡ 11 733,38 US$
--   V.0019: 1 en USD (250,00)
