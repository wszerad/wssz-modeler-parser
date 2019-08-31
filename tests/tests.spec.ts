import 'mocha';
import 'reflect-metadata';
import { expect } from 'chai';
import { Default, Type, Items } from '@wssz/modeler';
import { ItemsParse, Parse } from '../src/decorators';
import { parse } from '../src/parser';

class OtherClass {
	@Type()
	pDate: Date;
}

class TestClass {
	@Type()
	pDate: Date;

	@Type()
	pString: string;

	@Default(() => new Date(0))
	pDefault: Date;

	@Type(OtherClass)
	pOther: OtherClass;

	pInvisible: number;

	@Parse((v, k, s) => v * 2)
	pParse: number;

	@Items()
	pArray: number[];

	@Items(Date)
	pArrayDate: Date[];

	@ItemsParse((v, i, k, s) => v * 2)
	pArrayParse: number;
}

describe('tests', () => {
	describe('parser', () => {
		const date = new Date();
		const input = JSON.parse(JSON.stringify({
			pDate: new Date(date),
			pString: 'kot',
			pOther: {
				pDate: new Date(date)
			},
			pInvisible: 5,
			pParse: 10,
			pArray: [4],
			pArrayDate: [new Date(date)],
			pArrayParse: [1, 4]
		}));
		const output = Object.assign(new TestClass(), {
			pDate: new Date(date),
			pString: 'kot',
			pOther: Object.assign(new OtherClass(), {
				pDate: new Date(date)
			}),
			pDefault: new Date(0),
			pParse: 20,
			pArray: [4],
			pArrayDate: [new Date(date)],
			pArrayParse: [2, 8]
		});

		it('should parse', () => {
			expect(parse(TestClass, input)).to.eql(output);
		});
	});
});