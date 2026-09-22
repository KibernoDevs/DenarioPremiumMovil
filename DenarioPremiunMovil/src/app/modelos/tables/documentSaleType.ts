export class DocumentSaleType {

    static documentSaleTypeJson(obj: DocumentSaleType) {
        return new DocumentSaleType(
            obj['idDocumentSaleType'],
            obj['coType'],
            obj['naType'],
            obj['coEquiv'],
            obj['coEnterprise'],
            obj['idEnterprise'],
            DocumentSaleType.normalizeIsInvoice(obj['isInvoice']),

        );
    }

    static normalizeIsInvoice(value: unknown): boolean {
        return value === true || value === 1 || value === '1' || value === 'true';
    }

    constructor(
        public idDocumentSaleType: number,
        public coType: string,
        public naType: string,
        public coEquiv: string,
        public coEnterprise: string,
        public idEnterprise: number,
        public isInvoice: boolean = false,
        
    ) { }
}