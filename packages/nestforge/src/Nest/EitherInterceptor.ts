import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import ApiException from '../Exceptions/ApiException';
import { Either } from '../UseCase/Either';

/**
 * Lets controllers return `Either<DataError, T>` directly: Right is unwrapped,
 * Left is thrown as an ApiException (handled by ApiExceptionFilter).
 */
@Injectable()
export class EitherInterceptor implements NestInterceptor {
	intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next.handle().pipe(
			map((value) => {
				if (!(value instanceof Either)) return value;
				return value.fold(
					(err: any) => {
						throw new ApiException(err?.message ?? 'Request failed', err?.code ?? 400);
					},
					(ok) => ok,
				);
			}),
		);
	}
}
