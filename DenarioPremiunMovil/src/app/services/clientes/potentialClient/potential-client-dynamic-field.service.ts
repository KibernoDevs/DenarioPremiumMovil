import { Injectable, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { SynchronizationDBService } from '../../synchronization/synchronization-db.service';

export interface PotentialClientDynamicFieldOptionView {
  coOption: string;
  txLabel: string;
}

export interface PotentialClientDynamicFieldView {
  coField: string;
  naLabel: string;
  options: PotentialClientDynamicFieldOptionView[];
  required: boolean;
}

export interface PotentialClientFieldValuePair {
  coField: string;
  txValue: string;
}

@Injectable({
  providedIn: 'root',
})
export class PotentialClientDynamicFieldService {
  private readonly dbServ = inject(SynchronizationDBService);

  /** Campos dinámicos activos para la empresa actual (para el template). */
  dynamicFields: PotentialClientDynamicFieldView[] = [];

  private isTruthyFlag(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
  }

  async loadDefsAndOptions(idEnterprise: number): Promise<PotentialClientDynamicFieldView[]> {
    if (!idEnterprise) {
      this.dynamicFields = [];
      return [];
    }

    const db = this.dbServ.getDatabase();
    const defsRes = await db.executeSql(
      `SELECT id_field_def, co_field, na_label, co_field_type, bl_required, nu_order
       FROM potential_client_field_def
       WHERE id_enterprise = ? AND bl_active = 1
       ORDER BY nu_order ASC, id_field_def ASC`,
      [idEnterprise],
    );

    const fields: PotentialClientDynamicFieldView[] = [];
    const defIds: number[] = [];

    for (let i = 0; i < defsRes.rows.length; i++) {
      const row = defsRes.rows.item(i);
      const coFieldType = String(row.co_field_type ?? 'SELECT').toUpperCase();
      if (coFieldType !== 'SELECT' && coFieldType !== 'RANGE') {
        continue;
      }
      const idFieldDef = Number(row.id_field_def);
      defIds.push(idFieldDef);
      fields.push({
        coField: String(row.co_field ?? ''),
        naLabel: String(row.na_label ?? row.co_field ?? ''),
        options: [],
        required: this.isTruthyFlag(row.bl_required),
      });
    }

    if (defIds.length === 0) {
      this.dynamicFields = [];
      return [];
    }

    const placeholders = defIds.map(() => '?').join(',');
    const optsRes = await db.executeSql(
      `SELECT id_field_def, co_option, tx_label, nu_order
       FROM potential_client_field_option
       WHERE bl_active = 1 AND id_field_def IN (${placeholders})
       ORDER BY nu_order ASC, id_option ASC`,
      defIds,
    );

    const optionsByDef = new Map<number, PotentialClientDynamicFieldOptionView[]>();
    for (let i = 0; i < optsRes.rows.length; i++) {
      const row = optsRes.rows.item(i);
      const idFieldDef = Number(row.id_field_def);
      const list = optionsByDef.get(idFieldDef) ?? [];
      list.push({
        coOption: String(row.co_option ?? ''),
        txLabel: String(row.tx_label ?? row.co_option ?? ''),
      });
      optionsByDef.set(idFieldDef, list);
    }

    for (let i = 0; i < fields.length; i++) {
      fields[i].options = optionsByDef.get(defIds[i]) ?? [];
    }

    this.dynamicFields = fields;
    return fields;
  }

  /**
   * Quita controles dyn_* previos y agrega un FormControl por cada SELECT activo.
   * Si se pasan existingValues, se hidratan; si no, quedan vacíos (p. ej. cambio de empresa).
   */
  async replaceDynamicControls(
    form: FormGroup,
    idEnterprise: number,
    existingValues?: PotentialClientFieldValuePair[],
  ): Promise<void> {
    const keys = Object.keys(form.controls);
    for (const key of keys) {
      if (key.startsWith('dyn_')) {
        form.removeControl(key);
      }
    }

    const fields = await this.loadDefsAndOptions(idEnterprise);
    const valueMap = new Map<string, string>();
    if (existingValues) {
      for (const v of existingValues) {
        if (v?.coField) {
          valueMap.set(v.coField, v.txValue ?? '');
        }
      }
    }

    for (const field of fields) {
      const controlName = `dyn_${field.coField}`;
      const validators = field.required ? [Validators.required] : [];
      form.addControl(
        controlName,
        new FormControl(valueMap.get(field.coField) ?? '', validators),
      );
    }
  }

  getFieldValuesFromForm(form: FormGroup): PotentialClientFieldValuePair[] {
    const values: PotentialClientFieldValuePair[] = [];
    for (const field of this.dynamicFields) {
      const control = form.get(`dyn_${field.coField}`);
      const raw = control ? control.value : '';
      values.push({
        coField: field.coField,
        txValue: String(raw ?? '').trim(),
      });
    }
    return values;
  }

  async saveValues(coClient: string, values: PotentialClientFieldValuePair[]): Promise<void> {
    if (!coClient) {
      return;
    }
    const db = this.dbServ.getDatabase();
    await db.executeSql(
      'DELETE FROM potential_client_field_value WHERE co_client = ?',
      [coClient],
    );

    const statements: [string, unknown[]][] = [];
    const insertSql =
      'INSERT OR REPLACE INTO potential_client_field_value(co_client, co_field, tx_value) VALUES(?,?,?)';
    for (const v of values) {
      if (!v?.coField) {
        continue;
      }
      statements.push([insertSql, [coClient, v.coField, v.txValue ?? '']]);
    }
    if (statements.length > 0) {
      await db.sqlBatch(statements);
    }
  }

  async loadValues(coClient: string): Promise<PotentialClientFieldValuePair[]> {
    if (!coClient) {
      return [];
    }
    const db = this.dbServ.getDatabase();
    const res = await db.executeSql(
      'SELECT co_field, tx_value FROM potential_client_field_value WHERE co_client = ?',
      [coClient],
    );
    const values: PotentialClientFieldValuePair[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      values.push({
        coField: String(row.co_field ?? ''),
        txValue: String(row.tx_value ?? ''),
      });
    }
    return values;
  }
}
