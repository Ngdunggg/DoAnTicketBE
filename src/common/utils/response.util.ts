import { RESULT_CODE } from '@/shared/constants/constants';
import { BaseHttpResponse, BasicResult } from '@common/types/api-response.types';

/**
 * Creates a success response with data
 */
export function createSuccessResponse<T>(data: T, code = RESULT_CODE.SUCCESS): BaseHttpResponse<T> {
    const result: BasicResult = {
        code,
        error_msg_id: '',
        total_count: '',
    };

    return {
        data: data || ({} as T),
        result,
    };
}

/**
 * Creates an error response
 */
export function createErrorResponse(
    error_msg_id: string,
    code = RESULT_CODE.ERROR,
    data: unknown = {}
): BaseHttpResponse<unknown> {
    const result: BasicResult = {
        code,
        error_msg_id,
        total_count: '',
    };

    return {
        data: data || {},
        result,
    };
}
