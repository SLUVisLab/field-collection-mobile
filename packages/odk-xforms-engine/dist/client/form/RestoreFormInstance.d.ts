import { InstanceData } from '../serialization/InstanceData.ts';
import { FormInstance, FormInstanceRestoreMode } from './FormInstance.ts';
import { FormInstanceConfig } from './FormInstanceConfig.ts';
export interface RestoreFormInstanceInput {
    readonly data: readonly [InstanceData, ...InstanceData[]];
}
export type RestoredFormInstance = FormInstance<FormInstanceRestoreMode>;
export type RestoreFormInstance = (input: RestoreFormInstanceInput, config?: FormInstanceConfig) => Promise<RestoredFormInstance>;
