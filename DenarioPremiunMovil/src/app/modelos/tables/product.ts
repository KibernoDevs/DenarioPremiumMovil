export class Product {

    static productJson(obj: Product) {
        return new Product(
            obj['idProduct'],
            obj['coProduct'],
            obj['naProduct'],
            obj['coPrimaryUnit'],
            obj['coProductStructure'],
            obj['idProductStructure'],
            obj['txDimension'],
            obj['txPacking'],
            obj['points'],
            obj['nuPriority'],
            obj['featuredProduct'],
            obj['txDescription'],
            obj['coEnterprise'],
            obj['idEnterprise'],
            obj['nuTax'],
            obj['image'] ?? null,
          
        );
    }

    constructor(
        public idProduct: number,
        public coProduct: string,
        public naProduct: string,
        public coPrimaryUnit: string,
        public coProductStructure: string,
        public idProductStructure: number,
        public txDimension: string,
        public txPacking: string,
        public points: number,
        public nuPriority: number,
        public featuredProduct: boolean,
        public txDescription: string,
        public coEnterprise: string,
        public idEnterprise: number,
        public nuTax: number,
        public image: string | null = null,
        
    ) { }
}