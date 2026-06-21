export class OrderType {

  static orderTypeJson(obj: Record<string, unknown>): OrderType {
    const defRaw = obj['defaultValue'] ?? obj['default_value'];
    const itemsRaw = obj['itemsLimit'] ?? obj['items_limit'];
    const quRaw = obj['quItems'] ?? obj['qu_items'];
    const rawIva = obj['idIvaList'] ?? obj['id_iva_list'];
    const idIvaList =
      rawIva === undefined || rawIva === null ? null : Number(rawIva);
    const rawIdList = obj['idList'] ?? obj['id_list'];
    const idList = rawIdList == null ? null : Number(rawIdList);
    const rawCoList = obj['coList'] ?? obj['co_list'];
    const coList = rawCoList == null ? null : String(rawCoList);
    return new OrderType(
      obj['idOrderType'] as number,
      obj['coOrderType'] as string,
      obj['naOrderType'] as string,
      defRaw === true || defRaw === 1 || defRaw === '1',
      obj['coEnterprise'] as string,
      obj['idEnterprise'] as number,
      itemsRaw === true || itemsRaw === 1 || itemsRaw === '1',
      Number(quRaw ?? 0),
      idIvaList,
      idList,
      coList,
    );
  }

  constructor(
    public idOrderType: number,
    public coOrderType: string,
    public naOrderType: string,
    public defaultValue: boolean,
    public coEnterprise: string,
    public idEnterprise: number,
    public itemsLimit: boolean,
    public quItems: number,
    public idIvaList: number | null = null,
    public idList: number | null = null,
    public coList: string | null = null,
  ) { }
}
