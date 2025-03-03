import GitHubSlugger from 'github-slugger';
import { fromHtml } from 'hast-util-from-html';
import { hasProperty } from 'hast-util-has-property';
import isAbsoluteUrl from 'is-absolute-url';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';

/**
 * @type {Record<string, string[]>}
 */
const headings = {};
/**
 * @type {Record<string, string[]>}
 */
const internalLinks = {};
/**
 * @type {Record<string, string[]>}
 */
const externalLinks = {};

/**
 * @typedef {import('mdast').Root} MdastRoot
 * @typedef {import('vfile').VFile} VFile
 * @typedef {import('mdast-util-mdx-jsx').MdxJsxAttribute} MdxJsxAttribute
 */

/**
 * @typedef {object} RemarkLinkExtractorOptions
 * @property {boolean} [astroIgnoreDraft] Whether to ignore draft files if declared in Astro frontmatter.
 * @property {boolean} [astroUseSlug] Whether to use the slug from Astro frontmatter and not the file path as the key.
 */

/**
 * @description Extracts headings, internal links, and external links from
 * a markdown or mdx file.
 * @param {RemarkLinkExtractorOptions} options
 * @returns {(tree: MdastRoot, file: VFile) => void} A function that extracts
 * headings, internal links, and external links from a markdown or mdx file.
 */
export function remarkLinksExtractor(options = {}) {
	const {
		astroIgnoreDraft = false,
		astroUseSlug = false,
	} = options;

	return function (tree, file) {
		// @ts-ignore
		if (astroIgnoreDraft && file.data.astro?.frontmatter?.draft) {
			return;
		}

		const slugger = new GitHubSlugger();
		const filePath = file.history[0] || file.path || generateRandomFileName();

		let slug;
		if (astroUseSlug) {
			// @ts-ignore
			slug = typeof file.data.astro?.frontmatter?.slug === 'string' ? file.data.astro.frontmatter.slug : undefined;
			slug = slug?.replace(/\/$/, '');
			if (!slug) {
				// @ts-ignore
				console?.warn('No slug found for file: ', filePath);
				return;
			}
		}
		else {
			const cwd = file.cwd;
			slug = filePath.replace(/\.mdx?$/, '').replace(cwd, '').replace(/^\//, '');
		}

		/**
		 * @type {string[]}
		 */
		const fileHeadings = [];
		/**
		 * @type {string[]}
		 */
		const fileInternalLinks = [];
		/**
		 * @type {string[]}
		 */
		const fileExternalLinks = [];
		const fileDefinitions = new Map();

		visit(tree, 'definition', (node) => {
			fileDefinitions.set(node.identifier, node.url);
		});

		visit(tree, ['heading', 'html', 'link', 'linkReference', 'mdxJsxFlowElement', 'mdxJsxTextElement'], (node) => {
			switch (node.type) {
				case 'heading': {
					// @ts-ignore
					if (node.data?.hProperties?.id) {
						// @ts-ignore
						fileHeadings.push(String(node.data.hProperties.id));
						break;
					}

					const content = toString(node);

					if (content.length === 0) {
						break;
					}

					fileHeadings.push(slugger.slug(content));
					break;
				}
				case 'link': {
					if (isExternalLink(node.url)) {
						fileExternalLinks.push(node.url);
					}
					else {
						fileInternalLinks.push(node.url);
					}
					break;
				}
				case 'linkReference': {
					const definition = fileDefinitions.get(node.identifier);

					if (definition && isExternalLink(definition)) {
						fileExternalLinks.push(definition);
					}
					else if (definition) {
						fileInternalLinks.push(definition);
					}

					break;
				}
				case 'mdxJsxFlowElement': {
					for (const attribute of node.attributes) {
						// @ts-ignore
						if (isMdxIdAttribute(attribute)) {
							// @ts-ignore
							fileHeadings.push(attribute.value);
						}
					}

					if (node.name !== 'a' && node.name !== 'LinkCard' && node.name !== 'LinkButton') {
						break;
					}

					for (const attribute of node.attributes) {
						if (
							attribute.type !== 'mdxJsxAttribute'
							|| attribute.name !== 'href'
							|| typeof attribute.value !== 'string'
						) {
							continue;
						}

						if (isExternalLink(attribute.value)) {
							fileExternalLinks.push(attribute.value);
						}
						else {
							fileInternalLinks.push(attribute.value);
						}
					}

					break;
				}
				case 'mdxJsxTextElement': {
					for (const attribute of node.attributes) {
						// @ts-ignore
						if (isMdxIdAttribute(attribute)) {
							// @ts-ignore
							fileHeadings.push(attribute.value);
						}
					}

					break;
				}
				case 'html': {
					const htmlTree = fromHtml(node.value, { fragment: true });

					visit(htmlTree, (htmlNode) => {
						if (hasProperty(htmlNode, 'id') && typeof htmlNode.properties.id === 'string') {
							fileHeadings.push(htmlNode.properties.id);
						}

						if (
							htmlNode.type === 'element'
							&& htmlNode.tagName === 'a'
							&& hasProperty(htmlNode, 'href')
							&& typeof htmlNode.properties.href === 'string'
							&& isExternalLink(htmlNode.properties.href)
						) {
							fileExternalLinks.push(htmlNode.properties.href);
						}
						else if (
							htmlNode.type === 'element'
							&& htmlNode.tagName === 'a'
							&& hasProperty(htmlNode, 'href')
							&& typeof htmlNode.properties.href === 'string'
						) {
							fileInternalLinks.push(htmlNode.properties.href);
						}
					});

					break;
				}
			}
		});

		headings[slug] = fileHeadings;
		internalLinks[slug] = fileInternalLinks;
		if (fileExternalLinks.length > 0) {
			externalLinks[slug] = fileExternalLinks;
		}
	};
}

/**
 * @returns {{
 * headings: Record<string, string[]>;
 * internalLinks: Record<string, string[]>;
 * externalLinks: Record<string, string[]>;
 * }} Extracted link data.
 */
export function getData() {
	return { headings, internalLinks, externalLinks };
}

/**
 *
 * @param {string} link
 * @returns {boolean} Whether the link is an external link.
 */
function isExternalLink(link) {
	if (!/^(?:http|https):\/\//.test(link)) {
		return false;
	}
	return isAbsoluteUrl(link);
}

/**
 * @param {MdxJsxAttribute} attribute
 * @returns {boolean} Whether the attribute is an MDX id attribute.
 */
function isMdxIdAttribute(attribute) {
	return attribute.name === 'id' && typeof attribute.value === 'string';
}

/**
 * @description Generates a random file name if the file name is not provided.
 * @returns {string} A random file name.
 */
function generateRandomFileName() {
	return Math.random().toString(36).substring(7);
}
