/* eslint-disable test/no-import-node-test */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { remark } from 'remark';
import remarkParse from 'remark-parse';
import { VFile } from 'vfile';
import { getData, remarkLinksExtractor } from '../index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function createVFile(file) {
	const filePath = path.resolve(__dirname, file);
	const value = fs.readFileSync(filePath, 'utf8');
	return new VFile({ path: filePath, value });
}

function getKey(file) {
	return `test/${file.replace(/\.(?:md|mdx)$/, '')}`;
}

test('remark-link-extractor', async () => {
	await test('should extract headings from markdown', () => {
		const file = 'mock/headings.md';
		remark().use(remarkParse).use(remarkLinksExtractor, { createHeadingsSlug: true }).process(createVFile(file));
		const data = getData();
		assert.deepStrictEqual(data.headings[getKey(file)], ['heading-1', 'heading-2']);
	});

	await test('should not extract headings from markdown if no header slug creation is active', () => {
		const file = 'mock/headings.md';
		remark().use(remarkParse).use(remarkLinksExtractor, { createHeadingsSlug: false }).process(createVFile(file));
		const data = getData();
		assert.deepStrictEqual(data.headings[getKey(file)], []);
	});

	await test('should extract internal links from markdown', () => {
		const file = 'mock/internal-links.md';
		remark().use(remarkParse).use(remarkLinksExtractor).process(createVFile(file));
		const data = getData();
		assert.deepStrictEqual(data.internalLinks[getKey(file)], ['/internal']);
	});

	await test('should extract external links from markdown', () => {
		const file = 'mock/external-links.md';
		remark().use(remarkParse).use(remarkLinksExtractor).process(createVFile(file));
		const data = getData();
		assert.deepStrictEqual(data.externalLinks[getKey(file)], ['https://example.com']);
	});

	await test('should ignore draft files if astroIgnoreDraft is true', () => {
		const file = 'mock/draft.md';
		const vFile = createVFile(file);
		vFile.data = { astro: { frontmatter: { draft: true } } };

		remark().use(remarkParse).use(remarkLinksExtractor, { astroIgnoreDraft: true }).processSync(vFile);

		const data = getData();
		assert.deepStrictEqual(data.headings[getKey(file)], undefined);
	});

	await test('should use slug from frontmatter if astroUseSlug is true', () => {
		const file = 'mock/slug.md';
		const slug = 'custom-slug';
		const vFile = createVFile(file);
		vFile.data = { astro: { frontmatter: { slug } } };

		remark().use(remarkParse).use(remarkLinksExtractor, { astroUseSlug: true, createHeadingsSlug: true }).processSync(vFile);

		const data = getData();
		assert.deepStrictEqual(data.headings[slug], ['heading-1']);
	});

	await test('if no file path present it should create a filename in ordered format', () => {
		const file = 'mock/headings.md';
		const vFile = createVFile(file);
		vFile.history = [];
		remark().use(remarkParse).use(remarkLinksExtractor, { createHeadingsSlug: true }).processSync(vFile);
		remark().use(remarkParse).use(remarkLinksExtractor, { createHeadingsSlug: true }).processSync(vFile);

		const data = getData();
		assert.deepStrictEqual(data.headings['file-1'], ['heading-1', 'heading-2']);
		assert.deepStrictEqual(data.headings['file-2'], ['heading-1', 'heading-2']);
	});
});
