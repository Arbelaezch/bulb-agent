/* Generated from src/schemas/dashboard-error.schema.json by `npm run generate`. Do not edit by hand. */

/**
 * Error body for every dashboard API endpoint, sent with a status >= 400.
 */
export interface DashboardError {
  /**
   * invalid_request: 400. unauthorized: 401. not_found: 404. method_not_allowed: 405. payload_too_large: 413. internal: 500.
   */
  error:
    | 'invalid_request'
    | 'unauthorized'
    | 'not_found'
    | 'method_not_allowed'
    | 'payload_too_large'
    | 'internal';
  /**
   * One-line, human-readable message. It never contains request values or credentials.
   */
  message: string;
  /**
   * Validation issues for an invalid request body, as reported by the contract parsers.
   *
   * @maxItems 50
   */
  issues?: {
    /**
     * Dot path to the offending key; "" means the root.
     */
    path: string;
    /**
     * What is wrong with the key; never contains request values.
     */
    message: string;
  }[];
}
