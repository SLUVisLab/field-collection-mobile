import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { QualifiedName } from '../../lib/names/QualifiedName.ts';
import { AttributeDefinition } from './AttributeDefinition.ts';
import { ModelDefinition } from './ModelDefinition.ts';
/**
 * @todo There's a **much more expansive** general case just waiting for a good
 * opportuntity to prioritize it. E.g. a `NamedNodeMap<T>`, where T is any
 * generalized concept of a named node. This expansive generalization would have
 * a ton of value in a variety of known performance optimization
 * targets/solutions (i.e. optimizing the most redundant, suboptimal, frequently
 * performed aspects of any typical XPath expression in a typical XForm).
 *
 * @see {@link QualifiedName} for more detail.
 */
export declare class AttributeDefinitionMap extends Map<QualifiedName, AttributeDefinition> {
    static from(model: ModelDefinition, instanceNode: StaticElement): AttributeDefinitionMap;
    private constructor();
}
