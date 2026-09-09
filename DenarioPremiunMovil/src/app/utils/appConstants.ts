//Valores de status de envio (stDelivery)

export const DELIVERY_STATUS_NEW = 0
export const DELIVERY_STATUS_SENT = 1;
export const DELIVERY_STATUS_TO_SEND = 2;
export const DELIVERY_STATUS_SAVED = 3;


//Valores de status de envio (stDelivery)

export const CLIENTSTOCK_STATUS_NEW = 0
export const CLIENTSTOCK_STATUS_SENT = 1;
export const CLIENTSTOCK_STATUS_TO_SEND = 2;
export const CLIENTSTOCK_STATUS_SAVED = 3;

//FIN VALORES ENVIO

//Valores de status de envio (stDelivery)

export const DEPOSITO_STATUS_NEW = 0
export const DEPOSITO_STATUS_SAVED = 3;
export const DEPOSITO_STATUS_TO_SEND = 2;
export const DEPOSITO_STATUS_SENT = 1;

/** status_action del catálogo status (dep002) cuando el depósito fue rechazado en Web */
export const DEPOSIT_APPROVAL_STATUS_REJECTED = 2;

//FIN VALORES ENVIO

//Valores de status de collection

export const COLLECT_STATUS_NEW = 0
export const COLLECT_STATUS_SAVED = 3;
export const COLLECT_STATUS_TO_SEND = 2;
export const COLLECT_STATUS_SENT = 1;

//FIN VALORES collection

//Valores de status de visita

export const VISIT_STATUS_SAVED = 0;
export const VISIT_STATUS_TO_SEND = 1;
export const VISIT_STATUS_VISITED = 2;
export const VISIT_STATUS_NOT_VISITED = 3;

//FIN VALORES VISITA

export const MAX_ITEMS_PER_PAGE = 50; // cantidad de registros a traer por cada consulta a la base de datos (para evitar problemas de rendimiento)

//Valores de integracion (para tener en cuenta)
/*
1: aprobado - puede ser integrado
2: rechazado - se devuelve a la móvil no se integra
3: por defecto - no se hace nada (Este debe ser el estatus que traigan todas las transacciones por defecto)
5: Hubo un error de integración - queda en stand by
6: integrado
*/


//COLORES MODULOS

export const COLOR_VERDE = "#59b02d";
export const COLOR_AMARILLO = "#daab19";
export const COLOR_GRIS = "#666666";
export const COLOR_LILA = "#430197";
//FIN COLORES MODULOS

//API KEY GOOGLE MAPS
const env = (window as Window & { __env?: Record<string, string> }).__env || {};
export const API_KEY_GOOGLE_MAPS = env["API_KEY_GOOGLE_MAPS"] || "";

//API KEY GOOGLE MAPS

//Valores de status de cliente potencial
export const CLIENT_POTENTIAL_STATUS_NEW = 0;
export const CLIENT_POTENTIAL_STATUS_TO_SEND = 1;
export const CLIENT_POTENTIAL_STATUS_SENT = 2;


//FIN VALORES CLIENTE POTENTIAL

//VALORES isDispatched (VISITA - Transportistas)
export const VISIT_IS_DISPATCHED_NO = 0;
export const VISIT_IS_DISPATCHED_PARTIAL = 1;
export const VISIT_IS_DISPATCHED_YES = 2;


//FIN VALORES isDispatched
