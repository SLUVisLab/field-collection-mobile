import { StaticDocument } from '../../../integration/xpath/static-dom/StaticDocument.ts';
import { SecondaryInstanceDefinition } from './SecondaryInstancesDefinition.ts';
type AssertSecondaryInstanceDefinition = (doc: StaticDocument) => asserts doc is SecondaryInstanceDefinition;
export declare const assertSecondaryInstanceDefinition: AssertSecondaryInstanceDefinition;
export {};
