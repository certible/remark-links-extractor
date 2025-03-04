import GitHubSlugger from 'github-slugger';
import { fromHtml } from 'hast-util-from-html';
import { hasProperty } from 'hast-util-has-property';
import isAbsoluteUrl from 'is-absolute-url';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';

/**
 * @typedef {import('mdast').Root} MdastRoot
 * @typedef {import('vfile').VFile} VFile
 * @typedef {import('mdast-util-mdx-jsx').MdxJsxAttribute} MdxJsxAttribute
 * @typedef {import('mdast').Heading} Heading
 * @typedef {import('mdast').Link} Link
 * @typedef {import('mdast').LinkReference} LinkReference
 * @typedef {import('mdast').Html} HTML
 * @typedef {import('mdast-util-mdx-jsx').MdxJsxFlowElement} MdxJsxFlowElement
 * @typedef {import('mdast-util-mdx-jsx').MdxJsxTextElement} MdxJsxTextElement
 * @typedef {import('hast').Element} HastElement
 */

/**
 * @typedef {Record<string, string[]>} Result
 */

/**
 * @typedef {object} RemarkLinksExtractorOptions
 * @property {boolean} [astroIgnoreDraft] Whether to ignore draft files if declared in Astro frontmatter.
 * @property {boolean} [astroUseSlug] Whether to use the slug from Astro frontmatter and not the file path as the key.
 * @property {boolean} [createHeadingsSlug] Whether to automatically create a slug for headings if the heading does not have an id.
 * @property {boolean} [resetDataOnRun] Whether to reset the data collections before processing a new file.
 */

/** @type {Result} */
let headings = {};
/** @type {Result} */
let internalLinks = {};
/** @type {Result} */
let externalLinks = {};

/**
 * @description Extracts headings, internal links, and external links from
 * a markdown or mdx file.
 * @param {RemarkLinksExtractorOptions} options
 * @returns {(tree: MdastRoot, file: VFile) => void} A function that extracts
 * headings, internal links, and external links from a markdown or mdx file.
 */
export function remarkLinksExtractor(options = {}) {
	const {
		astroIgnoreDraft = false,
		astroUseSlug = false,
		createHeadingsSlug = false,
		resetDataOnRun = false,
	} = options;

	// Reset data if specified
	if (resetDataOnRun) {
		headings = {};
		internalLinks = {};
		externalLinks = {};
	}

	return function (tree, file) {
		// @ts-ignore
		if (astroIgnoreDraft && file.data?.astro?.frontmatter?.draft) {
			return;
		}

		const slugger = new GitHubSlugger();
		const filePath = file.history[0] || file.path || createFilename();

		const slug = getSlugFromFile(file, filePath, astroUseSlug);
		if (!slug)
			return;
		/** @type []string */
		const fileHeadings = [];
		/** @type []string */
		const fileInternalLinks = [];
		/** @type []string */
		const fileExternalLinks = [];
		const fileDefinitions = new Map();

		// Process definitions first
		visit(tree, 'definition', (node) => {
			fileDefinitions.set(node.identifier, node.url);
		});

		// Process other node types
		visit(tree, ['heading', 'html', 'link', 'linkReference', 'mdxJsxFlowElement', 'mdxJsxTextElement'], (node) => {
			switch (node.type) {
				case 'heading':
					processHeading(node, fileHeadings, slugger, createHeadingsSlug);
					break;
				case 'link':
					processLink(node, fileInternalLinks, fileExternalLinks);
					break;
				case 'linkReference':
					processLinkReference(node, fileDefinitions, fileInternalLinks, fileExternalLinks);
					break;
				case 'mdxJsxFlowElement':
					processMdxJsxFlowElement(node, fileHeadings, fileInternalLinks, fileExternalLinks);
					break;
				case 'mdxJsxTextElement':
					processMdxJsxTextElement(node, fileHeadings);
					break;
				case 'html':
					processHtml(node, fileHeadings, fileInternalLinks, fileExternalLinks);
					break;
			}
		});

		// Store results
		headings[slug] = fileHeadings;
		internalLinks[slug] = fileInternalLinks;
		if (fileExternalLinks.length > 0) {
			externalLinks[slug] = fileExternalLinks;
		}
	};
}

/**
 * @returns {{
 * headings: Result;
 * internalLinks: Result;
 * externalLinks: Result;
 * }} Extracted link data.
 */
export function getData() {
	return {
		headings: { ...headings },
		internalLinks: { ...internalLinks },
		externalLinks: { ...externalLinks },
	};
}

/**
 * @description Resets the collected data.
 */
export function resetData() {
	headings = {};
	internalLinks = {};
	externalLinks = {};
}

/**
 * @param {string} link
 * @returns {boolean} Whether the link is an external link.
 */
function isExternalLink(link) {
	return /^(?:http|https):\/\//.test(link) && isAbsoluteUrl(link);
}

/**
 * @param {MdxJsxAttribute} attribute
 * @returns {boolean} Whether the attribute is an MDX id attribute.
 */
function isMdxIdAttribute(attribute) {
	return attribute.name === 'id' && typeof attribute.value === 'string';
}

let fileNameCounter = 0;
/**
 * @description Generates a ordered filename.
 * @returns {string} A filename in style of `file-1`, `file-2`, etc.
 */
function createFilename() {
	return `file-${++fileNameCounter}`;
}

/**
 * @description Get slug from file based on configuration
 * @param {VFile} file - The file being processed
 * @param {string} filePath - Path to the file
 * @param {boolean} useAstroSlug - Whether to use Astro frontmatter slug
 * @returns {string|undefined} The slug or undefined if not found
 */
function getSlugFromFile(file, filePath, useAstroSlug) {
	if (useAstroSlug) {
		// @ts-ignore
		const slug = typeof file.data?.astro?.frontmatter?.slug === 'string'
			// @ts-ignore
			? file.data.astro.frontmatter.slug
			: undefined;

		const cleanSlug = slug?.replace(/\/$/, '');

		if (!cleanSlug) {
			console.warn('No slug found for file:', filePath);
			return undefined;
		}

		return cleanSlug;
	}
	else {
		const cwd = file.cwd;
		return filePath.replace(/\.mdx?$/, '').replace(cwd, '').replace(/^\//, '');
	}
}

/**
 * @description Process heading nodes
 * @param {Heading} node - The heading node
 * @param {string[]} fileHeadings - Collection of headings
 * @param {GitHubSlugger} slugger - Slugger instance
 * @param {boolean} createHeadingsSlug - Whether to create slugs for headings
 */
function processHeading(node, fileHeadings, slugger, createHeadingsSlug) {
	// @ts-ignore
	if (node.data?.hProperties?.id) {
		// @ts-ignore
		fileHeadings.push(String(node.data.hProperties.id));
		return;
	}

	const content = toString(node);
	if (content.length === 0)
		return;

	if (createHeadingsSlug) {
		fileHeadings.push(slugger.slug(content));
	}
}

/**
 * @description Process link nodes
 * @param {Link} node - The link node
 * @param {string[]} internalLinks - Collection of internal links
 * @param {string[]} externalLinks - Collection of external links
 */
function processLink(node, internalLinks, externalLinks) {
	if (isExternalLink(node.url)) {
		externalLinks.push(node.url);
	}
	else {
		internalLinks.push(node.url);
	}
}

/**
 * @description Process link reference nodes
 * @param {LinkReference} node - The link reference node
 * @param {Map<string, string>} definitions - Map of definitions
 * @param {string[]} internalLinks - Collection of internal links
 * @param {string[]} externalLinks - Collection of external links
 */
function processLinkReference(node, definitions, internalLinks, externalLinks) {
	const definition = definitions.get(node.identifier);

	if (!definition)
		return;

	if (isExternalLink(definition)) {
		externalLinks.push(definition);
	}
	else {
		internalLinks.push(definition);
	}
}

/**
 * @description Process MDX JSX flow elements
 * @param {MdxJsxFlowElement} node - The MDX JSX flow element node
 * @param {string[]} headings - Collection of headings
 * @param {string[]} internalLinks - Collection of internal links
 * @param {string[]} externalLinks - Collection of external links
 */
function processMdxJsxFlowElement(node, headings, internalLinks, externalLinks) {
	for (const attribute of node.attributes) {
		// @ts-ignore
		if (isMdxIdAttribute(attribute)) {
			// @ts-ignore
			headings.push(attribute.value);
		}
	}

	if (node.name !== 'a' && node.name !== 'LinkCard' && node.name !== 'LinkButton') {
		return;
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
			externalLinks.push(attribute.value);
		}
		else {
			internalLinks.push(attribute.value);
		}
	}
}

/**
 * @description Process MDX JSX text elements
 * @param {MdxJsxTextElement} node - The MDX JSX text element node
 * @param {string[]} headings - Collection of headings
 */
function processMdxJsxTextElement(node, headings) {
	for (const attribute of node.attributes) {
		// @ts-ignore
		if (isMdxIdAttribute(attribute)) {
			// @ts-ignore
			headings.push(attribute.value);
		}
	}
}

/**
 * @description Process HTML nodes
 * @param {HTML} node - The HTML node
 * @param {string[]} headings - Collection of headings
 * @param {string[]} internalLinks - Collection of internal links
 * @param {string[]} externalLinks - Collection of external links
 */
function processHtml(node, headings, internalLinks, externalLinks) {
	const htmlTree = fromHtml(node.value, { fragment: true });

	visit(htmlTree, (htmlNode) => {
		if (hasProperty(htmlNode, 'id') && typeof htmlNode.properties.id === 'string') {
			headings.push(htmlNode.properties.id);
		}

		if (
			htmlNode.type === 'element'
			&& htmlNode.tagName === 'a'
			&& hasProperty(htmlNode, 'href')
			&& typeof htmlNode.properties.href === 'string'
		) {
			if (isExternalLink(htmlNode.properties.href)) {
				externalLinks.push(htmlNode.properties.href);
			}
			else {
				internalLinks.push(htmlNode.properties.href);
			}
		}
	});
}
