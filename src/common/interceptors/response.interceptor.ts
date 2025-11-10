import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseHttpResponse, BasicResult } from '@common/types/api-response.types';
import { RESULT_CODE } from '@/shared/constants/constants';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, BaseHttpResponse<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<BaseHttpResponse<T>> {
        return next.handle().pipe(
            map((data) => {
                const result: BasicResult = {
                    code: RESULT_CODE.SUCCESS,
                    error_msg_id: '',
                    total_count: '',
                };

                return {
                    data: (data as T) || ({} as T),
                    result,
                };
            })
        );
    }
}
