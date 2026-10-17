import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import ApiException from '../Exceptions/ApiException';
import ValidationException from '../Exceptions/ValidationException';

/**
 * Maps nestforge's ApiException family and Nest's HttpException to one JSON shape:
 * `{ success: false, statusCode, message, errors? }`.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost) {
		const res = host.switchToHttp().getResponse();
		let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
		let message = 'Internal server error';
		let errors: unknown;

		if (exception instanceof ApiException) {
			statusCode = exception.getCode();
			message = exception.getMessage();
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

		res.status(statusCode).json({ success: false, statusCode, message, ...(errors ? { errors } : {}) });
	}
}
