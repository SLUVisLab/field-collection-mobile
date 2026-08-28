import { NoteRuntimeValue } from '../lib/codecs/NoteCodec.ts';
import { InputControlDefinition } from '../parse/body/control/InputControlDefinition.ts';
import { LeafNodeDefinition } from '../parse/model/LeafNodeDefinition.ts';
import { BaseValueNode, BaseValueNodeState } from './BaseValueNode.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { NodeAppearances } from './NodeAppearances.ts';
import { RootNode } from './RootNode.ts';
import { TextRange } from './TextRange.ts';
import { LeafNodeValidationState } from './validation.ts';
import { ValueType } from './ValueType.ts';
export type NoteValue<V extends ValueType> = NoteRuntimeValue<V>;
export interface NoteNodeState<V extends ValueType> extends BaseValueNodeState<NoteValue<V>> {
    /**
     * Note-specific specialization: a note will always have a non-null value in
     * at least one of:
     *
     * - {@link label}
     * - {@link hint}
     *
     * This is an alias to whichever is present, with precedent to {@link label}
     * if both are present.
     */
    get noteText(): NonNullable<this['label'] | this['hint']>;
    /**
     * A note will **always** be `readonly`.
     */
    readonly readonly: true;
    get label(): TextRange<'label'> | null;
    get hint(): TextRange<'hint'> | null;
    get children(): null;
    get valueOptions(): null;
    /**
     * Reflects the readonly value of a {@link NoteNode}, or `null` if blank.
     */
    get value(): NoteValue<V>;
}
export interface NoteDefinition<V extends ValueType = ValueType> extends LeafNodeDefinition<V> {
    readonly bodyElement: InputControlDefinition;
}
export type NoteNodeAppearances = NodeAppearances<NoteDefinition>;
/**
 * A node which is:
 *
 * - associated with an input, with at least one text element (label or hint)
 * - guaranteed to be {@link NoteNodeState.readonly | readonly}
 */
export interface NoteNode<V extends ValueType = ValueType> extends BaseValueNode<V, NoteValue<V>> {
    readonly nodeType: 'note';
    readonly appearances: NoteNodeAppearances;
    readonly nodeOptions: null;
    readonly definition: NoteDefinition<V>;
    readonly root: RootNode;
    readonly parent: GeneralParentNode;
    readonly currentState: NoteNodeState<V>;
    readonly validationState: LeafNodeValidationState;
}
export type StringNoteValue = NoteValue<'string'>;
export type IntNoteValue = NoteValue<'int'>;
export type DecimalNoteValue = NoteValue<'decimal'>;
export type DateNoteValue = NoteValue<'date'>;
export type TimeNoteValue = NoteValue<'time'>;
export type GeopointNoteValue = NoteValue<'geopoint'>;
export type GeoshapeNoteValue = NoteValue<'geoshape'>;
export type GeotraceNoteValue = NoteValue<'geotrace'>;
export type StringNoteNode = NoteNode<'string'>;
export type IntNoteNode = NoteNode<'int'>;
export type DecimalNoteNode = NoteNode<'decimal'>;
export type DateNoteNode = NoteNode<'date'>;
export type TimeNoteNode = NoteNode<'time'>;
export type GeopointNoteNode = NoteNode<'geopoint'>;
export type GeoshapeNoteNode = NoteNode<'geoshape'>;
export type GeotraceNoteNode = NoteNode<'geotrace'>;
type SupportedNoteValueType = 'string' | 'int' | 'decimal' | 'date' | 'time' | 'geopoint' | 'geoshape' | 'geotrace';
type TemporaryStringValueType = Exclude<ValueType, SupportedNoteValueType>;
export type TemporaryStringValueNoteNode = NoteNode<TemporaryStringValueType>;
export type AnyNoteNode = StringNoteNode | IntNoteNode | DecimalNoteNode | DateNoteNode | TimeNoteNode | GeopointNoteNode | GeoshapeNoteNode | GeotraceNoteNode | TemporaryStringValueNoteNode;
export {};
