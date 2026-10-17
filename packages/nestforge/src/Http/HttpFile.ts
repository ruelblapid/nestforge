/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */

export interface HttpFile {
	fieldName: string;
	originalName: string;
	mimeType: string;
	size: number;
	buffer?: Buffer;
	stream?: ReadableStream;
}
