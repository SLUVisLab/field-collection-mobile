import { StaticElementOptions } from '../../../integration/xpath/static-dom/StaticElement.ts';
import { SecondaryInstanceDefinition } from './SecondaryInstancesDefinition.ts';
type SecondaryInstanceRoot = StaticElementOptions | '';
export declare const defineSecondaryInstance: (instanceId: string, secondaryInstanceRoot: SecondaryInstanceRoot) => SecondaryInstanceDefinition;
export {};
