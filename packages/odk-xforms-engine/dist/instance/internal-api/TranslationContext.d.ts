import { Accessor } from 'solid-js';
import { ActiveLanguage } from '../../client/FormLanguage.ts';
export interface TranslationContext {
    readonly getActiveLanguage: Accessor<ActiveLanguage>;
}
