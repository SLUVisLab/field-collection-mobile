import { ExpandUnion } from '../../../common/types/helpers.js';
import { BindType } from '../parse/model/BindTypeDefinition.ts';
export type ValueType = ExpandUnion<BindType>;
