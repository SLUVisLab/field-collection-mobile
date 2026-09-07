import { Attribute } from '../Attribute';
import { AnyNode } from '../hierarchy.ts';
import { InputControl } from '../InputControl.ts';
import { ModelValue } from '../ModelValue.ts';
import { Note } from '../Note.ts';
import { RangeControl } from '../RangeControl.ts';
type AttributeOwner = AnyNode | InputControl<any> | ModelValue<any> | Note<any> | RangeControl<any>;
export declare function buildAttributes(owner: AttributeOwner): Attribute[];
export {};
