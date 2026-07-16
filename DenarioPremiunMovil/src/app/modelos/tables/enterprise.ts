export class Enterprise {

    static enterpriseJson(obj: Record<string, unknown>) {
        return new Enterprise(
            Number(obj['idEnterprise']),
            String(obj['lbEnterprise'] ?? ''),
            String(obj['coEnterprise'] ?? ''),
            String(obj['coCurrencyDefault'] ?? ''),
            Number(obj['prioritySelection'] ?? 0),
            Boolean(obj['enterpriseDefault']),
            String(obj['naEnterprise'] ?? obj['na_enterprise'] ?? ''),
            String(obj['nuRif'] ?? obj['nu_rif'] ?? ''),
            String(obj['txAddress'] ?? obj['tx_address'] ?? ''),
        );
    }

    constructor(
        public idEnterprise: number,
        public lbEnterprise: string,
        public coEnterprise: string,
        public coCurrencyDefault: string,
        public prioritySelection: number,
        public enterpriseDefault: boolean,
        public naEnterprise: string = '',
        public nuRif: string = '',
        public txAddress: string = '',
    ) { }

    static getDisplayName(enterprise: Pick<Enterprise, 'naEnterprise' | 'lbEnterprise'>): string {
        const name = (enterprise.naEnterprise || '').trim();
        return name || (enterprise.lbEnterprise || '').trim();
    }
}
