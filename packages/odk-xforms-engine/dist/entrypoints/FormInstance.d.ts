import { FormInstance as ClientFormInstance, FormInstanceInitializationMode } from '../client/form/FormInstance.ts';
import { FormInstanceConfig } from '../client/index.ts';
import { BasePrimaryInstanceOptions, PrimaryInstanceInitialState } from '../instance/PrimaryInstance.ts';
import { Root } from '../instance/Root.ts';
import { FormSuccessResult } from './FormResult/FormSuccessResult.ts';
import { FormWarningResult } from './FormResult/FormWarningResult.ts';
export type InstantiableFormResult = FormSuccessResult | FormWarningResult;
interface FormInstanceOptions<Mode extends FormInstanceInitializationMode> {
    readonly mode: Mode;
    readonly initialState: PrimaryInstanceInitialState<Mode>;
    readonly instanceOptions: BasePrimaryInstanceOptions;
    readonly instanceConfig: FormInstanceConfig;
}
export declare class FormInstance<Mode extends FormInstanceInitializationMode> implements ClientFormInstance<Mode> {
    readonly formResult: InstantiableFormResult;
    readonly mode: Mode;
    readonly root: Root;
    constructor(formResult: InstantiableFormResult, options: FormInstanceOptions<Mode>);
}
export {};
