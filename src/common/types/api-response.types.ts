/**
 * Represents a basic result.
 * This type is used to define the structure of a basic result object.
 */
export type BasicResult = {
    code?: string;
    error_msg_id?: string;
    total_count?: string;
};

/**
 * Represents the base HTTP response.
 *
 * @template Data - The type of the response data.
 */
export type BaseHttpResponse<Data = object | object[]> = {
    data: Data;
    result: BasicResult;
};

/**
 * Represents a type that converts the base HTTP response to a specific type.
 * @template T - The type of the data in the response.
 */
export type ConvertBaseHttpResponse<T> = Omit<BaseHttpResponse<T>, 'data' | 'result'> & {
    data: T;
    result: BasicResult;
};
