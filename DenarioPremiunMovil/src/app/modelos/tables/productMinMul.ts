export class ProductMinMulFav {

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
    return ProductMinMulFav.isFlagActive(flag) ? 1 : 0;
  }

  static productMinMulJson(obj: ProductMinMulFav) {
      return new ProductMinMulFav(
          obj['idProductMinMul'],
          obj['coProduct'],
          obj['idProduct'],
          obj['quMinimum'],
          obj['quMultiple'],
          obj['flag'],
          obj['coEnterprise'],
          obj['idEnterprise'],
        
      );
  }

  constructor(
      public idProductMinMul: number,
      public coProduct: string,
      public idProduct: number,
      public quMinimum: number,
      public quMultiple: number,
      public flag: boolean,
      public coEnterprise: string,
      public idEnterprise: number,
      
  ) { }
}