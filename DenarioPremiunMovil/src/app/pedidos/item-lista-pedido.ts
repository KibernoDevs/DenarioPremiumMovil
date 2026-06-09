export interface ItemListaPedido {
    //para ser usado en la lista de pedidos para copiar/ver;
    id_order: number;
    co_order: string;
    co_client: string;
    na_client: string;
    lb_client: string;
    st_order: number;// añadido para compatibilidad con versiones anteriores
    da_order: string;
    na_status: string;
    st_delivery: number; 
}