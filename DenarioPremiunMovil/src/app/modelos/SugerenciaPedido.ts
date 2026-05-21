import { ClientStockTotal } from "./client-stock-total";
import { ProductSuggestedUtil } from "./ProductSuggestedUtil";
import { AddresClient } from "./tables/addresClient";
import { Client } from "./tables/client";
import { ClientStocks } from "./tables/client-stocks";
import { Enterprise } from "./tables/enterprise";
import { List } from './tables/list';

export class SugerenciaPedido {
    static sugerenciaPedidoJson(obj: SugerenciaPedido){
        return new SugerenciaPedido(
            obj['empresa'],
            obj['cliente'],
            obj['direccion'],
            obj['productUtils'],
            obj['list'],
            obj['enviar'],
            obj['coClientStock'],
            obj['idClientStock'],
            
        );
    }

    constructor(
        public empresa: Enterprise,
        public cliente: Client = {} as Client,
        public direccion: AddresClient = {} as AddresClient,
        public productUtils: ProductSuggestedUtil[] = [],
        public list: List,
        public enviar: boolean,
        public coClientStock: string,
        public idClientStock: number | null,
        public idProducts: number[] = [],
        public idUnits: number[] = [],
        public idProductUnits: number[] = [],

    ){}
}