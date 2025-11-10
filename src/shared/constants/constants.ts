export const OTP_VERIFIED = 'VERIFIED';

export const RESULT_CODE = {
    SUCCESS: 'success',
    ERROR: 'error',
    UNAUTHORIZED: 'unauthorized',
    FORBIDDEN: 'forbidden',
    NOT_FOUND: 'not_found',
    INTERNAL_SERVER_ERROR: 'internal_server_error',
};
export type RESULT_CODE_TYPE = (typeof RESULT_CODE)[keyof typeof RESULT_CODE];
