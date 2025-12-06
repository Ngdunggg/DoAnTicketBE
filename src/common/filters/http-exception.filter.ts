import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { createErrorResponse } from '@common/utils/response.util';
import { RESULT_CODE, RESULT_CODE_TYPE } from '@/shared/constants/constants';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        let message = 'An error occurred';

        if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
            const responseObj = exceptionResponse as { message?: string | string[] };
            if (responseObj.message) {
                if (Array.isArray(responseObj.message)) {
                    message = responseObj.message[0];
                } else {
                    message = responseObj.message;
                }
            }
        } else if (typeof exceptionResponse === 'string') {
            message = exceptionResponse;
        }

        // Map HTTP status to error codes
        const errorCode = this.mapStatusToErrorCode(status);

        const errorResponse = createErrorResponse(message, errorCode);

        response.status(status).json(errorResponse);
    }

    private mapStatusToErrorCode(status: number): RESULT_CODE_TYPE {
        switch (status) {
            case 400: // HttpStatus.BAD_REQUEST
                return RESULT_CODE.ERROR;
            case 401: // HttpStatus.UNAUTHORIZED
                return RESULT_CODE.UNAUTHORIZED;
            case 403: // HttpStatus.FORBIDDEN
                return RESULT_CODE.FORBIDDEN;
            case 404: // HttpStatus.NOT_FOUND
                return RESULT_CODE.NOT_FOUND;
            case 429: // HttpStatus.TOO_MANY_REQUESTS
                return RESULT_CODE.ERROR; // Rate limit error
            case 500: // HttpStatus.INTERNAL_SERVER_ERROR
                return RESULT_CODE.INTERNAL_SERVER_ERROR;
            default:
                return RESULT_CODE.ERROR;
        }
    }
}
