/**
 * Copyright (C) RBL Solution 2026
 * All Rights Reserved.
 */
import { EnumValueObject } from '../../ValueObjects/EnumValueObject';
import { InvalidArgumentError } from '../../ValueObjects/InvalidArgumentError';

export enum Operator {
	EQUAL = '=',
	NOT_EQUAL = '!=',
	GT = '>',
	GTE = '>=',
	LT = '<',
	LTE = '<=',
	CONTAINS = 'ILIKE',
	NOT_CONTAINS = 'NOT ILIKE',
	BETWEEN = 'BETWEEN',
	OR = 'OR',
	IN = 'IN',
	NOT_IN = 'NOT IN',
	NAMED_EQ = 'eq',
	NAMED_NOT_EQ = 'not_eq',
	NAMED_GT = 'gt',
	NAMED_GTE = 'gte',
	NAMED_LT = 'lt',
	NAMED_LTE = 'lte',
	NAMED_CONTAINS = 'contains',
	NAMED_NOT_CONTAINS = 'not_contains',
	NAMED_BETWEEN = 'between',
	NAMED_OR = 'or',
	NAMED_IN = 'in',
	NAMED_NOT_IN = 'not_in',
}

export class FilterOperator extends EnumValueObject<Operator> {
	constructor(value: Operator) {
		super(value, Object.values(Operator));
	}

	static fromValue(value: string): FilterOperator {
		for (const operatorValue of Object.values(Operator)) {
			if (value === operatorValue.toString()) {
				return new FilterOperator(operatorValue);
			}
		}

		throw new InvalidArgumentError(
			`The filter operator ${value} is invalid`
		);
	}

	public isPositive(): boolean {
		return (
			this.value !== Operator.NOT_EQUAL &&
			this.value !== Operator.NOT_CONTAINS
		);
	}

	protected throwErrorForInvalidValue(value: Operator): void {
		throw new InvalidArgumentError(
			`The filter operator ${value} is invalid`
		);
	}

	static equal() {
		return this.fromValue(Operator.EQUAL);
	}
}
