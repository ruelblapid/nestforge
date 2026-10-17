/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
import { v4 as uuid } from 'uuid';
import { Identifier } from './Identifier';

export class UniqueEntityID extends Identifier<any> {
	constructor(id?: any) {
		super();
		this.value = id ? id : uuid();
	}
}
