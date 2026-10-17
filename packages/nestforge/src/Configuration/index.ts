export interface IOTPConfiguration {
	email: boolean;
	sms: boolean;
	mfa: boolean;
}

export interface IAuthConfiguration {
	driver: string;
	url: string;
	client_id?: string;
	client_secret: string;
	service_role_key?: string;
	client_role?: string;
	otp?: IOTPConfiguration;
}

export interface ICookieConfiguration {
	name: string;
	refresh_token?: string;
	path?: string;
	httpOnly: boolean;
	secure: boolean;
	sameSite?: 'lax' | 'strict' | 'none';
	maxAge: number;
}

export interface IPagingConfiguration {
	page: number;
	size: number;
}

export interface IApplicationConfiguration {
	name?: string;
	host?: string;
	terms?: string;
	privacy?: string;
	environment: string;
	session_timeout: number;
	jwt_secret?: string;
	jwks?: string;
	cookie: ICookieConfiguration;
	paging?: IPagingConfiguration;
}

export interface ICacheServerConfiguration {
	enabled: boolean;
	driver: string;
	url: string;
	token: string;
	maxSize?: number;
	expiration: number;
}

export interface IStorageConfiguration {
	enabled: boolean;
	driver: string;
	url: string;
	bucket?: string;
	client_secret?: string;
	signed_url_expiration?: number;
}

export interface IDatabaseConfiguration {
	driver?: string;
	dialect?: string;
	name?: string;
	host?: string;
	port?: number;
	username?: string;
	password?: string;
	database?: string;
	url?: string;
	ssl?: boolean;
	max?: number;
	idleTimeoutMillis?: number;
	connectionTimeoutMillis?: number;
	maxUses?: number;
	pool?: boolean;
}

export interface IMailerCredential {
	key: string;
	password: string;
}

export interface IMailerConfiguration {
	enabled?: boolean;
	host: string;
	port: number;
	from?: string;
	cc?: string;
	credentials?: IMailerCredential;
}

// Build your own concrete schema/provider per project (e.g. with zod) — this
// just gives consumers a typed shape to target so DI tokens stay consistent
// across apps.
export interface IConfigurationProvider<T = any> {
	get<K extends keyof T>(key: K): T[K];
	load(...files: string[]): void;
	validate(): void;
}
