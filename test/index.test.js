/* eslint-disable test/consistent-test-it */
import fs from 'node:fs';
import path from 'node:path';
import { remark } from 'remark';
import remarkParse from 'remark-parse';
import { VFile } from 'vfile';
import { describe, expect, test } from 'vitest';
import { getData, remarkLinksExtractor } from '../index.js';

function createVFile(file) {
	const filePath = path.resolve(__dirname, file);
	const value = fs.readFileSync(filePath, 'utf8');
	return new VFile({ path: filePath, value });
}

function getKey(file) {
	return `test/${file.replace(/\.(?:md|mdx)$/, '')}`;
}

describe('remark-link-extractor', () => {
	test('should extract headings from markdown', () => {
		const file = 'mock/headings.md';
		remark().use(remarkParse).use(remarkLinksExtractor).process(createVFile(file));
		const data = getData();
		expect(data.headings[getKey(file)]).toEqual(['heading-1', 'heading-2']);
	});

	test('should extract internal links from markdown', () => {
		const file = 'mock/internal-links.md';
		remark().use(remarkParse).use(remarkLinksExtractor).process(createVFile(file));
		const data = getData();
		expect(data.internalLinks[getKey(file)]).toEqual(['/internal']);
	});

	test('should extract external links from markdown', () => {
		const file = 'mock/external-links.md';
		remark().use(remarkParse).use(remarkLinksExtractor).process(createVFile(file));
		const data = getData();
		expect(data.externalLinks[getKey(file)]).toEqual(['https://example.com']);
	});

	test('should ignore draft files if astroIgnoreDraft is true', () => {
		const file = 'mock/draft.md';
		const vFile = createVFile(file);
		vFile.data = { astro: { frontmatter: { draft: true } } };

		remark().use(remarkParse).use(remarkLinksExtractor, { astroIgnoreDraft: true }).processSync(vFile);

		const data = getData();
		expect(data.headings[getKey(file)]).toBeUndefined();
	});

	test('should use slug from frontmatter if astroUseSlug is true', () => {
		const file = 'mock/slug.md';
		const slug = 'custom-slug';
		const vFile = createVFile(file);
		vFile.data = { astro: { frontmatter: { slug } } };

		remark().use(remarkParse).use(remarkLinksExtractor, { astroUseSlug: true }).processSync(vFile);

		const data = getData();
		expect(data.headings[slug]).toEqual(['heading-1']);
	});
});
