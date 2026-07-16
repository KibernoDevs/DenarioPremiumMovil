export class ProductBonusFav {

  static isFlagActive(flag: unknown): boolean {
    if (flag === false || flag === 0 || flag === '0') {
      return false;
    }
    if (String(flag).toLowerCase() === 'false') {
      return false;
    }
    return flag === true || flag === 1 ||
      String(flag).toLowerCase() === 'true' ||
      String(flag) === '1';
  }

  static normalizeFlag(flag: unknown): 0 | 1 {
    return ProductBonusFav.isFlagActive(flag) ? 1 : 0;
  }

  static productBonusFavJson(obj: ProductBonusFav) {
    return new ProductBonusFav(
      obj['idProductBonusFav'],
      obj['coProductBonusFav'],
      obj['idProduct'],
      obj['coProduct'],
      obj['idEnterprise'],
      obj['coEnterprise'],
      obj['quBuy'],
      obj['quBonus'],
      obj['flag'],
      obj['coOperation'],
      obj['daUpdate'],
    );
  }

  constructor(
    public idProductBonusFav: number,
    public coProductBonusFav: string,
    public idProduct: number,
    public coProduct: string,
    public idEnterprise: number,
    public coEnterprise: string,
    public quBuy: number,
    public quBonus: number,
    public flag: boolean,
    public coOperation: string,
    public daUpdate: string,
  ) { }
}
