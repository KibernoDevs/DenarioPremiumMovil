export class CollectRetentions {

    static collectRetentionsJson(obj: CollectRetentions) {
        return new CollectRetentions(
            obj['idCollectRetention'],
            obj['coCollectRetention'],
            obj['naCollectRetention'],
            obj['idEnterprise'],
        );
    }

    constructor(
        public idCollectRetention: number,
        public coCollectRetention: string,
        public naCollectRetention: string,
        public idEnterprise: number,
    ) { }
}
