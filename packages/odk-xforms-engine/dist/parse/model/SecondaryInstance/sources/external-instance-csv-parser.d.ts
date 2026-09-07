import { JRResourceURL } from '../../../../../../common/src/jr-resources/JRResourceURL';
interface CSVExternalSecondaryInstanceItemColumn {
    readonly columnName: string;
    readonly cellValue: string;
}
type CSVExternalSecondaryInstanceItem = readonly CSVExternalSecondaryInstanceItemColumn[];
export declare const parseItems: (resourceURL: JRResourceURL, data: string) => readonly CSVExternalSecondaryInstanceItem[];
export {};
