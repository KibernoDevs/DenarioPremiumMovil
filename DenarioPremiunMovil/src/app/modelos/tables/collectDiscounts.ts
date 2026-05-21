export class CollectDiscounts {

  static CollectDiscountsJson(obj: CollectDiscounts) {
    const objAny = obj as CollectDiscounts & Record<string, unknown>;
    const rawEnterprise =
      (objAny['idEnterprise'] ?? objAny['id_enterprise']) as number | null | undefined;
    const idEnterprise =
      rawEnterprise === undefined || rawEnterprise === null ? null : Number(rawEnterprise);
    return new CollectDiscounts(
      obj['idCollectDiscount'],
      obj['nuCollectDiscount'],
      obj['naCollectDiscount'],
      obj['requireInput'],
      obj['nuAmountCollectDiscount'],
      obj['nuAmountCollectDiscountConversion'],
      obj['position'],
      idEnterprise,
    );
  }

  constructor(
    public idCollectDiscount: number,
    public nuCollectDiscount: number,
    public naCollectDiscount: string,
    public requireInput: boolean,
    public nuAmountCollectDiscount: number,
    public nuAmountCollectDiscountConversion: number,
    public position: number,
    public idEnterprise: number | null = null,

  ) { }
}
