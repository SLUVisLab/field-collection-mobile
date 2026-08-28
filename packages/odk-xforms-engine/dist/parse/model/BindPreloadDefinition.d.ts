import { PartiallyKnownString } from '../../../../common/types/string/PartiallyKnownString.ts';
import { AttributeContext } from '../../instance/internal-api/AttributeContext.ts';
import { InstanceValueContext } from '../../instance/internal-api/InstanceValueContext.ts';
import { BindDefinition } from './BindDefinition.ts';
import { BindElement } from './BindElement.ts';
import { XFormEvent } from './Event.ts';
type PartiallyKnownPreloadParameter<Known extends string> = PartiallyKnownString<NonNullable<Known>>;
interface PreloadParametersByType {
    readonly uid: string | null;
    readonly date: PartiallyKnownPreloadParameter<'today'>;
    readonly timestamp: PartiallyKnownPreloadParameter<'end' | 'start'>;
    readonly property: PartiallyKnownPreloadParameter<'deviceid' | 'email' | 'phonenumber' | 'username'>;
}
type PreloadType = PartiallyKnownString<keyof PreloadParametersByType>;
type PreloadParameter<Type extends PreloadType> = Type extends keyof PreloadParametersByType ? PreloadParametersByType[Type] : string | null;
interface PreloadInput<Type extends PreloadType> {
    readonly type: Type;
    readonly parameter: PreloadParameter<Type>;
}
/**
 * Parsed representation of
 * {@link https://getodk.github.io/xforms-spec/#preload-attributes | Preload Attributes}.
 * If specified on a
 * {@link https://getodk.github.io/xforms-spec/#bindings | binding}, this will
 * be parsed to define:
 *
 * - {@link type}, a `jr:preload`
 * - {@link parameter}, an associated `jr:preloadParams` value
 */
export declare class BindPreloadDefinition<Type extends PreloadType> implements PreloadInput<Type> {
    readonly type: Type;
    readonly parameter: PreloadParameter<Type>;
    readonly event: XFormEvent;
    static from(definition: BindDefinition, bindElement: BindElement): AnyBindPreloadDefinition | null;
    getValue(context: AttributeContext | InstanceValueContext): string | undefined;
    private constructor();
}
export type AnyBindPreloadDefinition = BindPreloadDefinition<'uid'> | BindPreloadDefinition<'timestamp'> | BindPreloadDefinition<'property'> | BindPreloadDefinition<string>;
export {};
