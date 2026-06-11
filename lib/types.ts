export interface DatoField {
  id: string;
  api_key: string;
  label: string;
  field_type: string;
  localized: boolean;
  validators: Record<string, unknown>;
}

export interface DatoModel {
  id: string;
  name: string;
  api_key: string;
  fields: DatoField[];
}

export interface DatoRecord {
  id: string;
  item_type: { id: string };
  [key: string]: unknown;
}
