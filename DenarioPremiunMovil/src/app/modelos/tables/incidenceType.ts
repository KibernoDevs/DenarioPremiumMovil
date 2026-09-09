export class IncidenceType {

    static incidenceTypeJson(obj: IncidenceType) {
        return new IncidenceType(
            obj['idType'],
            obj['naType'],
            obj['requiredEvent'],
            obj['requiredSignature'],
            obj['active'] !== undefined && obj['active'] !== null ? obj['active'] : true
        );
    }

    constructor(
        public idType: number,
        public naType: string,
        public requiredEvent: boolean,
        public requiredSignature: boolean,
        public active: boolean | number = true
    ) { }
}
