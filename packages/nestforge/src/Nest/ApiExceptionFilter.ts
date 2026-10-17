import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import ApiException from '../Exceptions/ApiException';
import ValidationException from '../Exceptions/ValidationException';

/** What the filter learned about a failure. `exception` is the original, for subclasses that need more. */
export interface ErrorInfo {
	statusCode: number;
	message: string;
	errors?: unknown;
	errorCode?: string;
	details?: Record<string, unknown>;
	exception: unknown;
}

/**
 * Maps nestforge's ApiException family and Nest's HttpException to one JSON shape:
 * `{ success: false, statusCode, message, errorCode?, details?, errors? }`.
 *
 * Apps that must keep a different wire format extend this and override `body()`:
 *
 *   class MyFilter extends ApiExceptionFilter {
 *     protected body(e: ErrorInfo) { return { code: e.errorCode, message: e.message }; }
 *   }
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger('ApiExceptionFilter');

	catch(exception: unknown, host: ArgumentsHost) {
		const res = host.switchToHttp().getResponse();
		const info = this.describe(exception);
		if (info.statusCode >= 500) {
			// Everything unexpected would otherwise vanish behind a generic 500.
			this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
		}
		res.status(info.statusCode).json(this.body(info));
	}

	/** The JSON written to the client. Override to change the wire format. */
	protected body(info: ErrorInfo): unknown {
		const { statusCode, message, errorCode, details, errors } = info;
		return {
			success: false,
			statusCode,
			message,
			...(errorCode ? { errorCode } : {}),
			...(details ? { details } : {}),
			...(errors ? { errors } : {}),
		};
	}

	private describe(exception: unknown): ErrorInfo {
		let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
		let message = 'Internal server error';
		let errors: unknown;
		let errorCode: string | undefined;
		let details: Record<string, unknown> | undefined;

		if (exception instanceof ApiException) {
			statusCode = exception.getCode();
			message = exception.getMessage();
			errorCode = exception.getErrorCode();
			details = exception.getDetails();
			if (exception instanceof ValidationException) errors = (exception as any).errors;
		} else if (exception instanceof HttpException) {
			statusCode = exception.getStatus();
			const body = exception.getResponse();
			if (typeof body === 'string') message = body;
			else {
				const b = body as Record<string, any>;
				message = Array.isArray(b.message) ? b.message.join(', ') : (b.message ?? exception.message);
				errors = b.errors;
			}
		}
		return { statusCode, message, errors, errorCode, details, exception };
	}
}
