import ApiException from './ApiException';

export default class TokenExpiredException extends ApiException {
	constructor() {
		super('The token has expired', 406);
	}
}
