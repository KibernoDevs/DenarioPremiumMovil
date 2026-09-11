-- Corrida web_facturaciones_roles_20260911 · IMPORTADORA 4K (base: 4k) · SOLO LECTURA
-- Ejecutar con: node automation/db/query.js 4k "<SQL>"

-- Q1 · ¿Existe document_sale.id_user? ¿se llena?  → 8470 filas / 0 con id_user
SELECT count(*) AS document_sale_rows, count(id_user) AS con_id_user FROM document_sale;

-- Q1b · La columna EXISTE en el catálogo (integer, última de la tabla)
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='document_sale' AND column_name='id_user';

-- Q2 · Lado factura → 4474 filas / 4474 con id_user (100 %)
SELECT count(*) AS invoice_rows, count(id_user) AS con_id_user FROM invoice;

-- Q3 · Por qué el listado muestra 3.693 y no 4.474: solo el rol con selector=true
SELECT r.na_role, r.selector, count(i.id_invoice) facturas
  FROM invoice i JOIN role_user ru ON ru.id_user=i.id_user
  JOIN role r ON r.co_role=ru.co_role GROUP BY 1,2 ORDER BY 3 DESC;
-- ROLE_SALESMAN/true=3693 · ROLE_PROMOTER/false=588 · ROLE_SUPERVISOR/false=193

-- Q4 · Atadura documento↔factura (invoice.co_invoice = 'CJA-'||document_sale.nu_document)
SELECT count(*) ds_total, count(i.id_invoice) ds_con_invoice, count(*)-count(i.id_invoice) ds_sin_invoice
  FROM document_sale ds LEFT JOIN invoice i
    ON i.co_invoice='CJA-'||ds.nu_document AND i.co_client=ds.co_client;
-- 8470 / 4326 / 4144

-- Q4b · Lo mismo sobre los documentos VIVOS (co_operation='I')
SELECT count(*) vivos, count(i.id_invoice) con_factura, count(*)-count(i.id_invoice) sin_factura
  FROM document_sale ds LEFT JOIN invoice i ON i.co_invoice='CJA-'||ds.nu_document
 WHERE ds.co_operation='I';
-- 2044 / 1260 / 784

-- Q5 · Descartes: no es estatus, ni empresa, ni fecha, ni FKs nulas
SELECT co_operation, count(*) n, count(*) FILTER (WHERE nu_balance>0) con_saldo,
       min(da_document)::date mn, max(da_document)::date mx, count(id_user) con_vendedor
  FROM document_sale GROUP BY 1;                      -- D=6426 · I=2044 · con_vendedor=0 en ambos
SELECT count(*) n, count(id_client) id_client, count(id_currency) id_currency,
       count(id_enterprise) id_enterprise, count(id_document_sale_type) id_dstype, count(id_user) id_user
  FROM document_sale;                                  -- todas pobladas salvo id_user
SELECT co_enterprise, count(*) FROM document_sale GROUP BY 1;          -- DIESE = 8470 (empresa única)
SELECT st_document_sale, count(*) FROM document_sale GROUP BY 1;       -- 6 = 8470 (estatus único)

-- Q6 · Control de oráculo: facturas del vendedor 304 (EDWIN HERRERA, ROLE_SALESMAN) = 847
SELECT i.id_user, i.co_user, count(*) n FROM invoice i GROUP BY 1,2 ORDER BY 3 DESC;

-- Q7 · Líneas de detalle de factura (90 facturas sin líneas, 73 de ellas de 2026-08)
SELECT count(*) tot, count(*) FILTER (WHERE d.n IS NULL) sin_detalle, count(*) FILTER (WHERE d.n>0) con_detalle
  FROM invoice i LEFT JOIN (SELECT id_invoice,count(*) n FROM invoice_detail GROUP BY 1) d
    ON d.id_invoice=i.id_invoice;

-- Q8 · El "Subtotal" repetido del detalle viene del dato, no del render
SELECT d.co_invoice_detail, d.co_product, d.nu_price_base, d.nu_amount_total
  FROM invoice_detail d JOIN invoice i ON i.id_invoice=d.id_invoice
 WHERE i.co_invoice='CJA-D0001623' ORDER BY 1;   -- nu_amount_total = 595,00 en las 6 líneas
