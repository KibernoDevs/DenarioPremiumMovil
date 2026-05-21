export class ReturnCategory {

  static returnCategoryJson(obj: ReturnCategory) {
    return new ReturnCategory(
    obj['idReturnCategory'],
    obj['naReturnCategory'],
    obj['addSuggestion'],
    obj['subtractSuggestion']

    );
}

    constructor(
    public idReturnCategory: number,
    public naReturnCategory: string,
    public addSuggestion: string,
    public subtractSuggestion: string
  ) {};

}
