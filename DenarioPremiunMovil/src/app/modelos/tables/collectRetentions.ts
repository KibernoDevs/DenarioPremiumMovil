export class CollectRetentions {

    private static parseRequireInput(value: unknown): boolean {
        return value === true || value === 1 || value === '1' || value === 'true';
    }

    static collectRetentionsJson(obj: CollectRetentions) {
        const raw = obj as CollectRetentions & { requireInput?: unknown };
        return new CollectRetentions(
            obj['idCollectRetention'],
            obj['coCollectRetention'],
            obj['naCollectRetention'],
            obj['idEnterprise'],
            CollectRetentions.parseRequireInput(raw.requireInput),
            Number(obj['nuVoucherLength'] ?? 0),
        );
    }

    constructor(
        public idCollectRetention: number,
        public coCollectRetention: string,
        public naCollectRetention: string,
        public idEnterprise: number,
        public requireInput: boolean = false,
        public nuVoucherLength: number = 0,
    ) { }
}
