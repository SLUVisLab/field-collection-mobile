import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { NamespaceDeclarationMap } from '../../lib/names/NamespaceDeclarationMap.ts';
import { QualifiedName } from '../../lib/names/QualifiedName.ts';
import { RepeatElementDefinition } from '../body/RepeatElementDefinition.ts';
import { RepeatCountControlExpression } from '../expression/RepeatCountControlExpression.ts';
import { AttributeDefinitionMap } from './AttributeDefinitionMap.ts';
import { BindDefinition } from './BindDefinition.ts';
import { DescendentNodeDefinition } from './DescendentNodeDefinition.ts';
import { ModelDefinition } from './ModelDefinition.ts';
import { ChildNodeDefinition, ParentNodeDefinition } from './NodeDefinition.ts';
export type RepeatInstanceNodes = readonly [StaticElement, ...StaticElement[]];
export interface ControlledRepeatDefinition extends RepeatDefinition {
    readonly count: RepeatCountControlExpression;
}
export interface UncontrolledRepeatDefinition extends RepeatDefinition {
    readonly count: null;
}
/**
 * Represents a definition of the combined concepts colloquially called a
 * "repeat", as defined by a form, where those concepts include:
 *
 * - A {@link RepeatElementDefinition}—corresponding to a `<repeat>` {@link https://getodk.github.io/xforms-spec/#body-elements | body element}—which is associated with the nodeset referencing the "repeat template" and
 *   all "repeat instances" (see below points describing both concepts in more detail). The presence of such a body element determines whether to produce a repeat definition (rather than e.g. a {@link GroupDefinition}).
 *
 * - A "repeat template", defined by a form either
 *   explicitly,
 *   or derived from the structure of the first form-defined "repeat instance"
 *   (as described in the next point).
 *
 * - A sequence of one or more model instance nodes, each representing a "repeat instance"
 *   defined by the form. These nodes contribute to the definition in the following ways:
 *
 *   - If an explicit "repeat template" is not defined for
 *   the "repeat", one is derived from the **structure** (but not the values!)
 *   of the first such model instance node.
 *
 *   - If the "repeat" is {@link ControlledRepeatDefinition | controlled} (i.e. by either a `jr:count` or `jr:noAddRemove` {@link https://getodk.github.io/xforms-spec/#body-attributes | attribute} on the associated {@link RepeatElementDefinition}
 *
 * (For construction of this
 * definition, all other referenced instance nodes are **consumed** in the
 * process of building the repeat definition's subtree of a
 * {@link RootDefinition}, ensuring that one repeat definition is produced for
 * all applicable nodes; they are later referenced for construction of a
 * form's {@link PrimaryInstance | instance state}.)
 *
 * Combined, these concepts produce the details required to instantiate the
 * {@link RepeatRange} and {@link RepeatInstance} instance state nodes
 * associated with a defined repeat.
 */
export declare class RepeatDefinition extends DescendentNodeDefinition<'repeat', RepeatElementDefinition> {
    readonly model: ModelDefinition;
    static from(model: ModelDefinition, parent: ParentNodeDefinition, bind: BindDefinition, bodyElement: RepeatElementDefinition, instanceNodes: RepeatInstanceNodes): AnyRepeatDefinition;
    readonly type = "repeat";
    readonly children: readonly ChildNodeDefinition[];
    readonly count: RepeatCountControlExpression | null;
    readonly template: StaticElement;
    readonly namespaceDeclarations: NamespaceDeclarationMap;
    readonly qualifiedName: QualifiedName;
    readonly attributes: AttributeDefinitionMap;
    private constructor();
    isControlled(): this is ControlledRepeatDefinition;
    isUncontrolled(): this is UncontrolledRepeatDefinition;
    omitTemplate(instanceNodes: readonly StaticElement[]): readonly StaticElement[];
    toJSON(): object;
}
export type AnyRepeatDefinition = ControlledRepeatDefinition | UncontrolledRepeatDefinition;
