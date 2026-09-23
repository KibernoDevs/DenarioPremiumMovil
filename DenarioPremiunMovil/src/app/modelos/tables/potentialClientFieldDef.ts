export class PotentialClientFieldDef {
  static fromJson(obj: PotentialClientFieldDef | Record<string, unknown>): PotentialClientFieldDef {
    const row = obj as Record<string, unknown>;
    return new PotentialClientFieldDef(
      Number(row['idFieldDef'] ?? 0),
      Number(row['idEnterprise'] ?? 0),
      String(row['coField'] ?? ''),
      String(row['naLabel'] ?? ''),
      String(row['coFieldType'] ?? 'SELECT'),
      row['blRequired'] === true || row['blRequired'] === 1 || row['blRequired'] === '1',
      Number(row['nuOrder'] ?? 0),
      row['blActive'] === true || row['blActive'] === 1 || row['blActive'] === '1',
    );
  }

  constructor(
    public idFieldDef: number,
    public idEnterprise: number,
    public coField: string,
    public naLabel: string,
    public coFieldType: string,
    public blRequired: boolean,
    public nuOrder: number,
    public blActive: boolean,
  ) { }
}
