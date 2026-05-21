export class ReturnType {

    static returnTypeJson(obj: ReturnType) {
        return new ReturnType(
            obj['idType'],
            obj['naType'],
            obj['idReturnCategory']
        );
    }

    constructor(
        public idType: number,
        public naType: string,
        public idReturnCategory?: number
    ) { }
}