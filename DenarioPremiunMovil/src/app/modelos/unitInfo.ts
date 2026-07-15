export class UnitInfo {

    static productUnitJson(obj: UnitInfo) {
        return new UnitInfo(
            /*
             * Ayudante de unidades de producto para pedidos
             * literalmente productUnit con monto y nombre
             */

            obj['idProductUnit'],
            obj['coProductUnit'],
            obj['coProduct'],
            obj['idProduct'],
            obj['coUnit'],
            obj['idUnit'],
            obj['quUnit'],
            obj['coEnterprise'],
            obj['idEnterprise'],
            obj['naUnit'],
            obj['quAmount'],
            obj['coPriceList'],
            obj['idPriceList'],
            obj['quBonified'] ?? 0,
            obj['bonusActive'] ?? ((obj['quBonified'] ?? 0) > 0),
        );
    }

    constructor(
        public idProductUnit: number,
        public coProductUnit: string,
        public coProduct: string,
        public idProduct: number,
        public coUnit: string,
        public idUnit: number,
        public quUnit: number,
        public coEnterprise: string,
        public idEnterprise: number,
        public naUnit: string,
        public quAmount: number,
        public coPriceList: string,
        public idPriceList: number,
        /** REQ-01: unidades regaladas (adicionales a quAmount) */
        public quBonified: number = 0,
        /** REQ-01 UI: vendedor activó la bonificación (siempre aplica el máx). */
        public bonusActive: boolean = false,
    ) { }
}