import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        // 如果 controller 已返回 { code, data } 格式，直接透传
        if (data && typeof data === 'object' && 'code' in data) {
          return data;
        }
        return { code: 0, data };
      }),
    );
  }
}
