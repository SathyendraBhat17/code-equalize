import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { getSupportedProgrammingLanguage } from '../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('maps all supported VS Code source language IDs', () => {
		assert.strictEqual(getSupportedProgrammingLanguage('java'), 'Java');
		assert.strictEqual(getSupportedProgrammingLanguage('python'), 'Python');
		assert.strictEqual(getSupportedProgrammingLanguage('c'), 'C');
		assert.strictEqual(getSupportedProgrammingLanguage('cpp'), 'C++');
		assert.strictEqual(getSupportedProgrammingLanguage('c++'), 'C++');
		assert.strictEqual(getSupportedProgrammingLanguage('typescript'), undefined);
	});
});
