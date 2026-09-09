export class IncidenceMotive {

    static incidenceMotiveJson(obj: IncidenceMotive) {
        return new IncidenceMotive(
            obj['idMotive'],
            obj['naMotive'],
            obj['idType'],
            obj['active'] !== undefined && obj['active'] !== null ? obj['active'] : true,
            obj['requiredComment'] !== undefined && obj['requiredComment'] !== null ? obj['requiredComment'] : false
        );
    }

    constructor(
        public idMotive: number,
        public naMotive: string,
        public idType: number,
        public active: boolean | number = true,
        public requiredComment: boolean | number = false
    ) { }
}
