import { OrderDetailDiscount } from "../orderDetailDiscount";
import { OrderDetailUnit } from "./orderDetailUnit";

export class OrderDetail {
    static orderDetailJson(obj: OrderDetail) {
        return new OrderDetail(
            obj['idOrderDetail'],
            obj['coOrderDetail'],
            obj['coOrder'],
            obj['coProduct'],
            obj['naProduct'],
            obj['idProduct'],
            obj['nuPriceBase'],
            obj['nuAmountTotal'],
            obj['coWarehouse'],
            obj['idWarehouse'],
            obj['quSuggested'],
            obj['coEnterprise'],
            obj['idEnterprise'],
            obj['iva'],
            obj['nuDiscountTotal'],
            obj['coDiscount'],
            obj['idDiscount'],
            obj['coPriceList'],
            obj['idPriceList'],
            obj['posicion'],
            obj['nuPriceBaseConversion'],
            obj['nuDiscountTotalConversion'],
            obj['nuAmountTotalConversion'],
            obj['nuAmountTax'],
            obj['orderDetailUnit'],
            obj['orderDetailDiscount'],

        );
    }
    constructor(
        public idOrderDetail: number | null,
        public coOrderDetail: string,
        public coOrder: string,
        public coProduct: string,
        public naProduct: string,
        public idProduct: number,
        public nuPriceBase: number,
        public nuAmountTotal: number,
        public coWarehouse: string,
        public idWarehouse: number,
        public quSuggested: number,
        public coEnterprise: string,
        public idEnterprise: number,
        public iva: number,
        public nuDiscountTotal: number,
        public coDiscount: string,
        public idDiscount: number,
        public coPriceList: string,
        public idPriceList: number,
        public posicion: number,
        public nuPriceBaseConversion: number,
        public nuDiscountTotalConversion: number,
        public nuAmountTotalConversion: number,
        public nuAmountTax: number,

        public orderDetailUnit: OrderDetailUnit[],
        public orderDetailDiscount: OrderDetailDiscount[],

    ) {

    }
}
