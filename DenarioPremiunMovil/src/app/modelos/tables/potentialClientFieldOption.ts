export class PotentialClientFieldOption {
  static fromJson(obj: PotentialClientFieldOption | Record<string, unknown>): PotentialClientFieldOption {
    const row = obj as Record<string, unknown>;
    return new PotentialClientFieldOption(
      Number(row['idOption'] ?? 0),
      Number(row['idFieldDef'] ?? 0),
      String(row['coOption'] ?? ''),
      String(row['txLabel'] ?? ''),
      Number(row['nuOrder'] ?? 0),
      row['blActive'] === true || row['blActive'] === 1 || row['blActive'] === '1',
    );
  }

  constructor(
    public idOption: number,
    public idFieldDef: number,
    public coOption: string,
    public txLabel: string,
    public nuOrder: number,
    public blActive: boolean,
  ) { }
}
