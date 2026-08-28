import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { FormInstanceInitializationMode } from '../client/form/FormInstance.ts';
import { ActiveLanguage, FormLanguage, FormLanguages } from '../client/FormLanguage.ts';
import { FormNodeID } from '../client/identity.ts';
import { InstancePayload } from '../client/serialization/InstancePayload.ts';
import { InstancePayloadOptions, InstancePayloadType } from '../client/serialization/InstancePayloadOptions.ts';
import { InstanceState } from '../client/serialization/InstanceState.ts';
import { AncestorNodeValidationState } from '../client/validation.ts';
import { XFormsXPathDocument } from '../integration/xpath/adapter/XFormsXPathNode.ts';
import { EngineXPathEvaluator } from '../integration/xpath/EngineXPathEvaluator.ts';
import { StaticDocument } from '../integration/xpath/static-dom/StaticDocument.ts';
import { AttributeState } from '../lib/reactivity/createAttributeState.ts';
import { MaterializedChildren } from '../lib/reactivity/materializeCurrentStateChildren.ts';
import { CurrentState } from '../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../lib/reactivity/node-state/createSharedNodeState.ts';
import { ReactiveScope } from '../lib/reactivity/scope.ts';
import { BodyClassList } from '../parse/body/BodyDefinition.ts';
import { ModelDefinition } from '../parse/model/ModelDefinition.ts';
import { RootDefinition } from '../parse/model/RootDefinition.ts';
import { FetchFormAttachment } from '../client/resources.ts';
import { SecondaryInstancesDefinition } from '../parse/model/SecondaryInstance/SecondaryInstancesDefinition.ts';
import { InstanceNode } from './abstract/InstanceNode.ts';
import { InstanceAttachmentsState } from './attachments/InstanceAttachmentsState.ts';
import { Attribute } from './Attribute.ts';
import { InitialInstanceState } from './input/InitialInstanceState.ts';
import { EvaluationContext } from './internal-api/EvaluationContext.ts';
import { InstanceConfig } from './internal-api/InstanceConfig.ts';
import { PrimaryInstanceDocument } from './internal-api/PrimaryInstanceDocument.ts';
import { ClientReactiveSerializableInstance } from './internal-api/serialization/ClientReactiveSerializableInstance.ts';
import { TranslationContext } from './internal-api/TranslationContext.ts';
import { Root } from './Root.ts';
interface PrimaryInstanceStateSpec {
    readonly reference: string;
    readonly readonly: boolean;
    readonly relevant: boolean;
    readonly required: boolean;
    readonly label: null;
    readonly hint: null;
    readonly children: Accessor<readonly FormNodeID[]>;
    readonly attributes: Accessor<readonly Attribute[]>;
    readonly valueOptions: null;
    readonly value: null;
    readonly activeLanguage: Accessor<ActiveLanguage>;
}
interface PrimaryInstanceStateInputByMode {
    readonly create: null;
    readonly reset: null;
    readonly edit: InitialInstanceState;
    readonly restore: InitialInstanceState;
}
export type PrimaryInstanceInitialState<Mode extends FormInstanceInitializationMode> = PrimaryInstanceStateInputByMode[Mode];
export interface BasePrimaryInstanceOptions {
    scope: ReactiveScope;
    readonly model: ModelDefinition;
    readonly secondaryInstances: SecondaryInstancesDefinition;
    readonly fetchFormAttachment: FetchFormAttachment;
}
export interface ModelessPrimaryInstanceOptions extends BasePrimaryInstanceOptions {
    readonly config: InstanceConfig;
}
export interface PrimaryInstanceOptions<Mode extends FormInstanceInitializationMode> extends ModelessPrimaryInstanceOptions {
    readonly mode: Mode;
    readonly initialState: PrimaryInstanceInitialState<Mode>;
}
export declare class PrimaryInstance<Mode extends FormInstanceInitializationMode = FormInstanceInitializationMode> extends InstanceNode<RootDefinition, PrimaryInstanceStateSpec, null, Root> implements PrimaryInstanceDocument, XFormsXPathDocument, TranslationContext, EvaluationContext, ClientReactiveSerializableInstance {
    readonly initializationMode: FormInstanceInitializationMode;
    readonly model: ModelDefinition;
    readonly attachments: InstanceAttachmentsState;
    protected readonly state: SharedNodeState<PrimaryInstanceStateSpec>;
    protected readonly engineState: EngineState<PrimaryInstanceStateSpec>;
    readonly attributeState: AttributeState;
    readonly instanceNode: StaticDocument;
    readonly getChildren: Accessor<readonly Root[]>;
    readonly hasReadonlyAncestor: () => boolean;
    readonly isReadonly: () => boolean;
    readonly hasNonRelevantAncestor: () => boolean;
    readonly isRelevant: () => boolean;
    readonly hasRelevantBodyNodes: Accessor<boolean>;
    private geolocationProvider;
    private readonly setActiveLanguage;
    readonly [XPathNodeKindKey] = "document";
    readonly nodeType = "primary-instance";
    readonly appearances: null;
    readonly nodeOptions: null;
    readonly classes: BodyClassList;
    readonly root: Root;
    readonly currentState: MaterializedChildren<CurrentState<PrimaryInstanceStateSpec>, Root>;
    readonly validationState: AncestorNodeValidationState;
    readonly instanceState: InstanceState;
    readonly languages: FormLanguages;
    readonly getActiveLanguage: Accessor<ActiveLanguage>;
    readonly isAttached: Accessor<boolean>;
    readonly evaluator: EngineXPathEvaluator;
    readonly contextNode: this;
    constructor(options: PrimaryInstanceOptions<Mode>);
    getAttributes(): readonly Attribute[];
    /**
     * @todo Note that this method's signature is intentionally derived from
     * {@link RootNode.setLanguage}, but its return type differs! The design
     * intent of returning {@link RootNode} from all of the client-facing state
     * setter methods has proven… interesting philosophically. But nothing
     * downstream has availed itself of that philosophy, and otherwise it's not
     * particularly pragmatic or ergonomic (internally or for clients alike).
     *
     * Since this class is (currently) engine-internal, this seems like an
     * excellent place to start a discussion around what we want longer term for
     * state setter signatures in _client-facing_ APIs. As a first pass, it seems
     * reasonable to borrow the idiomatic convention of returning the effective
     * value assigned by the setter.
     *
     * @see
     * {@link https://github.com/getodk/web-forms/issues/45#issuecomment-1967932261 | Initial read interface design between engine and UI - design summary comment}
     * (and some of the comments leading up to it) for background on the
     * philosophical reasoning behind the existing signature convention.
     */
    setLanguage(language: FormLanguage): FormLanguage;
    prepareInstancePayload<PayloadType extends InstancePayloadType = 'monolithic'>(options?: InstancePayloadOptions<PayloadType>): Promise<InstancePayload<PayloadType>>;
    getBackgroundGeopoint(): Promise<string>;
}
export {};
