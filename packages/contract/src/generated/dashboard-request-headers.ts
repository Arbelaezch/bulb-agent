/* Generated from src/schemas/dashboard-request-headers.schema.json by `npm run generate`. Do not edit by hand. */

/**
 * Headers every dashboard API request must carry. Header names are lower-case (as Node delivers them); other headers are allowed.
 */
export interface DashboardRequestHeaders {
  /**
   * `Bearer <token>`: the case-sensitive scheme `Bearer`, one space, then an RFC 6750 token. The token is a secret: it must never be logged, recorded or echoed in an error.
   */
  authorization: string;
  [k: string]: unknown;
}
