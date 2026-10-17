import ApiException from './ApiException';

export default class UnAuthorizedException extends ApiException {
	constructor(message: string = 'Invalid or expired access token.') {
		super(message, 401);
	}
}
