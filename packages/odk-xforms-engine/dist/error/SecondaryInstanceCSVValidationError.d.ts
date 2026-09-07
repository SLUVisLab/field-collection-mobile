import { JRResourceURL } from '../../../common/src/jr-resources/JRResourceURL';
import { ErrorProductionDesignPendingError } from './ErrorProductionDesignPendingError';
export declare class CSVExternalSecondaryInstanceValidationError extends ErrorProductionDesignPendingError {
    constructor(resourceURL: JRResourceURL, rowIndex: number | null, columnIndex: number | null, message: string);
}
