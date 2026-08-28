import { INSTANCE_FILE_NAME, INSTANCE_FILE_TYPE } from '../constants.ts';
export type { INSTANCE_FILE_NAME, INSTANCE_FILE_TYPE };
export interface InstanceFile extends File {
    readonly name: INSTANCE_FILE_NAME;
    readonly type: INSTANCE_FILE_TYPE;
}
