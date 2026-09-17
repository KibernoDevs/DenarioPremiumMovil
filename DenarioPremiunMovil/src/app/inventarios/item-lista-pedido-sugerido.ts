import { ClientStockSuggestedOrder } from 'src/app/modelos/tables/client-stock-suggested-order';

export interface ItemListaPedidoSugerido extends ClientStockSuggestedOrder {
  lbClient: string;
  daClientStock: string;
}
