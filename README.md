# @certible/remark-link-extractor

Remark plugin to extract internal, external, and hash links from markdown. This remark plugin is **module only** and does not support CommonJS. Ensure your project is configured to use ES modules.

We use add [certible.com](https://www.certible.com) use this to check for broken links after an automated build of our Astro site.

## Installation

```sh
npm install @certible/remark-link-extractor
```

## Usage

```javascript
import { getData, remarkLinkExtractor } from '@certible/remark-link-extractor';
import { remark } from 'remark';
import remarkParse from 'remark-parse';

const markdown = `
# Heading 1

[Internal Link](/internal)
[External Link](https://example.com)
`;

remark()
 .use(remarkParse)
 .use(remarkLinkExtractor)
 .process(markdown, (err, file) => {
  if (err)
   throw err;
  const data = getData();
  console.log(data);
 });
```

## Options

### `astroIgnoreDraft`

Type: `boolean`
Default: `false`

Whether to ignore draft files if declared in Astro frontmatter.

### `astroUseSlug`

Type: `boolean`
Default: `false`

Whether to use the slug from Astro frontmatter and not the file path as the key.

## API

### `remarkLinkExtractor(options)`

Extracts headings, internal links, and external links from a markdown or mdx file.

#### Parameters

- `options` (optional): An object containing the following properties:
  - `astroIgnoreDraft` (boolean): Whether to ignore draft files if declared in Astro frontmatter.
  - `astroUseSlug` (boolean): Whether to use the slug from Astro frontmatter and not the file path as the key.

### `getData()`

Returns the extracted link data.

#### Returns

An object containing the following properties:

- `headings`: Record of headings extracted from the markdown files.
- `internalLinks`: Record of internal links extracted from the markdown files.
- `externalLinks`: Record of external links extracted from the markdown files.##

## License

MIT License. See [LICENSE](./LICENSE) for more information.
