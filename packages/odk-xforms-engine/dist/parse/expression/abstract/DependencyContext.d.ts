export declare abstract class DependencyContext {
    abstract get parentReference(): string | null;
    abstract get reference(): string | null;
    get isTranslated(): boolean;
    set isTranslated(value: true);
    protected _isTranslated: boolean;
}
