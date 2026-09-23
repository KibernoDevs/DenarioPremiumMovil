export class PaymentCondition {

    static paymentConditionJson(obj: PaymentCondition) {
        return new PaymentCondition(
            obj['idPaymentCondition'],
            obj['coPaymentCondition'],
            obj['naPaymentCondition'],
            obj['coEnterprise'],
            obj['idEnterprise'],
            obj['nuMinAmount'],
        );
    }

    constructor(
        public idPaymentCondition: number,
        public coPaymentCondition: string,
        public naPaymentCondition: string,
        public coEnterprise: string,
        public idEnterprise: number,
        public nuMinAmount: number = 0,
    ) { }
}
