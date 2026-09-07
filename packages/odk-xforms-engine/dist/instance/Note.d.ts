import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { NoteNode, NoteNodeAppearances, NoteValue } from '../client/NoteNode.ts';
import { TextRange } from '../client/TextRange.ts';
import { ValueType } from '../client/ValueType.ts';
import { XFormsXPathElement } from '../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticLeafElement } from '../integration/xpath/static-dom/StaticElement.ts';
import { NoteInputValue, NoteRuntimeValue } from '../lib/codecs/NoteCodec.ts';
import { AttributeState } from '../lib/reactivity/createAttributeState.ts';
import { CurrentState } from '../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../lib/reactivity/node-state/createSharedNodeState.ts';
import { ComputedNoteText } from '../lib/reactivity/text/createNoteText.ts';
import { NoteNodeDefinition } from '../parse/model/NoteNodeDefinition.ts';
import { ValueNode, ValueNodeStateSpec } from './abstract/ValueNode.ts';
import { Attribute } from './Attribute.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { EvaluationContext } from './internal-api/EvaluationContext.ts';
import { ClientReactiveSerializableValueNode } from './internal-api/serialization/ClientReactiveSerializableValueNode.ts';
import { ValidationContext } from './internal-api/ValidationContext.ts';
interface NoteStateSpec<V extends ValueType> extends ValueNodeStateSpec<NoteValue<V>> {
    readonly readonly: Accessor<true>;
    readonly noteText: ComputedNoteText;
    readonly label: Accessor<TextRange<'label'> | null>;
    readonly hint: Accessor<TextRange<'hint'> | null>;
    readonly valueOptions: null;
}
export declare class Note<V extends ValueType = ValueType> extends ValueNode<V, NoteNodeDefinition<V>, NoteRuntimeValue<V>, NoteInputValue<V>> implements NoteNode, XFormsXPathElement, EvaluationContext, ValidationContext, ClientReactiveSerializableValueNode {
    readonly [XPathNodeKindKey] = "element";
    protected readonly state: SharedNodeState<NoteStateSpec<V>>;
    protected readonly engineState: EngineState<NoteStateSpec<V>>;
    readonly attributeState: AttributeState;
    readonly nodeType = "note";
    readonly appearances: NoteNodeAppearances;
    readonly nodeOptions: null;
    readonly currentState: CurrentState<NoteStateSpec<V>>;
    constructor(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: NoteNodeDefinition<V>);
    getAttributes(): readonly Attribute[];
}
export type AnyNote = Note<'barcode'> | Note<'binary'> | Note<'boolean'> | Note<'date'> | Note<'dateTime'> | Note<'decimal'> | Note<'geopoint'> | Note<'geoshape'> | Note<'geotrace'> | Note<'int'> | Note<'intent'> | Note<'string'> | Note<'time'>;
export {};
