export class OrderDetailUnit {

    static OrderDetailUnitJSON(obj: OrderDetailUnit) {
        return new OrderDetailUnit(
            obj['idOrderDetailUnit'],
            obj['coOrderDetailUnit'],
            obj['coOrderDetail'],
            obj['coProductUnit'],
            obj['idProductUnit'],
            obj['quOrder'],
            obj['coEnterprise'],
            obj['idEnterprise'],
            obj['coUnit'],
            obj['quSuggested'],
            obj['coPriceList'],
            obj['idPriceList'],
        )
    }

    constructor(
        public idOrderDetailUnit: number | null,
        public coOrderDetailUnit: string,
        public coOrderDetail: string,
        public coProductUnit: string,
        public idProductUnit: number,
        public quOrder: number,
        public coEnterprise: string,
        public idEnterprise: number,
        public coUnit: string,
        public quSuggested: number,
        public coPriceList: string,
        public idPriceList: number,
    ) {

    }
}