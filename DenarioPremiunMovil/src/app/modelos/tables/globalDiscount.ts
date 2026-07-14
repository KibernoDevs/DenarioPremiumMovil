export class GlobalDiscount {

  static dlobalDiscountJson(obj: GlobalDiscount) {
      return new GlobalDiscount(
          obj['idGlobalDiscount'],
          obj['globalDiscount'],
          obj['txDescription'],
          obj['defaultGlobalDiscount'],
          obj['idEnterprise'],
          obj['coEnterprise'],
      );
  }

  constructor(
      public idGlobalDiscount: number,
      public globalDiscount: number,
      public txDescription: string,
      public defaultGlobalDiscount: boolean,
      public idEnterprise?: number,
      public coEnterprise?: string,
  ) { }
}
