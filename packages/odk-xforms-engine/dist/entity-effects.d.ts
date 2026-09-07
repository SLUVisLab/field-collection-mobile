export type EntityEffectAction = 'create' | 'update';

export interface EntityEffect {
  reference: string | null;
  dataset: string | null;
  action: EntityEffectAction;
  entityId: string | null;
  label: string | null;
  properties: Record<string, string | null>;
  baseVersion: string | null;
  trunkVersion: string | null;
  branchId: string | null;
}

export declare const resolveEntityEffects: (root: object) => EntityEffect[];
