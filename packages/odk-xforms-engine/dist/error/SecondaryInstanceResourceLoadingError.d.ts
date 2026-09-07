import { JRResourceURL } from '../../../common/src/jr-resources/JRResourceURL';
import { ErrorProductionDesignPendingError } from './ErrorProductionDesignPendingError';
import { FetchResourceResponse } from '../client';
export declare class SecondaryInstanceResourceLoadingError extends ErrorProductionDesignPendingError {
    constructor(resourceURL: JRResourceURL, response: FetchResourceResponse);
}
