import { XFormDefinition } from '../../XFormDefinition.ts';
import { RangeAppearanceDefinition } from '../appearance/rangeAppearanceParser.ts';
import { BodyElementParentContext } from '../BodyDefinition.ts';
import { ControlDefinition } from './ControlDefinition.ts';
type NumericString = `${number}`;
/**
 * Per
 * {@link https://getodk.github.io/xforms-spec/#body-elements | ODK XForms spec},
 * the following attributes are required:
 *
 * - `start`
 * - `end`
 * - `step`
 *
 * While we also know that a `<range>` control is expected to have a bind type
 * of either `decimal` or `int`, at this parsing stage we do not yet know which
 * type is associated with the control. So we parse the attributes as strings,
 * checking only that they appear to be numeric values. We also preserve the
 * attributes' names here, for consistency with the spec.
 *
 * Downstream, we parse these to their appropriate numeric runtime types.
 */
export declare class RangeControlBoundsDefinition {
    readonly start: NumericString;
    readonly end: NumericString;
    readonly step: NumericString;
    static from(element: Element): RangeControlBoundsDefinition;
    constructor(start: NumericString, end: NumericString, step: NumericString);
}
export declare class RangeControlDefinition extends ControlDefinition<'range'> {
    static isCompatible(localName: string): boolean;
    readonly type = "range";
    readonly appearances: RangeAppearanceDefinition;
    readonly bounds: RangeControlBoundsDefinition;
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
    toJSON(): object;
}
export {};
