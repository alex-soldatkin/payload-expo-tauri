/**
 * Converts RxDB Mango query selectors to SQL WHERE clauses.
 *
 * Handles common operators natively in SQL for indexed, efficient queries.
 * Falls back gracefully for complex operators ($regex, $elemMatch, etc.)
 * by flagging the result so the caller can apply a JS post-filter.
 */
export type SQLWhereResult = {
    /** SQL WHERE clause (without the "WHERE" keyword). Empty string = no conditions. */
    where: string;
    /** Positional parameters for the WHERE clause placeholders. */
    params: SQLParam[];
    /** When true the SQL result is a superset — caller must JS-filter the rows. */
    needsPostFilter: boolean;
};
export type SQLParam = string | number | null;
/**
 * Map a Mango field path to its SQL column expression.
 *
 * Dedicated columns are used for the primary key and RxDB meta-fields so
 * that the SQLite query planner can use their indexes.  Everything else
 * goes through `json_extract(data, '$.field')`.
 */
export declare function fieldToSQL(field: string, primaryPath: string): string;
/**
 * Recursively convert a Mango selector object into a SQL WHERE clause.
 */
export declare function mangoSelectorToSQL(selector: Record<string, unknown>, primaryPath: string): SQLWhereResult;
/**
 * Convert a Mango sort array to a SQL ORDER BY clause (without the keyword).
 */
export declare function mangoSortToSQL(sort: Array<Record<string, 'asc' | 'desc'>>, primaryPath: string): string;
