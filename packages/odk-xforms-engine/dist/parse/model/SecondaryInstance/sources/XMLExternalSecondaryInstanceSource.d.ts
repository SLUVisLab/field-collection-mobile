import { SecondaryInstanceDefinition } from '../SecondaryInstancesDefinition.ts';
import { ExternalSecondaryInstanceSource } from './ExternalSecondaryInstanceSource.ts';
export declare class XMLExternalSecondaryInstanceSource extends ExternalSecondaryInstanceSource<'xml'> {
    /**
     * Note: this logic is a superset of the logic in
     * {@link InternalSecondaryInstanceSource.parseDefinition}. That subset is so
     * trivial/already sufficiently abstracted that it doesn't really make a lot
     * of sense to abstract further, but it might be worth considering if both
     * method implementations grow their responsibilities in the same ways.
     */
    parseDefinition(): SecondaryInstanceDefinition;
}
