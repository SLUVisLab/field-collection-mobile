import { RuntimeInputValue, RuntimeValue } from '../lib/codecs/getSharedValueCodec.ts';
import { InputControlDefinition } from '../parse/body/control/InputControlDefinition.ts';
import { LeafNodeDefinition } from '../parse/model/LeafNodeDefinition.ts';
import { BaseValueNode, BaseValueNodeState } from './BaseValueNode.ts';
import { NodeAppearances } from './NodeAppearances.ts';
import { RootNode } from './RootNode.ts';
import { ValueType } from './ValueType.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { LeafNodeValidationState } from './validation.ts';
export type InputValue<V extends ValueType> = RuntimeValue<V>;
export type InputNodeInputValue<V extends ValueType> = RuntimeInputValue<V>;
export interface InputNodeState<V extends ValueType> extends BaseValueNodeState<InputValue<V>> {
    get children(): null;
    get valueOptions(): null;
    /**
     * Reflects the current value of a {@link InputNode}. This value may be
     * populated when a form is loaded, and it may be updated by certain
     * computations defined by the form. It may also be updated by a client, using
     * the {@link InputNode.setValue} method.
     */
    get value(): InputValue<V>;
}
export interface InputDefinition<V extends ValueType = ValueType> extends LeafNodeDefinition<V> {
    readonly bodyElement: InputControlDefinition;
}
export type InputNodeAppearances = NodeAppearances<InputDefinition>;
interface StringInputNodeOptions {
    readonly rows: number | null;
}
interface GeoInputNodeOptions {
    readonly accuracyThreshold: number | null;
    readonly unacceptableAccuracyThreshold: number | null;
}
interface InputNodeOptionsByValueType {
    readonly string: StringInputNodeOptions;
    readonly int: null;
    readonly boolean: null;
    readonly decimal: null;
    readonly date: null;
    readonly time: null;
    readonly dateTime: null;
    readonly geopoint: GeoInputNodeOptions;
    readonly geotrace: null;
    readonly geoshape: null;
    readonly binary: null;
    readonly barcode: null;
    readonly intent: null;
}
export type InputNodeOptions<V extends ValueType> = InputNodeOptionsByValueType[V];
/**
 * A node corresponding to form field defined as an
 * {@link https://getodk.github.io/xforms-spec/#body-elements | XForms `<input>`},
 * which a user-facing client would likely present for a user to fill.
 */
export interface InputNode<V extends ValueType = ValueType> extends BaseValueNode<V, InputValue<V>> {
    readonly nodeType: 'input';
    readonly valueType: V;
    readonly appearances: InputNodeAppearances;
    readonly nodeOptions: InputNodeOptions<V>;
    readonly definition: InputDefinition<V>;
    readonly root: RootNode;
    readonly parent: GeneralParentNode;
    readonly currentState: InputNodeState<V>;
    readonly validationState: LeafNodeValidationState;
    /**
     * For use by a client to update the value of an {@link InputNode}.
     */
    setValue(value: InputNodeInputValue<V>): RootNode;
}
export type StringInputValue = InputValue<'string'>;
export type IntInputValue = InputValue<'int'>;
export type DecimalInputValue = InputValue<'decimal'>;
export type DateInputValue = InputValue<'date'>;
export type TimeInputValue = InputValue<'time'>;
export type GeopointInputValue = InputValue<'geopoint'>;
export type GeoshapeInputValue = InputValue<'geoshape'>;
export type GeotraceInputValue = InputValue<'geotrace'>;
export type StringInputNode = InputNode<'string'>;
export type IntInputNode = InputNode<'int'>;
export type DecimalInputNode = InputNode<'decimal'>;
export type DateInputNode = InputNode<'date'>;
export type TimeInputNode = InputNode<'time'>;
export type DateTimeInputNode = InputNode<'dateTime'>;
export type GeopointInputNode = InputNode<'geopoint'>;
export type GeoshapeInputNode = InputNode<'geoshape'>;
export type GeotraceInputNode = InputNode<'geotrace'>;
type SupportedInputValueType = 'string' | 'int' | 'decimal' | 'date' | 'time' | 'dateTime' | 'geopoint' | 'geoshape' | 'geotrace';
type TemporaryStringValueType = Exclude<ValueType, SupportedInputValueType>;
export type TemporaryStringValueInputNode = InputNode<TemporaryStringValueType>;
export type AnyInputNode = StringInputNode | IntInputNode | DecimalInputNode | DateInputNode | TimeInputNode | DateTimeInputNode | GeopointInputNode | GeoshapeInputNode | GeotraceInputNode | TemporaryStringValueInputNode;
export {};
