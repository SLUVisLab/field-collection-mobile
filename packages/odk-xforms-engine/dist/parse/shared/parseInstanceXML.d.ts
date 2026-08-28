import { StaticDocument } from '../../integration/xpath/static-dom/StaticDocument.ts';
import { ModelDefinition } from '../model/ModelDefinition.ts';
/**
 * Parses incoming instance XML input into a {@link StaticDocument}, preserving
 * the form definition's default namespace URI (when the instance XML does not
 * explicitly declare a default namespace).
 *
 * @todo This is a hack! A proper solution will involve extending namespace
 * resolution (i.e. probably {@link NamespaceDeclarationMap}) from
 * {@link RootDefinition} on down throughout the instance's {@link StaticNode}
 * tree. The same will probably be the case for parsing (XML) external secondary
 * instances as well, so at that point we can also stop using this specialized
 * name!
 *
 * @todo Aside from this being a hack, it's not very robust because it makes
 * assumptions which are _likely but definitely not guaranteed_!
 *
 * - Instance XML (probably) doesn't declare a default namespace
 * - Instance XML **definitely** declares non-default namespaces
 */
export declare const parseInstanceXML: (model: ModelDefinition, instanceXML: string) => StaticDocument;
