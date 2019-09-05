import 'mocha';
import 'reflect-metadata';
import { expect } from 'chai';
import { Default, Prop } from '@wssz/modeler';
import { ItemsParse, Parse } from '../src/decorators';
import { parse } from '../src/parser';

class OtherClass {
	@Prop()
	pDate: Date;
}

class TestClass {
	@Prop()
	pDate: Date;

	@Prop()
	pString: string;

	@Prop()
	@Default(() => new Date(0))
	pDefault: Date;

	@Prop(OtherClass)
	pOther: OtherClass;

	pInvisible: number;

	@Prop()
	@Parse((v, k, s) => v * 2)
	pParse: number;

	@Prop()
	pArray: number[];

	@Prop([[Date]])
	pArrayDate: Date[][];

	@Prop([[]])
	@ItemsParse((v, i, k, s) => v * 2)
	pArrayParse: number[][];

	@Prop()
	@ItemsParse((v, i, k, s) => v * 2)
	pArrayParse2: number[];
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
			pArrayDate: [[new Date(date)]],
			pArrayParse: [[1], [4]],
			pArrayParse2: [1, 4]
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
			pArrayDate: [[new Date(date)]],
			pArrayParse: [[2], [8]],
			pArrayParse2: [2, 8]
		});

		it('should parse', () => {
			expect(parse(TestClass, input)).to.eql(output);
		});
	});
});