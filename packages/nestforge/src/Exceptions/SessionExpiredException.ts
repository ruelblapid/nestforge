import ApiException from './ApiException';

export default class SessionExpiredException extends ApiException {
	constructor(
		message: string = 'You need to be logged in to view the page. Please sign in to your account to access this content.'
	) {
		super(message, 406);
	}
}
