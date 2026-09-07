export type RepeatRangeNodeType = 'repeat-range:controlled' | 'repeat-range:uncontrolled';
export type LeafNodeType = 'model-value' | 'note' | 'select' | 'input' | 'trigger' | 'range' | 'rank' | 'attribute' | 'upload';
export type InstanceNodeType = 'root' | RepeatRangeNodeType | 'repeat-instance' | 'group' | LeafNodeType;
